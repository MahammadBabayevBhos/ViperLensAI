const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('malwareSample');
const fileMeta = document.getElementById('fileMeta');

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

fileInput.addEventListener('change', (event) => {
  setFileList(event.target.files);
});

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

const premiumModal = document.getElementById('premiumModal');
const openPremiumModalAi = document.getElementById('openPremiumModalAi');
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

if (openPremiumModalAi) {
  openPremiumModalAi.addEventListener('click', openPremiumModal);
}

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
