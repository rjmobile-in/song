// ==========================================
// 1. SUPABASE INITIALIZATION
// ==========================================
const SUPABASE_URL = 'https://kngchiisfcezqmrptvvt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuZ2NoaWlzZmNlenFtcnB0dnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MzEwMjMsImV4cCI6MjEwNTEwNzAyM30.8NBI8yaNADciacAQsF18WYUbvRkSxZa7fNthhqT9MVQ';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const LOG_TABLE = 'play_logs';

// ==========================================
// 2. STATE MANAGEMENT & DOM ELEMENTS
// ==========================================
let currentPage = 1;
const logsPerPage = 50;
let totalLogsCount = 0;
let realtimeChannel = null;

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const btnLogin = document.getElementById('btn-login');

// ==========================================
// 3. AUTHENTICATION LOGIC
// ==========================================
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
}

function showDashboard() {
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  hideLoginError();
}

loginForm.addEventListener('submit', async (e) => {
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

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  btnLogin.disabled = false;
  btnLogin.textContent = 'Login to Dashboard';

  if (error) showLoginError(error.message);
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  unsubscribeRealtime();
  await supabaseClient.auth.signOut();
  showLogin();
  loginForm.reset();
});

// Auth Listener
supabaseClient.auth.onAuthStateChange(async (event, session) => {
  if (session) {
    showDashboard();
    initDashboard();
  } else {
    showLogin();
  }
});

// ==========================================
// 4. DASHBOARD INITIALIZATION
// ==========================================
function initDashboard() {
  fetchAnalyticsOverview();
  fetchLiveStoreRadar();
  fetchLogs();
  populateBranchFilter();
  // Real-time sync band kar diya gaya hai
}

document.getElementById('btn-refresh-dashboard').addEventListener('click', () => {
  const btn = document.getElementById('btn-refresh-dashboard');
  btn.textContent = 'Refreshing...';
  
  // Ek sath saare sections refresh karega
  fetchAnalyticsOverview();
  fetchLiveStoreRadar();
  fetchLogs();

  // 1 second baad button ka text wapas normal kar dega
  setTimeout(() => { btn.textContent = 'Refresh Dashboard 🔄'; }, 1000);
});

// ==========================================
// 5. ANALYTICS OVERVIEW
// ==========================================
async function fetchAnalyticsOverview() {
  const today = new Date().toISOString().split('T')[0];

  const { data: todayLogs, error } = await supabaseClient
    .from(LOG_TABLE)
    .select('branch_name, event_type')
    .gte('timestamp', `${today}T00:00:00Z`);

  if (error || !todayLogs) return;

  // Total "started" plays today
  const plays = todayLogs.filter(log => log.event_type === 'started').length;
  document.getElementById('stat-total-plays').textContent = plays;

  // Active Branches & Most Active Branch
  const branchCounts = {};
  todayLogs.forEach(log => {
    branchCounts[log.branch_name] = (branchCounts[log.branch_name] || 0) + 1;
  });

  const onlineBranches = Object.keys(branchCounts).length;
  document.getElementById('stat-online-branches').textContent = onlineBranches;

  let mostActive = 'None';
  let maxCount = 0;
  for (const [branch, count] of Object.entries(branchCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostActive = branch;
    }
  }
  document.getElementById('stat-active-branch').textContent = mostActive;
  
  const now = new Date();
  document.getElementById('stat-last-sync').textContent = `Last sync: ${now.toLocaleTimeString()}`;
}

// ==========================================
// 6. STORE PLAYBACK RADAR (INDEPENDENT)
// ==========================================
async function fetchLiveStoreRadar() {
  const grid = document.getElementById('store-grid');
  grid.innerHTML = `<div class="loading-state"><span class="spinner"></span> Syncing radar...</div>`;

  // Ye query Activity Logs ke filters (date, page, search) se ekdum azad hai.
  // Ye hamesha directly database se top 500 latest events uthayegi.
  const { data: radarLogs, error } = await supabaseClient
    .from(LOG_TABLE)
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(500); 

  if (error) {
    grid.innerHTML = `<div class="empty-grid text-danger">Failed to load radar.</div>`;
    return;
  }

  // Har branch ka sirf sabse latest (taaza) event filter out karna
  const latestStatus = new Map();
  radarLogs.forEach(log => {
    if (!latestStatus.has(log.branch_name)) {
      latestStatus.set(log.branch_name, log);
    }
  });

  // Branches ko A to Z sort karna
  const branches = Array.from(latestStatus.values()).sort((a, b) => 
    a.branch_name.localeCompare(b.branch_name)
  );

  grid.innerHTML = '';
  if (branches.length === 0) {
    grid.innerHTML = `<div class="empty-grid">No store activity found.</div>`;
    return;
  }

  // Radar cards render karna
  branches.forEach(store => {
    // Ye wahi time-aware function hai (jo 5 min auto-pause karta hai)
    const status = getBranchStatus(store.event_type, store.timestamp);
    
    grid.innerHTML += `
      <div class="store-card ${status.cardClass}">
        <div class="store-card-header">
          <div class="store-name">${escapeHtml(store.branch_name)}</div>
          <div class="status-badge ${status.cssClass}">${status.label}</div>
        </div>
        <div class="store-song">
          <strong>${escapeHtml(store.song_name || 'Unknown Track')}</strong>
          <br><span class="text-muted" style="font-size: 11px;">Current Status</span>
        </div>
        <div class="store-updated">Updated: ${timeAgo(store.timestamp)}</div>
      </div>
    `;
  });
}

