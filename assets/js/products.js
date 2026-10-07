// ============================================
// PRODUCTS MODULE LOGIC (v6 - bỏ BH, có NCC)
// ============================================

const supabaseClient = window.supabaseClient;

// ===== STATE =====
let currentUser = null;
let currentProfile = null;
let currentCompany = null;
let allProducts = [];
let allGroups = [];
let allSuppliers = [];
let filteredProducts = [];
let currentPage = 1;
const PAGE_SIZE = 20;
let editingProductId = null;
let editingGroupId = null;
let uploadedImageBase64 = null;
let pendingToggleId = null;
let pendingDeleteType = null;
let sortField = 'imported_at';
let sortDirection = 'desc';

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
    { id: 'work', icon: 'briefcase', label: 'Công việc', href: '#' },
    { id: 'colleagues', icon: 'users', label: 'Đồng nghiệp', href: '#' },
    { id: 'chat', icon: 'message-circle', label: 'Chat', href: '#' }
  ]
};

// ============================================
// VALIDATORS
// ============================================
const VALIDATORS = {
  sku: (v) => {
    if (!v || v.length < 3) return 'SKU phải có ít nhất 3 ký tự';
    if (v.length > 30) return 'SKU tối đa 30 ký tự';
    if (!/^[A-Z0-9\-_\.]+$/.test(v)) return 'SKU chỉ chứa chữ HOA, số, dấu - _ .';
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
  },
  money: (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    if (isNaN(n) || n < 0) return 'Số tiền phải >= 0';
    if (n > 999999999999) return 'Số tiền quá lớn';
    return null;
  },
  positiveInt: (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    if (isNaN(n) || n < 0) return 'Phải là số >= 0';
    if (!Number.isInteger(n)) return 'Phải là số nguyên';
    if (n > 999999) return 'Số quá lớn';
    return null;
  },
  code: (v) => {
    if (!v) return null;
    if (!/^[A-Z0-9\-_]{3,20}$/i.test(v)) return 'Mã chỉ chứa chữ, số, dấu - (3-20 ký tự)';
    return null;
  }
};

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
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('✅ Products page loading...');
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

  await Promise.all([loadGroups(), loadSuppliers(), loadProducts()]);

  renderStats();
  renderProducts();
  populateGroupFilter();
  populateGroupSelect();
  populateSupplierSelect();
  initGlobalListeners();
  initSortableHeaders();
  setupValidations();

  if (typeof lucide !== 'undefined') lucide.createIcons();
  console.log('✅ Products page ready');

  const splash = document.getElementById('app-splash');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 300);
  }
});

function setupValidations() {
  attachRealtimeValidation('prod-sku', VALIDATORS.sku);
  attachRealtimeValidation('prod-name', VALIDATORS.name);
  attachRealtimeValidation('prod-purchase-price', VALIDATORS.money);
  attachRealtimeValidation('prod-price', VALIDATORS.money);
  attachRealtimeValidation('prod-stock', VALIDATORS.positiveInt);
  attachRealtimeValidation('prod-min-stock', VALIDATORS.positiveInt);
  attachRealtimeValidation('supp-code', VALIDATORS.code);
  attachRealtimeValidation('supp-name', VALIDATORS.name);
  attachRealtimeValidation('supp-tax-code', VALIDATORS.taxCode);
  attachRealtimeValidation('supp-phone', VALIDATORS.phone);
  attachRealtimeValidation('supp-email', VALIDATORS.email);
}

// ============================================
// SORTABLE
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
      sortProducts();
      renderProducts();
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

function sortProducts() {
  filteredProducts.sort((a, b) => {
    let va, vb;

    if (sortField === 'group_name') {
      va = (a.product_groups && a.product_groups.name) || '';
      vb = (b.product_groups && b.product_groups.name) || '';
    } else if (sortField === 'supplier_name') {
      va = (a.suppliers && a.suppliers.name) || '';
      vb = (b.suppliers && b.suppliers.name) || '';
    } else if (sortField === 'imported_at') {
      va = a.imported_at ? new Date(a.imported_at).getTime() : 0;
      vb = b.imported_at ? new Date(b.imported_at).getTime() : 0;
    } else {
      va = a[sortField];
      vb = b[sortField];
    }

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
// SESSION + PROFILE
// ============================================
async function waitForSession() {
  let result = await supabaseClient.auth.getSession();
  if (result.data.session) { currentUser = result.data.session.user; return; }
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 500));
    result = await supabaseClient.auth.getSession();
    if (result.data.session) { currentUser = result.data.session.user; return; }
  }
}

async function loadProfile() {
  try {
    const result = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (result.data) currentProfile = result.data;
  } catch (err) {}
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
  } catch (err) {}
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
  if (href === '#') { alert('Chức năng này sẽ được thêm sau'); return; }
  window.location.href = href;
}

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
async function loadGroups() {
  try {
    const result = await supabaseClient.from('product_groups')
      .select('*').eq('company_id', currentProfile.company_id)
      .eq('is_active', true).is('deleted_at', null)
      .order('is_system', { ascending: false }).order('name');
    allGroups = result.data || [];
  } catch (err) { allGroups = []; }
}

