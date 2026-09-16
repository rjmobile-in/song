const SUPABASE_URL = 'https://kngchiisfcezqmrptvvt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuZ2NoaWlzZmNlenFtcnB0dnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MzEwMjMsImV4cCI6MjEwNTEwNzAyM30.8NBI8yaNADciacAQsF18WYUbvRkSxZa7fNthhqT9MVQ';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let logs = [];
let realtimeChannel = null;

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const storeGrid = document.getElementById('store-grid');
const activityBody = document.getElementById('activity-body');

function showLoginError(message) {
  loginError.textContent = message;
  loginError.classList.add('visible');
}

function hideLoginError() {
  loginError.classList.remove('visible');
}

function showLogin() {
  unsubscribeRealtime();
  loginView.classList.remove('hidden');
  dashboardView.classList.add('hidden');
  logs = [];
}

function showDashboard() {
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  hideLoginError();
}

function formatTimestamp(iso) {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function getBranchStatus(eventType) {
  switch (eventType) {
    case 'started':
      return { label: 'Playing', cssClass: 'playing', cardClass: 'status-playing' };
    case 'paused':
      return { label: 'Paused', cssClass: 'paused', cardClass: 'status-paused' };
    case 'ended':
    default:
      return { label: 'Stopped', cssClass: 'stopped', cardClass: 'status-stopped' };
  }
}

function deriveBranchStatuses(allLogs) {
  const branchMap = new Map();

  for (const log of allLogs) {
    if (!branchMap.has(log.branch_name)) {
      branchMap.set(log.branch_name, log);
    }
  }

  return Array.from(branchMap.values()).sort((a, b) =>
    a.branch_name.localeCompare(b.branch_name)
  );
}

function renderStoreGrid() {
  const branches = deriveBranchStatuses(logs);

  if (branches.length === 0) {
    storeGrid.innerHTML = '<div class="empty-grid">No store activity recorded yet.</div>';
    return;
  }

  storeGrid.innerHTML = branches
    .map((log) => {
      const status = getBranchStatus(log.event_type);
      return `
        <div class="store-card ${status.cardClass}">
          <div class="store-card-header">
            <span class="store-name">${escapeHtml(log.branch_name)}</span>
            <span class="status-badge ${status.cssClass}">${status.label}</span>
          </div>
          <div class="store-song">Now: <strong>${escapeHtml(log.song_name)}</strong></div>
          <div class="store-updated">${formatTimestamp(log.timestamp)}</div>
        </div>
      `;
    })
    .join('');
}

function renderActivityTable() {
  const recent = logs.slice(0, 50);

  if (recent.length === 0) {
    activityBody.innerHTML =
      '<tr><td colspan="4" class="loading-text">No activity recorded yet.</td></tr>';
    return;
  }

  activityBody.innerHTML = recent
    .map(
      (log) => `
        <tr>
          <td>${escapeHtml(log.branch_name)}</td>
          <td>${escapeHtml(log.song_name)}</td>
          <td><span class="event-tag ${log.event_type}">${log.event_type}</span></td>
          <td class="timestamp-cell">${formatTimestamp(log.timestamp)}</td>
        </tr>
      `
    )
    .join('');
}

function renderAll() {
  renderStoreGrid();
  renderActivityTable();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function fetchLogs() {
  storeGrid.innerHTML = '<div class="loading-text">Loading store status...</div>';
  activityBody.innerHTML =
    '<tr><td colspan="4" class="loading-text">Loading activity...</td></tr>';

  const { data, error } = await supabase
    .from('play_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(100);

  if (error) {
    storeGrid.innerHTML = `<div class="empty-grid">Failed to load logs: ${escapeHtml(error.message)}</div>`;
    activityBody.innerHTML =
      `<tr><td colspan="4" class="loading-text">Failed to load activity.</td></tr>`;
    return;
  }

  logs = data || [];
  renderAll();
}

function subscribeRealtime() {
  if (realtimeChannel) return;

  realtimeChannel = supabase
    .channel('admin-play-logs')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'play_logs' },
      (payload) => {
        logs.unshift(payload.new);
        if (logs.length > 100) logs.length = 100;
        renderAll();
      }
    )
    .subscribe();
}

function unsubscribeRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

async function onAuthenticated() {
  showDashboard();
  await fetchLogs();
  subscribeRealtime();
}

async function handleLogin(e) {
  e.preventDefault();
  hideLoginError();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    showLoginError('Please enter both email and password.');
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = 'Signing in...';

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  btnLogin.disabled = false;
  btnLogin.textContent = 'Login';

  if (error) {
    showLoginError(error.message);
  }
}

async function handleLogout() {
  unsubscribeRealtime();
  await supabase.auth.signOut();
  showLogin();
  loginForm.reset();
}

async function init() {
  loginForm.addEventListener('submit', handleLogin);
  btnLogout.addEventListener('click', handleLogout);

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION') {
      if (session) await onAuthenticated();
      else showLogin();
      return;
    }
    if (event === 'SIGNED_OUT') {
      showLogin();
    } else if (event === 'SIGNED_IN' && session) {
      await onAuthenticated();
    }
  });
}

init();
