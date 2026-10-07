// ============================================
// LAYOUT CHUNG - DÙNG CHO TẤT CẢ CÁC TRANG SAU LOGIN
// Chứa: Session, Profile, Company, Sidebar, Header, Theme, User, Notif,
//       Status, Idle, Lunch, Search, Helpers
// ============================================

// ============================================
// STATE DÙNG CHUNG (prefix _ để tránh trùng với page.js)
// ============================================
let _currentStatus = 'online';
let _idleTimer = null;
let _statusUpdateTimer = null;
let _lunchCheckTimer = null;
let _searchTimeout = null;
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const STATUS_UPDATE_INTERVAL = 30 * 1000;

// ============================================
// MENU THEO ROLE
// ============================================
const MENU_BY_ROLE = {
    admin: [
        { id: 'dashboard', icon: 'home', label: 'Dashboard', href: 'dashboard.html' },
        { id: 'approvals', icon: 'check-square', label: 'Duyệt', href: '#', badge: 5 },
        { id: 'reports', icon: 'bar-chart-3', label: 'Báo cáo', href: '#' },
        {
            id: 'sales', icon: 'badge-dollar-sign', label: 'Kinh doanh',
            submenu: [
                { id: 'customers', icon: 'users', label: 'Khách hàng', href: 'customers.html' },
                { id: 'orders', icon: 'file-text', label: 'Đơn hàng', href: '#' }
            ]
        },
        {
            id: 'warehouse', icon: 'warehouse', label: 'Kho',
            submenu: [
                { id: 'products', icon: 'package', label: 'Sản phẩm', href: 'products.html' },
                { id: 'inventory', icon: 'boxes', label: 'Tồn kho', href: 'inventory.html' },
                { id: 'import', icon: 'download', label: 'Nhập kho', href: 'goods-receipt.html' },
                { id: 'export', icon: 'upload', label: 'Xuất kho', href: 'goods-issue.html' }
            ]
        },
        { id: 'suppliers', icon: 'factory', label: 'Nhà cung cấp', href: 'suppliers.html' },
        { id: 'hr', icon: 'users', label: 'Nhân sự', href: '#' },
        { id: 'settings', icon: 'settings', label: 'Cài đặt', href: '#' }
    ],
    manager: [
        { id: 'dashboard', icon: 'home', label: 'Dashboard', href: 'dashboard.html' },
        { id: 'approvals', icon: 'check-square', label: 'Duyệt', href: '#', badge: 3 },
        { id: 'tasks', icon: 'target', label: 'Task tôi', href: '#' },
        {
            id: 'sales', icon: 'badge-dollar-sign', label: 'Kinh doanh',
            submenu: [
                { id: 'customers', icon: 'users', label: 'Khách hàng', href: 'customers.html' },
                { id: 'orders', icon: 'file-text', label: 'Đơn hàng', href: '#' }
            ]
        },
        {
            id: 'warehouse', icon: 'warehouse', label: 'Kho',
            submenu: [
                { id: 'products', icon: 'package', label: 'Sản phẩm', href: 'products.html' },
                { id: 'inventory', icon: 'boxes', label: 'Tồn kho', href: 'inventory.html' }
            ]
        },
        { id: 'suppliers', icon: 'factory', label: 'Nhà cung cấp', href: 'suppliers.html' },
        { id: 'team', icon: 'users', label: 'NV nhóm', href: '#' }
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
        {
            id: 'sales', icon: 'badge-dollar-sign', label: 'Kinh doanh',
            submenu: [
                { id: 'customers', icon: 'users', label: 'Khách hàng', href: 'customers.html' },
                { id: 'orders', icon: 'file-text', label: 'Đơn hàng', href: '#' },
                { id: 'products', icon: 'package', label: 'Sản phẩm', href: 'products.html' }
            ]
        },
        { id: 'suppliers', icon: 'factory', label: 'Nhà cung cấp', href: 'suppliers.html' },
        { id: 'work', icon: 'briefcase', label: 'Công việc', href: '#' },
        { id: 'colleagues', icon: 'users', label: 'Đồng nghiệp', href: '#' },
        { id: 'chat', icon: 'message-circle', label: 'Chat', href: '#' }
    ]
};

// ============================================
// SESSION + PROFILE + COMPANY
// ============================================
async function waitForSession() {
    let result = await supabaseClient.auth.getSession();
    if (result.data.session) {
        window.currentUser = result.data.session.user;
        return;
    }
    for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500));
        result = await supabaseClient.auth.getSession();
        if (result.data.session) {
            window.currentUser = result.data.session.user;
            return;
        }
    }
}

