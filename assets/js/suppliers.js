// ============================================
// SUPPLIERS MODULE LOGIC
// ============================================
const supabaseClient = window.supabaseClient;

// ===== STATE =====
let currentUser = null;
let currentProfile = null;
let currentCompany = null;
let allSuppliers = [];
let allProducts = [];
let filteredSuppliers = [];
let currentPage = 1;
const PAGE_SIZE = 20;
let editingSupplierId = null;
let pendingToggleId = null;
let sortField = 'name';
let sortDirection = 'asc';

// ============================================
// MENU THEO ROLE
// ============================================
const MENU_BY_ROLE = {
    admin: [
        { id: 'dashboard', icon: 'home', label: 'Dashboard', href: 'dashboard.html' },
        { id: 'approvals', icon: 'check-square', label: 'Duyệt', href: '#', badge: 5 },
        { id: 'reports', icon: 'bar-chart-3', label: 'Báo cáo', href: '#' },
        { id: 'sales', icon: 'badge-dollar-sign', label: 'Kinh doanh', href: '#' },
        {
            id: 'warehouse', icon: 'warehouse', label: 'Kho',
            submenu: [
                { id: 'products', icon: 'package', label: 'Sản phẩm', href: 'products.html' },
                { id: 'inventory', icon: 'boxes', label: 'Tồn kho', href: '#' },
                { id: 'import', icon: 'download', label: 'Nhập kho', href: '#' },
                { id: 'export', icon: 'upload', label: 'Xuất kho', href: '#' }
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
        { id: 'sales', icon: 'badge-dollar-sign', label: 'Kinh doanh', href: '#' },
        {
            id: 'warehouse', icon: 'warehouse', label: 'Kho',
            submenu: [
                { id: 'products', icon: 'package', label: 'Sản phẩm', href: 'products.html' },
                { id: 'inventory', icon: 'boxes', label: 'Tồn kho', href: '#' }
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
                { id: 'customers', icon: 'users', label: 'Khách hàng', href: '#' },
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
// VALIDATORS
// ============================================
const VALIDATORS = {
    code: (v) => {
        if (!v) return null; // Optional, tự sinh
        if (!/^[A-Z0-9\-_]{3,20}$/i.test(v)) return 'Mã chỉ chứa chữ, số, dấu - (3-20 ký tự)';
        return null;
    },
    name: (v) => {
        if (!v || v.trim().length < 2) return 'Tên phải có ít nhất 2 ký tự';
        if (v.length > 200) return 'Tên tối đa 200 ký tự';
        return null;
    },
    taxCode: (v) => {
        if (!v) return null;
        if (!/^\d{10}(\d{3})?$/.test(v)) return 'MST phải là 10 hoặc 13 số';
        return null;
    },
    phone: (v) => {
        if (!v) return null;
        const cleaned = v.replace(/[\s\-\.]/g, '');
        if (!/^0\d{9,10}$/.test(cleaned)) return 'SĐT phải có 10-11 số, bắt đầu bằng 0';
        return null;
    },
    email: (v) => {
        if (!v) return null;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Email không đúng định dạng';
        return null;
    }
};

// ============================================
// HELPERS
// ============================================
function isAdmin() {
    return currentProfile && currentProfile.role === 'admin';
}
function canEdit() {
    return currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'manager');
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
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ Suppliers page loading...');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    loadTheme();
    await waitForSession();
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    await loadProfile();
    await loadCompany();
    renderSidebar();
    updateUserUI();

    await Promise.all([loadSuppliers(), loadProducts()]);
    renderStats();
    renderSuppliers();

    initGlobalListeners();
    initSortableHeaders();
    setupValidations();

    if (typeof lucide !== 'undefined') lucide.createIcons();
    console.log('✅ Suppliers page ready');

    // Ẩn splash
    const splash = document.getElementById('app-splash');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => splash.remove(), 300);
    }
});

function setupValidations() {
    attachRealtimeValidation('supp-code', VALIDATORS.code);
    attachRealtimeValidation('supp-name', VALIDATORS.name);
    attachRealtimeValidation('supp-tax-code', VALIDATORS.taxCode);
    attachRealtimeValidation('supp-phone', VALIDATORS.phone);
    attachRealtimeValidation('supp-email', VALIDATORS.email);
}

// ============================================
// SESSION + PROFILE
// ============================================
async function waitForSession() {
    let result = await supabaseClient.auth.getSession();
    if (result.data.session) {
        currentUser = result.data.session.user;
        return;
    }
    for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500));
        result = await supabaseClient.auth.getSession();
        if (result.data.session) {
            currentUser = result.data.session.user;
            return;
        }
    }
}
async function loadProfile() {
    try {
        const result = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
        if (result.data) currentProfile = result.data;
    } catch (err) { }
}
async function loadCompany() {
    if (!currentProfile || !currentProfile.company_id) return;
    try {
        const result = await supabaseClient.from('companies').select('*').eq('id', currentProfile.company_id).single();
        if (result.data) {
            currentCompany = result.data;
            const logoText = document.querySelector('.dash-logo-text');
            if (logoText) logoText.textContent = currentCompany.name;
        }
    } catch (err) { }
}