async function loadSuppliers() {
  try {
    const result = await supabaseClient.from('suppliers')
      .select('*').eq('company_id', currentProfile.company_id)
      .eq('is_active', true).is('deleted_at', null).order('name');
    allSuppliers = result.data || [];
  } catch (err) { allSuppliers = []; }
}

async function loadProducts() {
  try {
    const result = await supabaseClient.from('products')
      .select('*, product_groups(id, name, color, icon), suppliers(id, name, code)')
      .eq('company_id', currentProfile.company_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    allProducts = result.data || [];
    filteredProducts = [...allProducts];
    sortProducts();
  } catch (err) { allProducts = []; filteredProducts = []; }
}

// ============================================
// FORMAT
// ============================================
function formatMoney(n) { return !n ? '0 đ' : Number(n).toLocaleString('vi-VN') + ' đ'; }
function formatNumber(n) { return !n ? '0' : Number(n).toLocaleString('vi-VN'); }

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return day + '/' + month + '/' + year;
}

// ============================================
// STATS
// ============================================
function renderStats() {
  const activeProducts = allProducts.filter(p => p.is_active !== false);
  const totalEl = document.getElementById('stat-total');
  const groupsEl = document.getElementById('stat-groups');
  const lowStockEl = document.getElementById('stat-low-stock');
  const suppliersEl = document.getElementById('stat-suppliers');

  if (totalEl) totalEl.textContent = formatNumber(activeProducts.length);
  if (groupsEl) groupsEl.textContent = formatNumber(allGroups.length);
  if (suppliersEl) suppliersEl.textContent = formatNumber(allSuppliers.length);

  const lowStock = activeProducts.filter(p => (p.stock || 0) <= (p.min_stock || 0)).length;
  if (lowStockEl) lowStockEl.textContent = formatNumber(lowStock);
}

// ============================================
// SELECTS
// ============================================
function populateGroupFilter() {
  const sel = document.getElementById('filter-group');
  if (!sel) return;
  let html = '<option value="all">Tất cả nhóm</option>';
  allGroups.forEach(g => { html += '<option value="' + g.id + '">' + g.icon + ' ' + g.name + '</option>'; });
  sel.innerHTML = html;
}

function populateGroupSelect() {
  const sel = document.getElementById('prod-group');
  if (!sel) return;
  let html = '<option value="">-- Chọn nhóm --</option>';
  allGroups.forEach(g => { html += '<option value="' + g.id + '">' + g.icon + ' ' + g.name + '</option>'; });
  sel.innerHTML = html;
}

function populateSupplierSelect() {
  const sel = document.getElementById('prod-supplier');
  if (!sel) return;
  let html = '<option value="">-- Chưa chọn --</option>';
  allSuppliers.forEach(s => { html += '<option value="' + s.id + '">' + s.name + '</option>'; });
  sel.innerHTML = html;
}

