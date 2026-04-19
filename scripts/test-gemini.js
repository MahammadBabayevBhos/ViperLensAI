/**
 * Smoke test for GEMINI_MODEL / GEMINI_API_KEY (does not print secrets).
 * Run from project root: node scripts/test-gemini.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { generateGeminiAdvice } = require('../src/services/geminiService');

async function main() {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  if (!process.env.GEMINI_API_KEY) {
    console.error('[gemini-test] GEMINI_API_KEY is not set in .env');
    process.exitCode = 1;
    return;
  }
  console.log(`[gemini-test] Calling model: ${model}`);
  const out = await generateGeminiAdvice({
    prediction: { label: 'benign', confidence: 0.2 },
    verdict: 'benign',
    note: 'smoke payload only'
  });
  console.log('[gemini-test] OK — model in response:', out.model);
  console.log('[gemini-test] First 280 chars of content:\n', (out.content || '').slice(0, 280));
}

main().catch((e) => {
  console.error('[gemini-test] FAILED:', e.message);
  process.exitCode = 1;
});
