// ── State ──
let selectedTemplate = null;
let logoFile = null;
let abortController = null;

// ── DOM refs ──
const setupView = document.querySelector('#setup-view');
const progressView = document.querySelector('#progress-view');
const resultView = document.querySelector('#result-view');

const templateCards = document.querySelectorAll('.template-card');
const templateError = document.querySelector('#template-error');

const generatorForm = document.querySelector('#generator-form');
const customerNameInput = document.querySelector('#customer-name');
const nameError = document.querySelector('#name-error');

const logoDropZone = document.querySelector('#logo-drop-zone');
const logoInput = document.querySelector('#logo-input');
const logoDropContent = document.querySelector('#logo-drop-content');
const logoPreviewContent = document.querySelector('#logo-preview-content');
const logoPreviewImg = document.querySelector('#logo-preview-img');
const logoFileName = document.querySelector('#logo-file-name');
const logoRemoveBtn = document.querySelector('#logo-remove-btn');
const logoError = document.querySelector('#logo-error');

const languageInput = document.querySelector('#language-input');
const languageError = document.querySelector('#language-error');

const steps = document.querySelectorAll('.step');
const errorPanel = document.querySelector('#error-panel');
const errorMessage = document.querySelector('#error-message');
const retryBtn = document.querySelector('#retry-btn');
const backBtn = document.querySelector('#back-btn');

const resultLink = document.querySelector('#result-link');
const openSiteBtn = document.querySelector('#open-site-btn');
const copyUrlBtn = document.querySelector('#copy-url-btn');
const copyBtnText = document.querySelector('#copy-btn-text');
const generateAnotherBtn = document.querySelector('#generate-another-btn');

// ── View management ──
const showView = (view) => {
  [setupView, progressView, resultView].forEach(v => {
    if (v === view) {
      v.removeAttribute('hidden');
    } else {
      v.setAttribute('hidden', '');
    }
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ── Template selection ──
templateCards.forEach((card) => {
  card.addEventListener('click', () => {
    templateCards.forEach(c => {
      c.classList.remove('is-selected');
      c.setAttribute('aria-pressed', 'false');
    });
    card.classList.add('is-selected');
    card.setAttribute('aria-pressed', 'true');
    selectedTemplate = card.dataset.template;
    templateError.textContent = '';
  });
});

// ── Logo drop zone ──
logoDropZone.addEventListener('click', (e) => {
  if (e.target === logoRemoveBtn || logoRemoveBtn.contains(e.target)) return;
  logoInput.click();
});

logoDropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    logoInput.click();
  }
});

logoDropZone.addEventListener('dragenter', (e) => {
  e.preventDefault();
  logoDropZone.classList.add('is-dragover');
});

logoDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  logoDropZone.classList.add('is-dragover');
});

['dragleave', 'dragend'].forEach(evt => {
  logoDropZone.addEventListener(evt, () => {
    logoDropZone.classList.remove('is-dragover');
  });
});

logoDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  logoDropZone.classList.remove('is-dragover');
  const file = e.dataTransfer?.files?.[0];
  if (file) setLogoFile(file);
});

logoInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) setLogoFile(file);
});

logoRemoveBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  clearLogoFile();
});

const setLogoFile = (file) => {
  if (!file.type.startsWith('image/')) {
    logoError.textContent = 'Please upload an image file (PNG, JPG, SVG, WebP).';
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    logoError.textContent = 'Logo file must be under 2MB.';
    return;
  }
  logoError.textContent = '';
  logoFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    logoPreviewImg.src = e.target.result;
  };
  reader.readAsDataURL(file);

  logoFileName.textContent = file.name;
  logoDropContent.setAttribute('hidden', '');
  logoPreviewContent.removeAttribute('hidden');
};

const clearLogoFile = () => {
  logoFile = null;
  logoInput.value = '';
  logoPreviewImg.src = '';
  logoPreviewContent.setAttribute('hidden', '');
  logoDropContent.removeAttribute('hidden');
  logoError.textContent = '';
};

