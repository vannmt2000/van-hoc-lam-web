// ============================================
// DASHBOARD LOGIC - OTS ERP
// ============================================

const supabaseClient = window.supabaseClient;

let currentUser = null;
let currentProfile = null;
let currentCompany = null;
let currentStatus = 'online';
let idleTimer = null;
let statusUpdateTimer = null;
let lunchCheckTimer = null;
let clockTimer = null;

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const STATUS_UPDATE_INTERVAL = 30 * 1000;

// ============================================
// MENU THEO ROLE — Ưu tiên Duyệt lên đầu
// ============================================
const MENU_BY_ROLE = {
  admin: [
    { id: 'dashboard', icon: 'home', label: 'Dashboard', href: 'dashboard.html' },
    { id: 'approvals', icon: 'check-square', label: 'Duyệt', href: '#', badge: 5 },
    { id: 'reports', icon: 'bar-chart-3', label: 'Báo cáo', href: '#' },
    { id: 'sales', icon: 'badge-dollar-sign', label: 'Kinh doanh', href: '#' },
    { id: 'warehouse', icon: 'package', label: 'Kho', href: '#' },
    { id: 'suppliers', icon: 'factory', label: 'Nhà cung cấp', href: '#' },
    { id: 'hr', icon: 'users', label: 'Nhân sự', href: '#' },
    { id: 'settings', icon: 'settings', label: 'Cài đặt', href: '#' }
  ],
  manager: [
    { id: 'dashboard', icon: 'home', label: 'Dashboard', href: 'dashboard.html' },
    { id: 'approvals', icon: 'check-square', label: 'Duyệt', href: '#', badge: 3 },
    { id: 'tasks', icon: 'target', label: 'Task tôi', href: '#' },
    { id: 'team-tasks', icon: 'list-checks', label: 'Task nhóm', href: '#' },
    { id: 'sales', icon: 'badge-dollar-sign', label: 'Kinh doanh', href: '#' },
    { id: 'team', icon: 'users', label: 'NV nhóm', href: '#' },
    { id: 'warehouse', icon: 'package', label: 'Xem kho', href: '#' }
  ],
  hr: [
    { id: 'dashboard', icon: 'home', label: 'Dashboard', href: 'dashboard.html' },
    { id: 'approvals', icon: 'check-square', label: 'Duyệt', href: '#', badge: 2 },
    { id: 'staff', icon: 'users', label: 'Nhân viên', href: '#' },
    { id: 'attendance', icon: 'clock', label: 'Chấm công', href: '#' },
    { id: 'salary', icon: 'banknote', label: 'Lương thưởng', href: '#' },
    { id: 'contracts', icon: 'file-text', label: 'Hợp đồng', href: '#' },
    { id: 'recruitment', icon: 'user-plus', label: 'Tuyển dụng', href: '#' }
  ],
  it: [
    { id: 'dashboard', icon: 'home', label: 'Dashboard', href: 'dashboard.html' },
    { id: 'tickets', icon: 'ticket', label: 'Ticket', href: '#', badge: 5 },
    { id: 'devices', icon: 'laptop', label: 'Thiết bị', href: '#' },
    { id: 'reports-it', icon: 'bar-chart-3', label: 'Báo cáo IT', href: '#' }
  ],
  staff: [
    { id: 'dashboard', icon: 'home', label: 'Dashboard', href: 'dashboard.html' },
    { id: 'tasks', icon: 'target', label: 'Task tôi', href: '#' },
    { id: 'work', icon: 'briefcase', label: 'Công việc', href: '#' },
    { id: 'colleagues', icon: 'users', label: 'Đồng nghiệp', href: '#' },
    { id: 'leave', icon: 'plane', label: 'Xin nghỉ phép', href: '#' },
    { id: 'chat', icon: 'message-circle', label: 'Chat', href: '#' }
  ]
};

