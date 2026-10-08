// ============================================
// EXPORT / PRINT — Hệ thống dùng chung cho mọi trang
// Hướng A: không cần thư viện
// CSV (chuẩn) · Excel (.xls HTML fake) · Word (.doc HTML fake) · PDF (window.print)
// ============================================

(function() {
    // ===== STATE =====
    let _exportFormat = 'csv';
    let _columnState = {};
    window.EXPORT_SHOW_SIGNATURE = false;

    // Set chứa ID các row đang được tick chọn (dùng chung giữa các trang)
    window.EXPORT_SELECTED = window.EXPORT_SELECTED || new Set();

// ============================================
// OPEN MODAL
// ============================================
window.openExportModal = function() {
    const cfg = window.EXPORT_CONFIG;
    if (!cfg) {
        showToast('Trang này chưa hỗ trợ xuất dữ liệu', 'warning');
        return;
    }

    const selectedIds = window.EXPORT_SELECTED;
    const allFiltered = cfg.getFilteredRows ? cfg.getFilteredRows() : [];

    if (allFiltered.length === 0) {
        showToast('Không có dữ liệu để xuất', 'warning');
        return;
    }

    // ⭐ Nếu user chưa tick gì → popup confirm
    if (selectedIds.size === 0) {
        _showExportConfirm(allFiltered.length, () => {
            _openExportModalActual(cfg, allFiltered, false);
        });
        return;
    }

    const rows = allFiltered.filter(r => selectedIds.has(r.id));
    _openExportModalActual(cfg, rows, true);
};

// ============================================
// CONFIRM "chưa chọn gì"
// ============================================
function _showExportConfirm(total, onConfirm) {
    const confirmModal = document.getElementById('modal-confirm');
    if (!confirmModal) {
        // Fallback: dùng confirm() của browser
        const ok = confirm(
            '📋 Bạn chưa chọn mục nào.\n\n' +
            'Hệ thống sẽ xuất TẤT CẢ ' + total + ' mục đang hiển thị theo bộ lọc hiện tại.\n\n' +
            'Nhấn OK để tiếp tục, hoặc Hủy để quay lại chọn mục muốn xuất.'
        );
        if (ok) onConfirm();
        return;
    }

    document.getElementById('confirm-title').textContent = '📋 Chưa chọn mục nào';
    document.getElementById('confirm-message').innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 12px;">📋</div>
            <p style="color: #334155; font-size: 14px; line-height: 1.7;">
                Bạn <b>chưa tick chọn mục nào</b> trong bảng.
            </p>
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px; margin: 14px 0;">
                <p style="color: #1e40af; font-size: 13px; line-height: 1.6; margin: 0;">
                    Hệ thống sẽ xuất <b>tất cả ${total} mục</b> đang hiển thị theo bộ lọc hiện tại trên màn hình.
                </p>
            </div>
            <p style="color: #64748b; font-size: 12.5px;">
                Nếu chỉ muốn xuất vài mục, bấm <b>Quay lại</b> rồi tick chọn các mục cần thiết.
            </p>
        </div>
    `;

    const btn = document.getElementById('confirm-btn');
    btn.textContent = '✓ Xuất tất cả ' + total + ' mục';
    btn.className = 'btn btn-primary';
    btn.style.display = '';
    btn.onclick = () => {
        _closeExportConfirm();
        onConfirm();
    };

    // Đổi text nút Hủy → Quay lại
    const footer = document.querySelector('#modal-confirm .modal-footer');
    if (footer) {
        const cancelBtn = footer.querySelector('.btn-secondary');
        if (cancelBtn) cancelBtn.textContent = 'Quay lại';
    }

    confirmModal.classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function _closeExportConfirm() {
    if (typeof closeConfirmModal === 'function') {
        closeConfirmModal();
    } else {
        const m = document.getElementById('modal-confirm');
        if (m) m.classList.remove('show');
    }
    // Reset nút về mặc định (cho các confirm khác dùng lại)
    const footer = document.querySelector('#modal-confirm .modal-footer');
    if (footer) {
        const cancelBtn = footer.querySelector('.btn-secondary');
        if (cancelBtn) {
            cancelBtn.textContent = 'Hủy';
            cancelBtn.className = 'btn btn-secondary';
        }
    }
    const confirmBtn = document.getElementById('confirm-btn');
    if (confirmBtn) {
        confirmBtn.style.display = '';
        confirmBtn.onclick = null;
    }
}

// ============================================
// OPEN MODAL THẬT
// ============================================
function _openExportModalActual(cfg, rows, isSelectedMode) {
    if (rows.length === 0) {
        showToast('Không có dữ liệu để xuất', 'warning');
        return;
    }

    _columnState = {};
    cfg.columns.forEach(col => {
        _columnState[col.key] = col.defaultOn !== false;
    });
    _exportFormat = 'csv';
    window.EXPORT_SHOW_SIGNATURE = false;

    renderExportModal(rows, cfg, isSelectedMode);
    document.getElementById('modal-export').classList.add('show');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

    window.closeExportModal = function() {
        const el = document.getElementById('modal-export');
        if (el) el.classList.remove('show');
    };

    // ============================================
    // RENDER MODAL
    // ============================================
    function renderExportModal(rows, cfg, isSelectedMode) {
        const body = document.getElementById('export-body');
        const title = document.getElementById('export-title');
        const subtitle = document.getElementById('export-subtitle');

        if (title) title.textContent = 'In / Xuất ' + (cfg.entityName || 'dữ liệu');
        if (subtitle) {
            subtitle.innerHTML = isSelectedMode
                ? '📦 Sẽ xuất <b style="color:#667eea;">' + rows.length + ' mục đã chọn</b>'
                : '📦 Sẽ xuất <b style="color:#667eea;">tất cả ' + rows.length + ' mục</b> theo bộ lọc hiện tại';
        }

        let html = '';

        // --- Chọn cột ---
        html += '<div class="export-section">';
        html += '<div class="export-section-title">';
        html += '<span>📋 Chọn cột muốn xuất</span>';
        html += '<button type="button" class="export-toggle-all" onclick="exportToggleAllColumns()">Chọn tất cả / Bỏ tất cả</button>';
        html += '</div>';
        html += '<div class="export-columns-grid">';
        cfg.columns.forEach(col => {
            html += '<label class="export-col-checkbox">';
            html += '<input type="checkbox" data-col="' + col.key + '" ' + (_columnState[col.key] ? 'checked' : '') + ' onchange="exportToggleColumn(\'' + col.key + '\', this.checked)">';
            html += '<span>' + escapeHtml(col.label) + '</span>';
            html += '</label>';
        });
        html += '</div></div>';

        // --- Chọn định dạng ---
        const formats = [
            { val: 'csv',   label: 'CSV (dữ liệu thô)',    desc: 'Nhẹ, dùng import hệ thống khác' },
            { val: 'excel', label: 'Excel (có định dạng)',  desc: 'Đẹp, có màu, dùng in/gửi' },
            { val: 'pdf',   label: 'PDF',                   desc: 'In hoặc lưu PDF' },
            { val: 'word',  label: 'Word',                  desc: 'File .doc mở bằng Word' }
        ];
        html += '<div class="export-section">';
        html += '<div class="export-section-title"><span>📁 Định dạng file</span></div>';
        html += '<div class="export-formats-grid">';
        formats.forEach(f => {
            html += '<label class="export-format-option ' + (_exportFormat === f.val ? 'active' : '') + '" data-format="' + f.val + '">';
            html += '<input type="radio" name="export-format" value="' + f.val + '" ' + (_exportFormat === f.val ? 'checked' : '') + ' onchange="exportSetFormat(\'' + f.val + '\')">';
            html += '<div class="export-format-content">';
            html += '<div class="export-format-label">' + f.label + '</div>';
            html += '<div class="export-format-desc">' + f.desc + '</div>';
            html += '</div></label>';
        });
        html += '</div></div>';

        // --- Option ký duyệt (chỉ active khi PDF/Word) ---
        const signatureDisabled = (_exportFormat === 'csv' || _exportFormat === 'excel');
        html += '<div class="export-section">';
        html += '<label class="export-col-checkbox" style="padding: 10px 12px; background: ' + (signatureDisabled ? '#f1f5f9' : '#f8fafc') + '; border: 1px solid #e2e8f0; border-radius: 10px; ' + (signatureDisabled ? 'opacity: 0.5; cursor: not-allowed;' : '') + '">';
        html += '<input type="checkbox" id="export-show-signature" ' + (window.EXPORT_SHOW_SIGNATURE ? 'checked' : '') + (signatureDisabled ? ' disabled' : '') + ' onchange="window.EXPORT_SHOW_SIGNATURE = this.checked">';
        html += '<span>📝 Hiện chỗ ký duyệt (Người lập / Người duyệt / Giám đốc) — chỉ PDF và Word</span>';
        html += '</label>';
        html += '</div></div>';

        // Warning container — sẽ được điền khi user chọn Word
        html += '<div id="export-warning-container"></div>';

        if (body) body.innerHTML = html;

        // ⭐ Nếu format mặc định là word thì check luôn
        // (thường mặc định CSV nên bỏ qua)
    }

    // ============================================
    // TOGGLE
    // ============================================
    window.exportToggleColumn = function(key, checked) {
        _columnState[key] = checked;
        // Nếu đang chọn Word → update warning
        if (_exportFormat === 'word') {
            exportSetFormat('word');
        }
    };

    window.exportToggleAllColumns = function() {
        const cfg = window.EXPORT_CONFIG;
        const allChecked = cfg.columns.every(col => _columnState[col.key]);
        const newVal = !allChecked;
        cfg.columns.forEach(col => { _columnState[col.key] = newVal; });
        document.querySelectorAll('#export-body input[data-col]').forEach(inp => {
            inp.checked = newVal;
        });
    };

    window.exportSetFormat = function(fmt) {
        _exportFormat = fmt;
        document.querySelectorAll('.export-format-option').forEach(el => {
            el.classList.toggle('active', el.dataset.format === fmt);
        });

        // ===== Checkbox ký duyệt =====
        const sigCheckbox = document.getElementById('export-show-signature');
        if (sigCheckbox) {
            const disabled = (fmt === 'csv' || fmt === 'excel');
            sigCheckbox.disabled = disabled;
            if (disabled) {
                sigCheckbox.checked = false;
                window.EXPORT_SHOW_SIGNATURE = false;
            }

            const wrapper = sigCheckbox.closest('label');
            if (wrapper) {
                wrapper.style.opacity = disabled ? '0.5' : '1';
                wrapper.style.cursor = disabled ? 'not-allowed' : 'pointer';
                wrapper.style.background = disabled ? '#f1f5f9' : '#f8fafc';
            }

            const parent = sigCheckbox.closest('.export-section');
            if (parent) {
                parent.querySelectorAll('.sig-hint').forEach(el => el.remove());
                if (disabled) {
                    const hintEl = document.createElement('div');
                    hintEl.className = 'sig-hint';
                    hintEl.style.cssText = 'font-size: 11.5px; color: #94a3b8; margin-top: 6px; font-style: italic;';
                    hintEl.textContent = '💡 Chỉ áp dụng cho PDF và Word. Chọn định dạng khác để bật.';
                    parent.appendChild(hintEl);
                }
            }
        }

        // ===== ⭐ Cảnh báo khi chọn Word =====
        const body = document.getElementById('export-body');
        if (body) {
            // Xóa warning cũ
            body.querySelectorAll('.word-warning').forEach(el => el.remove());

            if (fmt === 'word') {
                // Đếm số cột đang tick
                const checkedCols = document.querySelectorAll('#export-body input[data-col]:checked').length;

                const warningEl = document.createElement('div');
                warningEl.className = 'word-warning';
                warningEl.style.cssText = 'margin-top: 12px; padding: 12px 14px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 10px; font-size: 12.5px; color: #92400e; line-height: 1.6;';

                let warningHtml = '<b>⚠️ Lưu ý khi xuất Word:</b><br>';
                warningHtml += '• File Word mở bằng MS Word, đôi khi cột bị co lại hoặc xuống dòng.<br>';
                warningHtml += '• Nếu bảng bị tràn, bạn có thể <b>kéo giãn cột</b> sau khi mở Word.<br>';
                warningHtml += '• <b>Khuyến nghị:</b> chỉ chọn <b>≤ 6-8 cột</b> để file Word hiển thị đẹp.';

                if (checkedCols > 8) {
                    warningHtml += '<br><br>🔴 Hiện tại bạn đang chọn <b>' + checkedCols + ' cột</b> — hơi nhiều. Bạn có thể bỏ tick vài cột không cần thiết.';
                }

                warningEl.innerHTML = warningHtml;
                body.appendChild(warningEl);
            }
        }
    };

    // ============================================
    // DO EXPORT
    // ============================================
    window.doExport = function() {
        const cfg = window.EXPORT_CONFIG;
        if (!cfg) return;

        // ⭐ Force OFF signature nếu format không hỗ trợ
        if (_exportFormat === 'csv' || _exportFormat === 'excel') {
            window.EXPORT_SHOW_SIGNATURE = false;
        }

        const selectedIds = window.EXPORT_SELECTED;
        // ... phần còn lại giữ nguyên
        const allFiltered = cfg.getFilteredRows ? cfg.getFilteredRows() : [];
        const rows = selectedIds.size > 0
            ? allFiltered.filter(r => selectedIds.has(r.id))
            : allFiltered;

        const activeCols = cfg.columns.filter(c => _columnState[c.key]);
        if (activeCols.length === 0) {
            showToast('Vui lòng chọn ít nhất 1 cột', 'warning');
            return;
        }
        if (rows.length === 0) {
            showToast('Không có dữ liệu', 'warning');
            return;
        }

                // Cảnh báo nếu Word + quá nhiều cột (user đã tick confirm)
        if (_exportFormat === 'word' && activeCols.length > 12) {
            if (!confirm('Bạn đang chọn ' + activeCols.length + ' cột cho file Word.\nFile Word có thể bị tràn, cột sẽ bị co lại.\n\nVẫn tiếp tục xuất?')) {
                return;
            }
        }

        switch (_exportFormat) {
            case 'csv':   doExportCSV(rows, activeCols, cfg);   break;
            case 'excel': doExportExcel(rows, activeCols, cfg); break;
            case 'word':  doExportWord(rows, activeCols, cfg);  break;
            case 'pdf':   doExportPDF(rows, activeCols, cfg);   break;
        }
        closeExportModal();
    };

    // ============================================
    // HELPERS
    // ============================================
    function buildTableData(rows, cols, options) {
        options = options || {};
        // PDF/Word: true (có dấu chấm) | CSV/Excel: false (số thuần)
        const formatNumber = options.formatNumber === true;

        const headers = cols.map(c => c.label);
        const data = rows.map(row => cols.map(c => {
            let val;
            if (typeof c.getValue === 'function') val = c.getValue(row);
            else val = row[c.key] != null ? row[c.key] : '';

            // Chỉ format số khi cần (PDF/Word)
            if (formatNumber && typeof val === 'number') {
                val = val.toLocaleString('vi-VN');
            }
            return val;
        }));
        return { headers, data };
    }

    function timestamp() {
        const d = new Date();
        return d.getFullYear() + '-' +
               String(d.getMonth() + 1).padStart(2, '0') + '-' +
               String(d.getDate()).padStart(2, '0') + '_' +
               String(d.getHours()).padStart(2, '0') + 'h' +
               String(d.getMinutes()).padStart(2, '0');
    }

    function safeFileName(prefix) {
        return (prefix || 'du-lieu') + '-' + timestamp();
    }

    function downloadBlob(content, filename, mime) {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // ============================================
    // CSV
    // ============================================
    function doExportCSV(rows, cols, cfg) {
    const { headers, data } = buildTableData(rows, cols, { formatNumber: false });
        const csvRows = [headers.map(h => '"' + String(h).replace(/"/g, '""') + '"').join(',')];
        data.forEach(r => {
            csvRows.push(r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(','));
        });
        const csv = '\uFEFF' + csvRows.join('\n');
        downloadBlob(csv, safeFileName(cfg.filePrefix) + '.csv', 'text/csv;charset=utf-8;');
        showToast('Đã xuất file CSV!', 'success');
    }

    // ============================================
    // EXCEL — HTML fake .xls
    // ============================================
function doExportExcel(rows, cols, cfg) {
const { headers, data } = buildTableData(rows, cols, { formatNumber: false });
    const now = new Date();
    const dateStr = String(now.getDate()).padStart(2, '0') + '/' +
                    String(now.getMonth() + 1).padStart(2, '0') + '/' +
                    now.getFullYear() + ' ' +
                    String(now.getHours()).padStart(2, '0') + ':' +
                    String(now.getMinutes()).padStart(2, '0');
    const userName = (window.currentProfile && window.currentProfile.full_name) || 'Nhân viên';

    const colWidthMap = {
        stt: 45, code: 100, sku: 100, unit: 60, vat: 55, status: 110,
        tier: 85, stock: 70, min_stock: 80, has_inv: 80, imported: 100,
        name: 220, desc: 250, address: 220, note: 200, company: 220,
        supplier: 200, price: 110, purchase: 110, phone: 110,
        email: 180, tax: 110, contact: 130, bank: 130, bank_acc: 120,
        rating: 80, prod_count: 90, group: 130, location: 100, barcode: 100
    };

    let html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8">';
    html += '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>';
    html += '<x:Name>Data</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>';
    html += '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->';
    html += '</head><body>';

    html += '<div style="font-family:Arial;font-size:14pt;font-weight:bold;text-align:center;text-transform:uppercase;">Công ty TNHH Một Con Sen</div>';
    html += '<div style="font-family:Arial;font-size:12pt;font-weight:bold;text-align:center;text-transform:uppercase;margin-top:6pt;">' + escapeHtml(cfg.entityName || 'Dữ liệu') + '</div>';
    html += '<div style="font-family:Arial;font-size:9pt;font-style:italic;text-align:right;">Ngày in: ' + dateStr + ' · Người in: ' + escapeHtml(userName) + '</div>';

    html += '<table border="1" cellpadding="5" cellspacing="0" style="font-family:Arial;font-size:10pt;margin-top:10pt;">';
    html += '<colgroup>';
    cols.forEach(c => {
        const w = colWidthMap[c.key] || 120;
        html += '<col width="' + w + '">';
    });
    html += '</colgroup>';

    html += '<thead><tr>';
    headers.forEach(h => {
        html += '<th style="background:#667eea;color:#fff;font-weight:bold;text-align:center;border:1px solid #333;">' + escapeHtml(String(h)) + '</th>';
    });
    html += '</tr></thead><tbody>';
    data.forEach((r, idx) => {
        const bg = idx % 2 === 0 ? '#fff' : '#f8fafc';
        html += '<tr style="background:' + bg + ';">';
        r.forEach(v => { html += '<td style="border:1px solid #999;">' + escapeHtml(String(v == null ? '' : v)) + '</td>'; });
        html += '</tr>';
    });
    html += '</tbody></table>';

    html += '</body></html>';
    downloadBlob(html, safeFileName(cfg.filePrefix) + '.xls', 'application/vnd.ms-excel');
    showToast('Đã xuất file Excel!', 'success');
}

    // ============================================
    // WORD — HTML fake .doc
    // ============================================
function doExportWord(rows, cols, cfg) {
const { headers, data } = buildTableData(rows, cols, { formatNumber: true });
    const now = new Date();
    const dateStr = String(now.getDate()).padStart(2, '0') + '/' +
                    String(now.getMonth() + 1).padStart(2, '0') + '/' +
                    now.getFullYear() + ' ' +
                    String(now.getHours()).padStart(2, '0') + ':' +
                    String(now.getMinutes()).padStart(2, '0');

    const userName = (window.currentProfile && window.currentProfile.full_name) || 'Nhân viên';
    const showSignature = window.EXPORT_SHOW_SIGNATURE === true;

    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">';
    html += '<head><meta charset="UTF-8">';
    html += '<title>' + escapeHtml(cfg.entityName || 'Dữ liệu') + '</title>';
    html += '<!--[if gte mso 9]><xml><w:WordDocument>';
    html += '<w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->';
    html += '<style>';
    html += '@page { size: A4 landscape; margin: 1cm; }';
    html += 'body { font-family: "Times New Roman", serif; font-size: 11pt; color: #000; }';
    html += '.company { text-align: center; font-weight: bold; font-size: 13pt; text-transform: uppercase; margin-bottom: 6pt; }';
    html += 'h1 { text-align: center; font-size: 16pt; font-weight: bold; text-transform: uppercase; margin: 14pt 0 4pt; }';
    html += 'p.meta { text-align: right; font-size: 10pt; font-style: italic; margin: 2pt 0; }';
    html += 'table { border-collapse: collapse; width: 100%; margin-top: 10pt; }';
    html += 'th, td { border: 1px solid #000; padding: 4pt 6pt; font-size: 10pt; vertical-align: top; }';
    html += 'th { background: #e8eef7; font-weight: bold; text-align: center; }';
    html += 'table.signature { border: none; margin-top: 30pt; }';
    html += 'table.signature td { border: none; text-align: center; padding: 4pt; font-size: 11pt; }';
    html += '.sig-title { font-weight: bold; padding-bottom: 50pt; }';
    html += '.sig-name { font-style: italic; font-size: 10pt; color: #555; }';
    html += '</style></head><body>';

    html += '<div class="company">Công ty TNHH Một Con Sen</div>';
    html += '<h1>' + escapeHtml(cfg.entityName || 'Dữ liệu') + '</h1>';
    html += '<p class="meta">Ngày in: ' + dateStr + '</p>';
    html += '<p class="meta">Người in: ' + escapeHtml(userName) + '</p>';

    html += '<table>';
    html += '<thead><tr>';
    headers.forEach(h => { html += '<th>' + escapeHtml(String(h)) + '</th>'; });
    html += '</tr></thead><tbody>';
    data.forEach(r => {
        html += '<tr>';
        r.forEach(v => { html += '<td>' + escapeHtml(String(v == null ? '' : v)) + '</td>'; });
        html += '</tr>';
    });
    html += '</tbody></table>';

    if (showSignature) {
        html += '<table class="signature"><tr>';
        html += '<td><div class="sig-title">Người lập</div><div class="sig-name">(Ký, ghi rõ họ tên)</div></td>';
        html += '<td><div class="sig-title">Người duyệt</div><div class="sig-name">(Ký, ghi rõ họ tên)</div></td>';
        html += '<td><div class="sig-title">Giám đốc</div><div class="sig-name">(Ký, ghi rõ họ tên)</div></td>';
        html += '</tr></table>';
    }

    html += '</body></html>';

    downloadBlob(html, safeFileName(cfg.filePrefix) + '.doc', 'application/msword');
    showToast('Đã xuất file Word!', 'success');
}

// ============================================
// PDF — window.print
// ============================================
function doExportPDF(rows, cols, cfg) {
const { headers, data } = buildTableData(rows, cols, { formatNumber: true });
    const now = new Date();
    const dateStr = String(now.getDate()).padStart(2, '0') + '/' +
                    String(now.getMonth() + 1).padStart(2, '0') + '/' +
                    now.getFullYear() + ' ' +
                    String(now.getHours()).padStart(2, '0') + ':' +
                    String(now.getMinutes()).padStart(2, '0');

    const fileName = (cfg.filePrefix || 'du-lieu') + '-' +
        now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');

    const userName = (window.currentProfile && window.currentProfile.full_name) || 'Nhân viên';
    const showSignature = window.EXPORT_SHOW_SIGNATURE === true;

    let html = '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">';
    html += '<title>' + escapeHtml(fileName) + '</title>';
    html += '<style>';
    html += '* { box-sizing: border-box; }';
    html += 'body { font-family: "Times New Roman", serif; padding: 20px; color: #000; }';
    html += '.company { text-align: center; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }';
    html += 'h1 { text-align: center; font-size: 22px; font-weight: 900; text-transform: uppercase; margin: 20px 0 6px; letter-spacing: 1px; }';
    html += '.meta { text-align: right; font-size: 12px; color: #333; font-style: italic; margin-bottom: 16px; line-height: 1.6; }';
    html += 'table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }';
    html += 'th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; word-wrap: break-word; }';
    html += 'th { background: #e8eef7; font-weight: 700; text-align: center; font-size: 11px; text-transform: uppercase; }';
    html += 'tbody tr:nth-child(even) td { background: #f8f9fb; }';
    html += '.signature { display: flex; justify-content: space-around; margin-top: 40px; page-break-inside: avoid; }';
    html += '.sig-box { text-align: center; width: 30%; }';
    html += '.sig-title { font-weight: 700; margin-bottom: 60px; font-size: 13px; }';
    html += '.sig-name { font-style: italic; font-size: 12px; color: #555; }';
    html += '@media print { body { padding: 0; } @page { margin: 10mm; } }';
    html += '</style></head><body>';

    html += '<div class="company">Công ty TNHH Một Con Sen</div>';
    html += '<h1>' + escapeHtml(cfg.entityName || 'Dữ liệu') + '</h1>';
    html += '<div class="meta">Ngày in: ' + dateStr + '<br>Người in: ' + escapeHtml(userName) + '</div>';

    html += '<table><thead><tr>';
    headers.forEach(h => { html += '<th>' + escapeHtml(String(h)) + '</th>'; });
    html += '</tr></thead><tbody>';
    data.forEach(r => {
        html += '<tr>';
        r.forEach(v => { html += '<td>' + escapeHtml(String(v == null ? '' : v)) + '</td>'; });
        html += '</tr>';
    });
    html += '</tbody></table>';

    if (showSignature) {
        html += '<div class="signature">';
        html += '<div class="sig-box"><div class="sig-title">Người lập</div><div class="sig-name">(Ký, ghi rõ họ tên)</div></div>';
        html += '<div class="sig-box"><div class="sig-title">Người duyệt</div><div class="sig-name">(Ký, ghi rõ họ tên)</div></div>';
        html += '<div class="sig-box"><div class="sig-title">Giám đốc</div><div class="sig-name">(Ký, ghi rõ họ tên)</div></div>';
        html += '</div>';
    }

    html += '</body></html>';

    const win = window.open('', '_blank');
    if (!win) {
        showToast('Vui lòng cho phép popup để in', 'warning');
        return;
    }
    win.document.write(html);
    win.document.close();
    try { win.document.title = fileName; } catch (e) {}
    win.focus();

    win.onafterprint = () => {
        setTimeout(() => { try { win.close(); } catch (e) {} }, 300);
    };

    setTimeout(() => win.print(), 400);
    showToast('Đang mở hộp thoại in... Nhớ bỏ tick "Headers and footers"', 'success');
}

    // ============================================
    // ESC
    // ============================================
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('modal-export');
            if (modal && modal.classList.contains('show')) closeExportModal();
        }
    });
    
    console.log('✅ export.js loaded');
})();