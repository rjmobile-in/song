const STORAGE_KEY = 'store_branch_name';

const BRANCHES = [
  'Jhotwara',
  'Lohamandi',
  'Murlipura, 1 Number',
  'Murlipura, 6 Number',
  'Shastri Nagar',
  'VKI, 17 Number'
];

let overlay = null;
let select = null;
let saveBtn = null;
let errorEl = null;
let branchLabel = null;
let resolveReady = null;

export function getBranchName() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function setBranchName(name) {
  if (BRANCHES.includes(name)) {
    localStorage.setItem(STORAGE_KEY, name);
  }
  updateBranchLabel();
}

function updateBranchLabel() {
  if (!branchLabel) return;
  const name = getBranchName();
  branchLabel.textContent = name || 'Set Branch';
}

function populateSelect() {
  if (!select) return;

  select.innerHTML =
    '<option value="" disabled selected>Select your branch...</option>' +
    BRANCHES.map(
      (branch) => `<option value="${escapeAttr(branch)}">${escapeHtml(branch)}</option>`
    ).join('');
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showError(message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.add('visible');
}

function hideError() {
  if (!errorEl) return;
  errorEl.classList.remove('visible');
}

function openModal(force = false) {
  if (!overlay) return;

  hideError();
  populateSelect();

  const saved = getBranchName();
  if (select) {
    if (force && saved && BRANCHES.includes(saved)) {
      select.value = saved;
    } else {
      select.selectedIndex = 0;
    }
  }

  overlay.classList.add('visible');
  requestAnimationFrame(() => select?.focus());
}

function closeModal() {
  if (!overlay) return;
  overlay.classList.remove('visible');
}

function handleSave() {
  const name = select?.value || '';

  if (!name || !BRANCHES.includes(name)) {
    showError('Please select a store branch from the list.');
    return;
  }

  hideError();
  setBranchName(name);
  closeModal();

  if (resolveReady) {
    resolveReady(name);
    resolveReady = null;
  }
}

export function initBranch() {
  overlay = document.getElementById('branch-overlay');
  select = document.getElementById('branch-select');
  saveBtn = document.getElementById('btn-branch-save');
  errorEl = document.getElementById('branch-error');
  branchLabel = document.getElementById('branch-label');

  const changeBtn = document.getElementById('btn-change-branch');
  changeBtn?.addEventListener('click', () => openModal(true));

  saveBtn?.addEventListener('click', handleSave);

  select?.addEventListener('change', hideError);

  populateSelect();
  updateBranchLabel();

  const existing = getBranchName();
  if (existing && BRANCHES.includes(existing)) {
    return Promise.resolve(existing);
  }

  if (existing && !BRANCHES.includes(existing)) {
    localStorage.removeItem(STORAGE_KEY);
  }

  openModal(false);

  return new Promise((resolve) => {
    resolveReady = resolve;
  });
}

export { BRANCHES };
