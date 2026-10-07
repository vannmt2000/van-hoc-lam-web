// ============================================
// PRODUCTS MODULE LOGIC (v9 - có Export/Print)
// ============================================
const supabaseClient = window.supabaseClient;

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
// CONFIG EXPORT
// ============================================
window.EXPORT_CONFIG = {
    entityName: 'danh sách sản phẩm',
    filePrefix: 'san-pham',
    getFilteredRows: () => filteredProducts,
    columns: [
        { key: 'stt',       label: 'STT',           defaultOn: true,  getValue: (row) => filteredProducts.indexOf(row) + 1 },
        { key: 'sku',       label: 'Mã sản phẩm',   defaultOn: true,  getValue: (r) => r.sku || '' },
        { key: 'name',      label: 'Tên sản phẩm',  defaultOn: true,  getValue: (r) => r.name || '' },
        { key: 'group',     label: 'Nhóm',          defaultOn: true,  getValue: (r) => r.product_groups ? r.product_groups.name : '' },
        { key: 'unit',      label: 'Đơn vị',        defaultOn: true,  getValue: (r) => r.unit || 'Cái' },
        { key: 'stock',     label: 'Tồn kho',       defaultOn: true,  getValue: (r) => r.stock || 0 },
        { key: 'min_stock', label: 'Tồn tối thiểu', defaultOn: false, getValue: (r) => r.min_stock || 0 },
        { key: 'purchase',  label: 'Giá nhập',      defaultOn: false, getValue: (r) => formatMoney(r.purchase_price) },
        { key: 'price',     label: 'Giá bán',       defaultOn: false, getValue: (r) => formatMoney(r.price) },
        { key: 'vat',       label: 'VAT',           defaultOn: false, getValue: (r) => (r.vat_percent || 0) + '%' },
        { key: 'supplier',  label: 'Nhà cung cấp',  defaultOn: true,  getValue: (r) => r.suppliers ? r.suppliers.name : '' },
        { key: 'location',  label: 'Vị trí kho',    defaultOn: false, getValue: (r) => r.location || '' },
        { key: 'barcode',   label: 'Barcode',       defaultOn: false, getValue: (r) => r.barcode || '' },
        { key: 'desc',      label: 'Mô tả',         defaultOn: false, getValue: (r) => r.description || '' },
        { key: 'imported',  label: 'Ngày nhập',     defaultOn: true,  getValue: (r) => formatDate(r.imported_at || r.created_at) },
        { key: 'status',    label: 'Trạng thái',    defaultOn: true,  getValue: (r) => r.is_active === false ? 'Đã ngưng' : 'Đang kinh doanh' }
    ]
};

