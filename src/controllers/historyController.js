const { AnalysisHistory } = require('../models');

const renderHistory = async (req, res) => {
  try {
    const historyItems = await AnalysisHistory.findAll({
      where: { user_id: req.session.user.id },
      order: [['timestamp', 'DESC']]
    });

    return res.render('history', {
      pageTitle: 'Analysis History - ViperLens',
      historyItems,
      user: req.session.user,
      error: null
    });
  } catch (error) {
    console.error(`[HISTORY] Failed to load history: ${error.message}`);
    return res.status(500).render('history', {
      pageTitle: 'Analysis History - ViperLens',
      historyItems: [],
      user: req.session.user,
      error: 'Failed to load analysis history.'
    });
  }
};

const viewHistoryReport = async (req, res) => {
  try {
    const historyRecord = await AnalysisHistory.findOne({
      where: {
        id: req.params.id,
        user_id: req.session.user.id
      }
    });

    if (!historyRecord) {
      return res.status(404).render('index', {
        pageTitle: 'Malware Analysis Platform',
        result: null,
        error: 'Scan record not found.',
        aiReport: null,
        isFreeTier: req.session.user.tier !== 'premium',
        user: req.session.user
      });
    }

    const report = JSON.parse(historyRecord.report_json);

    return res.render('index', {
      pageTitle: 'Malware Analysis Platform',
      result: report.result,
      aiReport: report.aiReport || null,
      error: null,
      isFreeTier: req.session.user.tier !== 'premium',
      user: req.session.user
    });
  } catch (error) {
    console.error(`[HISTORY] Failed to open report: ${error.message}`);
    return res.status(500).render('index', {
      pageTitle: 'Malware Analysis Platform',
      result: null,
      aiReport: null,
      error: 'Failed to open selected report.',
      isFreeTier: req.session.user.tier !== 'premium',
      user: req.session.user
    });
  }
};

const deleteHistoryRecord = async (req, res) => {
  try {
    const deleted = await AnalysisHistory.destroy({
      where: {
        id: req.params.id,
        user_id: req.session.user.id
      }
    });

    if (!deleted) {
      return res.status(404).render('history', {
        pageTitle: 'Analysis History - ViperLens',
        historyItems: [],
        user: req.session.user,
        error: 'Record not found or already deleted.'
      });
    }

    return res.redirect('/history');
  } catch (error) {
    console.error(`[HISTORY] Failed to delete record: ${error.message}`);
    return res.status(500).redirect('/history');
  }
};

module.exports = {
  renderHistory,
  viewHistoryReport,
  deleteHistoryRecord
};