// ==========================================
// 7. ADVANCED FILTERED LOGS & PAGINATION
// ==========================================
async function fetchLogs() {
  const tbody = document.getElementById('activity-body');
  tbody.innerHTML = `<tr><td colspan="5" class="loading-state"><span class="spinner"></span> Loading logs...</td></tr>`;

  const branchFilter = document.getElementById('filter-branch').value;
  const eventFilter = document.getElementById('filter-event').value;
  const dateStart = document.getElementById('filter-date-start').value;
  const dateEnd = document.getElementById('filter-date-end').value;
  const searchFilter = document.getElementById('filter-search').value.toLowerCase();

  let query = supabaseClient.from(LOG_TABLE).select('*', { count: 'exact' });

  // FIXED: branch aur event dono mein '.ilike' use kiya taaki capital/small letter ka farq na pade
  if (branchFilter !== 'all') query = query.ilike('branch_name', `%${branchFilter}%`);
  if (eventFilter !== 'all') query = query.ilike('event_type', `%${eventFilter}%`);
  
  // Agar start date select ki hai
  if (dateStart) {
    query = query.gte('timestamp', `${dateStart}T00:00:00Z`);
  }
  // Agar end date select ki hai
  if (dateEnd) {
    query = query.lte('timestamp', `${dateEnd}T23:59:59Z`);
  }
  if (searchFilter) query = query.ilike('song_name', `%${searchFilter}%`);

  const from = (currentPage - 1) * logsPerPage;
  const to = from + logsPerPage - 1;

  query = query.order('timestamp', { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center p-4">Error fetching data: ${error.message}</td></tr>`;
    return;
  }

  // FIXED: count agar null aaye toh 0 set ho jaye
  totalLogsCount = count || 0;
  updatePaginationUI();

  // FIXED: Agar data null hai ya length 0 hai toh safely "No logs" show kare (Loading stuck problem solved)
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-center p-4">No logs found for this filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(log => `
    <tr>
      <td>${getBadgeHTML(log.event_type)}</td>
      <td class="fw-bold">${escapeHtml(log.branch_name)}</td>
      <td>${escapeHtml(log.song_name || 'Unknown Track')}</td>
      <td class="timestamp-cell">${formatExactDate(log.timestamp)}</td>
      <td class="text-muted">${timeAgo(log.timestamp)}</td>
    </tr>
  `).join('');
}

// Filter Event Listeners
document.getElementById('btn-apply-filters').addEventListener('click', () => {
  currentPage = 1; 
  fetchLogs();
});

document.getElementById('btn-clear-filters').addEventListener('click', () => {
  document.getElementById('filter-branch').value = 'all';
  document.getElementById('filter-event').value = 'all';
  document.getElementById('filter-date-start').value = '';
  document.getElementById('filter-date-end').value = '';
  document.getElementById('filter-search').value = '';
  currentPage = 1;
  fetchLogs();
});

// Pagination Listeners
document.getElementById('btn-page-prev').addEventListener('click', () => {
  if (currentPage > 1) { currentPage--; fetchLogs(); }
});

document.getElementById('btn-page-next').addEventListener('click', () => {
  const maxPages = Math.ceil(totalLogsCount / logsPerPage);
  if (currentPage < maxPages) { currentPage++; fetchLogs(); }
});

function updatePaginationUI() {
  const maxPages = Math.ceil(totalLogsCount / logsPerPage);
  document.getElementById('page-current').textContent = `Page ${currentPage} of ${maxPages || 1}`;
  
  const startCount = totalLogsCount === 0 ? 0 : ((currentPage - 1) * logsPerPage) + 1;
  const endCount = Math.min(currentPage * logsPerPage, totalLogsCount);
  document.getElementById('pagination-info').textContent = `Showing ${startCount}-${endCount} of ${totalLogsCount} logs`;

  document.getElementById('btn-page-prev').disabled = currentPage === 1;
  document.getElementById('btn-page-next').disabled = currentPage === maxPages || maxPages === 0;
}

// ==========================================
// 8. REALTIME SUBSCRIPTION
// ==========================================
function subscribeRealtime() {
  if (realtimeChannel) return;

  realtimeChannel = supabaseClient
    .channel('admin-play-logs')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: LOG_TABLE },
      (payload) => {
        // Bina refresh kiye Dashboard update karna
        fetchAnalyticsOverview();
        fetchLiveStoreRadar();
        
        // Agar admin pehle page pe hai, toh latest log dikhao
        if (currentPage === 1) {
          fetchLogs();
        }
      }
    )
    .subscribe();
}

function unsubscribeRealtime() {
  if (realtimeChannel) {
    supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

function getBranchStatus(eventType, timestamp) {
  const ev = (eventType || '').toLowerCase();
  
  // Current time aur log aane ke time ke beech ka farq (Minutes mein) nikalna
  const now = new Date();
  const logTime = new Date(timestamp);
  const diffInMinutes = (now - logTime) / (1000 * 60);

  // LOGIC: Agar event 'started' hai lekin 5 minute se zyada purana hai, toh 'Auto-Paused' ghoshit kar do
  if (ev === 'started' && diffInMinutes > 5) {
    return { label: 'Auto-Paused', cssClass: 'paused', cardClass: 'status-paused' };
  }

  // Baaki normal conditions
  if (ev === 'started') return { label: 'Playing', cssClass: 'playing', cardClass: 'status-playing' };
  if (ev === 'paused') return { label: 'Paused', cssClass: 'paused', cardClass: 'status-paused' };
  
  return { label: 'Stopped', cssClass: 'stopped', cardClass: 'status-stopped' };
}

function getBadgeHTML(eventType) {
  // .trim() aur .toLowerCase() se extra space aur capital/small letter ka chakkar khatam ho jayega
  const ev = (eventType || '').toLowerCase().trim();
  
  if (ev === 'started') return '<span class="badge badge-play">▶ PLAYING</span>';
  if (ev === 'paused') return '<span class="badge badge-pause">⏸ PAUSED</span>';
  return '<span class="badge badge-stop">⏹ ENDED</span>';
}

function timeAgo(dateString) {
  const date = new Date(dateString);
  const diffInSec = Math.floor((new Date() - date) / 1000);

  if (diffInSec < 60) return `Just now`;
  if (diffInSec < 3600) return `${Math.floor(diffInSec / 60)}m ago`;
  if (diffInSec < 86400) return `${Math.floor(diffInSec / 3600)}h ago`;
  return `${Math.floor(diffInSec / 86400)}d ago`;
}

function formatExactDate(dateString) {
  return new Date(dateString).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Populate Branch Filter Dropdown (Fixed List)
function populateBranchFilter() {
  const fixedBranches = [
    'DCM',
    'Jhotwara',
    'Lohamandi',
    'Murlipura, 1 Number',
    'Murlipura, 6 Number',
    'Shastri Nagar',
    'VKI, 17 Number'
  ];

  const select = document.getElementById('filter-branch');
  
  // Aadhiche options clear kara ani fakt 'All Branches' theva
  select.innerHTML = '<option value="all">All Branches</option>';

  // Tumchi fixed list add kara
  fixedBranches.forEach(b => {
    select.innerHTML += `<option value="${b}">${b}</option>`;
  });
}

// ==========================================
// 10. CSV EXPORT (Download Report)
// ==========================================
document.getElementById('btn-export-csv').addEventListener('click', async () => {
  const btn = document.getElementById('btn-export-csv');
  const originalText = btn.textContent;
  btn.textContent = 'Preparing CSV...';
  
  const { data, error } = await supabaseClient
    .from(LOG_TABLE)
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(5000); // Export up to 5000 logs

  if (error || !data.length) {
    alert("No data to export or error occurred.");
    btn.textContent = originalText;
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Timestamp,Branch,Event Type,Song Title\n"; 

  data.forEach(row => {
    const song = (row.song_name || '').replace(/"/g, '""');
    const branch = (row.branch_name || '').replace(/"/g, '""');
    const date = new Date(row.timestamp).toLocaleString('en-IN').replace(/,/g, '');
    
    csvContent += `"${date}","${branch}","${row.event_type}","${song}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `RJMobile_Logs_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  btn.textContent = originalText;
});