// ============================================
// RENDER PRODUCTS
// ============================================
function renderProducts() {
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;

  if (filteredProducts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="table-loading">' +
      '<i data-lucide="package-x"></i> Chưa có sản phẩm nào.' +
      '</td></tr>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    renderPagination();
    return;
  }

  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredProducts.slice(start, start + PAGE_SIZE);

  let html = '';
  pageItems.forEach(p => {
    const group = p.product_groups;
    const supplier = p.suppliers;
    const stock = p.stock || 0;
    const minStock = p.min_stock || 0;
    const isInactive = p.is_active === false;

    let stockClass = 'ok';
    if (stock === 0) stockClass = 'out';
    else if (stock <= minStock) stockClass = 'low';

    let imgHtml = p.image_url
      ? '<img src="' + p.image_url + '" class="product-img">'
      : '<div class="product-img-placeholder">📦</div>';

    let groupHtml = '<span style="color: #94a3b8;">—</span>';
    if (group) {
      groupHtml = '<span class="group-badge" style="background: ' + (group.color || '#667eea') + '20; color: ' + (group.color || '#667eea') + ';">' +
        (group.icon || '📦') + ' ' + group.name + '</span>';
    }

    let supplierHtml = '<span style="color: #94a3b8; font-size: 12px;">— Chưa chọn —</span>';
    if (supplier) {
      supplierHtml = '<div style="font-size: 12.5px; font-weight: 600; color: #0f172a;">🏭 ' + supplier.name + '</div>';
      if (supplier.code) {
        supplierHtml += '<div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Mã: ' + supplier.code + '</div>';
      }
    }

    const importedHtml = '<div class="date-cell">' + formatDate(p.imported_at || p.created_at) + '</div>';

    const trStyle = isInactive ? 'opacity: 0.5; text-decoration: line-through;' : '';
    const statusTag = isInactive
      ? '<span style="display: inline-block; padding: 2px 8px; background: #fee2e2; color: #991b1b; border-radius: 6px; font-size: 10px; font-weight: 800; margin-left: 6px;">ĐÃ NGƯNG</span>'
      : '';

    html += '<tr style="' + trStyle + '">';
    html += '<td>' + imgHtml + '</td>';
    html += '<td><span class="product-sku">' + p.sku + '</span></td>';
    html += '<td>';
    html += '<span class="product-name">' + p.name + statusTag + '</span>';
    if (p.description) html += '<span class="product-desc" title="' + p.description.replace(/"/g, '&quot;') + '">' + p.description + '</span>';
    html += '</td>';
    html += '<td>' + groupHtml + '</td>';
    html += '<td>' + (p.unit || 'Cái') + '</td>';
    html += '<td class="price-cell purchase">' + formatMoney(p.purchase_price) + '</td>';
    html += '<td class="price-cell">' + formatMoney(p.price) + '</td>';
    html += '<td style="text-align: center; color: #d97706; font-weight: 700;">' + (p.vat_percent || 0) + '%</td>';
    html += '<td style="text-align: center;"><span class="stock-badge ' + stockClass + '">' + stock + '</span></td>';
    html += '<td>' + supplierHtml + '</td>';
    html += '<td>' + importedHtml + '</td>';
    html += '<td>';
    html += '<div class="table-actions">';
    html += '<button class="action-btn view" onclick="viewProduct(\'' + p.id + '\')" title="Xem"><i data-lucide="eye"></i></button>';
    html += '<button class="action-btn edit" onclick="editProduct(\'' + p.id + '\')" title="Sửa"><i data-lucide="edit"></i></button>';
    if (isInactive) {
      html += '<button class="action-btn" style="border-color: #86efac; color: #16a34a; background: #dcfce7;" onclick="askToggleActive(\'' + p.id + '\', true)" title="Kinh doanh lại"><i data-lucide="play"></i></button>';
    } else {
      html += '<button class="action-btn" style="border-color: #fed7aa; color: #ea580c; background: #ffedd5;" onclick="askToggleActive(\'' + p.id + '\', false)" title="Ngưng kinh doanh"><i data-lucide="pause"></i></button>';
    }
    html += '</div></td></tr>';
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
  const total = filteredProducts.length;
  if (total === 0) { el.innerHTML = ''; return; }
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) {
    el.innerHTML = '<span class="pagination-info">Hiển thị ' + total + ' sản phẩm</span>';
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
  renderProducts();
  const main = document.getElementById('dash-main');
  if (main) main.scrollTop = 0;
}

// ============================================
// FILTERS
// ============================================
function applyFilters() {
  const search = (document.getElementById('product-search').value || '').toLowerCase().trim();
  const groupId = document.getElementById('filter-group').value;
  const status = document.getElementById('filter-status').value;

  filteredProducts = allProducts.filter(p => {
    if (search) {
      const hay = (p.sku + ' ' + p.name + ' ' + (p.description || '')).toLowerCase();
      if (hay.indexOf(search) === -1) return false;
    }
    if (groupId !== 'all' && p.group_id !== groupId) return false;
    if (status === 'active' && p.is_active === false) return false;
    if (status === 'inactive' && p.is_active !== false) return false;
    if (status === 'low' && (p.stock || 0) > (p.min_stock || 0)) return false;
    return true;
  });
  sortProducts();
  currentPage = 1;
  renderProducts();
}

function resetFilters() {
  document.getElementById('product-search').value = '';
  document.getElementById('filter-group').value = 'all';
  document.getElementById('filter-status').value = 'all';
  filteredProducts = [...allProducts];
  sortProducts();
  currentPage = 1;
  renderProducts();
}

// ============================================
// MODAL PRODUCT
// ============================================
function openAddProductModal() {
  editingProductId = null;
  uploadedImageBase64 = null;
  document.getElementById('modal-product-title').textContent = 'Thêm Sản Phẩm Mới';
  document.getElementById('form-product').reset();
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-image-preview').style.display = 'none';
  document.getElementById('prod-image-placeholder').style.display = 'flex';
  document.getElementById('qr-preview').style.display = 'none';
  document.getElementById('prod-active').checked = true;
  document.getElementById('prod-vat').value = '8';
  document.getElementById('prod-unit').value = 'Cái';
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('prod-imported-at').value = today;
  clearFormErrors('form-product');
  calcProfit();
  populateGroupSelect();
  populateSupplierSelect();
  document.getElementById('modal-product').classList.add('show');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function editProduct(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  editingProductId = id;
  uploadedImageBase64 = null;
  document.getElementById('modal-product-title').textContent = 'Sửa: ' + p.name;
  document.getElementById('prod-id').value = p.id;
  document.getElementById('prod-sku').value = p.sku;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-unit').value = p.unit || 'Cái';
  document.getElementById('prod-location').value = p.location || '';
  document.getElementById('prod-description').value = p.description || '';
  document.getElementById('prod-barcode').value = p.barcode || '';
  document.getElementById('prod-purchase-price').value = p.purchase_price || 0;
  document.getElementById('prod-price').value = p.price || 0;
  document.getElementById('prod-vat').value = String(p.vat_percent || 8);
  document.getElementById('prod-stock').value = p.stock || 0;
  document.getElementById('prod-min-stock').value = p.min_stock || 10;
  document.getElementById('prod-active').checked = p.is_active !== false;
  if (p.imported_at) {
    document.getElementById('prod-imported-at').value = new Date(p.imported_at).toISOString().split('T')[0];
  } else {
    document.getElementById('prod-imported-at').value = '';
  }
  populateGroupSelect();
  populateSupplierSelect();
  document.getElementById('prod-group').value = p.group_id || '';
  document.getElementById('prod-supplier').value = p.supplier_id || '';
  if (p.image_url) {
    document.getElementById('prod-image-preview').src = p.image_url;
    document.getElementById('prod-image-preview').style.display = 'block';
    document.getElementById('prod-image-placeholder').style.display = 'none';
  } else {
    document.getElementById('prod-image-preview').style.display = 'none';
    document.getElementById('prod-image-placeholder').style.display = 'flex';
  }
  document.getElementById('qr-preview').style.display = 'none';
  clearFormErrors('form-product');
  calcProfit();
  document.getElementById('modal-product').classList.add('show');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeProductModal() {
  document.getElementById('modal-product').classList.remove('show');
}

// ============================================
// IMAGE UPLOAD
// ============================================
function handleImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast('Ảnh quá lớn. Tối đa 2MB', 'error');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      const max = 800;
      if (w > max || h > max) {
        if (w > h) { h = Math.round(h * max / w); w = max; }
        else { w = Math.round(w * max / h); h = max; }
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      uploadedImageBase64 = canvas.toDataURL('image/jpeg', 0.8);
      document.getElementById('prod-image-preview').src = uploadedImageBase64;
      document.getElementById('prod-image-preview').style.display = 'block';
      document.getElementById('prod-image-placeholder').style.display = 'none';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ============================================
// CALC PROFIT
// ============================================
function calcProfit() {
  const purchase = parseFloat(document.getElementById('prod-purchase-price').value) || 0;
  const price = parseFloat(document.getElementById('prod-price').value) || 0;
  const vat = parseFloat(document.getElementById('prod-vat').value) || 0;
  const finalPrice = Math.round(price * (1 + vat / 100));
  const profit = price - purchase;
  const profitRate = purchase > 0 ? Math.round((profit / purchase) * 100) : (price > 0 ? 100 : 0);
  const finalEl = document.getElementById('calc-final-price');
  const profitEl = document.getElementById('calc-profit');
  const rateEl = document.getElementById('calc-profit-rate');
  if (finalEl) finalEl.textContent = formatMoney(finalPrice);
  if (profitEl) profitEl.textContent = formatMoney(profit);
  if (rateEl) rateEl.textContent = profitRate + '%';
}

// ============================================
// QR CODE
// ============================================
function generateQRCode() {
  const sku = document.getElementById('prod-sku').value.trim();
  if (!sku) { showToast('Nhập SKU trước để sinh QR', 'warning'); return; }
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(sku);
  const preview = document.getElementById('qr-preview');
  preview.innerHTML = '<img src="' + qrUrl + '" alt="QR Code" crossorigin="anonymous">' +
    '<div class="qr-preview-info"><b>QR Code: ' + sku + '</b>Chuột phải → Lưu ảnh về máy để in. Miễn phí 100%!</div>';
  preview.style.display = 'flex';
  showToast('Đã tạo QR Code!', 'success');
}

// ============================================
// SAVE PRODUCT
// ============================================
async function handleSaveProduct(e) {
  e.preventDefault();
  clearFormErrors('form-product');

  const id = document.getElementById('prod-id').value;
  const sku = document.getElementById('prod-sku').value.trim().toUpperCase();
  const name = document.getElementById('prod-name').value.trim();
  const groupId = document.getElementById('prod-group').value;
  const supplierId = document.getElementById('prod-supplier').value || null;
  const unit = document.getElementById('prod-unit').value;
  const location = document.getElementById('prod-location').value.trim();
  const description = document.getElementById('prod-description').value.trim();
  const barcode = document.getElementById('prod-barcode').value.trim();
  const purchasePrice = parseFloat(document.getElementById('prod-purchase-price').value) || 0;
  const price = parseFloat(document.getElementById('prod-price').value) || 0;
  const vat = parseFloat(document.getElementById('prod-vat').value) || 0;
  const stock = parseInt(document.getElementById('prod-stock').value) || 0;
  const minStock = parseInt(document.getElementById('prod-min-stock').value) || 0;
  const isActive = document.getElementById('prod-active').checked;
  const importedAt = document.getElementById('prod-imported-at').value || null;

  let hasError = false;
  const errSku = VALIDATORS.sku(sku); if (errSku) { setFieldError('prod-sku', errSku); hasError = true; }
  const errName = VALIDATORS.name(name); if (errName) { setFieldError('prod-name', errName); hasError = true; }
  const errPP = VALIDATORS.money(purchasePrice); if (errPP) { setFieldError('prod-purchase-price', errPP); hasError = true; }
  const errP = VALIDATORS.money(price); if (errP) { setFieldError('prod-price', errP); hasError = true; }
  const errS = VALIDATORS.positiveInt(stock); if (errS) { setFieldError('prod-stock', errS); hasError = true; }
  const errMS = VALIDATORS.positiveInt(minStock); if (errMS) { setFieldError('prod-min-stock', errMS); hasError = true; }
  if (!groupId) { setFieldError('prod-group', 'Vui lòng chọn nhóm'); hasError = true; }

  if (hasError) {
    showToast('Vui lòng kiểm tra lại các trường báo đỏ', 'error');
    return;
  }

  const dup = allProducts.find(p => p.sku.toUpperCase() === sku && p.id !== id);
  if (dup) {
    setFieldError('prod-sku', 'SKU "' + sku + '" đã tồn tại!');
    showToast('❌ SKU đã tồn tại!', 'error');
    return;
  }

  const payload = {
    company_id: currentProfile.company_id,
    sku: sku, name: name, group_id: groupId || null,
    supplier_id: supplierId,
    unit: unit, location: location, description: description, barcode: barcode || null,
    purchase_price: purchasePrice, price: price, vat_percent: vat,
    stock: stock, min_stock: minStock, is_active: isActive,
    imported_at: importedAt ? new Date(importedAt).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (uploadedImageBase64) payload.image_url = uploadedImageBase64;

  try {
    let result;
    if (id) {
      result = await supabaseClient.from('products').update(payload).eq('id', id);
    } else {
      payload.created_by = currentUser.id;
      result = await supabaseClient.from('products').insert(payload);
    }
    if (result.error) {
      if (result.error.code === '23505' || result.error.message.includes('unique')) {
        setFieldError('prod-sku', 'SKU "' + sku + '" đã tồn tại!');
        showToast('❌ SKU đã tồn tại!', 'error');
        return;
      }
      throw result.error;
    }

    showToast(id ? 'Đã cập nhật sản phẩm!' : 'Đã thêm sản phẩm!', 'success');
    closeProductModal();
    await loadProducts();
    renderStats();
    applyFilters();
  } catch (err) {
    console.error('Lỗi lưu:', err);
    showToast('Lỗi: ' + err.message, 'error');
  }
}

// ============================================
// VIEW PRODUCT
// ============================================
function viewProduct(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  const group = p.product_groups;
  const supplier = p.suppliers;
  const finalPrice = Math.round(p.price * (1 + (p.vat_percent || 0) / 100));
  const profit = p.price - (p.purchase_price || 0);
  let imgHtml = p.image_url
    ? '<img src="' + p.image_url + '" class="detail-image">'
    : '<div class="detail-image-placeholder">📦</div>';

  const html = '<div class="detail-grid">' +
    '<div>' + imgHtml + '</div>' +
    '<div>' +
      '<div class="detail-section">' +
        '<h4>Thông tin cơ bản</h4>' +
        '<div class="detail-row"><span class="detail-row-label">SKU:</span><span class="detail-row-value">' + p.sku + '</span></div>' +
        '<div class="detail-row"><span class="detail-row-label">Tên:</span><span class="detail-row-value">' + p.name + '</span></div>' +
        '<div class="detail-row"><span class="detail-row-label">Nhóm:</span><span class="detail-row-value">' + (group ? (group.icon + ' ' + group.name) : '—') + '</span></div>' +
        '<div class="detail-row"><span class="detail-row-label">Đơn vị:</span><span class="detail-row-value">' + (p.unit || '—') + '</span></div>' +
        '<div class="detail-row"><span class="detail-row-label">Vị trí kho:</span><span class="detail-row-value">' + (p.location || '—') + '</span></div>' +
        (p.description ? '<div class="detail-row"><span class="detail-row-label">Mô tả:</span><span class="detail-row-value" style="max-width: 300px; white-space: pre-wrap;">' + p.description + '</span></div>' : '') +
      '</div>' +
      '<div class="detail-section">' +
        '<h4>💰 Giá & Lợi nhuận</h4>' +
        '<div class="detail-row"><span class="detail-row-label">Giá nhập:</span><span class="detail-row-value">' + formatMoney(p.purchase_price) + '</span></div>' +
        '<div class="detail-row"><span class="detail-row-label">Giá bán chưa VAT:</span><span class="detail-row-value">' + formatMoney(p.price) + '</span></div>' +
        '<div class="detail-row"><span class="detail-row-label">VAT:</span><span class="detail-row-value">' + (p.vat_percent || 0) + '%</span></div>' +
        '<div class="detail-row"><span class="detail-row-label">Giá bán CÓ VAT:</span><span class="detail-row-value" style="color: #667eea;">' + formatMoney(finalPrice) + '</span></div>' +
        '<div class="detail-row"><span class="detail-row-label">Lợi nhuận dự kiến:</span><span class="detail-row-value" style="color: #10b981;">' + formatMoney(profit) + '</span></div>' +
      '</div>' +
      '<div class="detail-section">' +
        '<h4>📦 Nhập hàng & Kho</h4>' +
        '<div class="detail-row"><span class="detail-row-label">Nhà cung cấp:</span><span class="detail-row-value">' + (supplier ? supplier.name : '— Chưa chọn —') + '</span></div>' +
        '<div class="detail-row"><span class="detail-row-label">Ngày nhập:</span><span class="detail-row-value">' + formatDate(p.imported_at || p.created_at) + '</span></div>' +
        '<div class="detail-row"><span class="detail-row-label">Tồn hiện tại:</span><span class="detail-row-value">' + (p.stock || 0) + ' ' + (p.unit || '') + '</span></div>' +
        '<div class="detail-row"><span class="detail-row-label">Tồn tối thiểu:</span><span class="detail-row-value">' + (p.min_stock || 0) + '</span></div>' +
      '</div>' +
      '<div class="detail-section">' +
        '<h4>Trạng thái</h4>' +
        '<div class="detail-row"><span class="detail-row-label">Kinh doanh:</span><span class="detail-row-value" style="color: ' + (p.is_active === false ? '#dc2626' : '#10b981') + ';">' + (p.is_active === false ? '⏸️ Đã ngưng' : '✅ Đang kinh doanh') + '</span></div>' +
      '</div>' +
    '</div>' +
  '</div>';
  document.getElementById('detail-content').innerHTML = html;
  document.getElementById('modal-detail').classList.add('show');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeDetailModal() {
  document.getElementById('modal-detail').classList.remove('show');
}

// ============================================
// QUẢN LÝ NHÓM
// ============================================
function openManageGroupsModal() {
  renderManageGroupsList();
  document.getElementById('modal-manage-groups').classList.add('show');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeManageGroupsModal() {
  document.getElementById('modal-manage-groups').classList.remove('show');
}

function renderManageGroupsList() {
  const container = document.getElementById('manage-groups-list');
  if (!container) return;
  if (allGroups.length === 0) {
    container.innerHTML = '<div style="padding: 30px; text-align: center; color: #94a3b8;">Chưa có nhóm nào</div>';
    return;
  }
  const isAdmin = currentProfile && currentProfile.role === 'admin';
  const activeGroups = allGroups.filter(g => g.is_active !== false);

  let html = '';
  activeGroups.forEach(g => {
    const productCount = allProducts.filter(p => p.group_id === g.id && p.is_active !== false).length;
    const isSystem = g.is_system === true;
    const canDelete = isAdmin && !isSystem && productCount === 0;

    html += '<div class="group-manage-item">';
    html += '<div class="group-manage-icon" style="background: ' + (g.color || '#667eea') + '20; color: ' + (g.color || '#667eea') + ';">' + (g.icon || '📦') + '</div>';
    html += '<div class="group-manage-info">';
    html += '<div class="group-manage-name">' + g.name;
    if (isSystem) html += ' <span class="group-manage-system-tag">Hệ thống</span>';
    if (productCount > 0) html += ' <span style="font-size: 10px; padding: 2px 6px; background: #dbeafe; color: #1e40af; border-radius: 4px; font-weight: 700;">' + productCount + ' SP</span>';
    html += '</div>';
    html += '<div class="group-manage-meta">' + (g.description || 'Không có mô tả') + '</div>';
    html += '</div>';
    html += '<div class="group-manage-actions">';
    html += '<button class="action-btn edit" onclick="editGroup(\'' + g.id + '\')" title="Sửa"><i data-lucide="edit"></i></button>';
    if (canDelete) {
      html += '<button class="action-btn delete" onclick="askDeleteGroup(\'' + g.id + '\')" title="Xóa"><i data-lucide="trash-2"></i></button>';
    } else if (isAdmin && !isSystem && productCount > 0) {
      html += '<button class="action-btn" style="opacity: 0.4; cursor: not-allowed; border-color: #e2e8f0; color: #94a3b8;" onclick="askDeleteGroup(\'' + g.id + '\')" title="Không thể xóa (đang có SP)"><i data-lucide="trash-2"></i></button>';
    }
    html += '</div></div>';
  });

  if (!isAdmin) {
    html += '<div style="margin-top: 16px; padding: 12px 14px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 10px; font-size: 12px; color: #92400e; line-height: 1.6;">';
    html += '<b>⚠️ Chỉ Admin mới có quyền xóa nhóm.</b><br>Bạn có thể tạo và sửa nhóm, nhưng không thể xóa để đảm bảo an toàn dữ liệu.</div>';
  }
  container.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openAddGroupModal() {
  editingGroupId = null;
  document.getElementById('form-group').reset();
  document.getElementById('group-color').value = '#667eea';
  document.getElementById('group-icon').value = '📦';
  document.querySelector('#modal-group .modal-header h3').textContent = 'Thêm Nhóm Sản Phẩm';
  clearFormErrors('form-group');
  document.getElementById('modal-manage-groups').classList.remove('show');
  document.getElementById('modal-group').classList.add('show');
}

function editGroup(id) {
  const g = allGroups.find(x => x.id === id);
  if (!g) return;
  editingGroupId = id;
  document.getElementById('group-name').value = g.name;
  document.getElementById('group-description').value = g.description || '';
  document.getElementById('group-color').value = g.color || '#667eea';
  document.getElementById('group-icon').value = g.icon || '📦';
  document.querySelector('#modal-group .modal-header h3').textContent = 'Sửa Nhóm: ' + g.name;
  clearFormErrors('form-group');
  document.getElementById('modal-manage-groups').classList.remove('show');
  document.getElementById('modal-group').classList.add('show');
}

function closeGroupModal() {
  document.getElementById('modal-group').classList.remove('show');
}

async function handleSaveGroup(e) {
  e.preventDefault();
  const name = document.getElementById('group-name').value.trim();
  const description = document.getElementById('group-description').value.trim();
  const color = document.getElementById('group-color').value;
  const icon = document.getElementById('group-icon').value.trim() || '📦';

  const errName = VALIDATORS.name(name);
  if (errName) { setFieldError('group-name', errName); return; }

  const dup = allGroups.find(g => g.name.toLowerCase() === name.toLowerCase() && g.id !== editingGroupId);
  if (dup) { setFieldError('group-name', 'Tên nhóm đã tồn tại!'); return; }

  try {
    let result;
    if (editingGroupId) {
      result = await supabaseClient.from('product_groups')
        .update({ name, description, color, icon, updated_at: new Date().toISOString() })
        .eq('id', editingGroupId);
    } else {
      result = await supabaseClient.from('product_groups').insert({
        company_id: currentProfile.company_id,
        name, description, color, icon, is_system: false, created_by: currentUser.id
      });
    }
    if (result.error) throw result.error;

    showToast(editingGroupId ? 'Đã cập nhật nhóm!' : 'Đã thêm nhóm "' + name + '"!', 'success');
    editingGroupId = null;
    closeGroupModal();
    await loadGroups();
    populateGroupFilter();
    populateGroupSelect();
    renderStats();
    setTimeout(() => openManageGroupsModal(), 300);
  } catch (err) {
    console.error('Lỗi:', err);
    showToast('Lỗi: ' + err.message, 'error');
  }
}

function askDeleteGroup(id) {
  const g = allGroups.find(x => x.id === id);
  if (!g) return;
  const isAdmin = currentProfile && currentProfile.role === 'admin';

  if (!isAdmin) { showToast('Chỉ Admin mới có quyền xóa nhóm', 'error'); return; }
  if (g.is_system === true) { showToast('Không thể xóa nhóm hệ thống', 'warning'); return; }

  const usedProducts = allProducts.filter(p => p.group_id === id);
  const activeUsedProducts = usedProducts.filter(p => p.is_active !== false);

  if (usedProducts.length > 0) {
    let spList = '';
    usedProducts.slice(0, 10).forEach(p => {
      const isInactive = p.is_active === false;
      spList += '<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #f1f5f9;">';
      spList += '<span style="font-family: monospace; color: #667eea; font-weight: 700; font-size: 12px;">' + p.sku + '</span>';
      spList += '<span style="color: #334155; font-size: 12.5px; flex: 1; margin-left: 10px; text-align: left;">' + p.name + (isInactive ? ' <span style="color: #dc2626; font-size: 10px;">(đã ngưng)</span>' : '') + '</span>';
      spList += '</div>';
    });
    if (usedProducts.length > 10) {
      spList += '<div style="text-align: center; padding: 8px; color: #94a3b8; font-size: 12px;">... và ' + (usedProducts.length - 10) + ' SP khác</div>';
    }

    const html = `
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 48px; margin-bottom: 8px;">⚠️</div>
        <h3 style="font-size: 17px; font-weight: 800; color: #dc2626; margin-bottom: 6px;">Không thể xóa nhóm "${g.name}"</h3>
        <p style="color: #64748b; font-size: 13px; line-height: 1.6;">
          Nhóm này đang có <b style="color: #dc2626;">${usedProducts.length} sản phẩm</b>${activeUsedProducts.length !== usedProducts.length ? ` (${activeUsedProducts.length} đang kinh doanh)` : ''}.
        </p>
      </div>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px; margin-bottom: 16px;">
        <div style="font-size: 11px; font-weight: 800; color: #991b1b; margin-bottom: 8px; text-transform: uppercase;">📦 Danh sách SP đang dùng:</div>
        <div style="max-height: 200px; overflow-y: auto; background: #fff; border-radius: 8px; padding: 10px;">${spList}</div>
      </div>
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px; font-size: 12.5px; color: #1e40af; line-height: 1.6;">
        <b>💡 Cách xử lý:</b><br>
        1. Vào <b>"Sản phẩm"</b> → bấm ✏️ sửa từng SP<br>
        2. Đổi <b>"Nhóm hàng"</b> sang nhóm khác<br>
        3. Sau khi chuyển hết → quay lại xóa nhóm này
      </div>
    `;
    document.getElementById('confirm-title').textContent = 'Không thể xóa';
    document.getElementById('confirm-message').innerHTML = html;
    document.getElementById('confirm-btn').style.display = 'none';
    const footer = document.querySelector('#modal-confirm .modal-footer');
    const cancelBtn = footer.querySelector('.btn-secondary, .btn-primary');
    if (cancelBtn && cancelBtn.id !== 'confirm-btn') {
      cancelBtn.textContent = 'Đã hiểu';
      cancelBtn.className = 'btn btn-primary';
    }
    document.getElementById('modal-confirm').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  pendingToggleId = id;
  pendingDeleteType = 'group';
  document.getElementById('confirm-title').textContent = 'Xóa nhóm sản phẩm';
  document.getElementById('confirm-message').innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 48px; margin-bottom: 8px;">🗑️</div>
      <p style="color: #334155; font-size: 14px; line-height: 1.7;">Bạn có chắc muốn xóa nhóm <b style="color: #dc2626;">"${g.name}"</b>?</p>
      <p style="color: #64748b; font-size: 12px; margin-top: 8px;">Nhóm này không có sản phẩm nào. Thao tác không thể hoàn tác.</p>
    </div>
  `;
  document.getElementById('confirm-btn').textContent = 'Xác nhận xóa';
  document.getElementById('confirm-btn').className = 'btn btn-danger';
  document.getElementById('confirm-btn').style.display = '';
  document.getElementById('confirm-btn').onclick = doDeleteGroup;
  const footer = document.querySelector('#modal-confirm .modal-footer');
  const cancelBtn = footer.querySelector('.btn-secondary, .btn-primary');
  if (cancelBtn && cancelBtn.id !== 'confirm-btn') {
    cancelBtn.textContent = 'Hủy';
    cancelBtn.className = 'btn btn-secondary';
  }
  document.getElementById('modal-confirm').classList.add('show');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function doDeleteGroup() {
  if (!pendingToggleId) return;
  try {
    const result = await supabaseClient.from('product_groups')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', pendingToggleId);
    if (result.error) throw result.error;
    showToast('Đã xóa nhóm!', 'success');
    closeConfirmModal();
    await loadGroups();
    populateGroupFilter();
    populateGroupSelect();
    renderStats();
    setTimeout(() => openManageGroupsModal(), 300);
  } catch (err) {
    console.error('Lỗi:', err);
    showToast('Lỗi: ' + err.message, 'error');
  }
}

// ============================================
// MODAL SUPPLIER
// ============================================
function openAddSupplierModal() {
  document.getElementById('form-supplier').reset();
  clearFormErrors('form-supplier');
  document.getElementById('modal-supplier').classList.add('show');
}

function closeSupplierModal() {
  document.getElementById('modal-supplier').classList.remove('show');
}

async function handleSaveSupplier(e) {
  e.preventDefault();
  clearFormErrors('form-supplier');

  const code = document.getElementById('supp-code').value.trim().toUpperCase();
  const name = document.getElementById('supp-name').value.trim();
  const taxCode = document.getElementById('supp-tax-code').value.trim();
  const phone = document.getElementById('supp-phone').value.trim();
  const email = document.getElementById('supp-email').value.trim();

  let hasError = false;
  const errCode = VALIDATORS.code(code); if (errCode) { setFieldError('supp-code', errCode); hasError = true; }
  const errName = VALIDATORS.name(name); if (errName) { setFieldError('supp-name', errName); hasError = true; }
  const errTax = VALIDATORS.taxCode(taxCode); if (errTax) { setFieldError('supp-tax-code', errTax); hasError = true; }
  const errPhone = VALIDATORS.phone(phone); if (errPhone) { setFieldError('supp-phone', errPhone); hasError = true; }
  const errEmail = VALIDATORS.email(email); if (errEmail) { setFieldError('supp-email', errEmail); hasError = true; }

  if (hasError) { showToast('Vui lòng kiểm tra lại các trường báo đỏ', 'error'); return; }

  try {
    const result = await supabaseClient.from('suppliers').insert({
      company_id: currentProfile.company_id,
      code: code || null, name: name,
      tax_code: taxCode || null, phone: phone || null,
      contact_person: document.getElementById('supp-contact').value.trim() || null,
      email: email || null, address: document.getElementById('supp-address').value.trim() || null,
      bank_name: document.getElementById('supp-bank-name').value.trim() || null,
      bank_account: document.getElementById('supp-bank-account').value.trim() || null,
      note: document.getElementById('supp-note').value.trim() || null,
      created_by: currentUser.id
    });
    if (result.error) throw result.error;
    showToast('Đã thêm NCC "' + name + '"!', 'success');
    closeSupplierModal();
    await loadSuppliers();
    populateSupplierSelect();
    renderStats();
  } catch (err) {
    console.error('Lỗi:', err);
    showToast('Lỗi: ' + err.message, 'error');
  }
}

// ============================================
// TOGGLE ACTIVE
// ============================================
function askToggleActive(id, activate) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  pendingToggleId = id;
  pendingDeleteType = 'product_toggle';
  const title = activate ? 'Kinh doanh lại sản phẩm' : 'Ngưng kinh doanh';
  const msg = activate
    ? 'Bạn muốn kinh doanh lại sản phẩm "' + p.name + '"? SP sẽ hiện lại trong danh sách.'
    : 'Bạn muốn NGƯNG kinh doanh sản phẩm "' + p.name + '"? SP sẽ bị ẩn khỏi danh sách, có thể mở lại bất cứ lúc nào.';
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = msg;
  document.getElementById('confirm-btn').textContent = activate ? 'Kinh doanh lại' : 'Ngưng kinh doanh';
  document.getElementById('confirm-btn').className = activate ? 'btn btn-primary' : 'btn btn-danger';
  document.getElementById('confirm-btn').style.display = '';
  document.getElementById('confirm-btn').onclick = doToggleActive;
  const footer = document.querySelector('#modal-confirm .modal-footer');
  const cancelBtn = footer.querySelector('.btn-secondary, .btn-primary');
  if (cancelBtn && cancelBtn.id !== 'confirm-btn') {
    cancelBtn.textContent = 'Hủy';
    cancelBtn.className = 'btn btn-secondary';
  }
  document.getElementById('modal-confirm').classList.add('show');
}

function closeConfirmModal() {
  document.getElementById('modal-confirm').classList.remove('show');
  pendingToggleId = null;
  pendingDeleteType = null;
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

async function doToggleActive() {
  if (!pendingToggleId) return;
  const p = allProducts.find(x => x.id === pendingToggleId);
  if (!p) return;
  const newStatus = !(p.is_active !== false);
  try {
    const result = await supabaseClient.from('products')
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq('id', pendingToggleId);
    if (result.error) throw result.error;
    showToast(newStatus ? 'Đã kinh doanh lại sản phẩm!' : 'Đã ngưng kinh doanh!', 'success');
    closeConfirmModal();
    await loadProducts();
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
// ESC
// ============================================
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeProductModal();
    closeGroupModal();
    closeSupplierModal();
    closeDetailModal();
    closeConfirmModal();
    closeManageGroupsModal();
    closeUserMenu();
  }
});

console.log('✅ products.js v6 loaded');