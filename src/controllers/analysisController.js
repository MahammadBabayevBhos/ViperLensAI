const path = require('path');
const { runPythonAnalysis } = require('../services/pythonBridgeService');
const { generateGeminiAdvice, generateComparativeGeminiAdvice } = require('../services/geminiService');
const { buildIncidentReportPdf } = require('../services/pdfReportService');
const { submitFile, waitForReport } = require('../services/sandboxService');
const { normalizeSandboxReport } = require('../services/sandboxAdapter');
const { AnalysisHistory } = require('../models');

const AUTO_DEEP_ANALYSIS = process.env.AUTO_DEEP_ANALYSIS === 'true';

const parsePayload = (payload) => {
  if (!payload) {
    throw new Error('Missing analysis payload.');
  }
  return JSON.parse(payload);
};

const isHighRisk = (analysis = {}) => {
  const prediction = analysis.prediction || {};
  const entropy = analysis.entropy || {};
  const confidence = Number(prediction.confidence || 0);
  const malicious = (prediction.label || analysis.verdict || '').toString().toLowerCase() === 'malicious';
  return malicious || confidence >= 0.85 || Boolean(entropy.packing_alert);
};

const buildHistoryPayload = (result, aiReport = null) => ({ result, aiReport });

const saveAnalysisRecord = async ({ userId, result, aiReport, status = 'completed' }) => {
  const verdict = (
    (result.analysis && result.analysis.prediction && result.analysis.prediction.label) ||
    (result.analysis && result.analysis.verdict) ||
    'unknown'
  )
    .toString()
    .toLowerCase();
  const confidence = Number(
    (result.analysis && result.analysis.prediction && result.analysis.prediction.confidence) || 0
  );

  const record = await AnalysisHistory.create({
    user_id: userId,
    file_name: result.fileName || 'unknown-file',
    verdict,
    confidence,
    status,
    timestamp: new Date(),
    report_json: JSON.stringify(buildHistoryPayload(result, aiReport))
  });

  return record;
};

const updateAnalysisRecord = async ({ recordId, userId, result, aiReport, status = 'completed' }) => {
  if (!recordId) {
    return null;
  }
  const record = await AnalysisHistory.findOne({
    where: { id: recordId, user_id: userId }
  });
  if (!record) {
    return null;
  }
  record.status = status;
  record.report_json = JSON.stringify(buildHistoryPayload(result, aiReport));
  record.verdict = (
    (result.analysis && result.analysis.prediction && result.analysis.prediction.label) ||
    (result.analysis && result.analysis.verdict) ||
    record.verdict
  )
    .toString()
    .toLowerCase();
  record.confidence = Number(
    (result.analysis && result.analysis.prediction && result.analysis.prediction.confidence) || record.confidence
  );
  await record.save();
  return record;
};

const renderHome = (req, res) => {
  const userTier = ((req.session && req.session.user && req.session.user.tier) || 'free').toLowerCase();
  return res.render('index', {
    pageTitle: 'Malware Analysis Platform',
    result: null,
    error: null,
    aiReport: null,
    isFreeTier: userTier !== 'premium',
    user: req.session.user
  });
};