// ============================================
// SIDEBAR
// ============================================
function renderSidebar() {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    const role = (currentProfile && currentProfile.role) || 'staff';
    const menus = MENU_BY_ROLE[role] || MENU_BY_ROLE.staff;
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    let html = '';
    menus.forEach(item => {
        if (item.submenu && item.submenu.length > 0) {
            const hasActiveChild = item.submenu.some(sub => sub.href === currentPage);
            html += '<div class="sidebar-group">';
            html += '<button class="sidebar-item sidebar-parent ' + (hasActiveChild ? 'has-active' : '') + '" onclick="toggleSubmenu(\'' + item.id + '\')">';
            html += '<i data-lucide="' + item.icon + '"></i>';
            html += '<span>' + item.label + '</span>';
            html += '<i data-lucide="chevron-down" class="submenu-caret"></i>';
            html += '</button>';
            html += '<div class="sidebar-submenu ' + (hasActiveChild ? 'show' : '') + '" id="submenu-' + item.id + '">';
            item.submenu.forEach(sub => {
                const isActive = sub.href === currentPage;
                html += '<button class="sidebar-item sidebar-child ' + (isActive ? 'active' : '') + '" onclick="navigateTo(\'' + sub.href + '\')">';
                html += '<i data-lucide="' + sub.icon + '"></i>';
                html += '<span>' + sub.label + '</span>';
                html += '</button>';
            });
            html += '</div></div>';
        } else {
            const isActive = item.href === currentPage;
            html += '<button class="sidebar-item ' + (isActive ? 'active' : '') + '" onclick="navigateTo(\'' + item.href + '\')">';
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
// USER UI
// ============================================
function updateUserUI() {
    if (!currentProfile) return;
    const name = currentProfile.full_name || currentUser.email;
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
    if (roleEl) roleEl.textContent = (currentProfile.position || 'Nhân viên');
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
function toggleSidebar() {
    const s = document.getElementById('sidebar');
    if (s) s.classList.toggle('show');
}
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
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
        supabaseClient.auth.signOut().then(() => window.location.href = 'login.html');
    }
}
function initGlobalListeners() {
    document.addEventListener('click', e => {
        const m = document.getElementById('user-menu');
        const b = document.querySelector('.dash-user');
        if (m && b && !b.contains(e.target)) m.classList.remove('show');
    });
}

// ============================================
// LOAD DATA
// ============================================
async function loadSuppliers() {
    try {
        const result = await supabaseClient
            .from('suppliers')
            .select('*')
            .eq('company_id', currentProfile.company_id)
            .order('name');
        allSuppliers = result.data || [];

        // Đếm số SP liên kết cho mỗi NCC
        allSuppliers = allSuppliers.map(s => {
            const productCount = allProducts.filter(p =>
                p.supplier_id === s.id && p.deleted_at === null
            ).length;
            return { ...s, product_count: productCount };
        });

        filteredSuppliers = [...allSuppliers];
        sortSuppliers();
    } catch (err) {
        console.error('Lỗi load suppliers:', err);
        allSuppliers = [];
        filteredSuppliers = [];
    }
}

async function loadProducts() {
    try {
        const result = await supabaseClient
            .from('products')
            .select('id, sku, name, price, stock, image_url, supplier_id, is_active, unit, deleted_at')
            .eq('company_id', currentProfile.company_id)
            .is('deleted_at', null);
        allProducts = result.data || [];
    } catch (err) {
        console.error('Lỗi load products:', err);
        allProducts = [];
    }
}

// Refresh product count sau khi load products
function recountProducts() {
    allSuppliers = allSuppliers.map(s => {
        const productCount = allProducts.filter(p =>
            p.supplier_id === s.id && p.deleted_at === null
        ).length;
        return { ...s, product_count: productCount };
    });
    filteredSuppliers = filteredSuppliers.map(fs => {
        const updated = allSuppliers.find(s => s.id === fs.id);
        return updated || fs;
    });
}

// ============================================
// SORT
// ============================================
function initSortableHeaders() {
    document.querySelectorAll('.data-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (sortField === field) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortField = field;
                sortDirection = 'asc';
            }
            updateSortIndicators();
            sortSuppliers();
            renderSuppliers();
        });
    });
    updateSortIndicators();
}
function updateSortIndicators() {
    document.querySelectorAll('.data-table th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.setAttribute('data-lucide', 'arrow-up-down');
        if (th.dataset.sort === sortField) {
            th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
            if (icon) icon.setAttribute('data-lucide', sortDirection === 'asc' ? 'arrow-up' : 'arrow-down');
        }
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
function sortSuppliers() {
    filteredSuppliers.sort((a, b) => {
        let va = a[sortField];
        let vb = b[sortField];
        if (va === null || va === undefined) va = '';
        if (vb === null || vb === undefined) vb = '';
        if (typeof va === 'number' && typeof vb === 'number') {
            return sortDirection === 'asc' ? va - vb : vb - va;
        }
        const strA = String(va).toLowerCase();
        const strB = String(vb).toLowerCase();
        if (sortDirection === 'asc') return strA.localeCompare(strB, 'vi');
        return strB.localeCompare(strA, 'vi');
    });
}

// ============================================
// STATS
// ============================================
function renderStats() {
    const totalEl = document.getElementById('stat-total');
    const activeEl = document.getElementById('stat-active');
    const inactiveEl = document.getElementById('stat-inactive');
    const productsEl = document.getElementById('stat-products');

    const activeCount = allSuppliers.filter(s => s.is_active !== false).length;
    const inactiveCount = allSuppliers.filter(s => s.is_active === false).length;

    // Đếm unique SP có supplier_id (không trùng)
    const uniqueProducts = new Set(
        allProducts.filter(p => p.supplier_id).map(p => p.id)
    ).size;

    if (totalEl) totalEl.textContent = allSuppliers.length;
    if (activeEl) activeEl.textContent = activeCount;
    if (inactiveEl) inactiveEl.textContent = inactiveCount;
    if (productsEl) productsEl.textContent = uniqueProducts;
}

// ============================================
// RENDER TABLE
// ============================================
function renderSuppliers() {
    const tbody = document.getElementById('suppliers-tbody');
    if (!tbody) return;

    if (filteredSuppliers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="table-loading">' +
            '<i data-lucide="factory"></i> Chưa có nhà cung cấp nào. Bấm "Thêm Nhà Cung Cấp" để bắt đầu.' +
            '</td></tr>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        renderPagination();
        return;
    }

    const totalPages = Math.ceil(filteredSuppliers.length / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredSuppliers.slice(start, start + PAGE_SIZE);

    let html = '';
    pageItems.forEach(s => {
        const isInactive = s.is_active === false;
        const statusBadge = isInactive
            ? '<span class="status-badge inactive">Ngưng giao dịch</span>'
            : '<span class="status-badge active">Đang giao dịch</span>';

        const productCount = s.product_count || 0;
        const productCountHtml = productCount > 0
            ? '<span class="product-count-badge">' + productCount + '</span>'
            : '<span class="product-count-badge zero">0</span>';

        // Contact info
        const contactHtml = s.contact_person
            ? escapeHtml(s.contact_person)
            : '<span style="color: #94a3b8;">—</span>';
        const phoneHtml = s.phone
            ? escapeHtml(s.phone)
            : '<span style="color: #94a3b8;">—</span>';
        const taxHtml = s.tax_code
            ? '<span style="font-family: monospace; font-size: 12px;">' + escapeHtml(s.tax_code) + '</span>'
            : '<span style="color: #94a3b8;">—</span>';

        // Nút thao tác (phân quyền)
        let actionBtns = '<button class="action-btn view" onclick="viewSupplier(\'' + s.id + '\')" title="Xem"><i data-lucide="eye"></i></button>';
        if (canEdit()) {
            actionBtns += '<button class="action-btn edit" onclick="editSupplier(\'' + s.id + '\')" title="Sửa"><i data-lucide="edit"></i></button>';
        }
        if (isAdmin()) {
            if (isInactive) {
                actionBtns += '<button class="action-btn" style="border-color: #86efac; color: #16a34a; background: #dcfce7;" onclick="askToggleSupplier(\'' + s.id + '\', true)" title="Mở lại giao dịch"><i data-lucide="play"></i></button>';
            } else {
                actionBtns += '<button class="action-btn" style="border-color: #fed7aa; color: #ea580c; background: #ffedd5;" onclick="askToggleSupplier(\'' + s.id + '\', false)" title="Ngưng giao dịch"><i data-lucide="pause"></i></button>';
            }
        }

        const trStyle = isInactive ? 'opacity: 0.6;' : '';

        html += '<tr style="' + trStyle + '">';
        html += '<td><span class="supplier-code">' + (s.code || '—') + '</span></td>';
        html += '<td>';
        html += '<span class="supplier-name">' + escapeHtml(s.name) + '</span>';
        if (s.address) html += '<span class="supplier-address">📍 ' + escapeHtml(s.address) + '</span>';
        html += '</td>';
        html += '<td>' + taxHtml + '</td>';
        html += '<td>' + contactHtml + '</td>';
        html += '<td>' + phoneHtml + '</td>';
        html += '<td style="text-align: center;">' + productCountHtml + '</td>';
        
// Badge thông tin NCC (chỉ hiện ngân hàng + hóa đơn)
let infoBadge = '';
if (s.bank_name) {
    infoBadge = '<div style="font-size: 11px; color: #667eea; font-weight: 700; margin-top: 4px;">🏦 ' + escapeHtml(s.bank_name) + '</div>';
} else {
    infoBadge = '<div style="font-size: 11px; color: #94a3b8; font-weight: 600; margin-top: 4px;">💵 Không có TK</div>';
}
if (s.has_invoice === false) {
    infoBadge += '<div style="font-size: 10px; color: #dc2626; margin-top: 2px;">⚠️ Không HĐ</div>';
}

html += '<td style="text-align: center;">' + statusBadge + infoBadge + '</td>';

        html += '<td><div class="table-actions">' + actionBtns + '</div></td>';
        html += '</tr>';
    });

    tbody.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    renderPagination();
}

// ============================================
// PAGINATION
// ============================================
function renderPagination() {
    const el = document.getElementById('pagination');
    if (!el) return;
    const total = filteredSuppliers.length;
    if (total === 0) { el.innerHTML = ''; return; }
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) {
        el.innerHTML = '<span class="pagination-info">Hiển thị ' + total + ' nhà cung cấp</span>';
        return;
    }
    let html = '';
    html += '<button ' + (currentPage === 1 ? 'disabled' : '') + ' onclick="goToPage(1)">«</button>';
    html += '<button ' + (currentPage === 1 ? 'disabled' : '') + ' onclick="goToPage(' + (currentPage - 1) + ')">‹</button>';
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    if (startPage > 1) {
        html += '<button onclick="goToPage(1)">1</button>';
        if (startPage > 2) html += '<span style="padding: 0 4px; color: #94a3b8;">...</span>';
    }
    for (let i = startPage; i <= endPage; i++) {
        html += '<button class="' + (i === currentPage ? 'active' : '') + '" onclick="goToPage(' + i + ')">' + i + '</button>';
    }
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += '<span style="padding: 0 4px; color: #94a3b8;">...</span>';
        html += '<button onclick="goToPage(' + totalPages + ')">' + totalPages + '</button>';
    }
    html += '<button ' + (currentPage === totalPages ? 'disabled' : '') + ' onclick="goToPage(' + (currentPage + 1) + ')">›</button>';
    html += '<button ' + (currentPage === totalPages ? 'disabled' : '') + ' onclick="goToPage(' + totalPages + ')">»</button>';
    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);
    html += '<span class="pagination-info">' + start + '-' + end + ' / ' + total + '</span>';
    el.innerHTML = html;
}
function goToPage(page) {
    currentPage = page;
    renderSuppliers();
    const main = document.getElementById('dash-main');
    if (main) main.scrollTop = 0;
}

