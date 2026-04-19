const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const DEFAULT_HYBRID_BASE = 'https://hybrid-analysis.com/api/v2';

/**
 * Normalize HYBRID_ANALYSIS_API_URL so we never double-append /api/v2 or /submit/file.
 */
const normalizeHybridAnalysisBaseUrl = (raw) => {
  let base = String(raw || DEFAULT_HYBRID_BASE).trim();
  base = base.replace(/\/+$/, '');
  base = base.replace(/\/submit\/file$/i, '');
  while (/\/api\/v2\/api\/v2$/i.test(base)) {
    base = base.replace(/\/api\/v2\/api\/v2$/i, '/api/v2');
  }
  return base;
};

const HYBRID_ANALYSIS_BASE_URL = normalizeHybridAnalysisBaseUrl(process.env.HYBRID_ANALYSIS_API_URL);

const rawEnvId = (process.env.HYBRID_ANALYSIS_ENVIRONMENT_ID || '').trim();
/** HA V2 accepts numeric environment ids; multipart fields are strings — normalize digits-only to plain string. */
const HYBRID_ANALYSIS_ENVIRONMENT_ID =
  rawEnvId && /^\d+$/.test(rawEnvId) ? String(parseInt(rawEnvId, 10)) : rawEnvId;

const HYBRID_ANALYSIS_API_KEY = (process.env.HYBRID_ANALYSIS_API_KEY || '').trim();
const SANDBOX_POLL_INTERVAL_MS = 15000;
const SANDBOX_MAX_WAIT_MS = Number(process.env.SANDBOX_MAX_WAIT_MS || 300000);
const SANDBOX_REQUEST_TIMEOUT_MS = Number(process.env.SANDBOX_REQUEST_TIMEOUT_MS || 30000);

const STATUS_SUCCESS = 'SUCCESS';
const FAILURE_STATES = new Set(['ERROR', 'FAILED', 'FAILURE', 'TIMEOUT', 'CANCELED', 'CANCELLED']);

const formatHybridAnalysisAxiosError = (error, label) => {
  const cfg = error.config || {};
  const method = (cfg.method || 'get').toUpperCase();
  const url = cfg.url || '';
  const status = error.response && error.response.status;
  const data = error.response && error.response.data;
  const detail =
    data != null && typeof data === 'object' ? JSON.stringify(data) : data != null ? String(data) : '';
  const detailClip = detail.length > 900 ? `${detail.slice(0, 900)}…` : detail;
  const tail = status ? `HTTP ${status}${detailClip ? `: ${detailClip}` : ''}` : error.message;
  return new Error(`${label} (${method} ${url}) — ${tail}`);
};

const assertSandboxConfig = () => {
  if (!HYBRID_ANALYSIS_API_KEY) {
    throw new Error('Hybrid Analysis API key is missing. Set HYBRID_ANALYSIS_API_KEY.');
  }
  if (!HYBRID_ANALYSIS_ENVIRONMENT_ID) {
    throw new Error('Hybrid Analysis environment_id is missing. Set HYBRID_ANALYSIS_ENVIRONMENT_ID (e.g. 160).');
  }
};

/**
 * Hybrid Analysis requires the `api-key` header (not Authorization). Merge multipart headers last
 * so Content-Type/boundary from FormData never overwrite `api-key`.
 */
const buildHeaders = (extraHeaders = {}) => ({
  'User-Agent': 'FalconSandboxIntegration/1.0',
  ...extraHeaders,
  'api-key': HYBRID_ANALYSIS_API_KEY
});

const joinApiUrl = (pathSuffix) => {
  const path = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`;
  return `${HYBRID_ANALYSIS_BASE_URL}${path}`;
};

/**
 * Report endpoints accept id as job_id or "sha256:environmentId". Prefer job_id from submit response.
 */
const extractJobId = (payload = {}) => {
  if (payload.job_id != null && String(payload.job_id).trim()) {
    return String(payload.job_id).trim();
  }
  if (payload.jobId != null && String(payload.jobId).trim()) {
    return String(payload.jobId).trim();
  }
  if (payload.sha256 && payload.environment_id != null) {
    return `${payload.sha256}:${payload.environment_id}`;
  }
  if (payload.analysis_id != null && String(payload.analysis_id).trim()) {
    return String(payload.analysis_id).trim();
  }
  if (payload.submission_id != null && String(payload.submission_id).trim()) {
    return String(payload.submission_id).trim();
  }
  if (payload.id != null && String(payload.id).trim()) {
    return String(payload.id).trim();
  }
  if (payload.sha256) {
    return String(payload.sha256).trim();
  }
  return null;
};

const submitFile = async (filePath) => {
  assertSandboxConfig();
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('environment_id', HYBRID_ANALYSIS_ENVIRONMENT_ID);

  const submitUrl = joinApiUrl('/submit/file');
  console.log(`[FALCON] Hybrid Analysis POST (full URL): ${submitUrl}`);
  console.log(
    `[FALCON] environment_id=${HYBRID_ANALYSIS_ENVIRONMENT_ID} (api-key header: ${HYBRID_ANALYSIS_API_KEY ? 'set' : 'missing'})`
  );

  let response;
  try {
    response = await axios.post(submitUrl, form, {
      headers: buildHeaders(form.getHeaders()),
      timeout: SANDBOX_REQUEST_TIMEOUT_MS
    });
  } catch (error) {
    throw formatHybridAnalysisAxiosError(error, 'Hybrid Analysis submit failed');
  }

  const jobId = extractJobId(response.data || {});
  if (!jobId) {
    throw new Error('Hybrid Analysis did not return a job_id.');
  }
  return jobId;
};

const getJobState = async (jobId) => {
  assertSandboxConfig();
  const id = encodeURIComponent(jobId);
  const stateUrl = joinApiUrl(`/report/${id}/state`);
  console.log(`[FALCON] Hybrid Analysis GET (full URL): ${stateUrl}`);
  let response;
  try {
    response = await axios.get(stateUrl, {
      headers: buildHeaders(),
      timeout: SANDBOX_REQUEST_TIMEOUT_MS
    });
  } catch (error) {
    throw formatHybridAnalysisAxiosError(error, 'Hybrid Analysis state poll failed');
  }
  return response.data || {};
};

const getSummaryReport = async (jobId) => {
  assertSandboxConfig();
  const id = encodeURIComponent(jobId);
  const summaryUrl = joinApiUrl(`/report/${id}/summary`);
  console.log(`[FALCON] Hybrid Analysis GET (full URL): ${summaryUrl}`);
  let response;
  try {
    response = await axios.get(summaryUrl, {
      headers: buildHeaders(),
      timeout: SANDBOX_REQUEST_TIMEOUT_MS
    });
  } catch (error) {
    throw formatHybridAnalysisAxiosError(error, 'Hybrid Analysis summary failed');
  }
  return response.data || {};
};

const waitForReport = async (jobId) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < SANDBOX_MAX_WAIT_MS) {
    const stateResponse = await getJobState(jobId);
    const status = (stateResponse.state || stateResponse.status || stateResponse.verdict || '')
      .toString()
      .toUpperCase();

    if (status === STATUS_SUCCESS) {
      return getSummaryReport(jobId);
    }

    if (FAILURE_STATES.has(status)) {
      throw new Error(`Falcon Sandbox analysis failed with status: ${status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, SANDBOX_POLL_INTERVAL_MS));
  }

  throw new Error(`Falcon Sandbox analysis timed out after ${SANDBOX_MAX_WAIT_MS}ms`);
};

module.exports = {
  submitFile,
  waitForReport,
  getJobState,
  getSummaryReport
};
