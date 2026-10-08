// ============================================
// SUPPLIERS MODULE LOGIC
// (Chỉ giữ logic RIÊNG — mọi thứ chung đã có trong layout.js)
// ============================================

const supabaseClient = window.supabaseClient;


// ============================================
// CONFIG EXPORT
// ============================================
window.EXPORT_CONFIG = {
    entityName: 'danh sách nhà cung cấp',
    filePrefix: 'nha-cung-cap',
    getFilteredRows: () => filteredSuppliers,
    columns: [
        { key: 'stt',        label: 'STT',            defaultOn: true,  getValue: (row) => filteredSuppliers.indexOf(row) + 1 },
        { key: 'code',       label: 'Mã NCC',         defaultOn: true,  getValue: (r) => r.code || '' },
        { key: 'name',       label: 'Tên nhà cung cấp', defaultOn: true, getValue: (r) => r.name || '' },
        { key: 'tax_code',   label: 'Mã số thuế',     defaultOn: true,  getValue: (r) => r.tax_code || '' },
        { key: 'contact',    label: 'Người liên hệ',  defaultOn: true,  getValue: (r) => r.contact_person || '' },
        { key: 'phone',      label: 'Số điện thoại',  defaultOn: true,  getValue: (r) => r.phone || '' },
        { key: 'email',      label: 'Email',          defaultOn: false, getValue: (r) => r.email || '' },
        { key: 'address',    label: 'Địa chỉ',        defaultOn: false, getValue: (r) => r.address || '' },
        { key: 'bank',       label: 'Ngân hàng',      defaultOn: false, getValue: (r) => r.bank_name || '' },
        { key: 'bank_acc',   label: 'Số tài khoản',   defaultOn: false, getValue: (r) => r.bank_account || '' },
        { key: 'rating',     label: 'Đánh giá',       defaultOn: false, getValue: (r) => (r.rating || 0) + '/5' },
        { key: 'prod_count', label: 'Số SP cung cấp', defaultOn: true,  getValue: (r) => r.product_count || 0 },
        { key: 'has_inv',    label: 'Có hóa đơn',     defaultOn: false, getValue: (r) => r.has_invoice === false ? 'Không' : 'Có' },
        { key: 'status',     label: 'Trạng thái',     defaultOn: true,  getValue: (r) => r.is_active === false ? 'Ngưng giao dịch' : 'Đang giao dịch' }
    ]
};

// ============================================
// ROW SELECTION
// ============================================
window.toggleRowSelect = function(id, checked) {
    if (checked) window.EXPORT_SELECTED.add(id);
    else window.EXPORT_SELECTED.delete(id);
    updateSelectAllCheckbox();
};

window.toggleSelectAllRows = function(checked) {
    if (checked) filteredSuppliers.forEach(s => window.EXPORT_SELECTED.add(s.id));
    else filteredSuppliers.forEach(s => window.EXPORT_SELECTED.delete(s.id));
    renderSuppliers();
};

function updateSelectAllCheckbox() {
    const all = document.getElementById('select-all-rows');
    if (!all) return;
    const allChecked = filteredSuppliers.length > 0 &&
        filteredSuppliers.every(s => window.EXPORT_SELECTED.has(s.id));
    all.checked = allChecked;
}


