/**
 * Derive a malware "family" label for analytics. Prefer explicit model output when available.
 */
const extractMalwareFamily = (analysis) => {
  if (!analysis || typeof analysis !== 'object') {
    return 'unknown';
  }
  if (analysis.malware_family != null && String(analysis.malware_family).trim()) {
    return String(analysis.malware_family).trim();
  }
  const prediction = analysis.prediction || {};
  const label = (prediction.label || analysis.verdict || 'unknown').toString().toLowerCase();
  if (label === 'malicious') {
    return 'Malware (unclassified)';
  }
  if (label === 'benign') {
    return 'Benign';
  }
  return label;
};

module.exports = { extractMalwareFamily };