// ============================================
// KHỞI TẠO
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('✅ Dashboard loading...');
  if (typeof lucide !== 'undefined') lucide.createIcons();

  loadTheme();

  await waitForSession();
  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  await loadUserProfile();
  await loadCompany();
  await updateStatusToServer('online');
  await new Promise(r => setTimeout(r, 500));
  await loadDashboardStats();

  renderSidebar();
  renderWelcome();
  startClock();
  updateUserUI();
  loadCustomize();

  initIdleTimer();
  initStatusUpdater();
  initLunchPopup();
  initSearchShortcut();
  initGlobalListeners();
  initCustomizeDragDrop();

  if (typeof lucide !== 'undefined') lucide.createIcons();
  console.log('✅ Dashboard ready');

  const splash = document.getElementById('app-splash');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 300);
  }
});

// ============================================
// THEME
// ============================================
function loadTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme-preload', saved);
  
  if (saved === 'dark') {
    document.body.classList.add('dark-mode');
    const icon = document.getElementById('theme-icon');
    if (icon) icon.setAttribute('data-lucide', 'moon');
  } else {
    document.body.classList.remove('dark-mode');
    const icon = document.getElementById('theme-icon');
    if (icon) icon.setAttribute('data-lucide', 'sun');
  }
  console.log('🎨 Theme loaded:', saved);
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  const newTheme = isDark ? 'dark' : 'light';
  
  // QUAN TRỌNG: Update CẢ attribute HTML lẫn localStorage
  document.documentElement.setAttribute('data-theme-preload', newTheme);
  localStorage.setItem('theme', newTheme);
  
  const icon = document.getElementById('theme-icon');
  if (icon) icon.setAttribute('data-lucide', isDark ? 'moon' : 'sun');
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  console.log('🎨 Theme toggled:', newTheme);
}

// ============================================
// SESSION
// ============================================
async function waitForSession() {
  let result = await supabaseClient.auth.getSession();
  if (result.data.session) {
    currentUser = result.data.session.user;
    console.log('✅ Session có sẵn:', currentUser.email);
    return;
  }

  console.log('⏳ Đợi session...');
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 500));
    result = await supabaseClient.auth.getSession();
    if (result.data.session) {
      currentUser = result.data.session.user;
      return;
    }
  }
}

// ============================================
// PROFILE + COMPANY
// ============================================
async function loadUserProfile() {
  try {
    const result = await supabaseClient
      .from('profiles').select('*').eq('id', currentUser.id).single();
    if (result.error) throw result.error;
    currentProfile = result.data;
    console.log('✅ Profile:', currentProfile.full_name, '·', currentProfile.role);
  } catch (err) {
    console.error('❌ Lỗi profile:', err.message);
    currentProfile = {
      full_name: currentUser.email.split('@')[0],
      role: 'staff', position: 'Nhân viên', department: 'Chưa phân bổ'
    };
  }
}

async function loadCompany() {
  if (!currentProfile || !currentProfile.company_id) return;
  try {
    const result = await supabaseClient
      .from('companies').select('*').eq('id', currentProfile.company_id).single();
    if (result.data) {
      currentCompany = result.data;
      const logoText = document.querySelector('.dash-logo-text');
      if (logoText) logoText.textContent = currentCompany.name;
      console.log('✅ Company:', currentCompany.name);
    }
  } catch (err) {
    console.error('❌ Lỗi company:', err.message);
  }
}

// ============================================
// STATS
// ============================================
async function loadDashboardStats() {
  try {
    const staffResult = await supabaseClient
      .from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true);
    const onlineResult = await supabaseClient
      .from('user_status').select('*', { count: 'exact', head: true }).eq('status', 'online');

    const staffCount = staffResult.count || 0;
    const onlineCount = onlineResult.count || 0;

    updateKPICard('nhansu', staffCount, onlineCount + ' online');
    updateKPICard('doanhthu', '—', 'Chưa có dữ liệu');
    updateKPICard('donhang', '—', 'Chưa có dữ liệu');
    updateKPICard('tonkho', '—', 'Chưa có dữ liệu');
    console.log('✅ Stats:', { staffCount, onlineCount });
  } catch (err) {
    console.error('❌ Lỗi stats:', err);
  }
}