// ============================================
// FILTERS
// ============================================
function applyFilters() {
    const search = (document.getElementById('supplier-search').value || '').toLowerCase().trim();
    const status = document.getElementById('filter-status').value;

    filteredSuppliers = allSuppliers.filter(s => {
        if (search) {
            const hay = (s.code + ' ' + s.name + ' ' + (s.tax_code || '') + ' ' + (s.phone || '') + ' ' + (s.contact_person || '')).toLowerCase();
            if (hay.indexOf(search) === -1) return false;
        }
        if (status === 'active' && s.is_active === false) return false;
        if (status === 'inactive' && s.is_active !== false) return false;
        return true;
    });
    sortSuppliers();
    currentPage = 1;
    renderSuppliers();
}
function resetFilters() {
    document.getElementById('supplier-search').value = '';
    document.getElementById('filter-status').value = 'all';
    filteredSuppliers = [...allSuppliers];
    sortSuppliers();
    currentPage = 1;
    renderSuppliers();
}

// ============================================
// MODAL SUPPLIER (THÊM/SỬA)
// ============================================
function openAddSupplierModal() {
    if (!canEdit()) {
        showToast('Bạn không có quyền thêm nhà cung cấp', 'error');
        return;
    }
    editingSupplierId = null;
    document.getElementById('modal-supplier-title').textContent = 'Thêm Nhà Cung Cấp';
    document.getElementById('form-supplier').reset();
    document.getElementById('supp-id').value = '';
    document.getElementById('supp-active').value = 'true';
    document.getElementById('supp-has-invoice').checked = true;

    clearFormErrors('form-supplier');
    document.getElementById('modal-supplier').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function editSupplier(id) {
    if (!canEdit()) {
        showToast('Bạn không có quyền sửa nhà cung cấp', 'error');
        return;
    }
    const s = allSuppliers.find(x => x.id === id);
    if (!s) return;
    editingSupplierId = id;
    document.getElementById('modal-supplier-title').textContent = 'Sửa: ' + s.name;
    document.getElementById('supp-id').value = s.id;
    document.getElementById('supp-code').value = s.code || '';
    document.getElementById('supp-name').value = s.name || '';
    document.getElementById('supp-tax-code').value = s.tax_code || '';
    document.getElementById('supp-contact').value = s.contact_person || '';
    document.getElementById('supp-phone').value = s.phone || '';
    document.getElementById('supp-email').value = s.email || '';
    document.getElementById('supp-address').value = s.address || '';
    document.getElementById('supp-bank-name').value = s.bank_name || '';
    document.getElementById('supp-bank-account').value = s.bank_account || '';
    document.getElementById('supp-note').value = s.note || '';
    document.getElementById('supp-active').value = s.is_active === false ? 'false' : 'true';
    document.getElementById('supp-has-invoice').checked = s.has_invoice !== false;

    setRating(s.rating || 0);
    document.getElementById('supp-rating-note').value = s.rating_note || '';
    clearFormErrors('form-supplier');
    document.getElementById('modal-supplier').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeSupplierModal() {
    document.getElementById('modal-supplier').classList.remove('show');
}

// ============================================
// RATING STARS
// ============================================
function setRating(value) {
    const input = document.getElementById('supp-rating');
    if (input) input.value = value;
    const stars = document.querySelectorAll('#rating-stars .star');
    stars.forEach((star, idx) => {
        star.classList.toggle('active', idx < value);
    });
    const textEl = document.getElementById('rating-text');
    if (textEl) {
        const labels = ['Chưa đánh giá', 'Rất kém', 'Kém', 'Trung bình', 'Tốt', 'Xuất sắc'];
        textEl.textContent = labels[value] || 'Chưa đánh giá';
    }
}

// ============================================
// SAVE SUPPLIER
// ============================================
async function handleSaveSupplier(e) {
    e.preventDefault();
    if (!canEdit()) {
        showToast('Bạn không có quyền lưu nhà cung cấp', 'error');
        return;
    }
    clearFormErrors('form-supplier');

    const id = document.getElementById('supp-id').value;
    const code = document.getElementById('supp-code').value.trim().toUpperCase();
    const name = document.getElementById('supp-name').value.trim();
    const taxCode = document.getElementById('supp-tax-code').value.trim();
    const contact = document.getElementById('supp-contact').value.trim();
    const phone = document.getElementById('supp-phone').value.trim();
    const email = document.getElementById('supp-email').value.trim();
    const address = document.getElementById('supp-address').value.trim();
    const bankName = document.getElementById('supp-bank-name').value.trim();
    const bankAccount = document.getElementById('supp-bank-account').value.trim();
    const note = document.getElementById('supp-note').value.trim();
    const isActive = document.getElementById('supp-active').value === 'true';
    const rating = parseInt(document.getElementById('supp-rating').value) || 0;
    const ratingNote = document.getElementById('supp-rating-note').value.trim();

    // Validation
    let hasError = false;
    const errCode = VALIDATORS.code(code); if (errCode) { setFieldError('supp-code', errCode); hasError = true; }
    const errName = VALIDATORS.name(name); if (errName) { setFieldError('supp-name', errName); hasError = true; }
    const errTax = VALIDATORS.taxCode(taxCode); if (errTax) { setFieldError('supp-tax-code', errTax); hasError = true; }
    const errPhone = VALIDATORS.phone(phone); if (errPhone) { setFieldError('supp-phone', errPhone); hasError = true; }
    const errEmail = VALIDATORS.email(email); if (errEmail) { setFieldError('supp-email', errEmail); hasError = true; }

    if (hasError) {
        showToast('Vui lòng kiểm tra lại các trường báo đỏ', 'error');
        return;
    }

// Check trùng mã NCC — Query DB để chính xác
if (code) {
    let query = supabaseClient
        .from('suppliers')
        .select('id, code, name')
        .eq('company_id', currentProfile.company_id)
        .ilike('code', code); // Không phân biệt hoa/thường
    
    // Nếu đang SỬA → bỏ qua chính nó
    if (id) {
        query = query.neq('id', id);
    }
    
    const { data: dup } = await query;
    
    if (dup && dup.length > 0) {
        setFieldError('supp-code', 'Mã "' + code + '" đã tồn tại! (NCC: ' + dup[0].name + ')');
        showToast('❌ Mã NCC đã tồn tại!', 'error');
        return;
    }
}

// Tự sinh mã nếu để trống — Query DB để chính xác
let finalCode = code;
if (!finalCode && !id) {
    const prefix = 'NCC-';
    // Query DB tìm mã lớn nhất
    const { data: maxCodes } = await supabaseClient
        .from('suppliers')
        .select('code')
        .eq('company_id', currentProfile.company_id)
        .like('code', prefix + '%')
        .order('code', { ascending: false })
        .limit(10);
    
    let maxNum = 0;
    if (maxCodes && maxCodes.length > 0) {
        maxCodes.forEach(row => {
            if (row.code) {
                const num = parseInt(row.code.replace(prefix, '')) || 0;
                if (num > maxNum) maxNum = num;
            }
        });
    }
    finalCode = prefix + String(maxNum + 1).padStart(3, '0');
    console.log('🔢 Tự sinh mã:', finalCode);
}

const hasInvoice = document.getElementById('supp-has-invoice').checked;

const payload = {
    company_id: currentProfile.company_id,
    code: finalCode || null,
    name: name,
    tax_code: taxCode || null,
    contact_person: contact || null,
    phone: phone || null,
    email: email || null,
    address: address || null,
    bank_name: bankName || null,
    bank_account: bankAccount || null,
    has_invoice: hasInvoice,
    note: note || null,
    is_active: isActive,
    rating: rating,
    rating_note: ratingNote || null,
    updated_at: new Date().toISOString()
};

    try {
        let result;
        if (id) {
            result = await supabaseClient.from('suppliers').update(payload).eq('id', id);
        } else {
            payload.created_by = currentUser.id;
            result = await supabaseClient.from('suppliers').insert(payload);
        }
        if (result.error) {
            if (result.error.code === '23505' || result.error.message.includes('unique')) {
                setFieldError('supp-code', 'Mã "' + finalCode + '" đã tồn tại!');
                showToast('❌ Mã NCC đã tồn tại!', 'error');
                return;
            }
            throw result.error;
        }
        showToast(id ? 'Đã cập nhật nhà cung cấp!' : 'Đã thêm nhà cung cấp!', 'success');
        closeSupplierModal();
        await Promise.all([loadSuppliers(), loadProducts()]);
        recountProducts();
        renderStats();
        applyFilters();
    } catch (err) {
        console.error('Lỗi lưu:', err);
        showToast('Lỗi: ' + err.message, 'error');
    }
}

// ============================================
// VIEW SUPPLIER DETAIL
// ============================================
function viewSupplier(id) {
    const s = allSuppliers.find(x => x.id === id);
    if (!s) return;

    // Danh sách SP của NCC này
    const supplierProducts = allProducts.filter(p => p.supplier_id === id);

    // Rating display
    let ratingHtml = '';
    if (s.rating && s.rating > 0) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            stars += '<span class="star-mini ' + (i <= s.rating ? 'filled' : '') + '">★</span>';
        }
        ratingHtml = '<div class="rating-display">' + stars + '<span class="rating-value">' + s.rating + '/5</span></div>';
        if (s.rating_note) {
            ratingHtml += '<div style="font-size: 12px; color: #64748b; margin-top: 4px; font-style: italic;">"' + escapeHtml(s.rating_note) + '"</div>';
        }
    } else {
        ratingHtml = '<span style="color: #94a3b8; font-size: 12px;">Chưa đánh giá</span>';
    }

    // Danh sách SP
    let productsHtml = '';
    if (supplierProducts.length === 0) {
        productsHtml = '<div class="supplier-empty-state">' +
            '<i data-lucide="package-x"></i>' +
            '<p>NCC này chưa có sản phẩm nào</p>' +
            '</div>';
    } else {
        productsHtml = '<div class="supplier-products-list">';
        supplierProducts.forEach(p => {
            const imgHtml = p.image_url
                ? '<img src="' + p.image_url + '">'
                : '📦';
            productsHtml += '<div class="supplier-product-item">';
            productsHtml += '<div class="supplier-product-img">' + imgHtml + '</div>';
            productsHtml += '<div class="supplier-product-info">';
            productsHtml += '<span class="supplier-product-sku">' + p.sku + '</span>';
            productsHtml += '<span class="supplier-product-name">' + escapeHtml(p.name) + '</span>';
            productsHtml += '</div>';
            productsHtml += '<div class="supplier-product-price">' + Number(p.price || 0).toLocaleString('vi-VN') + ' đ</div>';
            productsHtml += '</div>';
        });
        productsHtml += '</div>';
    }

    const statusBadge = s.is_active === false
        ? '<span class="status-badge inactive">Ngưng giao dịch</span>'
        : '<span class="status-badge active">Đang giao dịch</span>';

    const html = `
        <div class="supplier-detail-header">
            <div class="supplier-detail-logo">🏭</div>
            <div class="supplier-detail-info">
                <div class="supplier-detail-name">${escapeHtml(s.name)}</div>
                <div class="supplier-detail-meta">
                    <span style="font-family: monospace; color: #667eea; font-weight: 700;">${s.code || 'Chưa có mã'}</span>
                    ${statusBadge}
                </div>
                <div style="margin-top: 8px;">${ratingHtml}</div>
            </div>
        </div>

        <div class="detail-section">
            <h4>📋 Thông Tin Liên Hệ</h4>
            <div class="detail-row"><span class="detail-row-label">Mã số thuế:</span><span class="detail-row-value">${s.tax_code || '—'}</span></div>
            <div class="detail-row"><span class="detail-row-label">Người liên hệ:</span><span class="detail-row-value">${escapeHtml(s.contact_person) || '—'}</span></div>
            <div class="detail-row"><span class="detail-row-label">Số điện thoại:</span><span class="detail-row-value">${s.phone || '—'}</span></div>
            <div class="detail-row"><span class="detail-row-label">Email:</span><span class="detail-row-value">${escapeHtml(s.email) || '—'}</span></div>
            <div class="detail-row"><span class="detail-row-label">Địa chỉ:</span><span class="detail-row-value" style="max-width: 300px; text-align: right;">${escapeHtml(s.address) || '—'}</span></div>
        </div>

        <div class="detail-section">
            <h4>💰 Thông Tin Thanh Toán</h4>
            <div class="detail-row"><span class="detail-row-label">Ngân hàng:</span><span class="detail-row-value">${escapeHtml(s.bank_name) || '—'}</span></div>
            <div class="detail-row"><span class="detail-row-label">Số tài khoản:</span><span class="detail-row-value">${s.bank_account || '—'}</span></div>
        </div>

        <div class="detail-section">
            <h4>📦 Sản Phẩm Cung Cấp (${supplierProducts.length})</h4>
            ${productsHtml}
        </div>

        ${s.note ? `
        <div class="detail-section">
            <h4>📝 Ghi Chú Nội Bộ</h4>
            <p style="font-size: 13px; color: #64748b; line-height: 1.6; padding: 10px; background: #f8fafc; border-radius: 8px;">${escapeHtml(s.note)}</p>
        </div>
        ` : ''}
    `;

    document.getElementById('detail-content').innerHTML = html;
    document.getElementById('modal-detail').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeDetailModal() {
    document.getElementById('modal-detail').classList.remove('show');
}

// ============================================
// TOGGLE ACTIVE (Ngưng giao dịch / Mở lại)
// ============================================
function askToggleSupplier(id, activate) {
    if (!isAdmin()) {
        showToast('Chỉ Admin mới có quyền thực hiện', 'error');
        return;
    }
    const s = allSuppliers.find(x => x.id === id);
    if (!s) return;

    pendingToggleId = id;

    if (activate) {
        // Mở lại giao dịch
        document.getElementById('confirm-title').textContent = 'Mở lại giao dịch';
        document.getElementById('confirm-message').innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 8px;">▶️</div>
                <p style="color: #334155; font-size: 14px; line-height: 1.7;">
                    Mở lại giao dịch với <b style="color: #10b981;">"${escapeHtml(s.name)}"</b>?
                </p>
                <p style="color: #64748b; font-size: 12px; margin-top: 8px;">
                    NCC sẽ hiện lại khi chọn nhà cung cấp cho sản phẩm.
                </p>
            </div>
        `;
        document.getElementById('confirm-btn').textContent = 'Mở lại';
        document.getElementById('confirm-btn').className = 'btn btn-primary';
        document.getElementById('confirm-btn').style.display = '';
        document.getElementById('confirm-btn').onclick = doToggleSupplier;
    } else {
        // Ngưng giao dịch - check SP liên kết
        const linkedProducts = allProducts.filter(p => p.supplier_id === id);

        if (linkedProducts.length > 0) {
            // Có SP → hiện cảnh báo
            let spList = '';
            linkedProducts.slice(0, 8).forEach(p => {
                spList += '<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #f1f5f9;">';
                spList += '<span style="font-family: monospace; color: #667eea; font-weight: 700; font-size: 12px;">' + p.sku + '</span>';
                spList += '<span style="color: #334155; font-size: 12.5px; flex: 1; margin-left: 10px; text-align: left;">' + escapeHtml(p.name) + '</span>';
                spList += '</div>';
            });
            if (linkedProducts.length > 8) {
                spList += '<div style="text-align: center; padding: 8px; color: #94a3b8; font-size: 12px;">... và ' + (linkedProducts.length - 8) + ' SP khác</div>';
            }

            document.getElementById('confirm-title').textContent = 'Cảnh báo';
            document.getElementById('confirm-message').innerHTML = `
                <div style="text-align: center; margin-bottom: 12px;">
                    <div style="font-size: 48px; margin-bottom: 8px;">⚠️</div>
                    <h3 style="font-size: 16px; font-weight: 800; color: #d97706; margin-bottom: 6px;">NCC đang có ${linkedProducts.length} sản phẩm</h3>
                    <p style="color: #64748b; font-size: 12.5px; line-height: 1.6;">
                        Nếu bạn ngưng giao dịch, các SP này vẫn giữ NCC cũ.<br>
                        Bạn có muốn tiếp tục?
                    </p>
                </div>
                <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 10px; padding: 12px; margin-bottom: 12px;">
                    <div style="font-size: 11px; font-weight: 800; color: #92400e; margin-bottom: 8px; text-transform: uppercase;">📦 SP đang liên kết:</div>
                    <div style="max-height: 180px; overflow-y: auto; background: #fff; border-radius: 8px; padding: 10px;">
                        ${spList}
                    </div>
                </div>
            `;
            document.getElementById('confirm-btn').textContent = 'Vẫn ngưng';
            document.getElementById('confirm-btn').className = 'btn btn-danger';
            document.getElementById('confirm-btn').style.display = '';
            document.getElementById('confirm-btn').onclick = doToggleSupplier;
        } else {
            // Không có SP → confirm bình thường
            document.getElementById('confirm-title').textContent = 'Ngưng giao dịch';
            document.getElementById('confirm-message').innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 8px;">⏸️</div>
                    <p style="color: #334155; font-size: 14px; line-height: 1.7;">
                        Ngưng giao dịch với <b style="color: #d97706;">"${escapeHtml(s.name)}"</b>?
                    </p>
                    <p style="color: #64748b; font-size: 12px; margin-top: 8px;">
                        NCC sẽ bị ẩn khỏi dropdown chọn NCC.<br>Có thể mở lại bất cứ lúc nào.
                    </p>
                </div>
            `;
            document.getElementById('confirm-btn').textContent = 'Ngưng giao dịch';
            document.getElementById('confirm-btn').className = 'btn btn-danger';
            document.getElementById('confirm-btn').style.display = '';
            document.getElementById('confirm-btn').onclick = doToggleSupplier;
        }
    }

    document.getElementById('modal-confirm').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeConfirmModal() {
    document.getElementById('modal-confirm').classList.remove('show');
    pendingToggleId = null;
    const confirmBtn = document.getElementById('confirm-btn');
    if (confirmBtn) { confirmBtn.style.display = ''; confirmBtn.onclick = null; }
    const footer = document.querySelector('#modal-confirm .modal-footer');
    if (footer) {
        const cancelBtn = footer.querySelector('.btn-secondary, .btn-primary');
        if (cancelBtn && cancelBtn.id !== 'confirm-btn') {
            cancelBtn.textContent = 'Hủy';
            cancelBtn.className = 'btn btn-secondary';
        }
    }
}

async function doToggleSupplier() {
    if (!pendingToggleId) return;
    const s = allSuppliers.find(x => x.id === pendingToggleId);
    if (!s) return;
    const newStatus = !(s.is_active !== false);

    try {
        const result = await supabaseClient
            .from('suppliers')
            .update({ is_active: newStatus, updated_at: new Date().toISOString() })
            .eq('id', pendingToggleId);
        if (result.error) throw result.error;

        showToast(newStatus ? 'Đã mở lại giao dịch!' : 'Đã ngưng giao dịch!', 'success');
        closeConfirmModal();
        await loadSuppliers();
        recountProducts();
        renderStats();
        applyFilters();
    } catch (err) {
        console.error('Lỗi:', err);
        showToast('Lỗi: ' + err.message, 'error');
    }
}

// ============================================
// TOAST
// ============================================
let toastTimer = null;
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
    clearTimeout(toastTimer);
    requestAnimationFrame(() => {
        toast.classList.add('show');
        toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
    });
}

