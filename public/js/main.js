const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('malwareSample');
const fileMeta = document.getElementById('fileMeta');
const uploadForm = document.getElementById('uploadForm');
const uploadPipelineProgress = document.getElementById('uploadPipelineProgress');
const uploadPipelineIdField = document.getElementById('uploadPipelineIdField');
const uploadPipelineError = document.getElementById('uploadPipelineError');
const uploadStaticStage = document.querySelector('[data-scope="upload"][data-stage="static"]');

const premiumAiForm = document.getElementById('premiumAiForm');
const premiumPipelineIdField = document.getElementById('pipelineIdField');
const premiumPipelineProgress = document.getElementById('pipelineProgress');
const premiumPipelineError = document.getElementById('pipelineError');
const sandboxSpinner = document.getElementById('sandboxSpinner');
const premiumStages = {
  static: document.querySelector('[data-scope="premium"][data-stage="static"]'),
  dynamic: document.querySelector('[data-scope="premium"][data-stage="dynamic"]'),
  ai: document.querySelector('[data-scope="premium"][data-stage="ai"]')
};

const createPipelineId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const NETWORK_ERROR_TEXT =
  'Cannot reach backend service. Confirm the server is running and refresh the page.';

const setStageStatus = (node, status) => {
  if (!node) {
    return;
  }
  node.setAttribute('data-status', status);
};

const pollPipelineStatus = async (pipelineId) => {
  try {
    const response = await fetch(`/status/${encodeURIComponent(pipelineId)}`, {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch (_error) {
    return null;
  }
};

const readResponsePayload = async (response) => {
  const responseType = (response.headers.get('content-type') || '').toLowerCase();
  if (responseType.includes('application/json')) {
    return response.json();
  }

  const fallbackText = await response.text();
  return {
    ok: response.ok,
    error: fallbackText && fallbackText.trim() ? fallbackText.trim() : 'Unexpected server response.'
  };
};

const getErrorMessage = (error, fallbackMessage) => {
  if (error && error.name === 'TypeError' && /failed to fetch/i.test(error.message || '')) {
    return NETWORK_ERROR_TEXT;
  }
  return (error && error.message) || fallbackMessage;
};

const monitorPipeline = async ({ pipelineId, onUpdate }) => {
  let attempts = 0;
  while (attempts < 120) {
    const statusPayload = await pollPipelineStatus(pipelineId);
    if (statusPayload) {
      onUpdate(statusPayload);
      if (statusPayload.overall === 'completed' || statusPayload.overall === 'failed') {
        return statusPayload;
      }
    }
    attempts += 1;
    await sleep(1200);
  }
  return null;
};

const updateFileMeta = (file) => {
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  fileMeta.textContent = `Selected: ${file.name} (${sizeMb} MB)`;
  fileMeta.classList.remove('hidden');
};

const setFileList = (files) => {
  if (!files || files.length === 0) {
    return;
  }

  const file = files[0];
  const isExe = file.name.toLowerCase().endsWith('.exe');

  if (!isExe) {
    fileMeta.textContent = 'Invalid format. Please provide a .exe file.';
    fileMeta.classList.remove('hidden');
    return;
  }

  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;

  updateFileMeta(file);
};

if (fileInput) {
  fileInput.addEventListener('change', (event) => {
    setFileList(event.target.files);
  });
}

if (dropZone) {
  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('border-sky-400', 'bg-slate-900');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-sky-400', 'bg-slate-900');
  });

  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('border-sky-400', 'bg-slate-900');
    setFileList(event.dataTransfer.files);
  });
}

const premiumModal = document.getElementById('premiumModal');
const openPremiumModalReport = document.getElementById('openPremiumModalReport');
const closePremiumModal = document.getElementById('closePremiumModal');

const openPremiumModal = () => {
  if (!premiumModal) {
    return;
  }
  premiumModal.classList.remove('hidden');
  premiumModal.classList.add('flex');
};

const hidePremiumModal = () => {
  if (!premiumModal) {
    return;
  }
  premiumModal.classList.add('hidden');
  premiumModal.classList.remove('flex');
};

if (openPremiumModalReport) {
  openPremiumModalReport.addEventListener('click', openPremiumModal);
}

if (closePremiumModal) {
  closePremiumModal.addEventListener('click', hidePremiumModal);
}

if (premiumModal) {
  premiumModal.addEventListener('click', (event) => {
    if (event.target === premiumModal) {
      hidePremiumModal();
    }
  });
}