// ============================================
// VALIDATORS
// ============================================
const VALIDATORS = {
    sku: (v) => {
        if (!v) return null;
        if (v.length < 3) return 'Mã sản phẩm phải có ít nhất 3 ký tự';
        if (v.length > 30) return 'Mã sản phẩm tối đa 30 ký tự';
        if (!/^[A-Z0-9\-_\.]+$/.test(v)) return 'Mã sản phẩm chỉ chứa chữ HOA, số, dấu - _ .';
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

// ============================================
// AUTO-GEN SKU
// ============================================
async function generateSKU() {
    const prefix = 'SP-';
    const { data } = await supabaseClient
        .from('products').select('sku')
        .eq('company_id', window.currentProfile.company_id)
        .like('sku', prefix + '%')
        .order('sku', { ascending: false }).limit(20);
    let maxNum = 0;
    if (data && data.length > 0) {
        data.forEach(row => {
            if (row.sku) {
                const num = parseInt(row.sku.replace(prefix, '')) || 0;
                if (num > maxNum) maxNum = num;
            }
        });
    }
    return prefix + String(maxNum + 1).padStart(3, '0');
}

// ============================================
// ROW SELECTION
// ============================================
window.toggleRowSelect = function(id, checked) {
    if (checked) window.EXPORT_SELECTED.add(id);
    else window.EXPORT_SELECTED.delete(id);
    updateSelectAllCheckbox();
};

window.toggleSelectAllRows = function(checked) {
    if (checked) filteredProducts.forEach(p => window.EXPORT_SELECTED.add(p.id));
    else filteredProducts.forEach(p => window.EXPORT_SELECTED.delete(p.id));
    renderProducts();
};

function updateSelectAllCheckbox() {
    const all = document.getElementById('select-all-rows');
    if (!all) return;
    const allChecked = filteredProducts.length > 0 &&
        filteredProducts.every(p => window.EXPORT_SELECTED.has(p.id));
    all.checked = allChecked;
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ Products page loading...');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const ok = await initLayout();
    if (!ok) return;

    await Promise.all([loadGroups(), loadSuppliers(), loadProducts()]);

    renderStats();
    renderProducts();
    populateGroupFilter();
    populateGroupSelect();
    populateSupplierSelect();
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
// LOAD DATA
// ============================================
async function loadGroups() {
    try {
        const result = await supabaseClient.from('product_groups')
            .select('*').eq('company_id', window.currentProfile.company_id)
            .eq('is_active', true).is('deleted_at', null)
            .order('is_system', { ascending: false }).order('name');
        allGroups = result.data || [];
    } catch (err) { allGroups = []; }
}

async function loadSuppliers() {
    try {
        const result = await supabaseClient.from('suppliers')
            .select('*').eq('company_id', window.currentProfile.company_id)
            .eq('is_active', true).is('deleted_at', null).order('name');
        allSuppliers = result.data || [];
    } catch (err) { allSuppliers = []; }
}

async function loadProducts() {
    try {
        const result = await supabaseClient.from('products')
            .select('*, product_groups(id, name, color, icon), suppliers(id, name, code)')
            .eq('company_id', window.currentProfile.company_id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        allProducts = result.data || [];
        filteredProducts = [...allProducts];
        sortProducts();
    } catch (err) { allProducts = []; filteredProducts = []; }
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
// RENDER PRODUCTS — 10 cột (thêm checkbox)
// ============================================
function renderProducts() {
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;

    if (filteredProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="table-loading">' +
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
        const isChecked = window.EXPORT_SELECTED.has(p.id);

        let stockClass = 'ok';
        if (stock === 0) stockClass = 'out';
        else if (stock <= minStock) stockClass = 'low';

        const imgHtml = p.image_url
            ? '<img src="' + p.image_url + '" class="product-img">'
            : '<div class="product-img-placeholder"><i data-lucide="image"></i></div>';

        let groupHtml = '<span style="color: #94a3b8;">—</span>';
        if (group) {
            groupHtml = '<span class="group-badge" style="background: ' + (group.color || '#667eea') + '20; color: ' + (group.color || '#667eea') + ';">' +
                (group.icon || '📦') + ' ' + escapeHtml(group.name) + '</span>';
        }

        let supplierHtml = '<span style="color: #94a3b8; font-size: 12px;">— Chưa chọn —</span>';
        if (supplier) {
            supplierHtml = '<div style="font-size: 12.5px; font-weight: 600; color: #0f172a;">' + escapeHtml(supplier.name) + '</div>';
            if (supplier.code) {
                supplierHtml += '<div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Mã: ' + escapeHtml(supplier.code) + '</div>';
            }
        }

        const importedHtml = '<div class="date-cell">' + formatDate(p.imported_at || p.created_at) + '</div>';
        const trStyle = isInactive ? 'opacity: 0.5; text-decoration: line-through;' : '';
        const statusTag = isInactive
            ? '<span style="display: inline-block; padding: 2px 8px; background: #fee2e2; color: #991b1b; border-radius: 6px; font-size: 10px; font-weight: 800; margin-left: 6px;">ĐÃ NGƯNG</span>'
            : '';

        html += '<tr style="' + trStyle + '">';
        html += '<td style="text-align: center;"><input type="checkbox" class="row-checkbox" ' + (isChecked ? 'checked' : '') + ' onchange="toggleRowSelect(\'' + p.id + '\', this.checked)"></td>';
        html += '<td>' + imgHtml + '</td>';
        html += '<td><span class="product-sku">' + escapeHtml(p.sku) + '</span></td>';
        html += '<td>';
        html += '<span class="product-name">' + escapeHtml(p.name) + statusTag + '</span>';
        if (p.description) html += '<span class="product-desc" title="' + escapeHtml(p.description) + '">' + escapeHtml(p.description) + '</span>';
        html += '</td>';
        html += '<td>' + groupHtml + '</td>';
        html += '<td>' + escapeHtml(p.unit || 'Cái') + '</td>';
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
    updateSelectAllCheckbox();
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
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
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
    document.getElementById('prod-imported-at').value = new Date().toISOString().split('T')[0];
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
    if (!sku) { showToast('Nhập mã sản phẩm trước để sinh QR', 'warning'); return; }
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(sku);
    const preview = document.getElementById('qr-preview');
    preview.innerHTML = '<img src="' + qrUrl + '" alt="QR Code" crossorigin="anonymous">' +
        '<div class="qr-preview-info"><b>QR Code: ' + escapeHtml(sku) + '</b>Chuột phải → Lưu ảnh về máy để in. Miễn phí 100%!</div>';
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
    let sku = document.getElementById('prod-sku').value.trim().toUpperCase();
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

    if (!sku && !id) {
        try {
            sku = await generateSKU();
            console.log('🔢 Tự sinh SKU:', sku);
        } catch (err) {
            showToast('Lỗi sinh SKU tự động', 'error');
            return;
        }
    }

    const dup = allProducts.find(p => p.sku && p.sku.toUpperCase() === sku.toUpperCase() && p.id !== id);
    if (dup) {
        setFieldError('prod-sku', 'Mã sản phẩm "' + sku + '" đã tồn tại!');
        showToast('❌ Mã sản phẩm đã tồn tại!', 'error');
        return;
    }

    const payload = {
        company_id: window.currentProfile.company_id,
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
            payload.created_by = window.currentUser.id;
            result = await supabaseClient.from('products').insert(payload);
        }
        if (result.error) {
            if (result.error.code === '23505' || result.error.message.includes('unique')) {
                setFieldError('prod-sku', 'Mã sản phẩm "' + sku + '" đã tồn tại!');
                showToast('❌ Mã sản phẩm đã tồn tại!', 'error');
                return;
            }
            throw result.error;
        }
        showToast(id ? 'Đã cập nhật sản phẩm!' : 'Đã thêm sản phẩm (Mã: ' + sku + ')!', 'success');
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
    const imgHtml = p.image_url
        ? '<img src="' + p.image_url + '" class="detail-image">'
        : '<div class="detail-image-placeholder"><i data-lucide="image"></i></div>';

    const html = '<div class="detail-grid">' +
        '<div>' + imgHtml + '</div>' +
        '<div>' +
            '<div class="detail-section">' +
                '<h4>Thông tin cơ bản</h4>' +
                '<div class="detail-row"><span class="detail-row-label">Mã sản phẩm:</span><span class="detail-row-value">' + escapeHtml(p.sku) + '</span></div>' +
                '<div class="detail-row"><span class="detail-row-label">Tên:</span><span class="detail-row-value">' + escapeHtml(p.name) + '</span></div>' +
                '<div class="detail-row"><span class="detail-row-label">Nhóm:</span><span class="detail-row-value">' + (group ? (group.icon + ' ' + escapeHtml(group.name)) : '—') + '</span></div>' +
                '<div class="detail-row"><span class="detail-row-label">Đơn vị:</span><span class="detail-row-value">' + escapeHtml(p.unit || '—') + '</span></div>' +
                '<div class="detail-row"><span class="detail-row-label">Vị trí kho:</span><span class="detail-row-value">' + escapeHtml(p.location || '—') + '</span></div>' +
                (p.description ? '<div class="detail-row"><span class="detail-row-label">Mô tả:</span><span class="detail-row-value" style="max-width: 300px; white-space: pre-wrap;">' + escapeHtml(p.description) + '</span></div>' : '') +
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
                '<div class="detail-row"><span class="detail-row-label">Nhà cung cấp:</span><span class="detail-row-value">' + (supplier ? escapeHtml(supplier.name) : '— Chưa chọn —') + '</span></div>' +
                '<div class="detail-row"><span class="detail-row-label">Ngày nhập:</span><span class="detail-row-value">' + formatDate(p.imported_at || p.created_at) + '</span></div>' +
                '<div class="detail-row"><span class="detail-row-label">Tồn hiện tại:</span><span class="detail-row-value">' + (p.stock || 0) + ' ' + escapeHtml(p.unit || '') + '</span></div>' +
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
    const admin = isAdmin();
    const activeGroups = allGroups.filter(g => g.is_active !== false);

    let html = '';
    activeGroups.forEach(g => {
        const productCount = allProducts.filter(p => p.group_id === g.id && p.is_active !== false).length;
        const isSystem = g.is_system === true;
        const canDelete = admin && !isSystem && productCount === 0;

        html += '<div class="group-manage-item">';
        html += '<div class="group-manage-icon" style="background: ' + (g.color || '#667eea') + '20; color: ' + (g.color || '#667eea') + ';">' + (g.icon || '📦') + '</div>';
        html += '<div class="group-manage-info">';
        html += '<div class="group-manage-name">' + escapeHtml(g.name);
        if (isSystem) html += ' <span class="group-manage-system-tag">Hệ thống</span>';
        if (productCount > 0) html += ' <span style="font-size: 10px; padding: 2px 6px; background: #dbeafe; color: #1e40af; border-radius: 4px; font-weight: 700;">' + productCount + ' SP</span>';
        html += '</div>';
        html += '<div class="group-manage-meta">' + escapeHtml(g.description || 'Không có mô tả') + '</div>';
        html += '</div>';
        html += '<div class="group-manage-actions">';
        html += '<button class="action-btn edit" onclick="editGroup(\'' + g.id + '\')" title="Sửa"><i data-lucide="edit"></i></button>';
        if (canDelete) {
            html += '<button class="action-btn delete" onclick="askDeleteGroup(\'' + g.id + '\')" title="Xóa"><i data-lucide="trash-2"></i></button>';
        } else if (admin && !isSystem && productCount > 0) {
            html += '<button class="action-btn" style="opacity: 0.4; cursor: not-allowed; border-color: #e2e8f0; color: #94a3b8;" onclick="askDeleteGroup(\'' + g.id + '\')" title="Không thể xóa (đang có SP)"><i data-lucide="trash-2"></i></button>';
        }
        html += '</div></div>';
    });

    if (!admin) {
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
                company_id: window.currentProfile.company_id,
                name, description, color, icon, is_system: false, created_by: window.currentUser.id
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
    const admin = isAdmin();

    if (!admin) { showToast('Chỉ Admin mới có quyền xóa nhóm', 'error'); return; }
    if (g.is_system === true) { showToast('Không thể xóa nhóm hệ thống', 'warning'); return; }

    const usedProducts = allProducts.filter(p => p.group_id === id);
    const activeUsedProducts = usedProducts.filter(p => p.is_active !== false);

    if (usedProducts.length > 0) {
        let spList = '';
        usedProducts.slice(0, 10).forEach(p => {
            const isInactive = p.is_active === false;
            spList += '<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #f1f5f9;">';
            spList += '<span style="font-family: monospace; color: #667eea; font-weight: 700; font-size: 12px;">' + escapeHtml(p.sku) + '</span>';
            spList += '<span style="color: #334155; font-size: 12.5px; flex: 1; margin-left: 10px; text-align: left;">' + escapeHtml(p.name) + (isInactive ? ' <span style="color: #dc2626; font-size: 10px;">(đã ngưng)</span>' : '') + '</span>';
            spList += '</div>';
        });
        if (usedProducts.length > 10) {
            spList += '<div style="text-align: center; padding: 8px; color: #94a3b8; font-size: 12px;">... và ' + (usedProducts.length - 10) + ' SP khác</div>';
        }

        const html = `
            <div style="text-align: center; margin-bottom: 16px;">
                <div style="font-size: 48px; margin-bottom: 8px;">⚠️</div>
                <h3 style="font-size: 17px; font-weight: 800; color: #dc2626; margin-bottom: 6px;">Không thể xóa nhóm "${escapeHtml(g.name)}"</h3>
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
            <p style="color: #334155; font-size: 14px; line-height: 1.7;">Bạn có chắc muốn xóa nhóm <b style="color: #dc2626;">"${escapeHtml(g.name)}"</b>?</p>
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
// MODAL NCC NHANH
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
            company_id: window.currentProfile.company_id,
            code: code || null, name: name,
            tax_code: taxCode || null, phone: phone || null,
            contact_person: document.getElementById('supp-contact').value.trim() || null,
            email: email || null, address: document.getElementById('supp-address').value.trim() || null,
            bank_name: document.getElementById('supp-bank-name').value.trim() || null,
            bank_account: document.getElementById('supp-bank-account').value.trim() || null,
            note: document.getElementById('supp-note').value.trim() || null,
            created_by: window.currentUser.id
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
// ESC KEY
// ============================================
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeProductModal();
        closeGroupModal();
        closeSupplierModal();
        closeDetailModal();
        closeConfirmModal();
        closeManageGroupsModal();
    }
});

console.log('✅ products.js v9 loaded');