// ============================================
// ESC KEY
// ============================================
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeSupplierModal();
        closeDetailModal();
        closeConfirmModal();
        closeUserMenu();
    }
});

// ============================================
// PAYMENT METHOD TOGGLE
// ============================================


// ============================================
// CUSTOM COMBOBOX - NGÂN HÀNG
// ============================================
// ============================================
// DANH SÁCH NGÂN HÀNG (logo thật từ VietQR)
// ============================================
const BANK_LIST = [
    { name: 'Vietcombank', logo: 'https://api.vietqr.io/img/VCB.png' },
    { name: 'VietinBank', logo: 'https://api.vietqr.io/img/ICB.png' },
    { name: 'BIDV', logo: 'https://api.vietqr.io/img/BIDV.png' },
    { name: 'Agribank', logo: 'https://api.vietqr.io/img/VBA.png' },
    { name: 'Techcombank', logo: 'https://api.vietqr.io/img/TCB.png' },
    { name: 'VPBank', logo: 'https://api.vietqr.io/img/VPB.png' },
    { name: 'MB Bank', logo: 'https://api.vietqr.io/img/MB.png' },
    { name: 'ACB', logo: 'https://api.vietqr.io/img/ACB.png' },
    { name: 'Sacombank', logo: 'https://api.vietqr.io/img/STB.png' },
    { name: 'TPBank', logo: 'https://api.vietqr.io/img/TPB.png' },
    { name: 'VIB', logo: 'https://api.vietqr.io/img/VIB.png' },
    { name: 'SHB', logo: 'https://api.vietqr.io/img/SHB.png' },
    { name: 'HDBank', logo: 'https://api.vietqr.io/img/HDB.png' },
    { name: 'MSB', logo: 'https://api.vietqr.io/img/MSB.png' },
    { name: 'OCB', logo: 'https://api.vietqr.io/img/OCB.png' },
    { name: 'SeABank', logo: 'https://api.vietqr.io/img/SEAB.png' },
    { name: 'Eximbank', logo: 'https://api.vietqr.io/img/EIB.png' },
    { name: 'LienVietPostBank', logo: 'https://api.vietqr.io/img/LPB.png' },
    { name: 'Nam A Bank', logo: 'https://api.vietqr.io/img/NAB.png' },
    { name: 'KienlongBank', logo: 'https://api.vietqr.io/img/KLB.png' },
    { name: 'Bac A Bank', logo: 'https://api.vietqr.io/img/BAB.png' },
    { name: 'PVcomBank', logo: 'https://api.vietqr.io/img/PVB.png' },
    { name: 'Cake by VPBank', logo: 'https://api.vietqr.io/img/CAKE.png' },
    { name: 'Timo', logo: 'https://api.vietqr.io/img/TIMO.png' },
    { name: 'Viettel Money', logo: '' },
    { name: 'MoMo', logo: '' },
    { name: 'ZaloPay', logo: '' },
    { name: 'VNPay', logo: '' },
    { name: 'ShopeePay', logo: '' },
    { name: 'Khác', logo: '' }
];