const handleUploadAndAnalyze = async (req, res) => {
  if (!req.file) {
    return res.status(400).render('index', {
      pageTitle: 'Malware Analysis Platform',
      result: null,
      error: 'No file uploaded. Please provide an executable file.',
      aiReport: null,
      isFreeTier: req.session.user.tier !== 'premium',
      user: req.session.user
    });
  }

  console.log(`[UPLOAD] Received file: ${req.file.filename}`);

  try {
    const normalizedPath = path.resolve(req.file.path);
    console.log(`[ANALYSIS] Running Python scanner for ${normalizedPath}`);

    const analysis = await runPythonAnalysis(normalizedPath);
    let aiReport = null;

    const userTier = ((req.session && req.session.user && req.session.user.tier) || 'free').toLowerCase();
    if (AUTO_DEEP_ANALYSIS && userTier === 'premium' && isHighRisk(analysis)) {
      console.log(`[PREMIUM] Auto Deep AI Analysis triggered for ${req.file.filename}`);
      try {
        aiReport = await generateGeminiAdvice(analysis);
      } catch (aiError) {
        console.error(`[PREMIUM] Auto AI analysis failed: ${aiError.message}`);
      }
    }

    console.log(`[ANALYSIS] Completed successfully for ${req.file.filename}`);

    const resultPayload = {
      fileName: req.file.originalname,
      storedAs: req.file.filename,
      fileSizeKB: (req.file.size / 1024).toFixed(2),
      analysis
    };
    const historyRecord = await saveAnalysisRecord({
      userId: req.session.user.id,
      result: resultPayload,
      aiReport
    });

    return res.status(200).render('index', {
      pageTitle: 'Malware Analysis Platform',
      result: { ...resultPayload, historyId: historyRecord.id },
      error: null,
      aiReport,
      isFreeTier: userTier !== 'premium',
      user: req.session.user
    });
  } catch (error) {
    console.error(`[ANALYSIS] Failed for ${req.file.filename}: ${error.message}`);

    return res.status(500).render('index', {
      pageTitle: 'Malware Analysis Platform',
      result: null,
      error: `Analysis failed: ${error.message}`,
      aiReport: null,
      isFreeTier: req.session.user.tier !== 'premium',
      user: req.session.user
    });
  }
};

const handleDeepAiAnalysis = async (req, res) => {
  try {
    const result = parsePayload(req.body.resultPayload);
    const staticAnalysis = result.analysis || {};
    const historyId = result.historyId || null;

    console.log(`[PREMIUM] Deep AI pipeline started for ${result.storedAs || 'unknown-file'}`);
    console.log('[SANDBOX] Submitting file to Joe Sandbox');
    const filePath = path.resolve(__dirname, '../../uploads', result.storedAs);
    const submissionId = await submitFile(filePath);
    console.log(`[SANDBOX] Submission created: ${submissionId}`);

    console.log('[SANDBOX] Polling Joe Sandbox for completion');
    const sandboxReport = await waitForReport(submissionId);
    const normalizedSandboxReport = normalizeSandboxReport(sandboxReport);
    console.log(`[SANDBOX] Report received for submission ${submissionId}`);

    const combinedIntelligence = {
      static_analysis: staticAnalysis,
      dynamic_analysis: normalizedSandboxReport
    };
    const updatedResult = {
      ...result,
      combinedIntelligence
    };
    const aiReport = await generateComparativeGeminiAdvice({
      staticAnalysis,
      dynamicAnalysis: normalizedSandboxReport
    });
    await updateAnalysisRecord({
      recordId: historyId,
      userId: req.session.user.id,
      result: updatedResult,
      aiReport
    });

    console.log('[PREMIUM] Deep AI pipeline completed');

    return res.status(200).render('index', {
      pageTitle: 'Malware Analysis Platform',
      result: updatedResult,
      aiReport,
      error: null,
      isFreeTier: req.session.user.tier !== 'premium',
      user: req.session.user
    });
  } catch (error) {
    console.error(`[PREMIUM] Deep AI Analysis failed: ${error.message}`);
    return res.status(500).render('index', {
      pageTitle: 'Malware Analysis Platform',
      result: null,
      aiReport: null,
      error: `Deep AI Analysis failed: ${error.message}`,
      isFreeTier: req.session.user.tier !== 'premium',
      user: req.session.user
    });
  }
};

const handlePdfDownload = async (req, res) => {
  try {
    const result = parsePayload(req.body.resultPayload);
    const aiReport = req.body.aiReportPayload ? parsePayload(req.body.aiReportPayload) : null;

    console.log(`[PREMIUM] Building PDF report for ${result.storedAs || 'unknown-file'}`);
    const pdfBuffer = await buildIncidentReportPdf({ result, aiReport });
    const reportName = `${(result.storedAs || 'analysis-report').replace('.exe', '')}-incident-report.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${reportName}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error(`[PREMIUM] PDF generation failed: ${error.message}`);
    return res.status(500).render('index', {
      pageTitle: 'Malware Analysis Platform',
      result: null,
      aiReport: null,
      error: `PDF generation failed: ${error.message}`,
      isFreeTier: req.session.user.tier !== 'premium',
      user: req.session.user
    });
  }
};

module.exports = {
  renderHome,
  handleUploadAndAnalyze,
  handleDeepAiAnalysis,
  handlePdfDownload
};