async function loadProfile() {
    try {
        const result = await supabaseClient.from('profiles').select('*').eq('id', window.currentUser.id).single();
        if (result.data) window.currentProfile = result.data;
    } catch (err) {}
}

async function loadCompany() {
    if (!window.currentProfile || !window.currentProfile.company_id) return;
    try {
        const result = await supabaseClient.from('companies').select('*').eq('id', window.currentProfile.company_id).single();
        if (result.data) {
            window.currentCompany = result.data;
            const logoText = document.querySelector('.dash-logo-text');
            if (logoText) logoText.textContent = window.currentCompany.name;
        }
    } catch (err) {}
}

// ============================================
// SIDEBAR RENDER
// ============================================
function renderSidebar() {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    const role = (window.currentProfile && window.currentProfile.role) || 'staff';
    const menus = MENU_BY_ROLE[role] || MENU_BY_ROLE.staff;
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    let html = '';
    menus.forEach(item => {
        if (item.submenu && item.submenu.length > 0) {
            const hasActiveChild = item.submenu.some(sub => sub.href === currentPage);
            html += '<div class="sidebar-group">';
            html += '<button class="sidebar-item sidebar-parent ' + (hasActiveChild ? 'has-active' : '') + '" onclick="toggleSubmenu(\'' + item.id + '\')" data-label="' + item.label + '">';
            html += '<i data-lucide="' + item.icon + '"></i>';
            html += '<span>' + item.label + '</span>';
            html += '<i data-lucide="chevron-down" class="submenu-caret"></i>';
            html += '</button>';
            html += '<div class="sidebar-submenu ' + (hasActiveChild ? 'show' : '') + '" id="submenu-' + item.id + '">';
            item.submenu.forEach(sub => {
                const isActive = sub.href === currentPage;
                html += '<button class="sidebar-item sidebar-child ' + (isActive ? 'active' : '') + '" onclick="navigateTo(\'' + sub.href + '\')" data-label="' + sub.label + '">';
                html += '<i data-lucide="' + sub.icon + '"></i>';
                html += '<span>' + sub.label + '</span>';
                html += '</button>';
            });
            html += '</div></div>';
        } else {
            const isActive = item.href === currentPage;
            html += '<button class="sidebar-item ' + (isActive ? 'active' : '') + '" onclick="navigateTo(\'' + item.href + '\')" data-label="' + item.label + '">';
            html += '<i data-lucide="' + item.icon + '"></i>';
            html += '<span>' + item.label + '</span>';
            if (item.badge) html += '<span class="sidebar-badge">' + item.badge + '</span>';
            html += '</button>';
        }
    });
    nav.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleSubmenu(id) {
    const submenu = document.getElementById('submenu-' + id);
    if (submenu) submenu.classList.toggle('show');
}

function navigateTo(href) {
    if (href === '#') {
        alert('Chức năng này sẽ được thêm sau');
        return;
    }
    window.location.href = href;
}

// ============================================
// SIDEBAR TOGGLE — DÙNG CHUNG DESKTOP + MOBILE
// ============================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
        sidebar.classList.toggle('show');
    } else {
        const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebar_collapsed', isCollapsed ? 'true' : 'false');
    }
}

// Chỉ collapse (không phân biệt mobile) — dùng cho nút trong sidebar
function toggleSidebarCollapse() {
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebar_collapsed', isCollapsed ? 'true' : 'false');
}

function loadSidebarState() {
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (isCollapsed && window.innerWidth >= 768) {
        document.body.classList.add('sidebar-collapsed');
    }
}

// Click ra ngoài → đóng sidebar mobile
document.addEventListener('click', e => {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.querySelector('.dash-menu-toggle');
    if (!sidebar || window.innerWidth >= 768) return;
    if (!sidebar.classList.contains('show')) return;
    if (menuToggle && menuToggle.contains(e.target)) return;
    if (sidebar.contains(e.target)) return;
    sidebar.classList.remove('show');
});

// ============================================
// USER UI
// ============================================
function updateUserUI() {
    if (!window.currentProfile) return;
    const name = window.currentProfile.full_name || window.currentUser.email;
    const initial = name.charAt(0).toUpperCase();
    ['user-avatar', 'user-avatar-menu'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = initial;
    });
    ['user-name', 'user-name-menu'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = name;
    });
    const roleEl = document.getElementById('user-role-menu');
    if (roleEl) roleEl.textContent = (window.currentProfile.position || 'Nhân viên');
}

