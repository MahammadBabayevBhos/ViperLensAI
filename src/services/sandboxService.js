const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const JOE_SANDBOX_API_URL = process.env.JOE_SANDBOX_API_URL || '';
const JOE_SANDBOX_API_KEY = process.env.JOE_SANDBOX_API_KEY || '';
const SANDBOX_POLL_INTERVAL_MS = Number(process.env.SANDBOX_POLL_INTERVAL_MS || 20000);
const SANDBOX_MAX_WAIT_MS = Number(process.env.SANDBOX_MAX_WAIT_MS || 240000);
const SANDBOX_REQUEST_TIMEOUT_MS = Number(process.env.SANDBOX_REQUEST_TIMEOUT_MS || 30000);

const assertSandboxConfig = () => {
  if (!JOE_SANDBOX_API_URL || !JOE_SANDBOX_API_KEY) {
    throw new Error('Joe Sandbox configuration is missing. Set JOE_SANDBOX_API_URL and JOE_SANDBOX_API_KEY.');
  }
};

const submitFile = async (filePath) => {
  assertSandboxConfig();
  const form = new FormData();
  form.append('apikey', JOE_SANDBOX_API_KEY);
  form.append('sample', fs.createReadStream(filePath));

  const endpoint = `${JOE_SANDBOX_API_URL.replace(/\/$/, '')}/submit`;
  const response = await axios.post(endpoint, form, {
    headers: form.getHeaders(),
    timeout: SANDBOX_REQUEST_TIMEOUT_MS
  });

  const data = response.data || {};
  const submissionId = data.submission_id || data.webid || data.id;
  if (!submissionId) {
    throw new Error('Joe Sandbox did not return a submission id.');
  }
  return submissionId;
};

const getReport = async (submissionId) => {
  assertSandboxConfig();
  const endpoint = `${JOE_SANDBOX_API_URL.replace(/\/$/, '')}/analysis/${submissionId}`;
  const response = await axios.get(endpoint, {
    params: { apikey: JOE_SANDBOX_API_KEY },
    timeout: SANDBOX_REQUEST_TIMEOUT_MS
  });
  return response.data || {};
};

const waitForReport = async (submissionId) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < SANDBOX_MAX_WAIT_MS) {
    const report = await getReport(submissionId);
    const status = (report.status || report.analysis_status || '').toString().toLowerCase();
    if (['finished', 'complete', 'completed', 'done'].includes(status)) {
      return report;
    }
    await new Promise((resolve) => setTimeout(resolve, SANDBOX_POLL_INTERVAL_MS));
  }
  throw new Error(`Joe Sandbox analysis timed out after ${SANDBOX_MAX_WAIT_MS}ms`);
};

module.exports = {
  submitFile,
  getReport,
  waitForReport
};
