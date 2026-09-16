const STORAGE_KEY = 'store_branch_name';

const SUGGESTED_BRANCHES = [
  'Main Street',
  'Downtown',
  'Mall Outlet',
  'Airport',
  'Warehouse'
];

let overlay = null;
let input = null;
let saveBtn = null;
let errorEl = null;
let branchLabel = null;
let resolveReady = null;

export function getBranchName() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function setBranchName(name) {
  const trimmed = name.trim();
  if (trimmed) {
    localStorage.setItem(STORAGE_KEY, trimmed);
  }
  updateBranchLabel();
}

function updateBranchLabel() {
  if (!branchLabel) return;
  const name = getBranchName();
  branchLabel.textContent = name || 'Set Branch';
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
  if (input) {
    input.value = force ? getBranchName() : (getBranchName() || '');
  }

  overlay.classList.add('visible');
  requestAnimationFrame(() => input?.focus());
}

function closeModal() {
  if (!overlay) return;
  overlay.classList.remove('visible');
}

function handleSave() {
  const name = input?.value.trim() || '';
  if (!name) {
    showError('Please enter a store branch name.');
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

function bindSuggestions() {
  const chips = document.querySelectorAll('.branch-chip');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      if (input) input.value = chip.textContent.trim();
      hideError();
    });
  });
}

export function initBranch() {
  overlay = document.getElementById('branch-overlay');
  input = document.getElementById('branch-input');
  saveBtn = document.getElementById('btn-branch-save');
  errorEl = document.getElementById('branch-error');
  branchLabel = document.getElementById('branch-label');

  const changeBtn = document.getElementById('btn-change-branch');
  changeBtn?.addEventListener('click', () => openModal(true));

  saveBtn?.addEventListener('click', handleSave);

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSave();
  });

  input?.addEventListener('input', hideError);

  bindSuggestions();
  updateBranchLabel();

  const existing = getBranchName();
  if (existing) {
    return Promise.resolve(existing);
  }

  openModal(false);

  return new Promise((resolve) => {
    resolveReady = resolve;
  });
}

export { SUGGESTED_BRANCHES };