function getRoleLabel(role) {
    const labels = { admin: 'Quản trị viên', manager: 'Quản lý', hr: 'Nhân sự', it: 'IT', staff: 'Nhân viên' };
    return labels[role] || 'Nhân viên';
}

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
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    const newTheme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme-preload', newTheme);
    localStorage.setItem('theme', newTheme);
    const icon = document.getElementById('theme-icon');
    if (icon) icon.setAttribute('data-lucide', isDark ? 'moon' : 'sun');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================
// USER MENU
// ============================================
function toggleUserMenu(e) {
    if (e) e.stopPropagation();
    const m = document.getElementById('user-menu');
    if (m) m.classList.toggle('show');
}
function closeUserMenu() {
    const m = document.getElementById('user-menu');
    if (m) m.classList.remove('show');
}
function goToProfile() { closeUserMenu(); alert('Trang hồ sơ sẽ được thêm sau'); }
function changePassword() { closeUserMenu(); alert('Đổi mật khẩu sẽ được thêm sau'); }

function confirmLogout() {
    closeUserMenu();
    const popup = document.getElementById('logout-popup');
    if (popup) {
        popup.classList.add('show');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } else {
        // Fallback nếu không có popup
        if (confirm('Bạn có chắc muốn đăng xuất?')) doLogout();
    }
}

function closeLogoutConfirm() {
    const p = document.getElementById('logout-popup');
    if (p) p.classList.remove('show');
}

async function doLogout() {
    try { await updateStatusToServer('offline'); } catch (e) {}
    sessionStorage.removeItem('return_url');
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

// ============================================
// NOTIFICATIONS
// ============================================
function toggleNotifications(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('user-menu');
    const notif = document.getElementById('notif-menu');
    if (menu) menu.classList.remove('show');
    if (notif) notif.classList.toggle('show');
}
function closeNotifMenu() {
    const m = document.getElementById('notif-menu');
    if (m) m.classList.remove('show');
}
function markAllRead() { closeNotifMenu(); }

// ============================================
// HELPERS CHUNG
// ============================================
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function formatDate(d) {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return day + '/' + month + '/' + year;
}

function formatMoney(n) {
    if (!n) return '0 đ';
    return Number(n).toLocaleString('vi-VN') + ' đ';
}

function formatNumber(n) {
    if (!n) return '0';
    return Number(n).toLocaleString('vi-VN');
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return diffMins + ' phút trước';
    if (diffHours < 24) return diffHours + ' giờ trước';
    if (diffDays < 7) return diffDays + ' ngày trước';
    return date.toLocaleDateString('vi-VN');
}

function setFieldError(inputId, errorMsg) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const formGroup = input.closest('.form-group');
    if (!formGroup) return;
    const oldErr = formGroup.querySelector('.field-error');
    if (oldErr) oldErr.remove();
    input.style.borderColor = '';
    if (errorMsg) {
        input.style.borderColor = '#dc2626';
        const err = document.createElement('div');
        err.className = 'field-error';
        err.style.cssText = 'color: #dc2626; font-size: 11px; margin-top: 4px; font-weight: 600;';
        err.textContent = errorMsg;
        formGroup.appendChild(err);
        return false;
    }
    return true;
}

function clearFormErrors(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.querySelectorAll('.field-error').forEach(e => e.remove());
    form.querySelectorAll('input, select, textarea').forEach(i => i.style.borderColor = '');
}

function attachRealtimeValidation(inputId, validatorFn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('blur', function() {
        const err = validatorFn(this.value);
        setFieldError(inputId, err);
    });
    input.addEventListener('input', function() {
        if (this.style.borderColor === 'rgb(220, 38, 38)') {
            const err = validatorFn(this.value);
            setFieldError(inputId, err);
        }
    });
}

// ============================================
// ROLE HELPERS
// ============================================
function isAdmin() {
    return window.currentProfile && window.currentProfile.role === 'admin';
}
function canEdit() {
    return window.currentProfile && (window.currentProfile.role === 'admin' || window.currentProfile.role === 'manager');
}

