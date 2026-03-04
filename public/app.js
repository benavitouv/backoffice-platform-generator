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

const customConfig = document.querySelector('#custom-config');
const websiteDescInput = document.querySelector('#website-description');
const fieldsSpecInput = document.querySelector('#fields-spec');
const envBaseUrlInput = document.querySelector('#env-base-url');
const webhookUrlInput = document.querySelector('#webhook-url');
const webhookSecretInput = document.querySelector('#webhook-secret');
const storageUrlInput = document.querySelector('#storage-url');
const storageApiKeyInput = document.querySelector('#storage-api-key');
const descError = document.querySelector('#desc-error');
const fieldsError = document.querySelector('#fields-error');
const webhookError = document.querySelector('#webhook-error');
const webhookSecretError = document.querySelector('#webhook-secret-error');

const steps = document.querySelectorAll('.step');
const logList = document.querySelector('#log-list');
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
    if (selectedTemplate === 'custom') {
      customConfig.classList.add('is-visible');
    } else {
      customConfig.classList.remove('is-visible');
    }
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

  if (selectedTemplate === 'custom') {
    if (!websiteDescInput.value.trim()) {
      descError.textContent = 'Website description is required.';
      valid = false;
    } else {
      descError.textContent = '';
    }

    if (!fieldsSpecInput.value.trim()) {
      fieldsError.textContent = 'Form fields specification is required.';
      valid = false;
    } else {
      fieldsError.textContent = '';
    }

    if (!webhookUrlInput.value.trim()) {
      webhookError.textContent = 'Webhook URL is required.';
      valid = false;
    } else {
      webhookError.textContent = '';
    }

    if (!webhookSecretInput.value.trim()) {
      webhookSecretError.textContent = 'Webhook secret is required.';
      valid = false;
    } else {
      webhookSecretError.textContent = '';
    }
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
  logList.innerHTML = '';
  errorPanel.setAttribute('hidden', '');
  errorMessage.textContent = '';
};

// ── Log panel ──
const addLogEntry = (message, elapsed, type = 'info') => {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.dataset.type = type;
  entry.innerHTML = `<span class="log-time">${elapsed}s</span><span class="log-msg">${message}</span>`;
  logList.appendChild(entry);
  logList.scrollTop = logList.scrollHeight;
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

  if (event.log) {
    addLogEntry(event.message, event.elapsed, event.type || 'info');
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

  if (selectedTemplate === 'custom') {
    formData.append('websiteDescription', websiteDescInput.value.trim());
    formData.append('fieldsSpec', fieldsSpecInput.value.trim());
    formData.append('envBaseUrl', envBaseUrlInput.value.trim());
    formData.append('webhookUrl', webhookUrlInput.value.trim());
    formData.append('webhookSecret', webhookSecretInput.value.trim());
    formData.append('storageUrl', storageUrlInput.value.trim());
    formData.append('storageApiKey', storageApiKeyInput.value.trim());
  }

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

// ── Edit modal DOM refs ──
const editModal           = document.querySelector('#edit-modal');
const editModalName       = document.querySelector('#edit-modal-name');
const editModalNameProg   = document.querySelector('#edit-modal-name-progress');
const editFormState       = document.querySelector('#edit-form-state');
const editProgressState   = document.querySelector('#edit-progress-state');
const editResultState     = document.querySelector('#edit-result-state');
const editPromptInput     = document.querySelector('#edit-prompt');
const editPromptError     = document.querySelector('#edit-prompt-error');
const editModalClose      = document.querySelector('#edit-modal-close');
const editCancelBtn       = document.querySelector('#edit-cancel-btn');
const editSubmitBtn       = document.querySelector('#edit-submit-btn');
const editResultClose     = document.querySelector('#edit-result-close');
const editResultLink      = document.querySelector('#edit-result-link');
const editOpenBtn         = document.querySelector('#edit-open-btn');
const editDoneBtn         = document.querySelector('#edit-done-btn');
const editErrorPanel      = document.querySelector('#edit-error-panel');
const editErrorMsg        = document.querySelector('#edit-error-msg');
const editRetryBtn        = document.querySelector('#edit-retry-btn');
const editLogList         = document.querySelector('#edit-log-list');

const addEditLogEntry = (message, elapsed, type = 'info') => {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.dataset.type = type;
  entry.innerHTML = `<span class="log-time">${elapsed}s</span><span class="log-msg">${message}</span>`;
  editLogList.appendChild(entry);
  editLogList.scrollTop = editLogList.scrollHeight;
};

let editEntry = null;

const setEditStepStatus = (step, status) => {
  const el = document.querySelector(`.step[data-edit-step="${step}"]`);
  if (el) el.setAttribute('data-status', status);
};

const openEditModal = (entry) => {
  editEntry = entry;
  editModalName.textContent       = entry.customerName || '—';
  editModalNameProg.textContent   = entry.customerName || '—';
  editPromptInput.value           = '';
  editPromptError.textContent     = '';
  editFormState.removeAttribute('hidden');
  editProgressState.setAttribute('hidden', '');
  editResultState.setAttribute('hidden', '');
  editErrorPanel.setAttribute('hidden', '');
  editModal.removeAttribute('hidden');
  editPromptInput.focus();
};

const closeEditModal = () => {
  editModal.setAttribute('hidden', '');
  editEntry = null;
};

editModalClose.addEventListener('click', closeEditModal);
editCancelBtn.addEventListener('click', closeEditModal);
editResultClose.addEventListener('click', () => {
  closeEditModal();
  loadHistorySidebar();
});
editDoneBtn.addEventListener('click', () => {
  closeEditModal();
  loadHistorySidebar();
});

// Click outside panel to close
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeEditModal();
});

