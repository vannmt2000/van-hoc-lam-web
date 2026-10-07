// ============================================
// CUSTOMERS MODULE LOGIC
// ============================================
const supabaseClient = window.supabaseClient;

let allCustomers = [];
let allLogs = [];
let filteredCustomers = [];
let currentPage = 1;
const PAGE_SIZE = 20;
let editingCustomerId = null;
let editingCustomerType = 'individual';
let pendingToggleId = null;
let sortField = 'created_at';
let sortDirection = 'desc';
let detailCustomerId = null;
let detailTab = 'info';
let repCustomerId = null;
let repMode = 'existing';

const VALIDATORS = {
    phone: (v) => {
        if (!v) return 'Vui lòng nhập số điện thoại';
        const cleaned = v.replace(/[\s\-\.]/g, '');
        if (!/^0\d{9,10}$/.test(cleaned)) return 'Số điện thoại phải có 10-11 số, bắt đầu bằng 0';
        return null;
    },
    email: (v) => {
        if (!v) return null;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Email không đúng định dạng';
        return null;
    },
    name: (v) => {
        if (!v || v.trim().length < 2) return 'Tên phải có ít nhất 2 ký tự';
        if (v.length > 200) return 'Tên tối đa 200 ký tự';
        return null;
    },
    taxCode: (v, type) => {
        if (type === 'business' && !v) return 'Doanh nghiệp phải có mã số thuế';
        if (!v) return null;
        if (!/^\d{10}(\d{3})?$/.test(v)) return 'Mã số thuế phải là 10 hoặc 13 số';
        return null;
    },
    idCard: (v) => {
        if (!v) return null;
        const cleaned = v.replace(/[\s\-\.]/g, '');
        if (!/^\d{9}$|^\d{12}$/.test(cleaned)) return 'CCCD phải 9 hoặc 12 số';
        return null;
    }
};

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ Customers page loading...');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const ok = await initLayout();
    if (!ok) return;

    await loadCustomers();
    await loadLogs();
    renderStats();
    renderCustomers();
    initSortableHeaders();
    setupValidations();

    if (typeof lucide !== 'undefined') lucide.createIcons();
    console.log('✅ Customers page ready');

    const splash = document.getElementById('app-splash');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => splash.remove(), 300);
    }
});

function setupValidations() {
    const phoneInput = document.getElementById('cust-phone');
    if (phoneInput) {
        phoneInput.addEventListener('blur', function() {
            const err = VALIDATORS.phone(this.value);
            setFieldError('cust-phone', err);
        });
    }
}

