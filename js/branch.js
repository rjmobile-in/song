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
let branchListEl = null;
let saveBtn = null;
let errorEl = null;
let branchLabel = null;
let resolveReady = null;
let currentSelection = '';

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
  branchLabel.textContent = name || 'Branch';
}

function renderBranches() {
  if (!branchListEl) return;
  branchListEl.innerHTML = '';
  
  BRANCHES.forEach((branch) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'branch-btn';
    
    if (branch === currentSelection) {
      btn.classList.add('selected');
    }
    
    btn.textContent = branch;
    
    btn.addEventListener('click', () => {
      currentSelection = branch;
      hideError();
      if (saveBtn) saveBtn.disabled = false;
      renderBranches();
    });
    
    branchListEl.appendChild(btn);
  });
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
  
  const saved = getBranchName();
  if (force && saved && BRANCHES.includes(saved)) {
    currentSelection = saved;
    if (saveBtn) saveBtn.disabled = false;
  } else {
    currentSelection = '';
    if (saveBtn) saveBtn.disabled = true;
  }
  
  renderBranches();
  overlay.classList.add('visible');
}

function closeModal() {
  if (!overlay) return;
  overlay.classList.remove('visible');
}

function handleSave() {
  if (!currentSelection || !BRANCHES.includes(currentSelection)) {
    showError('Please select a store branch from the list.');
    return;
  }

  hideError();
  setBranchName(currentSelection);
  closeModal();

  if (resolveReady) {
    resolveReady(currentSelection);
    resolveReady = null;
  }
}

export function initBranch() {
  overlay = document.getElementById('branch-overlay');
  branchListEl = document.getElementById('branch-list');
  saveBtn = document.getElementById('btn-branch-save');
  errorEl = document.getElementById('branch-error');
  branchLabel = document.getElementById('branch-label');

  const changeBtn = document.getElementById('btn-change-branch');
  if (changeBtn) {
    changeBtn.addEventListener('click', () => openModal(true));
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', handleSave);
  }

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