// Escape to close
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !editModal.hasAttribute('hidden')) closeEditModal();
});

editRetryBtn.addEventListener('click', () => {
  editErrorPanel.setAttribute('hidden', '');
  editFormState.removeAttribute('hidden');
});

editSubmitBtn.addEventListener('click', async () => {
  const prompt = editPromptInput.value.trim();
  if (!prompt) {
    editPromptError.textContent = 'Please describe the changes you want.';
    editPromptInput.focus();
    return;
  }
  if (!editEntry?.repoFullName) {
    editPromptError.textContent = 'No repository linked to this deployment.';
    return;
  }
  editPromptError.textContent = '';

  editFormState.setAttribute('hidden', '');
  editProgressState.removeAttribute('hidden');
  editResultState.setAttribute('hidden', '');
  editErrorPanel.setAttribute('hidden', '');

  document.querySelectorAll('.step[data-edit-step]').forEach(s => s.setAttribute('data-status', 'pending'));
  editLogList.innerHTML = '';

  try {
    const response = await fetch('/api/redeploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoFullName: editEntry.repoFullName, editPrompt: prompt }),
    });

    if (!response.ok) throw new Error(`Server error (${response.status})`);

    let resolveEdit, rejectEdit;
    const editDonePromise = new Promise((res, rej) => { resolveEdit = res; rejectEdit = rej; });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.error) { rejectEdit(new Error(ev.message || 'Edit failed')); break; }
          if (ev.log)   { addEditLogEntry(ev.message, ev.elapsed, ev.type || 'info'); }
          if (ev.step && ev.status) setEditStepStatus(ev.step, ev.status === 'loading' ? 'active' : 'done');
          if (ev.done && ev.url) resolveEdit(ev.url);
        } catch { /* ignore */ }
      }
    }

    const url = await editDonePromise;
    const displayUrl = url.startsWith('https://') ? url : `https://${url}`;
    editResultLink.href       = displayUrl;
    editResultLink.textContent = displayUrl;
    editOpenBtn.href          = displayUrl;

    editProgressState.setAttribute('hidden', '');
    editResultState.removeAttribute('hidden');

  } catch (err) {
    editProgressState.setAttribute('hidden', '');
    editErrorMsg.textContent = err.message || 'An unexpected error occurred.';
    editErrorPanel.removeAttribute('hidden');
  }
});

// ── History sidebar ──
const appSidebar            = document.querySelector('#app-sidebar');
const sidebarCollapseBtn    = document.querySelector('#sidebar-collapse-btn');
const historySidebarRefresh = document.querySelector('#history-sidebar-refresh');
const hsbLoading            = document.querySelector('#hsb-loading');
const hsbList               = document.querySelector('#hsb-list');
const hsbEmpty              = document.querySelector('#hsb-empty');
const hsbError              = document.querySelector('#hsb-error');
const hsbErrorMsg           = document.querySelector('#hsb-error-msg');

// Restore persisted collapse state
if (localStorage.getItem('sidebarCollapsed') === 'true') {
  appSidebar.classList.add('is-collapsed');
}

const toggleSidebar = (collapsed) => {
  appSidebar.classList.toggle('is-collapsed', collapsed);
  localStorage.setItem('sidebarCollapsed', collapsed ? 'true' : 'false');
};

// Clicking anywhere on the sidebar expands/collapses it,
// except history entries (links/rows) and the refresh button when expanded.
appSidebar.addEventListener('click', (e) => {
  const isCollapsed = appSidebar.classList.contains('is-collapsed');
  if (isCollapsed) {
    toggleSidebar(false);
    return;
  }
  if (e.target.closest('.hsb-entry') || e.target.closest('#history-sidebar-refresh') || e.target.closest('#edit-modal')) return;
  toggleSidebar(true);
});

const TEMPLATE_LABELS = {
  form17:    'Health Referral',
  insurance: 'Insurance',
  loan:      'Loan',
  provident: 'Provident',
  custom:    'Custom',
};

const escHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const formatDateShort = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
};

