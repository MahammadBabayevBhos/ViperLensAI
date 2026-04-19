const path = require('path');
const { UPLOADS_DIR } = require('../config/paths');
const { runPythonAnalysis } = require('../services/pythonBridgeService');
const { generateGeminiAdvice, generateComparativeGeminiAdvice } = require('../services/geminiService');
const { buildIncidentReportPdf } = require('../services/pdfReportService');
const { submitFile, waitForReport } = require('../services/sandboxService');
const { normalizeSandboxReport } = require('../services/sandboxAdapter');
const { AnalysisHistory } = require('../models');
const { extractMalwareFamily } = require('../utils/analysisHelpers');

const AUTO_DEEP_ANALYSIS = process.env.AUTO_DEEP_ANALYSIS === 'true';
const PIPELINE_STATUS_TTL_MS = 30 * 60 * 1000;
const pipelineStatusStore = new Map();

const createStageState = () => ({
  static: 'pending',
  dynamic: 'pending',
  ai: 'pending'
});

const upsertPipelineStatus = (pipelineId, patch = {}) => {
  if (!pipelineId) {
    return;
  }
  const current = pipelineStatusStore.get(pipelineId) || {
    stages: createStageState(),
    overall: 'pending',
    error: null,
    updatedAt: Date.now()
  };
  const merged = {
    ...current,
    ...patch,
    stages: {
      ...current.stages,
      ...(patch.stages || {})
    },
    updatedAt: Date.now()
  };
  pipelineStatusStore.set(pipelineId, merged);
};

const getPipelineStatus = (pipelineId) => {
  const status = pipelineStatusStore.get(pipelineId);
  if (!status) {
    return null;
  }
  if (Date.now() - status.updatedAt > PIPELINE_STATUS_TTL_MS) {
    pipelineStatusStore.delete(pipelineId);
    return null;
  }
  return status;
};

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

  const analysisBlock = (result && result.analysis) || {};
  const malware_family = extractMalwareFamily(analysisBlock);

  const record = await AnalysisHistory.create({
    user_id: userId,
    file_name: result.fileName || 'unknown-file',
    verdict,
    confidence,
    status,
    timestamp: new Date(),
    report_json: JSON.stringify(buildHistoryPayload(result, aiReport)),
    malware_family
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
  record.malware_family = extractMalwareFamily((result && result.analysis) || {});
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

const getPipelineStatusById = (req, res) => {
  const pipelineId = (req.params.pipelineId || '').trim();
  const status = getPipelineStatus(pipelineId);
  if (!status) {
    return res.status(404).json({ error: 'Pipeline status not found.' });
  }
  return res.status(200).json(status);
};

const handleUploadAndAnalyze = async (req, res) => {
  const pipelineId = (req.body.pipelineId || '').trim();

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
    upsertPipelineStatus(pipelineId, {
      overall: 'running',
      error: null,
      stages: {
        static: 'running',
        dynamic: 'pending',
        ai: 'pending'
      }
    });

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
    upsertPipelineStatus(pipelineId, {
      overall: 'completed',
      stages: {
        static: 'completed'
      }
    });

    const renderedResult = { ...resultPayload, historyId: historyRecord.id };

    if (req.xhr || req.headers.accept === 'application/json') {
      return res.render(
        'index',
        {
          pageTitle: 'Malware Analysis Platform',
          result: renderedResult,
          error: null,
          aiReport,
          isFreeTier: userTier !== 'premium',
          user: req.session.user
        },
        (renderError, html) => {
          if (renderError) {
            return res.status(500).json({
              ok: false,
              error: `View rendering failed: ${renderError.message}`
            });
          }
          return res.status(200).json({
            ok: true,
            html
          });
        }
      );
    }

    return res.status(200).render('index', {
      pageTitle: 'Malware Analysis Platform',
      result: renderedResult,
      error: null,
      aiReport,
      isFreeTier: userTier !== 'premium',
      user: req.session.user
    });
  } catch (error) {
    upsertPipelineStatus(pipelineId, {
      overall: 'failed',
      error: error.message,
      stages: {
        static: 'failed'
      }
    });
    console.error(`[ANALYSIS] Failed for ${req.file.filename}: ${error.message}`);

    if (req.xhr || req.headers.accept === 'application/json') {
      return res.status(500).json({
        ok: false,
        error: `Analysis failed: ${error.message}`
      });
    }

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
  const pipelineId = (req.body.pipelineId || '').trim();

  try {
    upsertPipelineStatus(pipelineId, {
      overall: 'running',
      error: null,
      stages: {
        static: 'completed',
        dynamic: 'running',
        ai: 'pending'
      }
    });

    const result = parsePayload(req.body.resultPayload);
    const staticAnalysis = result.analysis || {};
    const historyId = result.historyId || null;

    console.log(`[PREMIUM] Deep AI pipeline started for ${result.storedAs || 'unknown-file'}`);
    console.log('[FALCON] Submitting file to Falcon Sandbox (Hybrid Analysis)');
    const filePath = path.resolve(UPLOADS_DIR, result.storedAs);
    const submissionId = await submitFile(filePath);
    console.log(`[FALCON] Submission created: ${submissionId}`);

    console.log('[FALCON] Polling Falcon Sandbox /check-state endpoint for completion');
    const sandboxReport = await waitForReport(submissionId);
    const normalizedSandboxReport = normalizeSandboxReport(sandboxReport);
    console.log(`[FALCON] Summary report received for submission ${submissionId}`);
    upsertPipelineStatus(pipelineId, {
      stages: {
        dynamic: 'completed',
        ai: 'running'
      }
    });

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
    upsertPipelineStatus(pipelineId, {
      overall: 'completed',
      stages: {
        ai: 'completed'
      }
    });

    console.log('[PREMIUM] Deep AI pipeline completed');
    if (req.xhr || req.headers.accept === 'application/json') {
      return res.render(
        'index',
        {
          pageTitle: 'Malware Analysis Platform',
          result: updatedResult,
          aiReport,
          error: null,
          isFreeTier: req.session.user.tier !== 'premium',
          user: req.session.user
        },
        (renderError, html) => {
          if (renderError) {
            return res.status(500).json({
              ok: false,
              error: `View rendering failed: ${renderError.message}`
            });
          }
          return res.status(200).json({
            ok: true,
            html
          });
        }
      );
    }
    return res.status(200).render('index', {
      pageTitle: 'Malware Analysis Platform',
      result: updatedResult,
      aiReport,
      error: null,
      isFreeTier: req.session.user.tier !== 'premium',
      user: req.session.user
    });
  } catch (error) {
    upsertPipelineStatus(pipelineId, {
      overall: 'failed',
      error: error.message,
      stages: {
        dynamic: 'failed',
        ai: 'failed'
      }
    });
    console.error(`[PREMIUM] Deep AI Analysis failed: ${error.message}`);
    if (req.xhr || req.headers.accept === 'application/json') {
      return res.status(500).json({
        ok: false,
        error: `Deep AI Analysis failed: ${error.message}`
      });
    }
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
  getPipelineStatusById,
  handleUploadAndAnalyze,
  handleDeepAiAnalysis,
  handlePdfDownload
};
