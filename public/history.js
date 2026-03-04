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

const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

const loadingEl   = document.getElementById('history-loading');
const contentEl   = document.getElementById('history-content');
const emptyEl     = document.getElementById('history-empty');
const errorEl     = document.getElementById('history-error');
const errorMsgEl  = document.getElementById('history-error-msg');
const tbodyEl     = document.getElementById('history-tbody');
const subEl       = document.getElementById('history-sub');
const countEl     = document.getElementById('history-count');

const show = (el) => el.removeAttribute('hidden');
const hide = (el) => el.setAttribute('hidden', '');

const loadHistory = async () => {
  show(loadingEl);
  hide(contentEl);
  hide(emptyEl);
  hide(errorEl);
  hide(countEl);
  subEl.textContent = 'Loading deployments…';

  try {
    const res = await fetch('/api/history');
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);
    const entries = await res.json();

    hide(loadingEl);

    if (!Array.isArray(entries) || entries.length === 0) {
      subEl.textContent = 'No deployments recorded yet.';
      show(emptyEl);
      return;
    }

    const count = entries.length;
    subEl.textContent = `${count} deployment${count !== 1 ? 's' : ''} recorded — newest first`;
    countEl.textContent = String(count);
    show(countEl);

    tbodyEl.innerHTML = '';
    entries.forEach((entry, i) => {
      const tr = document.createElement('tr');
      const templateLabel = TEMPLATE_LABELS[entry.templateId] || entry.templateId || '—';
      const hasRestore = entry.templateId === 'custom';
      const hasEdit    = !!entry.repoFullName;
      tr.innerHTML = `
        <td class="history-row-num">${count - i}</td>
        <td><strong>${escHtml(entry.customerName)}</strong></td>
        <td><span class="template-badge" data-type="${escHtml(entry.templateId)}">${escHtml(templateLabel)}</span></td>
        <td>${escHtml(entry.language || '—')}</td>
        <td><a class="history-url-link" href="${escHtml(entry.url)}" target="_blank" rel="noopener noreferrer">${escHtml(entry.url)}</a></td>
        <td class="history-date">${escHtml(formatDate(entry.timestamp))}</td>
        <td class="history-actions-cell">
          ${hasRestore ? '<button class="restore-btn" type="button">↩ Reuse</button>' : ''}
          ${hasEdit    ? '<button class="edit-btn"    type="button">✏ Edit</button>'   : ''}
        </td>
      `;
      if (hasRestore) {
        tr.querySelector('.restore-btn').addEventListener('click', () => {
          localStorage.setItem('pendingRestore', JSON.stringify(entry));
          window.location.href = '/';
        });
      }
      if (hasEdit) {
        tr.querySelector('.edit-btn').addEventListener('click', () => {
          localStorage.setItem('pendingEdit', JSON.stringify(entry));
          window.location.href = '/';
        });
      }
      tbodyEl.appendChild(tr);
    });

    show(contentEl);
  } catch (err) {
    hide(loadingEl);
    errorMsgEl.textContent = err.message;
    show(errorEl);
    subEl.textContent = 'Could not load deployments.';
  }
};

document.getElementById('refresh-btn').addEventListener('click', loadHistory);
document.getElementById('retry-btn').addEventListener('click', loadHistory);

loadHistory();