// ── Restore form from history entry ──
const restoreForm = (entry) => {
  // Select the custom template card
  templateCards.forEach(c => {
    c.classList.remove('is-selected');
    c.setAttribute('aria-pressed', 'false');
  });
  const customCard = document.querySelector('.template-card[data-template="custom"]');
  if (customCard) {
    customCard.classList.add('is-selected');
    customCard.setAttribute('aria-pressed', 'true');
  }
  selectedTemplate = 'custom';
  customConfig.classList.add('is-visible');
  templateError.textContent = '';

  // Common fields
  customerNameInput.value = entry.customerName || '';
  nameError.textContent = '';
  languageInput.value = entry.language || 'English';

  // Custom-specific fields
  const r = entry.restore || {};
  websiteDescInput.value    = r.websiteDescription || '';
  fieldsSpecInput.value     = r.fieldsSpec         || '';
  envBaseUrlInput.value     = r.envBaseUrl         || '';
  webhookUrlInput.value     = r.webhookUrl         || '';
  webhookSecretInput.value  = r.webhookSecret      || '';
  storageUrlInput.value     = r.storageUrl         || '';
  storageApiKeyInput.value  = r.storageApiKey      || '';
  descError.textContent     = '';
  fieldsError.textContent   = '';
  webhookError.textContent  = '';
  webhookSecretError.textContent = '';

  showView(setupView);
};

const loadHistorySidebar = async () => {
  hsbLoading.removeAttribute('hidden');
  hsbList.setAttribute('hidden', '');
  hsbEmpty.setAttribute('hidden', '');
  hsbError.setAttribute('hidden', '');

  try {
    const res = await fetch('/api/history');
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const entries = await res.json();

    hsbLoading.setAttribute('hidden', '');

    if (!Array.isArray(entries) || entries.length === 0) {
      hsbEmpty.removeAttribute('hidden');
      return;
    }

    hsbList.innerHTML = '';
    entries.forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'hsb-entry';
      const label = TEMPLATE_LABELS[entry.templateId] || entry.templateId || '—';
      const meta = [entry.language, formatDateShort(entry.timestamp)].filter(Boolean).join(' · ');
      const hasRestore = entry.templateId === 'custom';
      const hasEdit    = !!entry.repoFullName;
      li.innerHTML = `
        <div class="hsb-entry-top">
          <strong class="hsb-entry-name">${escHtml(entry.customerName)}</strong>
          <span class="template-badge" data-type="${escHtml(entry.templateId)}">${escHtml(label)}</span>
        </div>
        <a class="hsb-entry-url" href="${escHtml(entry.url)}" target="_blank" rel="noopener noreferrer">${escHtml(entry.url)}</a>
        <span class="hsb-entry-meta">${escHtml(meta)}</span>
        ${hasRestore || hasEdit ? `
        <div class="hsb-entry-actions">
          ${hasRestore ? '<button class="hsb-restore-btn" type="button">↩ Reuse form</button>' : ''}
          ${hasEdit    ? '<button class="hsb-edit-btn"    type="button">✏ Edit site</button>'  : ''}
        </div>` : ''}
      `;
      if (hasRestore) {
        li.querySelector('.hsb-restore-btn').addEventListener('click', () => restoreForm(entry));
      }
      if (hasEdit) {
        li.querySelector('.hsb-edit-btn').addEventListener('click', () => openEditModal(entry));
      }
      hsbList.appendChild(li);
    });
    hsbList.removeAttribute('hidden');
  } catch (err) {
    hsbLoading.setAttribute('hidden', '');
    hsbErrorMsg.textContent = `Failed to load: ${err.message}`;
    hsbError.removeAttribute('hidden');
  }
};

historySidebarRefresh.addEventListener('click', loadHistorySidebar);

// Load history on page load
loadHistorySidebar();

// Apply any restore data passed from the history page
const _pendingRestore = localStorage.getItem('pendingRestore');
if (_pendingRestore) {
  localStorage.removeItem('pendingRestore');
  try { restoreForm(JSON.parse(_pendingRestore)); } catch { /* ignore */ }
}

// Open edit modal for entry passed from the history page
const _pendingEdit = localStorage.getItem('pendingEdit');
if (_pendingEdit) {
  localStorage.removeItem('pendingEdit');
  try { openEditModal(JSON.parse(_pendingEdit)); } catch { /* ignore */ }
}

// Open edit modal when arriving from a generated site's "Edit site" FAB
// URL format: /?editRepo=owner/repo&customerName=Acme+Bank
const _urlParams = new URLSearchParams(window.location.search);
const _editRepo = _urlParams.get('editRepo');
if (_editRepo) {
  history.replaceState({}, '', window.location.pathname); // clean URL bar
  openEditModal({
    repoFullName: _editRepo,
    customerName: _urlParams.get('customerName') || _editRepo.split('/').pop(),
  });
}

