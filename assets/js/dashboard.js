// ============================================
// DASHBOARD LOGIC
// ============================================
const supabaseClient = window.supabaseClient;

let _clockTimer = null;

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ Dashboard loading...');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const ok = await initLayout();
    if (!ok) return;

    await new Promise(r => setTimeout(r, 500));
    await Promise.all([
        loadDashboardStats(),
        loadTopSuppliers()
    ]);
    renderWelcome();
    startClock();
    loadCustomize();
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
// STATS
// ============================================
async function loadDashboardStats() {
    try {
        const staffResult = await supabaseClient
            .from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true);
        const onlineResult = await supabaseClient
            .from('user_status').select('*', { count: 'exact', head: true }).eq('status', 'online');

        // Tồn kho = tổng SP đang kinh doanh
        const productsResult = await supabaseClient
            .from('products').select('stock, min_stock', { count: 'exact' })
            .eq('company_id', window.currentProfile.company_id)
            .is('deleted_at', null)
            .eq('is_active', true);

        const staffCount = staffResult.count || 0;
        const onlineCount = onlineResult.count || 0;
        const products = productsResult.data || [];
        const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
        const lowStockCount = products.filter(p => (p.stock || 0) <= (p.min_stock || 0)).length;

        updateKPICard('nhansu', staffCount, onlineCount + ' đang online');
        updateKPICard('doanhthu', '—', 'Chưa có dữ liệu');
        updateKPICard('donhang', '—', 'Chưa có dữ liệu');
        updateKPICard('tonkho', products.length, totalStock.toLocaleString('vi-VN') + ' SP trong kho' + (lowStockCount > 0 ? ' · ⚠️ ' + lowStockCount + ' sắp hết' : ''));
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
// TOP SUPPLIERS
// ============================================
async function loadTopSuppliers() {
    const container = document.getElementById('top-suppliers-body');
    if (!container) return; // HTML chưa có widget thì bỏ qua

    try {
        // Đếm SP theo NCC
        const { data: products } = await supabaseClient
            .from('products').select('supplier_id')
            .eq('company_id', window.currentProfile.company_id)
            .is('deleted_at', null)
            .not('supplier_id', 'is', null);

        const { data: suppliers } = await supabaseClient
            .from('suppliers').select('id, name, code, rating')
            .eq('company_id', window.currentProfile.company_id)
            .eq('is_active', true)
            .is('deleted_at', null);

        const counts = {};
        (products || []).forEach(p => {
            counts[p.supplier_id] = (counts[p.supplier_id] || 0) + 1;
        });

        const ranked = (suppliers || [])
            .map(s => ({ ...s, product_count: counts[s.id] || 0 }))
            .filter(s => s.product_count > 0)
            .sort((a, b) => b.product_count - a.product_count)
            .slice(0, 5);

        if (ranked.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 13px;">Chưa có nhà cung cấp nào có sản phẩm</div>';
            return;
        }

        let html = '';
        ranked.forEach((s, idx) => {
            const medal = ['🥇', '🥈', '🥉'][idx] || '🏭';
            html += '<div style="display: flex; align-items: center; gap: 12px; padding: 10px 4px; border-bottom: 1px solid #f1f5f9;">';
            html += '<div style="width: 32px; height: 32px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px;">' + (idx + 1) + '</div>';
            html += '<div style="flex: 1; min-width: 0;">';
            html += '<div style="font-weight: 700; color: #0f172a; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + medal + ' ' + escapeHtml(s.name) + '</div>';
            html += '<div style="font-size: 11px; color: #64748b; margin-top: 2px; font-family: monospace;">' + escapeHtml(s.code || '—') + '</div>';
            html += '</div>';
            html += '<div style="font-weight: 800; color: #667eea; font-size: 14px; white-space: nowrap;">' + s.product_count + ' SP</div>';
            html += '</div>';
        });
        container.innerHTML = html;
    } catch (err) {
        console.error('Lỗi load top suppliers:', err);
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #dc2626; font-size: 13px;">Lỗi tải dữ liệu</div>';
    }
}

// ============================================
// WELCOME + CLOCK
// ============================================
function renderWelcome() {
    const name = (window.currentProfile && window.currentProfile.full_name) || window.currentUser.email;
    const el = document.getElementById('welcome-name');
    if (el) el.textContent = name;
}

function startClock() {
    updateClock();
    clearInterval(_clockTimer);
    _clockTimer = setInterval(updateClock, 1000);
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
// CUSTOMIZE PANEL — FIX LƯU/LOAD
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
            if (draggedIndex < targetIndex) parent.insertBefore(draggedItem, item.nextSibling);
            else parent.insertBefore(draggedItem, item);
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
        const cb = item.querySelector('input[type="checkbox"]');
        config.push({
            id: item.dataset.widget,
            order: index,
            visible: cb ? cb.checked : true
        });
    });
    localStorage.setItem('dashboard_config', JSON.stringify(config));
    applyDashboardConfig(config);
    console.log('✅ Đã lưu cấu hình:', config);
    showToast('Đã lưu cấu hình Dashboard!', 'success');
    toggleCustomize();
}

// Áp config vào widget THẬT (không phải item trong panel)
function applyDashboardConfig(config) {
    const main = document.querySelector('.dash-main') || document.body;

    // Bước 1: Ẩn/hiện từng widget theo checkbox
    config.forEach(cfg => {
        const el = main.querySelector('[data-widget="' + cfg.id + '"]');
        if (!el || el.classList.contains('dash-customize-item')) return;
        el.style.display = cfg.visible ? '' : 'none';
    });

    // Bước 2: Sắp xếp lại thứ tự theo config
    const widgets = [];
    config.forEach(cfg => {
        const el = main.querySelector('[data-widget="' + cfg.id + '"]');
        if (el && !el.classList.contains('dash-customize-item')) {
            widgets.push(el);
        }
    });

    if (widgets.length < 2) return;

    // Remove hết widget ra khỏi DOM
    widgets.forEach(w => w.remove());

    // Append lại theo đúng thứ tự trong config (đầu config = trên cùng)
    widgets.forEach(w => main.appendChild(w));

    console.log('🔀 Đã sắp xếp lại thứ tự widget');
}

function loadCustomize() {
    const saved = localStorage.getItem('dashboard_config');
    if (!saved) return;
    try {
        const config = JSON.parse(saved);
        // Update panel order/checkbox
        const panelContainer = document.querySelector('.dash-customize-body');
        if (panelContainer) {
            const items = Array.from(panelContainer.querySelectorAll('.dash-customize-item'));
            config.forEach(cfg => {
                const item = items.find(i => i.dataset.widget === cfg.id);
                if (item) {
                    panelContainer.appendChild(item);
                    const cb = item.querySelector('input[type="checkbox"]');
                    if (cb) cb.checked = cfg.visible;
                }
            });
        }
        // Áp vào widget thật
        applyDashboardConfig(config);
    } catch (e) { console.error('Lỗi load config:', e); }
}

// ============================================
// TIME FILTER
// ============================================
function setTimeFilter(period) {
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.period === period);
    });
    console.log('Time filter:', period);
}

// ============================================
// ACTIONS
// ============================================
function requestLeave() { closeUserMenu(); alert('Xin nghỉ phép sẽ được thêm sau'); }
function viewAllNotifications() { closeNotifMenu(); alert('Trang thông báo sẽ được thêm sau'); }

console.log('✅ dashboard.js loaded');