if (uploadForm && uploadPipelineIdField) {
  uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pipelineId = createPipelineId();
    uploadPipelineIdField.value = pipelineId;

    if (uploadPipelineProgress) {
      uploadPipelineProgress.classList.remove('hidden');
    }
    if (uploadPipelineError) {
      uploadPipelineError.classList.add('hidden');
      uploadPipelineError.textContent = '';
    }
    setStageStatus(uploadStaticStage, 'running');

    const formData = new FormData(uploadForm);
    const monitorTask = monitorPipeline({
      pipelineId,
      onUpdate: (statusPayload) => {
        const staticStatus = (statusPayload.stages && statusPayload.stages.static) || 'pending';
        setStageStatus(uploadStaticStage, staticStatus);
        if (statusPayload.overall === 'failed' && uploadPipelineError) {
          uploadPipelineError.classList.remove('hidden');
          uploadPipelineError.textContent = statusPayload.error || 'Static analysis failed.';
        }
      }
    });

    const analyzeAction =
      (uploadForm.getAttribute('action') && uploadForm.getAttribute('action').trim()) || '/analyze';

    try {
      const response = await fetch(analyzeAction, {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      const payload = await readResponsePayload(response);
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Analysis failed.');
      }
      await monitorTask;
      if (payload.html) {
        document.open();
        document.write(payload.html);
        document.close();
      }
    } catch (error) {
      setStageStatus(uploadStaticStage, 'failed');
      if (uploadPipelineError) {
        uploadPipelineError.classList.remove('hidden');
        uploadPipelineError.textContent = getErrorMessage(error, 'Static analysis failed.');
      }
    }
  });
}

if (premiumAiForm) {
  premiumAiForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pipelineId = createPipelineId();
    if (premiumPipelineIdField) {
      premiumPipelineIdField.value = pipelineId;
    }
    if (premiumPipelineProgress) {
      premiumPipelineProgress.classList.remove('hidden');
    }
    if (sandboxSpinner) {
      sandboxSpinner.classList.remove('hidden');
    }
    if (premiumPipelineError) {
      premiumPipelineError.classList.add('hidden');
      premiumPipelineError.textContent = '';
    }
    setStageStatus(premiumStages.static, 'completed');
    setStageStatus(premiumStages.dynamic, 'running');
    setStageStatus(premiumStages.ai, 'pending');

    const formData = new FormData(premiumAiForm);
    const monitorTask = monitorPipeline({
      pipelineId,
      onUpdate: (statusPayload) => {
        const stages = statusPayload.stages || {};
        setStageStatus(premiumStages.static, stages.static || 'pending');
        setStageStatus(premiumStages.dynamic, stages.dynamic || 'pending');
        setStageStatus(premiumStages.ai, stages.ai || 'pending');
        if (statusPayload.overall === 'failed' && premiumPipelineError) {
          premiumPipelineError.classList.remove('hidden');
          premiumPipelineError.textContent = statusPayload.error || 'Premium analysis failed.';
        }
      }
    });

    const premiumAiAction =
      (premiumAiForm.getAttribute('action') && premiumAiForm.getAttribute('action').trim()) || '/premium/ai';

    try {
      const response = await fetch(premiumAiAction, {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      const payload = await readResponsePayload(response);
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Deep AI Analysis failed.');
      }
      await monitorTask;
      if (payload.html) {
        document.open();
        document.write(payload.html);
        document.close();
      }
    } catch (error) {
      setStageStatus(premiumStages.dynamic, 'failed');
      setStageStatus(premiumStages.ai, 'failed');
      if (premiumPipelineError) {
        premiumPipelineError.classList.remove('hidden');
        premiumPipelineError.textContent = getErrorMessage(error, 'Premium analysis failed.');
      }
    }
  });
}

const copyButtons = document.querySelectorAll('[data-copy-target]');
if (copyButtons.length) {
  copyButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const selector = button.getAttribute('data-copy-target');
      if (!selector) {
        return;
      }
      const sourceNode = document.querySelector(selector);
      if (!sourceNode) {
        return;
      }
      const text = sourceNode.textContent || '';
      if (!text.trim()) {
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        button.classList.add('is-copied');
        setTimeout(() => {
          button.classList.remove('is-copied');
        }, 1200);
      } catch (_error) {
        button.classList.remove('is-copied');
      }
    });
  });
}