function updateKPICard(key, value, subtitle) {
  const el = document.querySelector('[data-kpi="' + key + '"]');
  if (!el) return;
  const valueEl = el.querySelector('.dash-kpi-value');
  const trendEl = el.querySelector('.dash-kpi-trend');
  if (valueEl) valueEl.textContent = typeof value === 'number' ? value.toLocaleString('vi-VN') : value;
  if (trendEl) trendEl.textContent = subtitle;
}

// ============================================
// SIDEBAR
// ============================================
function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  const role = (currentProfile && currentProfile.role) || 'staff';
  const menus = MENU_BY_ROLE[role] || MENU_BY_ROLE.staff;

  let html = '';
  menus.forEach(item => {
    const activeClass = item.id === 'dashboard' ? ' active' : '';
    html += '<button class="sidebar-item' + activeClass + '" onclick="navigateTo(\'' + item.href + '\')">';
    html += '<i data-lucide="' + item.icon + '"></i>';
    html += '<span>' + item.label + '</span>';
    if (item.badge) {
      html += '<span class="sidebar-badge">' + item.badge + '</span>';
    }
    html += '</button>';
  });
  nav.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================
// WELCOME + CLOCK
// ============================================
function renderWelcome() {
  const name = (currentProfile && currentProfile.full_name) || currentUser.email;
  const el = document.getElementById('welcome-name');
  if (el) el.textContent = name;
}

function startClock() {
  updateClock();
  clockTimer = setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dateStr = String(now.getDate()).padStart(2, '0');
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hourStr = String(now.getHours()).padStart(2, '0');
  const minStr = String(now.getMinutes()).padStart(2, '0');
  const secStr = String(now.getSeconds()).padStart(2, '0');

  const el = document.getElementById('welcome-date');
  if (el) {
    el.textContent = '📅 ' + days[now.getDay()] + ', ' + dateStr + '/' + monthStr + '/' + year +
      ' · 🕐 ' + hourStr + ':' + minStr + ':' + secStr;
  }
}

// ============================================
// USER UI
// ============================================
function updateUserUI() {
  const name = (currentProfile && currentProfile.full_name) || currentUser.email;
  const initial = name.charAt(0).toUpperCase();
  const roleLabel = getRoleLabel(currentProfile ? currentProfile.role : 'staff');

  const avatarEl = document.getElementById('user-avatar');
  const nameEl = document.getElementById('user-name');
  const avatarMenuEl = document.getElementById('user-avatar-menu');
  const nameMenuEl = document.getElementById('user-name-menu');
  const roleMenuEl = document.getElementById('user-role-menu');

  if (avatarEl) avatarEl.textContent = initial;
  if (nameEl) nameEl.textContent = name;
  if (avatarMenuEl) avatarMenuEl.textContent = initial;
  if (nameMenuEl) nameMenuEl.textContent = name;
  if (roleMenuEl) roleMenuEl.textContent = roleLabel + ' · ' +
    ((currentProfile && currentProfile.position) || 'Nhân viên');
}

function getRoleLabel(role) {
  const labels = { admin: 'Quản trị viên', manager: 'Quản lý', hr: 'Nhân sự', it: 'IT', staff: 'Nhân viên' };
  return labels[role] || 'Nhân viên';
}

// ============================================
// STATUS
// ============================================
function initStatusUpdater() {
  currentStatus = 'online';
  updateStatusDot('online');
  updateStatusToServer('online');
  statusUpdateTimer = setInterval(() => updateStatusToServer(currentStatus), STATUS_UPDATE_INTERVAL);
}