// ============================================
// LOAD DATA
// ============================================
async function loadCustomers() {
    try {
        const result = await supabaseClient
            .from('customers').select('*')
            .eq('company_id', window.currentProfile.company_id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        allCustomers = result.data || [];
        filteredCustomers = [...allCustomers];
        sortCustomers();
    } catch (err) {
        console.error('Lỗi load customers:', err);
        allCustomers = [];
        filteredCustomers = [];
    }
}

async function loadLogs() {
    try {
        const result = await supabaseClient
            .from('customer_logs').select('*')
            .order('created_at', { ascending: false }).limit(500);
        allLogs = result.data || [];
    } catch (err) { allLogs = []; }
}

async function saveLog(customerId, action, description) {
    try {
        await supabaseClient.from('customer_logs').insert({
            customer_id: customerId,
            action: action,
            description: description,
            performed_by: window.currentUser.id
        });
    } catch (err) { console.error('Lỗi save log:', err); }
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
            sortCustomers();
            renderCustomers();
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

function sortCustomers() {
    filteredCustomers.sort((a, b) => {
        let va = a[sortField];
        let vb = b[sortField];
        if (sortField === 'tier') {
            const order = { 'vip': 1, 'regular': 2, 'new': 3 };
            va = order[va] || 99;
            vb = order[vb] || 99;
        }
        if (sortField === 'full_name') {
            if (a.customer_type === 'business') {
                let repName = a.representative_name || '';
                if (a.representative_customer_id) {
                    const rep = allCustomers.find(x => x.id === a.representative_customer_id);
                    if (rep) repName = rep.full_name;
                }
                va = repName || '';
            }
            if (b.customer_type === 'business') {
                let repName = b.representative_name || '';
                if (b.representative_customer_id) {
                    const rep = allCustomers.find(x => x.id === b.representative_customer_id);
                    if (rep) repName = rep.full_name;
                }
                vb = repName || '';
            }
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
// STATS
// ============================================
function renderStats() {
    const activeCustomers = allCustomers.filter(c => c.is_active !== false);
    const totalEl = document.getElementById('stat-total');
    const indEl = document.getElementById('stat-individual');
    const bizEl = document.getElementById('stat-business');
    const vipEl = document.getElementById('stat-vip');
    if (totalEl) totalEl.textContent = activeCustomers.length;
    if (indEl) indEl.textContent = activeCustomers.filter(c => c.customer_type === 'individual').length;
    if (bizEl) bizEl.textContent = activeCustomers.filter(c => c.customer_type === 'business').length;
    if (vipEl) vipEl.textContent = activeCustomers.filter(c => c.tier === 'vip').length;
}

// ============================================
// RENDER TABLE
// ============================================
function renderCustomers() {
    const tbody = document.getElementById('customers-tbody');
    if (!tbody) return;
    if (filteredCustomers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="table-loading">' +
            '<i data-lucide="users"></i> Chưa có khách hàng nào.' +
            '</td></tr>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        renderPagination();
        return;
    }
    const totalPages = Math.ceil(filteredCustomers.length / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredCustomers.slice(start, start + PAGE_SIZE);
    let html = '';
    pageItems.forEach(c => {
        const isInactive = c.is_active === false;
        const isBiz = c.customer_type === 'business';
        const typeBadge = isBiz
            ? '<div class="type-badge business">🏢</div>'
            : '<div class="type-badge individual">👤</div>';
        const codeClass = isBiz ? 'customer-code business' : 'customer-code';

        let nameHtml = '';
        let nameSub = '';
        if (isBiz) {
            let repName = '';
            if (c.representative_customer_id) {
                const rep = allCustomers.find(x => x.id === c.representative_customer_id);
                if (rep) repName = rep.full_name;
            } else if (c.representative_name) {
                repName = c.representative_name;
            }
            nameHtml = repName
                ? escapeHtml(repName)
                : '<span style="color: #94a3b8; font-style: italic;">Chưa có người đại diện</span>';
            if (c.position) nameSub = '💼 ' + escapeHtml(c.position);
            else if (c.address) nameSub = '📍 ' + escapeHtml(c.address);
        } else {
            nameHtml = escapeHtml(c.full_name);
            nameSub = c.address ? '📍 ' + escapeHtml(c.address) : '';
        }

        let bizHtml = '';
        if (isBiz) {
            bizHtml = '<div style="font-weight: 700; color: #0f172a; font-size: 13px;">' + escapeHtml(c.company_name || '—') + '</div>';
            if (c.tax_code) {
                bizHtml += '<div style="font-size: 11px; color: #64748b; margin-top: 2px; font-family: monospace;">MST: ' + escapeHtml(c.tax_code) + '</div>';
            }
        } else {
            bizHtml = '<span style="color: #94a3b8; font-style: italic; font-size: 12px;">Khách cá nhân</span>';
        }

        const statusBadge = isInactive
            ? '<span class="status-badge inactive">Ngưng</span>'
            : '<span class="status-badge active">Hoạt động</span>';

        const tierLabels = { 'new': 'Mới', 'regular': 'Thường', 'vip': '⭐ VIP' };
        const tierBadge = '<span class="tier-badge ' + (c.tier || 'new') + '">' + (tierLabels[c.tier] || 'Mới') + '</span>';

        const sourceBadge = c.source
            ? '<span class="source-badge">' + escapeHtml(c.source) + '</span>'
            : '<span style="color: #94a3b8;">—</span>';

        // ⭐ SĐT đậm rõ
        const phoneHtml = c.phone
            ? '<span style="color: #0f172a; font-weight: 600; font-family: monospace; font-size: 13px;">' + escapeHtml(c.phone) + '</span>'
            : '<span style="color: #94a3b8;">—</span>';

        const trStyle = isInactive ? 'opacity: 0.5;' : '';

        html += '<tr style="' + trStyle + '">';
        html += '<td style="text-align: center;">' + typeBadge + '</td>';
        html += '<td><span class="' + codeClass + '">' + escapeHtml(c.code || '—') + '</span></td>';
        html += '<td>';
        html += '<span class="customer-name">' + nameHtml + '</span>';
        if (nameSub) html += '<span class="customer-sub">' + nameSub + '</span>';
        html += '</td>';
        html += '<td>' + bizHtml + '</td>';
        html += '<td>' + phoneHtml + '</td>';
        html += '<td>' + sourceBadge + '</td>';
        html += '<td style="text-align: center;">' + tierBadge + '</td>';
        html += '<td style="text-align: center;">' + statusBadge + '</td>';
        html += '<td>';
        html += '<div class="table-actions">';
        html += '<button class="action-btn view" onclick="viewCustomer(\'' + c.id + '\')" title="Xem"><i data-lucide="eye"></i></button>';
        html += '<button class="action-btn edit" onclick="editCustomer(\'' + c.id + '\')" title="Sửa"><i data-lucide="edit"></i></button>';
        if (isInactive) {
            html += '<button class="action-btn" style="border-color: #86efac; color: #16a34a; background: #dcfce7;" onclick="askToggleCustomer(\'' + c.id + '\', true)" title="Mở lại"><i data-lucide="play"></i></button>';
        } else {
            html += '<button class="action-btn" style="border-color: #fed7aa; color: #ea580c; background: #ffedd5;" onclick="askToggleCustomer(\'' + c.id + '\', false)" title="Ngưng"><i data-lucide="pause"></i></button>';
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
    const total = filteredCustomers.length;
    if (total === 0) { el.innerHTML = ''; return; }
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) {
        el.innerHTML = '<span class="pagination-info">Hiển thị ' + total + ' khách hàng</span>';
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
    renderCustomers();
    const main = document.getElementById('dash-main');
    if (main) main.scrollTop = 0;
}

// ============================================
// FILTERS
// ============================================
function applyFilters() {
    const search = (document.getElementById('customer-search').value || '').toLowerCase().trim();
    const typeFilter = document.getElementById('filter-type').value;
    const tierFilter = document.getElementById('filter-tier').value;

    filteredCustomers = allCustomers.filter(c => {
        if (search) {
            const searchable = [
                c.code || '', c.full_name || '', c.company_name || '',
                c.phone || '', c.tax_code || ''
            ].join(' ').toLowerCase();
            if (searchable.indexOf(search) === -1) return false;
        }
        if (typeFilter !== 'all' && c.customer_type !== typeFilter) return false;
        if (tierFilter !== 'all' && c.tier !== tierFilter) return false;
        return true;
    });

    sortCustomers();
    currentPage = 1;
    renderCustomers();
}

function resetFilters() {
    document.getElementById('customer-search').value = '';
    document.getElementById('filter-type').value = 'all';
    document.getElementById('filter-tier').value = 'all';
    filteredCustomers = [...allCustomers];
    sortCustomers();
    currentPage = 1;
    renderCustomers();
}

// ============================================
// TYPE SELECTOR
// ============================================
function selectCustomerType(type) {
    editingCustomerType = type;
    document.getElementById('cust-type').value = type;
    document.querySelectorAll('.type-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    const sectionIndividual = document.getElementById('section-individual');
    const sectionBusiness = document.getElementById('section-business');
    const labelName = document.getElementById('label-full-name');
    const titleBasic = document.getElementById('section-basic-title');
    if (type === 'business') {
        if (sectionIndividual) sectionIndividual.style.display = 'none';
        if (sectionBusiness) sectionBusiness.style.display = 'block';
        if (labelName) labelName.innerHTML = 'Tên công ty <span class="required">*</span>';
        if (titleBasic) titleBasic.innerHTML = '<i data-lucide="building-2"></i> Thông Tin Doanh Nghiệp';
    } else {
        if (sectionIndividual) sectionIndividual.style.display = 'block';
        if (sectionBusiness) sectionBusiness.style.display = 'none';
        if (labelName) labelName.innerHTML = 'Họ tên <span class="required">*</span>';
        if (titleBasic) titleBasic.innerHTML = '<i data-lucide="user"></i> Thông Tin Cơ Bản';
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================
// OPEN MODAL ADD
// ============================================
function openAddCustomerModal(type) {
    editingCustomerId = null;
    editingCustomerType = type || 'individual';
    repCustomerId = null;
    document.getElementById('modal-customer-title').textContent = type === 'business' ? 'Thêm Khách Hàng Doanh Nghiệp' : 'Thêm Khách Hàng Cá Nhân';
    document.getElementById('form-customer').reset();
    document.getElementById('cust-id').value = '';
    document.getElementById('cust-type').value = editingCustomerType;
    document.getElementById('cust-active').checked = true;
    document.getElementById('cust-rep-id').value = '';
    document.getElementById('cust-rep-search').value = '';
    document.getElementById('cust-rep-name').value = '';
    document.getElementById('cust-rep-phone').value = '';
    setRepMode('existing');
    selectCustomerType(editingCustomerType);
    clearFormErrors('form-customer');
    document.getElementById('modal-customer').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================
// EDIT CUSTOMER
// ============================================
function editCustomer(id) {
    const c = allCustomers.find(x => x.id === id);
    if (!c) return;
    editingCustomerId = id;
    editingCustomerType = c.customer_type || 'individual';
    repCustomerId = c.representative_customer_id || null;
    document.getElementById('modal-customer-title').textContent = 'Sửa: ' + (c.company_name || c.full_name);
    document.getElementById('cust-id').value = c.id;
    document.getElementById('cust-type').value = editingCustomerType;
    document.getElementById('cust-code').value = c.code || '';

    if (c.customer_type === 'business') {
        document.getElementById('cust-name').value = c.company_name || c.full_name || '';
    } else {
        document.getElementById('cust-name').value = c.full_name || '';
    }

    document.getElementById('cust-phone').value = c.phone || '';
    document.getElementById('cust-email').value = c.email || '';
    document.getElementById('cust-address').value = c.address || '';
    document.getElementById('cust-dob').value = c.date_of_birth || '';
    document.getElementById('cust-gender').value = c.gender || '';
    document.getElementById('cust-id-card').value = c.id_card || '';
    document.getElementById('cust-tax-code').value = c.tax_code || '';
    document.getElementById('cust-position').value = c.position || '';
    document.getElementById('cust-delivery-address').value = c.delivery_address || '';
    document.getElementById('cust-tier').value = c.tier || 'new';
    document.getElementById('cust-source').value = c.source || '';
    document.getElementById('cust-pref-payment').value = c.preferred_payment_method || '';
    document.getElementById('cust-payment-term').value = c.payment_term || 'immediate';
    document.getElementById('cust-note').value = c.note || '';
    document.getElementById('cust-active').checked = c.is_active !== false;

    if (c.representative_customer_id) {
        setRepMode('existing');
        const rep = allCustomers.find(x => x.id === c.representative_customer_id);
        if (rep) {
            document.getElementById('cust-rep-search').value = rep.full_name + ' - ' + (rep.phone || '');
            document.getElementById('cust-rep-id').value = rep.id;
            repCustomerId = rep.id;
        }
        document.getElementById('cust-rep-name').value = '';
        document.getElementById('cust-rep-phone').value = '';
    } else if (c.representative_name || c.representative_phone) {
        setRepMode('manual');
        document.getElementById('cust-rep-name').value = c.representative_name || '';
        document.getElementById('cust-rep-phone').value = c.representative_phone || '';
        document.getElementById('cust-rep-search').value = '';
        document.getElementById('cust-rep-id').value = '';
    } else {
        setRepMode('existing');
        document.getElementById('cust-rep-search').value = '';
        document.getElementById('cust-rep-id').value = '';
        document.getElementById('cust-rep-name').value = '';
        document.getElementById('cust-rep-phone').value = '';
    }

    selectCustomerType(editingCustomerType);
    clearFormErrors('form-customer');
    document.getElementById('modal-customer').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeCustomerModal() {
    document.getElementById('modal-customer').classList.remove('show');
    hideRepList();
}

// ============================================
// COMBOBOX — NGƯỜI ĐẠI DIỆN
// ============================================
function showRepList() {
    renderRepList('');
    const dd = document.getElementById('rep-dropdown');
    const tog = document.querySelector('#cust-rep-search')?.nextElementSibling;
    if (dd) dd.classList.add('show');
    if (tog) tog.classList.add('open');
}
function hideRepList() {
    const dd = document.getElementById('rep-dropdown');
    const tog = document.querySelector('#cust-rep-search')?.nextElementSibling;
    if (dd) dd.classList.remove('show');
    if (tog) tog.classList.remove('open');
}
function toggleRepList(e) {
    if (e) e.stopPropagation();
    const dd = document.getElementById('rep-dropdown');
    if (dd && dd.classList.contains('show')) {
        hideRepList();
    } else {
        const input = document.getElementById('cust-rep-search');
        if (input && input.value.trim()) searchRepCustomer(input.value);
        else showRepList();
        if (input) input.focus();
    }
}
function searchRepCustomer(keyword) {
    renderRepList(keyword);
    const dd = document.getElementById('rep-dropdown');
    const tog = document.querySelector('#cust-rep-search')?.nextElementSibling;
    if (dd) dd.classList.add('show');
    if (tog) tog.classList.add('open');
}
function renderRepList(keyword) {
    const dd = document.getElementById('rep-dropdown');
    if (!dd) return;
    const kw = (keyword || '').toLowerCase().trim();
    let list = allCustomers.filter(c => c.customer_type === 'individual' && c.is_active !== false);
    if (kw) {
        list = list.filter(c =>
            (c.full_name || '').toLowerCase().includes(kw) ||
            (c.phone || '').toLowerCase().includes(kw)
        );
    }
    let html = '';
    if (list.length === 0) {
        html = '<div class="combobox-empty">Không tìm thấy khách hàng cá nhân nào</div>';
    } else {
        list.slice(0, 10).forEach(c => {
            const isSelected = repCustomerId === c.id;
            html += '<div class="combobox-item ' + (isSelected ? 'selected' : '') + '" onclick="selectRepCustomer(\'' + c.id + '\')">';
            html += '<div class="type-badge individual" style="width: 28px; height: 28px; font-size: 14px;">👤</div>';
            html += '<div class="combobox-item-info">';
            html += '<div class="combobox-item-name">' + escapeHtml(c.full_name) + '</div>';
            html += '<div class="combobox-item-desc">' + escapeHtml(c.phone || '') + (c.code ? ' · ' + escapeHtml(c.code) : '') + '</div>';
            html += '</div></div>';
        });
    }
    dd.innerHTML = html;
}

function selectRepCustomer(id) {
    const c = allCustomers.find(x => x.id === id);
    if (!c) return;
    const oldPhone = document.getElementById('cust-phone').value.trim();
    const newPhone = c.phone || '';
    const newName = c.full_name || '';
    repCustomerId = id;
    document.getElementById('cust-rep-search').value = newName + ' - ' + (c.phone || '');
    document.getElementById('cust-rep-id').value = id;
    hideRepList();

    if (newPhone && oldPhone !== newPhone) {
        document.getElementById('confirm-title').textContent = '📞 Cập nhật số điện thoại?';
        document.getElementById('confirm-message').innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 12px;">📞</div>
                <p style="color: #334155; font-size: 14px; line-height: 1.7;">
                    Bạn vừa chọn người đại diện mới:<br>
                    <b style="color: #667eea;">${escapeHtml(newName)}</b>
                </p>
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px; margin: 14px 0; text-align: left;">
                    <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">Số điện thoại liên hệ sẽ đổi:</div>
                    <div style="display: flex; align-items: center; gap: 10px; font-size: 14px;">
                        <span style="color: #94a3b8; text-decoration: line-through; font-family: monospace;">${escapeHtml(oldPhone || 'Chưa có')}</span>
                        <span style="color: #667eea; font-weight: 900;">→</span>
                        <span style="color: #10b981; font-weight: 800; font-family: monospace;">${escapeHtml(newPhone)}</span>
                    </div>
                </div>
                <p style="color: #64748b; font-size: 12.5px; line-height: 1.6;">
                    Bạn có muốn cập nhật số điện thoại theo người đại diện mới không?<br>
                    <span style="font-size: 11.5px; font-style: italic;">(Nếu không, bạn vẫn có thể nhập số riêng cho công ty)</span>
                </p>
            </div>
        `;
        const btn = document.getElementById('confirm-btn');
        btn.textContent = '✓ Đổi theo';
        btn.className = 'btn btn-primary';
        btn.style.display = '';
        btn.onclick = () => {
            document.getElementById('cust-phone').value = newPhone;
            closeConfirmModal();
            showToast('Đã cập nhật số điện thoại theo người đại diện', 'success');
        };
        const footer = document.querySelector('#modal-confirm .modal-footer');
        const cancelBtn = footer.querySelector('.btn-secondary, .btn-primary');
        if (cancelBtn && cancelBtn.id !== 'confirm-btn') {
            cancelBtn.textContent = 'Giữ số cũ';
            cancelBtn.className = 'btn btn-secondary';
        }
        document.getElementById('modal-confirm').classList.add('show');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// ============================================
// SAVE CUSTOMER
// ============================================
async function handleSaveCustomer(e) {
    e.preventDefault();
    clearFormErrors('form-customer');

    const id = document.getElementById('cust-id').value;
    const type = document.getElementById('cust-type').value;
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const email = document.getElementById('cust-email').value.trim();
    const idCard = document.getElementById('cust-id-card').value.trim();
    const taxCode = document.getElementById('cust-tax-code').value.trim();

    let hasError = false;
    const errName = VALIDATORS.name(name); if (errName) { setFieldError('cust-name', errName); hasError = true; }
    const errPhone = VALIDATORS.phone(phone); if (errPhone) { setFieldError('cust-phone', errPhone); hasError = true; }
    const errEmail = VALIDATORS.email(email); if (errEmail) { setFieldError('cust-email', errEmail); hasError = true; }
    const errTax = VALIDATORS.taxCode(taxCode, type); if (errTax) { setFieldError('cust-tax-code', errTax); hasError = true; }
    const errIdCard = VALIDATORS.idCard(idCard); if (errIdCard) { setFieldError('cust-id-card', errIdCard); hasError = true; }

    if (hasError) { showToast('Vui lòng kiểm tra các trường báo đỏ', 'error'); return; }

    if (type === 'individual') {
        const dup = allCustomers.find(c =>
            c.phone === phone && c.id !== id && c.customer_type === 'individual'
        );
        if (dup) {
            window._pendingPayload = await buildPayload();
            window._pendingDup = dup;
            showDupPhoneConfirm(dup);
            return;
        }
    }
    await doSaveCustomer(null);
}

async function buildPayload() {
    const id = document.getElementById('cust-id').value;
    const type = document.getElementById('cust-type').value;
    const code = document.getElementById('cust-code').value.trim().toUpperCase();
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const email = document.getElementById('cust-email').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const dob = document.getElementById('cust-dob').value || null;
    const gender = document.getElementById('cust-gender').value || null;
    const idCard = document.getElementById('cust-id-card').value.trim();
    const taxCode = document.getElementById('cust-tax-code').value.trim();
    const position = document.getElementById('cust-position').value || null;
    const deliveryAddress = document.getElementById('cust-delivery-address').value.trim();
    const tier = document.getElementById('cust-tier').value;
    const source = document.getElementById('cust-source').value || null;
    const prefPayment = document.getElementById('cust-pref-payment').value || null;
    const paymentTerm = document.getElementById('cust-payment-term').value;
    const note = document.getElementById('cust-note').value.trim();
    const isActive = document.getElementById('cust-active').checked;

    let repId = null, repName = null, repPhone = null, displayName = name;

    if (type === 'business') {
        if (repMode === 'existing') {
            repId = document.getElementById('cust-rep-id').value || null;
            if (repId) {
                const rep = allCustomers.find(x => x.id === repId);
                if (rep) {
                    repName = rep.full_name;
                    repPhone = rep.phone || null;
                    displayName = rep.full_name;
                }
            }
        } else {
            repName = document.getElementById('cust-rep-name').value.trim() || null;
            repPhone = document.getElementById('cust-rep-phone').value.trim() || null;
            if (repName) displayName = repName;
        }
    }

    let finalCode = code;
    if (!finalCode && !id) {
        const prefix = type === 'business' ? 'DN-' : 'KH-';
        const { data: maxCodes } = await supabaseClient
            .from('customers').select('code')
            .eq('company_id', window.currentProfile.company_id)
            .eq('customer_type', type)
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
    }

    return {
        company_id: window.currentProfile.company_id,
        customer_type: type,
        code: finalCode || null,
        full_name: displayName,
        phone: phone,
        email: email || null,
        address: address || null,
        date_of_birth: dob,
        gender: gender,
        id_card: idCard || null,
        tax_code: taxCode || null,
        company_name: type === 'business' ? name : null,
        position: position,
        delivery_address: deliveryAddress || null,
        representative_customer_id: type === 'business' ? repId : null,
        representative_name: type === 'business' ? repName : null,
        representative_phone: type === 'business' ? repPhone : null,
        tier: tier,
        source: source,
        preferred_payment_method: prefPayment,
        payment_term: paymentTerm,
        note: note || null,
        is_active: isActive,
        updated_at: new Date().toISOString()
    };
}

async function doSaveCustomer(payloadFromConfirm) {
    const payload = payloadFromConfirm || await buildPayload();
    const id = document.getElementById('cust-id').value;
    try {
        let result, customerId = id;
        if (id) {
            result = await supabaseClient.from('customers').update(payload).eq('id', id);
            if (!result.error) await saveLog(id, 'updated', 'Cập nhật thông tin khách hàng');
        } else {
            payload.created_by = window.currentUser.id;
            result = await supabaseClient.from('customers').insert(payload).select().single();
            if (result.data) {
                customerId = result.data.id;
                await saveLog(customerId, 'created', 'Tạo khách hàng mới: ' + payload.full_name);
            }
        }
        if (result.error) {
            if (result.error.code === '23505' || result.error.message.includes('unique')) {
                setFieldError('cust-code', 'Mã "' + payload.code + '" đã tồn tại!');
                showToast('❌ Mã khách hàng đã tồn tại!', 'error');
                return;
            }
            throw result.error;
        }
        showToast(id ? 'Đã cập nhật khách hàng!' : 'Đã thêm khách hàng!', 'success');
        closeCustomerModal();
        await loadCustomers();
        await loadLogs();
        renderStats();
        applyFilters();
    } catch (err) {
        console.error('Lỗi lưu:', err);
        showToast('Lỗi: ' + err.message, 'error');
    }
}

function showDupPhoneConfirm(dupCustomer) {
    document.getElementById('confirm-title').textContent = '⚠️ Số điện thoại đã tồn tại';
    document.getElementById('confirm-message').innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
            <p style="color: #334155; font-size: 14px; line-height: 1.7;">
                Số điện thoại này đã tồn tại ở khách hàng khác:
            </p>
            <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 10px; padding: 12px; margin: 12px 0; text-align: left;">
                <div style="font-weight: 800; color: #92400e; font-size: 14px;">
                    ${escapeHtml(dupCustomer.full_name)}
                </div>
                <div style="font-size: 12.5px; color: #92400e; margin-top: 4px;">
                    ${escapeHtml(dupCustomer.code || '')} · ${escapeHtml(dupCustomer.phone || '')}
                </div>
            </div>
            <p style="color: #64748b; font-size: 12.5px;">
                Vẫn tiếp tục lưu khách hàng mới với số điện thoại này?
            </p>
        </div>
    `;
    const btn = document.getElementById('confirm-btn');
    btn.textContent = 'Vẫn lưu';
    btn.className = 'btn btn-primary';
    btn.style.display = '';
    btn.onclick = async () => {
        closeConfirmModal();
        await doSaveCustomer(window._pendingPayload);
        window._pendingPayload = null;
        window._pendingDup = null;
    };
    const footer = document.querySelector('#modal-confirm .modal-footer');
    const cancelBtn = footer.querySelector('.btn-secondary, .btn-primary');
    if (cancelBtn && cancelBtn.id !== 'confirm-btn') {
        cancelBtn.textContent = 'Hủy';
        cancelBtn.className = 'btn btn-secondary';
    }
    document.getElementById('modal-confirm').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================
// VIEW DETAIL
// ============================================
function viewCustomer(id) {
    const c = allCustomers.find(x => x.id === id);
    if (!c) return;
    detailCustomerId = id;
    detailTab = 'info';
    document.getElementById('detail-title').textContent = c.customer_type === 'business'
        ? '🏢 ' + (c.company_name || c.full_name)
        : '👤 ' + c.full_name;
    document.querySelectorAll('.detail-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === 'info');
    });
    renderDetailContent();
    document.getElementById('modal-detail').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeDetailModal() {
    document.getElementById('modal-detail').classList.remove('show');
    detailCustomerId = null;
}

function switchDetailTab(tab) {
    detailTab = tab;
    document.querySelectorAll('.detail-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    renderDetailContent();
}

function renderDetailContent() {
    const c = allCustomers.find(x => x.id === detailCustomerId);
    if (!c) return;
    const container = document.getElementById('detail-content');
    if (!container) return;
    if (detailTab === 'info') container.innerHTML = renderTabInfo(c);
    else if (detailTab === 'orders') container.innerHTML = renderTabOrders(c);
    else if (detailTab === 'warranty') container.innerHTML = renderTabWarranty(c);
    else if (detailTab === 'activity') container.innerHTML = renderTabActivity(c);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderTabInfo(c) {
    const isBiz = c.customer_type === 'business';
    const avatar = isBiz ? '🏢' : '👤';
    const tierLabels = { 'new': 'Mới', 'regular': 'Thường', 'vip': '⭐ VIP' };

    let repName = '', repPhone = '', repIdLinked = null;
    if (isBiz) {
        if (c.representative_customer_id) {
            const rep = allCustomers.find(x => x.id === c.representative_customer_id);
            if (rep) {
                repName = rep.full_name;
                repPhone = rep.phone || '';
                repIdLinked = rep.id;
            }
        } else if (c.representative_name) {
            repName = c.representative_name;
            repPhone = c.representative_phone || '';
        }
        if (!repName && c.full_name && c.full_name !== c.company_name) repName = c.full_name;
    }

    let linkedDN = '';
    if (!isBiz) {
        const relatedBiz = allCustomers.filter(x =>
            x.customer_type === 'business' && x.representative_customer_id === c.id
        );
        if (relatedBiz.length > 0) {
            linkedDN = '<div class="link-box">';
            linkedDN += '<div class="link-box-icon">🏢</div>';
            linkedDN += '<div class="link-box-info">';
            linkedDN += '<div class="link-box-title">Đang đại diện cho ' + relatedBiz.length + ' doanh nghiệp</div>';
            relatedBiz.forEach(b => {
                linkedDN += '<div class="link-box-desc" style="margin-top: 4px;">• ' + escapeHtml(b.company_name || b.full_name) + '</div>';
            });
            linkedDN += '</div></div>';
        }
    }

    let repInfo = '';
    if (isBiz) {
        if (repIdLinked) {
            repInfo = '<div class="link-box">';
            repInfo += '<div class="link-box-icon">👤</div>';
            repInfo += '<div class="link-box-info">';
            repInfo += '<div class="link-box-title">Người đại diện (đã liên kết)</div>';
            repInfo += '<div class="link-box-desc">' + escapeHtml(repName) + (repPhone ? ' · ' + escapeHtml(repPhone) : '') + '</div>';
            repInfo += '</div>';
            repInfo += '<button class="link-box-btn" onclick="viewCustomer(\'' + repIdLinked + '\')">Xem KH →</button>';
            repInfo += '</div>';
        } else if (repName) {
            repInfo = '<div class="link-box" style="background: #f1f5f9; border-color: #cbd5e1;">';
            repInfo += '<div class="link-box-icon">👤</div>';
            repInfo += '<div class="link-box-info">';
            repInfo += '<div class="link-box-title" style="color: #475569;">Người đại diện (nhập tay)</div>';
            repInfo += '<div class="link-box-desc" style="color: #64748b;">' + escapeHtml(repName) + (repPhone ? ' · ' + escapeHtml(repPhone) : '') + '</div>';
            repInfo += '</div></div>';
        }
    }

    let html = '';
    html += '<div class="customer-detail-header">';
    html += '<div class="customer-detail-avatar">' + avatar + '</div>';
    html += '<div class="customer-detail-info">';
    html += '<div class="customer-detail-name">' + escapeHtml(isBiz ? c.company_name : c.full_name) + '</div>';
    html += '<div class="customer-detail-meta">';
    html += '<span class="' + (isBiz ? 'customer-code business' : 'customer-code') + '">' + escapeHtml(c.code || '—') + '</span>';
    html += '<span class="status-badge ' + (c.is_active === false ? 'inactive' : 'active') + '">' + (c.is_active === false ? 'Ngưng' : 'Hoạt động') + '</span>';
    html += '<span class="tier-badge ' + (c.tier || 'new') + '">' + (tierLabels[c.tier] || 'Mới') + '</span>';
    html += '</div></div></div>';

    // ===== THÔNG TIN =====
    html += '<div class="detail-section">';
    html += '<h4>📋 Thông Tin ' + (isBiz ? 'Doanh Nghiệp' : 'Cá Nhân') + '</h4>';
    if (isBiz) {
        html += infoRow('🏢', 'Tên công ty', c.company_name || '—');
        html += infoRow('🆔', 'Mã số thuế', c.tax_code || '—');
        html += infoRow('👤', 'Người đại diện', repName || '—');
        html += infoRow('💼', 'Chức vụ', c.position || '—');
    } else {
        html += infoRow('👤', 'Họ và tên', c.full_name);
        html += infoRow('📅', 'Ngày sinh', formatDate(c.date_of_birth));
        html += infoRow('⚥', 'Giới tính', c.gender === 'male' ? 'Nam' : c.gender === 'female' ? 'Nữ' : c.gender === 'other' ? 'Khác' : '—');
        html += infoRow('🪪', 'Số CCCD', c.id_card ? c.id_card.replace(/(\d{4})\d+(\d{3})/, '$1****$2') : '—');
    }
    html += '</div>';

    // ===== LIÊN HỆ (SĐT ĐẬM) =====
    html += '<div class="detail-section">';
    html += '<h4>📞 Thông Tin Liên Hệ</h4>';
    html += infoRow('📱', 'Số điện thoại', c.phone || '—', 'bold-mono');
    html += infoRow('📧', 'Địa chỉ email', c.email || '—');
    html += infoRow('📍', 'Địa chỉ', c.address || '—');
    if (isBiz && c.delivery_address) {
        html += infoRow('🚚', 'Địa chỉ giao hàng', c.delivery_address);
    }
    html += '</div>';

    if (linkedDN || repInfo) {
        html += '<div class="detail-section">';
        html += '<h4>🔗 Liên Kết</h4>';
        html += linkedDN + repInfo;
        html += '</div>';
    }

    // ===== THANH TOÁN (LABEL RÕ + NOTE) =====
    html += '<div class="detail-section">';
    html += '<h4>💰 Thông Tin Thanh Toán</h4>';
    const payMethods = { 'cash': '💵 Tiền mặt', 'bank_transfer': '🏦 Chuyển khoản', 'mixed': '🔄 Linh hoạt' };
    const terms = { 'immediate': 'Trả ngay', 'net_15': 'Trả trong 15 ngày', 'net_30': 'Trả trong 30 ngày', 'net_60': 'Trả trong 60 ngày' };
    html += infoRow('💳', 'Phương thức thanh toán ưu tiên', payMethods[c.preferred_payment_method] || 'Chưa chọn', null,
        'Khách hàng thường dùng cách nào để thanh toán');
    html += infoRow('📅', 'Điều khoản thanh toán', terms[c.payment_term] || 'Trả ngay', null,
        'Thời hạn khách hàng thanh toán sau khi nhận hàng');
    html += infoRow('🛒', 'Nguồn khách hàng', c.source || '—', null,
        'Khách biết đến công ty qua kênh nào');
    html += '</div>';

    if (c.note) {
        html += '<div class="detail-section">';
        html += '<h4>📝 Ghi Chú</h4>';
        html += '<p style="font-size: 13px; color: #64748b; line-height: 1.6; padding: 10px; background: #f8fafc; border-radius: 8px;">' + escapeHtml(c.note) + '</p>';
        html += '</div>';
    }
    return html;
}

// infoRow có thêm param styleClass và hint (chú thích nhỏ)
function infoRow(icon, label, value, styleClass, hint) {
    const valueStyle = styleClass === 'bold-mono'
        ? 'color: #0f172a; font-weight: 700; font-family: monospace; font-size: 14px;'
        : '';
    let html = '<div class="info-row">' +
        '<div class="info-row-icon">' + icon + '</div>' +
        '<div class="info-row-content">' +
        '<div class="info-row-label">' + label + '</div>' +
        '<div class="info-row-value" style="' + valueStyle + '">' + escapeHtml(String(value)) + '</div>';
    if (hint) {
        html += '<div style="font-size: 11px; color: #94a3b8; margin-top: 3px; font-style: italic; line-height: 1.4;">💡 ' + hint + '</div>';
    }
    html += '</div></div>';
    return html;
}

function renderTabOrders(c) {
    return '<div class="empty-tab">' +
        '<div class="empty-tab-icon">📦</div>' +
        '<div class="empty-tab-title">Chưa có đơn hàng nào</div>' +
        '<div class="empty-tab-desc">Khi bạn tạo đơn hàng cho khách này, lịch sử mua hàng sẽ hiện ở đây.</div>' +
        '<div class="detail-stats" style="margin-top: 24px; max-width: 400px; margin-left: auto; margin-right: auto;">' +
        '<div class="detail-stat"><div class="detail-stat-label">Tổng đơn</div><div class="detail-stat-value">0</div></div>' +
        '<div class="detail-stat"><div class="detail-stat-label">Đã thanh toán</div><div class="detail-stat-value success">0</div></div>' +
        '<div class="detail-stat"><div class="detail-stat-label">Tổng chi</div><div class="detail-stat-value">0 đ</div></div>' +
        '</div></div>';
}

function renderTabWarranty(c) {
    return '<div class="empty-tab">' +
        '<div class="empty-tab-icon">🛡️</div>' +
        '<div class="empty-tab-title">Chưa có phiếu bảo hành nào</div>' +
        '<div class="empty-tab-desc">Khi khách gửi bảo hành sản phẩm, lịch sử sẽ hiện ở đây.</div>' +
        '</div>';
}

function renderTabActivity(c) {
    const logs = allLogs.filter(l => l.customer_id === c.id).slice(0, 30);
    if (logs.length === 0) {
        return '<div class="empty-tab">' +
            '<div class="empty-tab-icon">📜</div>' +
            '<div class="empty-tab-title">Chưa có hoạt động nào</div>' +
            '<div class="empty-tab-desc">Mọi thao tác với khách hàng sẽ được ghi lại ở đây.</div>' +
            '</div>';
    }
    const actionIcons = {
        'created': '✨', 'updated': '✏️', 'deleted': '🗑️',
        'order': '📦', 'warranty': '🛡️', 'payment': '💰'
    };
    let html = '<div class="timeline">';
    logs.forEach(log => {
        const icon = actionIcons[log.action] || '📌';
        html += '<div class="timeline-item">';
        html += '<div class="timeline-time">' + formatTimeAgo(log.created_at) + '</div>';
        html += '<div class="timeline-title">' + icon + ' ' + escapeHtml(log.action) + '</div>';
        if (log.description) html += '<div class="timeline-desc">' + escapeHtml(log.description) + '</div>';
        html += '</div>';
    });
    html += '</div>';
    return html;
}

// ============================================
// TOGGLE ACTIVE
// ============================================
function askToggleCustomer(id, activate) {
    const c = allCustomers.find(x => x.id === id);
    if (!c) return;
    pendingToggleId = id;
    const name = c.company_name || c.full_name;
    document.getElementById('confirm-title').textContent = activate ? 'Mở lại khách hàng' : 'Ngưng khách hàng';
    document.getElementById('confirm-message').textContent = activate
        ? 'Mở lại khách hàng "' + name + '"?'
        : 'Ngưng khách hàng "' + name + '"? Khách hàng sẽ bị ẩn khỏi danh sách chính nhưng dữ liệu vẫn giữ.';
    document.getElementById('confirm-btn').textContent = activate ? 'Mở lại' : 'Ngưng';
    document.getElementById('confirm-btn').className = activate ? 'btn btn-primary' : 'btn btn-danger';
    document.getElementById('confirm-btn').style.display = '';
    document.getElementById('confirm-btn').onclick = doToggleCustomer;
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
    const btn = document.getElementById('confirm-btn');
    if (btn) btn.onclick = null;
}

async function doToggleCustomer() {
    if (!pendingToggleId) return;
    const c = allCustomers.find(x => x.id === pendingToggleId);
    if (!c) return;
    const newStatus = !(c.is_active !== false);
    try {
        const result = await supabaseClient
            .from('customers')
            .update({ is_active: newStatus, updated_at: new Date().toISOString() })
            .eq('id', pendingToggleId);
        if (result.error) throw result.error;
        await saveLog(pendingToggleId, newStatus ? 'activated' : 'deactivated',
            newStatus ? 'Mở lại khách hàng' : 'Ngưng khách hàng');
        showToast(newStatus ? 'Đã mở lại khách hàng!' : 'Đã ngưng khách hàng!', 'success');
        closeConfirmModal();
        await loadCustomers();
        await loadLogs();
        renderStats();
        applyFilters();
    } catch (err) {
        console.error('Lỗi:', err);
        showToast('Lỗi: ' + err.message, 'error');
    }
}

// ============================================
// REP MODE
// ============================================
function setRepMode(mode) {
    repMode = mode;
    document.querySelectorAll('.rep-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    const existing = document.getElementById('rep-mode-existing');
    const manual = document.getElementById('rep-mode-manual');
    if (existing) existing.style.display = mode === 'existing' ? 'block' : 'none';
    if (manual) manual.style.display = mode === 'manual' ? 'block' : 'none';
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeCustomerModal();
        closeDetailModal();
        closeConfirmModal();
        hideRepList();
    }
});

console.log('✅ customers.js loaded');