function showBankList() {
    renderBankList('');
    const dropdown = document.getElementById('bank-dropdown');
    const toggle = document.querySelector('.combobox-toggle');
    if (dropdown) {
        dropdown.classList.add('show');
    }
    if (toggle) {
        toggle.classList.add('open');
    }
}

function hideBankList() {
    const dropdown = document.getElementById('bank-dropdown');
    const toggle = document.querySelector('.combobox-toggle');
    if (dropdown) dropdown.classList.remove('show');
    if (toggle) toggle.classList.remove('open');
}

function toggleBankList(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('bank-dropdown');
    if (dropdown && dropdown.classList.contains('show')) {
        hideBankList();
    } else {
        const input = document.getElementById('supp-bank-name');
        // Nếu đã có value → filter theo value, không thì show full
        if (input && input.value.trim()) {
            filterBankList(input.value);
        } else {
            showBankList();
        }
        if (input) input.focus();
    }
}

function filterBankList(keyword) {
    renderBankList(keyword);
    const dropdown = document.getElementById('bank-dropdown');
    const toggle = document.querySelector('.combobox-toggle');
    if (dropdown) dropdown.classList.add('show');
    if (toggle) toggle.classList.add('open');
}

function renderBankList(keyword) {
    const dropdown = document.getElementById('bank-dropdown');
    if (!dropdown) return;

    const currentValue = document.getElementById('supp-bank-name')?.value?.trim() || '';
    const kw = (keyword || '').toLowerCase().trim();

    let filtered = BANK_LIST;
    if (kw) {
        filtered = BANK_LIST.filter(b => b.name.toLowerCase().includes(kw));
    }

    let html = '';

    if (filtered.length === 0) {
        html += '<div class="combobox-empty">';
        html += 'Không tìm thấy trong danh sách<br>';
        html += '<span style="color: #667eea; font-weight: 700;">Nhấn Esc để giữ "' + escapeHtml(keyword) + '"</span>';
        html += '</div>';
        html += '<div class="combobox-hint">💡 Bạn vẫn có thể nhập tay tên ngân hàng bất kỳ</div>';
    } else {
        filtered.forEach(bank => {
            const isSelected = currentValue && bank.name.toLowerCase() === currentValue.toLowerCase();
            
            // Logo: nếu có URL thì hiện <img>, không thì bỏ trống
            let logoHtml = '';
            if (bank.logo) {
                logoHtml = '<img src="' + bank.logo + '" class="combobox-item-logo" alt="' + bank.name + '" onerror="this.style.display=\'none\'">';
            }
            
            html += '<div class="combobox-item ' + (isSelected ? 'selected' : '') + '" onclick="selectBank(\'' + bank.name.replace(/'/g, "\\'") + '\')">';
            html += logoHtml;
            html += '<span>' + escapeHtml(bank.name) + '</span>';
            html += '</div>';
        });
        
        if (kw && filtered.length > 0) {
            html += '<div class="combobox-hint">💡 Không thấy NH của bạn? Cứ gõ tay rồi nhấn Enter</div>';
        }
    }

    dropdown.innerHTML = html;
}

function selectBank(name) {
    const input = document.getElementById('supp-bank-name');
    if (input) {
        input.value = name;
        // Trigger event để form biết value đã đổi (không cần thiết nhưng tốt)
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    hideBankList();
}

// Click ngoài → đóng dropdown
document.addEventListener('click', function(e) {
    const wrap = document.querySelector('.combobox-wrap');
    if (wrap && !wrap.contains(e.target)) {
        hideBankList();
    }
});

// Phím tắt khi dropdown mở
document.addEventListener('keydown', function(e) {
    const dropdown = document.getElementById('bank-dropdown');
    const input = document.getElementById('supp-bank-name');
    if (!dropdown || !dropdown.classList.contains('show')) return;
    if (!input || document.activeElement !== input) return;

    if (e.key === 'Escape') {
        hideBankList();
    } else if (e.key === 'Enter') {
        // Nếu có item đang highlight thì chọn, không thì đóng
        const selected = dropdown.querySelector('.combobox-item.selected');
        if (selected) {
            // Giữ nguyên value
            hideBankList();
        } else {
            // Nhập tay → đóng, giữ value hiện tại
            hideBankList();
        }
    }
});

console.log('✅ suppliers.js loaded');