async function updateStatusToServer(status) {
  try {
    await supabaseClient.from('user_status').upsert({
      user_id: currentUser.id, status: status,
      last_activity: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      current_page: window.location.pathname,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  } catch (err) {}
}

function updateStatusDot(status) {
  const dot = document.getElementById('status-dot');
  if (dot) dot.className = 'dash-user-status-dot ' + status;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    currentStatus = 'away';
    updateStatusDot('away');
    updateStatusToServer('away');
  } else if (currentUser) {
    currentStatus = 'online';
    updateStatusDot('online');
    updateStatusToServer('online');
    resetIdleTimer();
  }
});

// ============================================
// IDLE
// ============================================
function initIdleTimer() {
  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  if (!currentUser) return;
  idleTimer = setTimeout(showSessionExpired, IDLE_TIMEOUT_MS);
}

function showSessionExpired() {
  sessionStorage.setItem('return_url', window.location.pathname + window.location.search);
  updateStatusToServer('offline');
  supabaseClient.auth.signOut();
  const popup = document.getElementById('session-popup');
  if (popup) popup.classList.add('show');
}

function relogin() { window.location.href = 'login.html'; }

// ============================================
// LUNCH POPUP
// ============================================
const LUNCH_MESSAGES = [
  { icon: '🍜', title: 'Trưa rồi!', text: 'Ăn gì chưa đó?<br>Gác việc lại xíu, ăn trưa rồi tính tiếp nha 😋' },
  { icon: '🌮', title: '12h gòi', text: 'Nghỉ xíu đi nè<br>Đói bụng làm gì cũng không dzui đâu ó 😆' },
  { icon: '☕', title: 'Trưa đến rồi', text: 'Gác lại chút, nạp năng lượng nha!<br>(Làm gì thì làm, đừng bỏ bữa á 🥲)' },
  { icon: '🍱', title: 'Nghỉ trưa nha', text: 'Trưa nay ăn gì ta?<br>Cơm tấm, phở, hay bún bò? 🤤' },
  { icon: '😴', title: 'Trưa gòi', text: 'Mắt nhắm mắt mở xíu đi<br>Chiều còn quẩy tiếp 💪' },
  { icon: '🍲', title: 'Nghỉ xíu nha', text: 'Đói bụng rồi đúng không?<br>Ăn gì đi rồi làm tiếp 📢' },
  { icon: '🥗', title: 'Trưa oyyy', text: 'Ăn healthy hay ăn gì cũng được<br>Miễn là ăn nha 🥰' },
  { icon: '🍕', title: 'Đến giờ trưa', text: 'Đừng skip bữa trưa nha<br>Chiều đói xỉu giờ 😵' },
  { icon: '🍛', title: 'Trưa rồiiii', text: 'Đi ăn thôi nào<br>Mai làm tiếp 😎' },
  { icon: '🍔', title: '12h gòi đó', text: 'Nghỉ ngơi xíu đi<br>Não cần được sạc pin 🔋' }
];

function initLunchPopup() {
  lunchCheckTimer = setInterval(checkLunchTime, 60 * 1000);
  checkLunchTime();
}

function checkLunchTime() {
  const now = new Date();
  if (now.getHours() === 12 && now.getMinutes() === 0 && !document.hidden) {
    const today = now.toISOString().split('T')[0];
    if (localStorage.getItem('lunch_popup_shown') !== today) {
      showLunchPopup();
      localStorage.setItem('lunch_popup_shown', today);
    }
  }
}

function getUserLunchMessage(userId) {
  const today = new Date().toISOString().split('T')[0];
  const key = userId + '_' + today;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return LUNCH_MESSAGES[Math.abs(hash) % LUNCH_MESSAGES.length];
}

