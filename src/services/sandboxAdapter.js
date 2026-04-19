const MAX_NORMALIZED_BYTES = 15 * 1024;
const MAX_UNIQUE_PREVIEW = 5;
const MAX_CATEGORY_ITEMS = 20;

const CRITICAL_PATTERNS = {
  injection: /(virtualalloc|writeprocessmemory|createremotethread|ntcreatethreadex|queueuserapc|setthreadcontext|process\s*injection)/i,
  persistence: /(reg(setvalue|createkey|openkey)|run\\|runonce\\|currentversion\\run|startup|schtasks|service\s*create)/i,
  exfiltration: /(http|https|ftp|dns|c2|command.?and.?control|socket|connect|send|post|upload|exfiltration)/i
};

const toText = (value) => {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
};

const flattenObjects = (input, collector = []) => {
  if (!input) {
    return collector;
  }
  if (Array.isArray(input)) {
    input.forEach((item) => flattenObjects(item, collector));
    return collector;
  }
  if (typeof input === 'object') {
    collector.push(input);
    Object.values(input).forEach((value) => flattenObjects(value, collector));
  }
  return collector;
};

const extractApiName = (record) => {
  return (
    record.api ||
    record.api_name ||
    record.name ||
    record.function ||
    record.call ||
    ''
  ).toString();
};

const extractTarget = (record) => {
  return (
    record.path ||
    record.file ||
    record.filename ||
    record.registry_key ||
    record.key ||
    record.domain ||
    record.host ||
    record.ip ||
    record.target ||
    ''
  ).toString();
};

const uniqueByText = (items, cap = MAX_CATEGORY_ITEMS) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = toText(item);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
    if (out.length >= cap) {
      break;
    }
  }
  return out;
};

const classifyRecord = (record) => {
  const apiName = extractApiName(record);
  const target = extractTarget(record);
  const text = `${apiName} ${target} ${toText(record)}`;
  const lowered = text.toLowerCase();

  const isFileOpen = lowered.includes('file open') || lowered.includes('createfile') || lowered.includes('openfile');
  const isRegistryRead = lowered.includes('registry read') || lowered.includes('regqueryvalue') || lowered.includes('regopenkey');

  return {
    apiName,
    target,
    text,
    isInjection: CRITICAL_PATTERNS.injection.test(text),
    isPersistence: CRITICAL_PATTERNS.persistence.test(text),
    isExfiltration: CRITICAL_PATTERNS.exfiltration.test(text),
    isFileOpen,
    isRegistryRead
  };
};

