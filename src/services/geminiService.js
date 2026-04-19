const { GoogleGenerativeAI } = require('@google/generative-ai');

/** Default uses a current AI Studio model; override with GEMINI_MODEL in .env if needed. */
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 15000);
const GEMINI_COMPARATIVE_TIMEOUT_MS = Number(
  process.env.GEMINI_COMPARATIVE_TIMEOUT_MS || Math.max(GEMINI_TIMEOUT_MS, 45000)
);
const GEMINI_COMPARATIVE_RETRIES = Math.max(1, Number(process.env.GEMINI_COMPARATIVE_RETRIES || 2));
const GEMINI_MAX_PROMPT_JSON_CHARS = Math.max(2000, Number(process.env.GEMINI_MAX_PROMPT_JSON_CHARS || 25000));

const withTimeout = (promise, timeoutMs) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Gemini request timed out after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
};

const buildPrompt = (analysisData) => {
  return [
    'You are a Senior Malware Researcher.',
    'Analyze this JSON data from a PE file and explain why this sample is dangerous in plain language.',
    'Then provide exactly 3 immediate response steps for a SOC analyst.',
    'Return your answer with the following headings:',
    '1) Executive Summary',
    '2) Why This Is Dangerous',
    '3) Immediate SOC Response Steps',
    '',
    `PE Analysis JSON: ${JSON.stringify(analysisData)}`
  ].join('\n');
};

const buildComparativePrompt = ({ staticAnalysis, dynamicAnalysis }) => {
  return [
    'You are a Senior Malware Analyst at ViperLens.',
    'Analyze the correlation between the Static features (CNN results) and Dynamic behaviors (Falcon Sandbox logs).',
    'Provide a high-level executive summary and technical breakdown.',
    'Use the following sections in your response:',
    '1) Executive Summary',
    '2) Static vs Dynamic Correlation',
    '3) Technical Breakdown',
    '4) Immediate SOC Actions',
    '',
    `Static Analysis JSON: ${JSON.stringify(staticAnalysis)}`,
    '',
    `Dynamic Analysis JSON: ${JSON.stringify(dynamicAnalysis)}`
  ].join('\n');
};

const truncateLongStrings = (value, maxLen) => {
  if (typeof value === 'string') {
    return value.length > maxLen ? `${value.slice(0, maxLen)}...[truncated]` : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => truncateLongStrings(item, maxLen));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, nestedValue]) => {
      acc[key] = truncateLongStrings(nestedValue, maxLen);
      return acc;
    }, {});
  }
  return value;
};

const toBoundedJson = (payload, maxChars) => {
  const normalized = truncateLongStrings(payload, 400);
  const serialized = JSON.stringify(normalized);
  if (serialized.length <= maxChars) {
    return serialized;
  }
  return `${serialized.slice(0, maxChars)}...[truncated]`;
};

const buildComparativePromptCompact = ({ staticAnalysis, dynamicAnalysis }) => {
  return [
    'You are a Senior Malware Analyst at ViperLens.',
    'Analyze correlation between static indicators and dynamic behaviors.',
    'Focus on the strongest signals and likely attacker intent.',
    'Use the following sections in your response:',
    '1) Executive Summary',
    '2) Static vs Dynamic Correlation',
    '3) Technical Breakdown',
    '4) Immediate SOC Actions',
    '',
    `Static Analysis JSON: ${toBoundedJson(staticAnalysis, GEMINI_MAX_PROMPT_JSON_CHARS)}`,
    '',
    `Dynamic Analysis JSON: ${toBoundedJson(dynamicAnalysis, GEMINI_MAX_PROMPT_JSON_CHARS)}`
  ].join('\n');
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const generateGeminiAdvice = async (analysisData) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: GEMINI_MODEL });
    const prompt = buildPrompt(analysisData);

    const response = await withTimeout(
      model.generateContent(prompt),
      GEMINI_TIMEOUT_MS
    );

    const text = response.response.text().trim();
    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }

    return {
      model: GEMINI_MODEL,
      generatedAt: new Date().toISOString(),
      content: text
    };
  } catch (error) {
    throw new Error(`Gemini advice failed (model ${GEMINI_MODEL}): ${error.message}`);
  }
};

const generateComparativeGeminiAdvice = async (payload) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: GEMINI_MODEL });
    let lastError = null;

    for (let attempt = 1; attempt <= GEMINI_COMPARATIVE_RETRIES; attempt += 1) {
      const useCompactPrompt = attempt > 1;
      const prompt = useCompactPrompt ? buildComparativePromptCompact(payload) : buildComparativePrompt(payload);

      try {
        const response = await withTimeout(
          model.generateContent(prompt),
          GEMINI_COMPARATIVE_TIMEOUT_MS
        );

        const text = response.response.text().trim();
        if (!text) {
          throw new Error('Gemini returned an empty comparative response.');
        }

        return {
          model: GEMINI_MODEL,
          generatedAt: new Date().toISOString(),
          content: text
        };
      } catch (attemptError) {
        lastError = attemptError;
        if (attempt < GEMINI_COMPARATIVE_RETRIES) {
          await sleep(500 * attempt);
        }
      }
    }

    throw lastError || new Error('Gemini comparative report failed without a specific error.');
  } catch (error) {
    throw new Error(`Gemini comparative report failed (model ${GEMINI_MODEL}): ${error.message}`);
  }
};

module.exports = {
  generateGeminiAdvice,
  generateComparativeGeminiAdvice
};