// ── Form validation ──
const validate = () => {
  let valid = true;

  if (!selectedTemplate) {
    templateError.textContent = 'Please select a template.';
    valid = false;
  }

  if (!customerNameInput.value.trim()) {
    nameError.textContent = 'Customer name is required.';
    valid = false;
  } else {
    nameError.textContent = '';
  }

  if (!logoFile) {
    logoError.textContent = 'Please upload a logo file.';
    valid = false;
  }

  if (!languageInput.value.trim()) {
    languageError.textContent = 'Please enter a target language.';
    valid = false;
  } else {
    languageError.textContent = '';
  }

  return valid;
};

// ── Progress steps ──
const setStepStatus = (stepNum, status) => {
  const step = document.querySelector(`.step[data-step="${stepNum}"]`);
  if (step) step.dataset.status = status;
};

const resetSteps = () => {
  steps.forEach(s => { s.dataset.status = 'pending'; });
  errorPanel.setAttribute('hidden', '');
  errorMessage.textContent = '';
};

// ── SSE / fetch stream consumer ──
const consumeStream = async (response) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE lines
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        handleSSEEvent(event);
      } catch {
        // ignore malformed lines
      }
    }
  }

  // Process any remaining buffer
  if (buffer.startsWith('data: ')) {
    try {
      const event = JSON.parse(buffer.slice(6));
      handleSSEEvent(event);
    } catch {
      // ignore
    }
  }
};

let resolveGeneration;
let rejectGeneration;

const handleSSEEvent = (event) => {
  if (event.error) {
    rejectGeneration?.(new Error(event.message || 'Generation failed'));
    return;
  }

  if (event.step && event.status) {
    setStepStatus(event.step, event.status === 'loading' ? 'active' : 'done');
  }

  if (event.done && event.url) {
    resolveGeneration?.(event.url);
  }
};

// ── Form submission ──
generatorForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validate()) return;

  showView(progressView);
  resetSteps();

  const formData = new FormData();
  formData.append('templateId', selectedTemplate);
  formData.append('customerName', customerNameInput.value.trim());
  formData.append('language', languageInput.value.trim());
  formData.append('logo', logoFile, logoFile.name);

  abortController = new AbortController();

  try {
    const generationPromise = new Promise((resolve, reject) => {
      resolveGeneration = resolve;
      rejectGeneration = reject;
    });

    const response = await fetch('/api/generate', {
      method: 'POST',
      body: formData,
      signal: abortController.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Server error (${response.status}): ${text}`);
    }

    // Consume SSE stream
    await consumeStream(response);

    const liveUrl = await generationPromise;
    showResult(liveUrl);
  } catch (err) {
    if (err.name === 'AbortError') return; // user cancelled — already navigated back
    showError(err.message || 'An unexpected error occurred.');
  }
});

// ── Show result ──
const showResult = (url) => {
  const displayUrl = url.startsWith('https://') ? url : `https://${url}`;
  resultLink.href = displayUrl;
  resultLink.textContent = displayUrl;
  openSiteBtn.href = displayUrl;
  showView(resultView);
};

// ── Show error ──
const showError = (message) => {
  errorPanel.removeAttribute('hidden');
  errorMessage.textContent = message;
};

// ── Copy URL ──
copyUrlBtn.addEventListener('click', async () => {
  const url = resultLink.href;
  try {
    await navigator.clipboard.writeText(url);
    copyUrlBtn.classList.add('copied');
    copyBtnText.textContent = 'Copied!';
    setTimeout(() => {
      copyUrlBtn.classList.remove('copied');
      copyBtnText.textContent = 'Copy';
    }, 2000);
  } catch {
    // Fallback: select text
    const range = document.createRange();
    range.selectNode(resultLink);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }
});

// ── Generate another ──
generateAnotherBtn.addEventListener('click', () => {
  showView(setupView);
});

// ── Back button ──
backBtn.addEventListener('click', () => {
  abortController?.abort();
  abortController = null;
  showView(setupView);
});

// ── Retry ──
retryBtn.addEventListener('click', () => {
  showView(setupView);
});