const groupFileOpenOps = (records) => {
  const groups = {};
  records.forEach((record) => {
    const target = (extractTarget(record) || 'unknown').replace(/\//g, '\\');
    const parts = target.split('\\').filter(Boolean);
    const folder = parts.length > 1 ? parts.slice(0, -1).join('\\') : target;
    groups[folder] = (groups[folder] || 0) + 1;
  });
  return Object.entries(groups)
    .map(([folder, count]) => ({ folder, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_UNIQUE_PREVIEW);
};

const groupRegistryReadOps = (records) => {
  const groups = {};
  records.forEach((record) => {
    const key = (extractTarget(record) || 'unknown').toLowerCase();
    const root = key.split('\\').slice(0, 3).join('\\') || key;
    groups[root] = (groups[root] || 0) + 1;
  });
  return Object.entries(groups)
    .map(([key_prefix, count]) => ({ key_prefix, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_UNIQUE_PREVIEW);
};

const normalizeMitreEntry = (entry = {}) => {
  if (typeof entry === 'string') {
    return {
      tactic_name: 'Unknown',
      technique_id: entry,
      malicious_intent: 'Behavior aligned with suspicious execution activity.'
    };
  }
  const tacticName =
    entry.tactic ||
    entry.tactic_name ||
    entry.tacticLabel ||
    entry.tactic_id ||
    'Unknown';
  const techniqueId =
    entry.technique_id ||
    entry.techniqueId ||
    entry.attack_id ||
    entry.id ||
    'Unknown';
  const maliciousIntent =
    entry.malicious_intent ||
    entry.intent ||
    entry.description ||
    entry.signature ||
    'Behavior aligned with suspicious execution activity.';

  return {
    tactic_name: String(tacticName),
    technique_id: String(techniqueId),
    malicious_intent: String(maliciousIntent)
  };
};

const enforceSizeBudget = (normalized) => {
  let output = normalized;
  let bytes = Buffer.byteLength(JSON.stringify(output), 'utf8');
  if (bytes <= MAX_NORMALIZED_BYTES) {
    return output;
  }

  // Keep critical evidence while trimming verbose sections.
  output = {
    ...output,
    process_tree: {
      ...(output.process_tree || {}),
      raw_nodes: [],
      summarized: true
    }
  };
  bytes = Buffer.byteLength(JSON.stringify(output), 'utf8');
  if (bytes <= MAX_NORMALIZED_BYTES) {
    return output;
  }

  output = {
    ...output,
    network_indicators: {
      ...output.network_indicators,
      connections: uniqueByText(output.network_indicators.connections || [], MAX_UNIQUE_PREVIEW),
      preserved_cc_calls: uniqueByText(output.network_indicators.preserved_cc_calls || [], MAX_UNIQUE_PREVIEW)
    },
    file_system_impact: {
      ...output.file_system_impact,
      changed_paths: uniqueByText(output.file_system_impact.changed_paths || [], MAX_UNIQUE_PREVIEW)
    },
    evasion_attempts: {
      ...output.evasion_attempts,
      preserved_injection_calls: uniqueByText(output.evasion_attempts.preserved_injection_calls || [], MAX_UNIQUE_PREVIEW),
      preserved_persistence_calls: uniqueByText(output.evasion_attempts.preserved_persistence_calls || [], MAX_UNIQUE_PREVIEW)
    }
  };

  // Hard-safe fallback.
  bytes = Buffer.byteLength(JSON.stringify(output), 'utf8');
  if (bytes > MAX_NORMALIZED_BYTES) {
    return {
      metadata: output.metadata,
      evasion_attempts: output.evasion_attempts,
      network_indicators: output.network_indicators,
      file_system_impact: output.file_system_impact,
      process_tree: {
        total_nodes: output.process_tree.total_nodes || 0,
        summarized: true
      }
    };
  }
  return output;
};

const normalizeSandboxReport = (rawReport = {}) => {
  const objects = flattenObjects(rawReport);
  const classified = objects.map((record) => ({ record, ...classifyRecord(record) }));

  const injectionCalls = classified.filter((c) => c.isInjection).map((c) => ({ api: c.apiName, target: c.target }));
  const persistenceCalls = classified.filter((c) => c.isPersistence).map((c) => ({ api: c.apiName, target: c.target }));
  const ccCalls = classified.filter((c) => c.isExfiltration).map((c) => ({ api: c.apiName, target: c.target }));

  const fileOpenOps = classified.filter((c) => c.isFileOpen).map((c) => c.record);
  const registryReadOps = classified.filter((c) => c.isRegistryRead).map((c) => c.record);

  const rawConnections = [
    ...(Array.isArray(rawReport.network_calls) ? rawReport.network_calls : []),
    ...(Array.isArray(rawReport.network) ? rawReport.network : [])
  ];
  const droppedFiles = [
    ...(Array.isArray(rawReport.file_drops) ? rawReport.file_drops : []),
    ...(Array.isArray(rawReport.dropped_files) ? rawReport.dropped_files : [])
  ];
  const signatures = Array.isArray(rawReport.signatures)
    ? rawReport.signatures
    : Array.isArray(rawReport.scanners)
      ? rawReport.scanners
      : [];
  const mitreRaw =
    rawReport['mitre_att&ck'] ||
    rawReport.mitre_attck ||
    rawReport.mitre_attck_framework_matches ||
    rawReport.mitre ||
    [];
  const mitre = Array.isArray(mitreRaw) ? mitreRaw : [mitreRaw].filter(Boolean);

  const normalized = {
    metadata: {
      status: rawReport.status || rawReport.analysis_status || 'unknown',
      submission_id: rawReport.job_id || rawReport.submission_id || rawReport.id || rawReport.webid || null,
      threat_score: rawReport.threat_score || rawReport.score || rawReport.threat_level || 'unknown',
      mitre_attck_framework_matches: mitre,
      signatures: uniqueByText(signatures, MAX_CATEGORY_ITEMS)
    },
    mitre_attck: uniqueByText(mitre.map((entry) => normalizeMitreEntry(entry)), MAX_CATEGORY_ITEMS),
    evasion_attempts: {
      total_events: injectionCalls.length + persistenceCalls.length,
      preserved_injection_calls: injectionCalls,
      preserved_persistence_calls: persistenceCalls
    },
    network_indicators: {
      total_events: rawConnections.length + ccCalls.length,
      connections: uniqueByText(rawConnections, MAX_CATEGORY_ITEMS),
      preserved_cc_calls: ccCalls
    },
    file_system_impact: {
      total_file_events: droppedFiles.length + fileOpenOps.length,
      changed_paths: uniqueByText(droppedFiles, MAX_CATEGORY_ITEMS),
      file_open_summary:
        fileOpenOps.length >= 100
          ? { summarized: true, action_count: fileOpenOps.length, top_folders: groupFileOpenOps(fileOpenOps) }
          : { summarized: false, action_count: fileOpenOps.length, entries: uniqueByText(fileOpenOps, MAX_CATEGORY_ITEMS) },
      registry_read_summary:
        registryReadOps.length >= 100
          ? { summarized: true, action_count: registryReadOps.length, top_keys: groupRegistryReadOps(registryReadOps) }
          : { summarized: false, action_count: registryReadOps.length, entries: uniqueByText(registryReadOps, MAX_CATEGORY_ITEMS) }
    },
    process_tree: {
      total_nodes: Array.isArray(rawReport.process_tree) ? rawReport.process_tree.length : 0,
      root_processes: uniqueByText(rawReport.process_tree || rawReport.processes || [], MAX_CATEGORY_ITEMS),
      raw_nodes: uniqueByText(rawReport.process_tree || [], MAX_CATEGORY_ITEMS)
    }
  };

  // Never discard critical preserved categories; only limit verbosity of previews.
  normalized.evasion_attempts.preserved_injection_calls = uniqueByText(
    normalized.evasion_attempts.preserved_injection_calls,
    500
  );
  normalized.evasion_attempts.preserved_persistence_calls = uniqueByText(
    normalized.evasion_attempts.preserved_persistence_calls,
    500
  );
  normalized.network_indicators.preserved_cc_calls = uniqueByText(
    normalized.network_indicators.preserved_cc_calls,
    500
  );

  return enforceSizeBudget(normalized);
};

module.exports = {
  normalizeSandboxReport
};