// ============================================
// TOAST
// ============================================
let _toastTimer = null;
function showToast(msg, type) {
    type = type || 'success';
    const toast = document.getElementById('toast');
    if (!toast) return;
    let icon = 'check-circle';
    if (type === 'error') icon = 'x-circle';
    if (type === 'warning') icon = 'alert-triangle';
    toast.className = 'toast ' + type;
    toast.innerHTML = '<i data-lucide="' + icon + '"></i><span>' + msg + '</span>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    clearTimeout(_toastTimer);
    requestAnimationFrame(() => {
        toast.classList.add('show');
        _toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
    });
}

// ============================================
// GLOBAL LISTENERS
// ============================================
function initGlobalListeners() {
    document.addEventListener('click', e => {
        const userMenuEl = document.getElementById('user-menu');
        const notifMenuEl = document.getElementById('notif-menu');
        const userBtn = document.querySelector('.dash-user');
        const notifBtn = document.querySelector('.dash-icon-btn[onclick*="toggleNotifications"]');
        if (userMenuEl && userBtn && !userBtn.contains(e.target)) userMenuEl.classList.remove('show');
        if (notifMenuEl && notifBtn && !notifBtn.contains(e.target)) notifMenuEl.classList.remove('show');
    });
}

// ESC close menus chung
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeUserMenu();
        closeNotifMenu();
        const lunch = document.getElementById('lunch-popup');
        if (lunch) lunch.classList.remove('show');
        const box = document.getElementById('search-results');
        if (box) box.classList.remove('show');
    }
});

// ============================================
// STATUS UPDATER
// ============================================
function initStatusUpdater() {
    if (!window.currentUser) return;
    _currentStatus = 'online';
    updateStatusDot('online');
    updateStatusToServer('online');
    clearInterval(_statusUpdateTimer);
    _statusUpdateTimer = setInterval(() => updateStatusToServer(_currentStatus), STATUS_UPDATE_INTERVAL);
}

async function updateStatusToServer(status) {
    if (!window.currentUser) return;
    try {
        await supabaseClient.from('user_status').upsert({
            user_id: window.currentUser.id,
            status: status,
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

// Visibility change: away/online
document.addEventListener('visibilitychange', () => {
    if (!window.currentUser) return;
    if (document.hidden) {
        _currentStatus = 'away';
        updateStatusDot('away');
        updateStatusToServer('away');
    } else {
        _currentStatus = 'online';
        updateStatusDot('online');
        updateStatusToServer('online');
        resetIdleTimer();
    }
});

// ============================================
// IDLE TIMER
// ============================================
function initIdleTimer() {
    if (!window.currentUser) return;
    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetIdleTimer, { passive: true });
    });
    resetIdleTimer();
}

function resetIdleTimer() {
    clearTimeout(_idleTimer);
    if (!window.currentUser) return;
    _idleTimer = setTimeout(showSessionExpired, IDLE_TIMEOUT_MS);
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
    clearInterval(_lunchCheckTimer);
    _lunchCheckTimer = setInterval(checkLunchTime, 60 * 1000);
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
    const msg = getUserLunchMessage(window.currentUser ? window.currentUser.id : 'default');
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
// SEARCH (Ctrl+K)
// ============================================
function handleSearchInput(query) {
    clearTimeout(_searchTimeout);
    const resultsBox = document.getElementById('search-results');
    if (!resultsBox) return;

    if (!query || query.trim().length < 2) {
        resultsBox.classList.remove('show');
        return;
    }

    _searchTimeout = setTimeout(async () => {
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
        const initial = (user.full_name || '?').charAt(0).toUpperCase();
        html += '<div class="search-result-item" onclick="viewProfile(\'' + user.id + '\')">';
        html += '<div class="search-result-avatar">' + initial + '</div>';
        html += '<div class="search-result-info">';
        html += '<div class="search-result-name">' + escapeHtml(user.full_name) + '</div>';
        html += '<div class="search-result-meta">' + escapeHtml(user.position || 'Nhân viên') +
            ' · ' + escapeHtml(user.department || 'Chưa phân bổ') + '</div>';
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
    });
}

// ============================================
// INIT LAYOUT — Gọi trong mỗi trang
// ============================================
async function initLayout() {
    loadTheme();
    loadSidebarState();
    await waitForSession();
    if (!window.currentUser) {
        window.location.href = 'login.html';
        return false;
    }
    await loadProfile();
    await loadCompany();
    renderSidebar();
    updateUserUI();
    initGlobalListeners();
    initStatusUpdater();
    initIdleTimer();
    initLunchPopup();
    initSearchShortcut();
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return true;
}

console.log('✅ layout.js loaded');