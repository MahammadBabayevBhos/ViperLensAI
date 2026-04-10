const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 15000);

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
    'Compare these Static features (High Entropy, Suspicious APIs) with the observed Dynamic behaviors (Network calls, File drops).',
    'Explain the evasion techniques and actual impact. Be clinical and detailed.',
    'Use the following sections in your response:',
    '1) Static vs Dynamic Correlation',
    '2) Evasion Techniques',
    '3) Real-World Impact',
    '4) Immediate SOC Actions',
    '',
    `Static Analysis JSON: ${JSON.stringify(staticAnalysis)}`,
    '',
    `Dynamic Analysis JSON: ${JSON.stringify(dynamicAnalysis)}`
  ].join('\n');
};

const generateGeminiAdvice = async (analysisData) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

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
};

const generateComparativeGeminiAdvice = async (payload) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: GEMINI_MODEL });
  const prompt = buildComparativePrompt(payload);

  const response = await withTimeout(
    model.generateContent(prompt),
    GEMINI_TIMEOUT_MS
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
};

module.exports = {
  generateGeminiAdvice,
  generateComparativeGeminiAdvice
};