function showLunchPopup() {
  const msg = getUserLunchMessage(currentUser ? currentUser.id : 'default');
  const iconEl = document.getElementById('lunch-icon');
  const titleEl = document.getElementById('lunch-title');
  const textEl = document.getElementById('lunch-text');
  if (iconEl) iconEl.textContent = msg.icon;
  if (titleEl) titleEl.textContent = msg.title;
  if (textEl) textEl.innerHTML = msg.text;
  const popup = document.getElementById('lunch-popup');
  if (popup) popup.classList.add('show');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeLunchPopup() {
  const popup = document.getElementById('lunch-popup');
  if (popup) popup.classList.remove('show');
}

// ============================================
// SEARCH
// ============================================
let searchTimeout = null;

function handleSearchInput(query) {
  clearTimeout(searchTimeout);
  const resultsBox = document.getElementById('search-results');
  if (!resultsBox) return;

  if (!query || query.trim().length < 2) {
    resultsBox.classList.remove('show');
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      const result = await supabaseClient
        .from('profiles')
        .select('id, full_name, avatar_url, department, position, work_email')
        .ilike('full_name', '%' + query + '%')
        .eq('is_active', true)
        .limit(8);
      if (result.error) throw result.error;
      renderSearchResults(result.data || []);
    } catch (err) {
      console.error('Lỗi search:', err);
      resultsBox.classList.remove('show');
    }
  }, 300);
}

function renderSearchResults(results) {
  const box = document.getElementById('search-results');
  if (!box) return;

  if (results.length === 0) {
    box.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:14px;">Không tìm thấy kết quả</div>';
    box.classList.add('show');
    return;
  }

  let html = '';
  results.forEach(user => {
    const initial = user.full_name.charAt(0).toUpperCase();
    html += '<div class="search-result-item" onclick="viewProfile(\'' + user.id + '\')">';
    html += '<div class="search-result-avatar">' + initial + '</div>';
    html += '<div class="search-result-info">';
    html += '<div class="search-result-name">' + user.full_name + '</div>';
    html += '<div class="search-result-meta">' + (user.position || 'Nhân viên') +
      ' · ' + (user.department || 'Chưa phân bổ') + '</div>';
    html += '</div></div>';
  });
  box.innerHTML = html;
  box.classList.add('show');
}

function showSearchResults() {
  const input = document.getElementById('global-search');
  if (!input) return;
  if (input.value && input.value.length >= 2) {
    const box = document.getElementById('search-results');
    if (box) box.classList.add('show');
  }
}

function viewProfile(userId) {
  console.log('Xem profile:', userId);
  const box = document.getElementById('search-results');
  const input = document.getElementById('global-search');
  if (box) box.classList.remove('show');
  if (input) input.value = '';
}

function initSearchShortcut() {
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const input = document.getElementById('global-search');
      if (input) input.focus();
    }
    if (e.key === 'Escape') {
      const box = document.getElementById('search-results');
      if (box) box.classList.remove('show');
      closeLunchPopup();
      closeLogoutConfirm();
      closeUserMenu();
      closeNotifMenu();
    }
  });
}

// ============================================
// CUSTOMIZE
// ============================================
function initCustomizeDragDrop() {
  const items = document.querySelectorAll('.dash-customize-item');
  let draggedItem = null;

  items.forEach(item => {
    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', () => { draggedItem = item; item.style.opacity = '0.4'; });
    item.addEventListener('dragend', () => { item.style.opacity = '1'; draggedItem = null; });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (!draggedItem || draggedItem === item) return;
      const parent = item.parentNode;
      const allItems = Array.from(parent.children);
      const draggedIndex = allItems.indexOf(draggedItem);
      const targetIndex = allItems.indexOf(item);
      if (draggedIndex < targetIndex) {
        parent.insertBefore(draggedItem, item.nextSibling);
      } else {
        parent.insertBefore(draggedItem, item);
      }
    });
  });
}

function toggleCustomize() {
  const panel = document.getElementById('customize-panel');
  if (panel) panel.classList.toggle('show');
}