// ===== STATE =====
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
// VALIDATORS
// ============================================
const VALIDATORS = {
    code: (v) => {
        if (!v) return null;
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
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ Suppliers page loading...');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const ok = await initLayout();
    if (!ok) return;

    // Load SP TRƯỚC để có data đếm
    await loadProducts();
    await loadSuppliers();
    recountProducts();
    renderStats();
    renderSuppliers();

    initSortableHeaders();
    setupValidations();

    if (typeof lucide !== 'undefined') lucide.createIcons();
    console.log('✅ Suppliers page ready');

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
// LOAD DATA
// ============================================
async function loadSuppliers() {
    try {
        const result = await supabaseClient
            .from('suppliers')
            .select('*')
            .eq('company_id', window.currentProfile.company_id)
            .order('name');
        allSuppliers = result.data || [];

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
            .eq('company_id', window.currentProfile.company_id)
            .is('deleted_at', null);
        allProducts = result.data || [];
    } catch (err) {
        console.error('Lỗi load products:', err);
        allProducts = [];
    }
}

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
        tbody.innerHTML = '<tr><td colspan="9" class="table-loading">' +
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

        const contactHtml = s.contact_person
            ? escapeHtml(s.contact_person)
            : '<span style="color: #94a3b8;">—</span>';
        const phoneHtml = s.phone
            ? escapeHtml(s.phone)
            : '<span style="color: #94a3b8;">—</span>';
        const taxHtml = s.tax_code
            ? '<span style="font-family: monospace; font-size: 12px;">' + escapeHtml(s.tax_code) + '</span>'
            : '<span style="color: #94a3b8;">—</span>';

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

const isChecked = window.EXPORT_SELECTED.has(s.id);
html += '<tr style="' + trStyle + '">';
html += '<td style="text-align: center;"><input type="checkbox" class="row-checkbox" ' + (isChecked ? 'checked' : '') + ' onchange="toggleRowSelect(\'' + s.id + '\', this.checked)"></td>';
html += '<td><span class="supplier-code">' + escapeHtml(s.code || '—') + '</span></td>';
        html += '<td>';
        html += '<span class="supplier-name">' + escapeHtml(s.name) + '</span>';
        if (s.address) html += '<span class="supplier-address">📍 ' + escapeHtml(s.address) + '</span>';
        html += '</td>';
        html += '<td>' + taxHtml + '</td>';
        html += '<td>' + contactHtml + '</td>';
        html += '<td>' + phoneHtml + '</td>';
        html += '<td style="text-align: center;">' + productCountHtml + '</td>';

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
    updateSelectAllCheckbox();
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
    renderSuppliers();
    const main = document.getElementById('dash-main');
    if (main) main.scrollTop = 0;
}

// ============================================
// FILTERS
// ============================================
function applyFilters() {
    const search = normalizeVN(document.getElementById('supplier-search').value || '');
    const status = document.getElementById('filter-status').value;

    filteredSuppliers = allSuppliers.filter(s => {
        if (search) {
            const hay = normalizeVN((s.code || '') + ' ' + (s.name || '') + ' ' + (s.tax_code || '') + ' ' + (s.phone || '') + ' ' + (s.contact_person || ''));
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
// MODAL SUPPLIER
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

    // Check trùng mã
    if (code) {
        let query = supabaseClient
            .from('suppliers')
            .select('id, code, name')
            .eq('company_id', window.currentProfile.company_id)
            .ilike('code', code);
        if (id) query = query.neq('id', id);
        const { data: dup } = await query;
        if (dup && dup.length > 0) {
            setFieldError('supp-code', 'Mã "' + code + '" đã tồn tại! (NCC: ' + dup[0].name + ')');
            showToast('❌ Mã NCC đã tồn tại!', 'error');
            return;
        }
    }

    // Tự sinh mã nếu để trống
    let finalCode = code;
    if (!finalCode && !id) {
        const prefix = 'NCC-';
        const { data: maxCodes } = await supabaseClient
            .from('suppliers')
            .select('code')
            .eq('company_id', window.currentProfile.company_id)
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
        company_id: window.currentProfile.company_id,
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
            payload.created_by = window.currentUser.id;
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

    const supplierProducts = allProducts.filter(p => p.supplier_id === id);

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
            productsHtml += '<span class="supplier-product-sku">' + escapeHtml(p.sku) + '</span>';
            productsHtml += '<span class="supplier-product-name">' + escapeHtml(p.name) + '</span>';
            productsHtml += '</div>';
            productsHtml += '<div class="supplier-product-price">' + formatMoney(p.price) + '</div>';
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
                    <span style="font-family: monospace; color: #667eea; font-weight: 700;">${escapeHtml(s.code || 'Chưa có mã')}</span>
                    ${statusBadge}
                </div>
                <div style="margin-top: 8px;">${ratingHtml}</div>
            </div>
        </div>

        <div class="detail-section">
            <h4>📋 Thông Tin Liên Hệ</h4>
            <div class="detail-row"><span class="detail-row-label">Mã số thuế:</span><span class="detail-row-value">${escapeHtml(s.tax_code || '—')}</span></div>
            <div class="detail-row"><span class="detail-row-label">Người liên hệ:</span><span class="detail-row-value">${escapeHtml(s.contact_person || '—')}</span></div>
            <div class="detail-row"><span class="detail-row-label">Số điện thoại:</span><span class="detail-row-value">${escapeHtml(s.phone || '—')}</span></div>
            <div class="detail-row"><span class="detail-row-label">Email:</span><span class="detail-row-value">${escapeHtml(s.email || '—')}</span></div>
            <div class="detail-row"><span class="detail-row-label">Địa chỉ:</span><span class="detail-row-value" style="max-width: 300px; text-align: right;">${escapeHtml(s.address || '—')}</span></div>
        </div>

        <div class="detail-section">
            <h4>💰 Thông Tin Thanh Toán</h4>
            <div class="detail-row"><span class="detail-row-label">Ngân hàng:</span><span class="detail-row-value">${escapeHtml(s.bank_name || '—')}</span></div>
            <div class="detail-row"><span class="detail-row-label">Số tài khoản:</span><span class="detail-row-value">${escapeHtml(s.bank_account || '—')}</span></div>
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
// TOGGLE ACTIVE
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
        const linkedProducts = allProducts.filter(p => p.supplier_id === id);
        if (linkedProducts.length > 0) {
            let spList = '';
            linkedProducts.slice(0, 8).forEach(p => {
                spList += '<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #f1f5f9;">';
                spList += '<span style="font-family: monospace; color: #667eea; font-weight: 700; font-size: 12px;">' + escapeHtml(p.sku) + '</span>';
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
// BANK COMBOBOX
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
    if (dropdown) dropdown.classList.add('show');
    if (toggle) toggle.classList.add('open');
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
            let logoHtml = '';
            if (bank.logo) {
                logoHtml = '<img src="' + bank.logo + '" class="combobox-item-logo" alt="' + escapeHtml(bank.name) + '" onerror="this.style.display=\'none\'">';
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
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    hideBankList();
}

document.addEventListener('click', function(e) {
    const wrap = document.querySelector('.combobox-wrap');
    if (wrap && !wrap.contains(e.target)) hideBankList();
});

document.addEventListener('keydown', function(e) {
    const dropdown = document.getElementById('bank-dropdown');
    const input = document.getElementById('supp-bank-name');
    if (!dropdown || !dropdown.classList.contains('show')) return;
    if (!input || document.activeElement !== input) return;
    if (e.key === 'Escape' || e.key === 'Enter') hideBankList();
});

// ============================================
// ESC KEY
// ============================================
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeSupplierModal();
        closeDetailModal();
        closeConfirmModal();
    }
});

console.log('✅ suppliers.js loaded');