function saveCustomize() {
  const items = document.querySelectorAll('.dash-customize-item');
  const config = [];
  items.forEach((item, index) => {
    config.push({
      id: item.dataset.widget,
      order: index,
      visible: item.querySelector('input[type="checkbox"]').checked
    });
  });
  localStorage.setItem('dashboard_config', JSON.stringify(config));
  console.log('✅ Đã lưu cấu hình:', config);
  alert('✅ Đã lưu cấu hình Dashboard!');
  toggleCustomize();
}

function loadCustomize() {
  const saved = localStorage.getItem('dashboard_config');
  if (!saved) return;
  try {
    const config = JSON.parse(saved);
    const container = document.querySelector('.dash-customize-body');
    if (!container) return;
    const items = Array.from(container.querySelectorAll('.dash-customize-item'));
    config.forEach(cfg => {
      const item = items.find(i => i.dataset.widget === cfg.id);
      if (item) {
        container.appendChild(item);
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = cfg.visible;
      }
    });
  } catch (e) { console.error('Lỗi load config:', e); }
}

// ============================================
// UI TOGGLE
// ============================================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('show');
}

function toggleUserMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('user-menu');
  const notif = document.getElementById('notif-menu');
  if (notif) notif.classList.remove('show');
  if (menu) menu.classList.toggle('show');
}

function toggleNotifications(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('user-menu');
  const notif = document.getElementById('notif-menu');
  if (menu) menu.classList.remove('show');
  if (notif) notif.classList.toggle('show');
}

function closeUserMenu() {
  const m = document.getElementById('user-menu');
  if (m) m.classList.remove('show');
}

function closeNotifMenu() {
  const m = document.getElementById('notif-menu');
  if (m) m.classList.remove('show');
}

function setTimeFilter(period) {
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === period);
  });
  console.log('Time filter:', period);
}

// ============================================
// ACTIONS
// ============================================
function navigateTo(href) {
  if (href === '#') {
    alert('Chức năng này sẽ được thêm sau');
    return;
  }
  window.location.href = href;
}

function goToProfile() { closeUserMenu(); alert('Trang hồ sơ sẽ được thêm sau'); }
function changePassword() { closeUserMenu(); alert('Đổi mật khẩu sẽ được thêm sau'); }
function requestLeave() { closeUserMenu(); alert('Xin nghỉ phép sẽ được thêm sau'); }

function markAllRead() {
  document.querySelectorAll('.dash-notif-item').forEach(i => i.classList.remove('unread'));
  const badge = document.getElementById('notif-badge');
  if (badge) badge.style.display = 'none';
}

function viewAllNotifications() { closeNotifMenu(); alert('Trang thông báo sẽ được thêm sau'); }

// ============================================
// LOGOUT
// ============================================
function confirmLogout() {
  closeUserMenu();
  const p = document.getElementById('logout-popup');
  if (p) p.classList.add('show');
}

function closeLogoutConfirm() {
  const p = document.getElementById('logout-popup');
  if (p) p.classList.remove('show');
}

async function doLogout() {
  await updateStatusToServer('offline');
  sessionStorage.removeItem('return_url');
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}

// ============================================
// GLOBAL LISTENERS
// ============================================
function initGlobalListeners() {
  document.addEventListener('click', e => {
    const userMenu = document.getElementById('user-menu');
    const notifMenu = document.getElementById('notif-menu');
    const userBtn = document.querySelector('.dash-user');
    const notifBtn = document.querySelector('.dash-icon-btn[onclick*="toggleNotifications"]');
    const searchBox = document.querySelector('.dash-search-wrap');

    if (userMenu && userBtn && !userBtn.contains(e.target)) userMenu.classList.remove('show');
    if (notifMenu && notifBtn && !notifBtn.contains(e.target)) notifMenu.classList.remove('show');
    if (searchBox && !searchBox.contains(e.target)) {
      const box = document.getElementById('search-results');
      if (box) box.classList.remove('show');
    }
  });
}

console.log('✅ dashboard.js loaded');