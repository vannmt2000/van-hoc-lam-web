// ============================================
// EXPORT / PRINT — Hệ thống dùng chung cho mọi trang
// Hướng A: không cần thư viện
// CSV (chuẩn) · Excel (.xls HTML fake) · Word (.doc HTML fake) · PDF (window.print)
// ============================================

(function() {
    // ===== STATE =====
    let _exportFormat = 'csv';
    let _columnState = {};

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
        const rows = selectedIds.size > 0
            ? allFiltered.filter(r => selectedIds.has(r.id))
            : allFiltered;

        if (rows.length === 0) {
            showToast('Không có dữ liệu để xuất', 'warning');
            return;
        }

        _columnState = {};
        cfg.columns.forEach(col => {
            _columnState[col.key] = col.defaultOn !== false;
        });
        _exportFormat = 'csv';

        renderExportModal(rows, cfg, selectedIds.size > 0);
        document.getElementById('modal-export').classList.add('show');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    };

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
            { val: 'csv',   label: 'CSV',   desc: 'Mở bằng Excel, Google Sheets' },
            { val: 'excel', label: 'Excel', desc: 'File .xls mở bằng Excel' },
            { val: 'pdf',   label: 'PDF',   desc: 'In hoặc lưu PDF' },
            { val: 'word',  label: 'Word',  desc: 'File .doc mở bằng Word' }
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

        if (body) body.innerHTML = html;
    }

    // ============================================
    // TOGGLE
    // ============================================
    window.exportToggleColumn = function(key, checked) {
        _columnState[key] = checked;
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
    };

    // ============================================
    // DO EXPORT
    // ============================================
    window.doExport = function() {
        const cfg = window.EXPORT_CONFIG;
        if (!cfg) return;

        const selectedIds = window.EXPORT_SELECTED;
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
    function buildTableData(rows, cols) {
        const headers = cols.map(c => c.label);
        const data = rows.map(row => cols.map(c => {
            if (typeof c.getValue === 'function') return c.getValue(row);
            return row[c.key] != null ? row[c.key] : '';
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
        const { headers, data } = buildTableData(rows, cols);
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
        const { headers, data } = buildTableData(rows, cols);
        let html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8">';
        html += '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>';
        html += '<x:Name>Data</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>';
        html += '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->';
        html += '</head><body><table border="1" cellpadding="5" cellspacing="0">';
        html += '<thead><tr>';
        headers.forEach(h => {
            html += '<th style="background:#667eea;color:#fff;font-weight:bold;">' + escapeHtml(String(h)) + '</th>';
        });
        html += '</tr></thead><tbody>';
        data.forEach(r => {
            html += '<tr>';
            r.forEach(v => { html += '<td>' + escapeHtml(String(v == null ? '' : v)) + '</td>'; });
            html += '</tr>';
        });
        html += '</tbody></table></body></html>';
        downloadBlob(html, safeFileName(cfg.filePrefix) + '.xls', 'application/vnd.ms-excel');
        showToast('Đã xuất file Excel!', 'success');
    }

    // ============================================
    // WORD — HTML fake .doc
    // ============================================
    function doExportWord(rows, cols, cfg) {
        const { headers, data } = buildTableData(rows, cols);
        let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">';
        html += '<head><meta charset="UTF-8"><title>Export</title></head><body>';
        html += '<h2>' + escapeHtml(cfg.entityName || 'Dữ liệu') + '</h2>';
        html += '<p><i>Xuất ngày: ' + new Date().toLocaleString('vi-VN') + '</i></p>';
        html += '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:Arial;font-size:12px;">';
        html += '<thead><tr>';
        headers.forEach(h => {
            html += '<th style="background:#667eea;color:#fff;">' + escapeHtml(String(h)) + '</th>';
        });
        html += '</tr></thead><tbody>';
        data.forEach(r => {
            html += '<tr>';
            r.forEach(v => { html += '<td>' + escapeHtml(String(v == null ? '' : v)) + '</td>'; });
            html += '</tr>';
        });
        html += '</tbody></table></body></html>';
        downloadBlob(html, safeFileName(cfg.filePrefix) + '.doc', 'application/msword');
        showToast('Đã xuất file Word!', 'success');
    }

    // ============================================
    // PDF — window.print
    // ============================================
    function doExportPDF(rows, cols, cfg) {
        const { headers, data } = buildTableData(rows, cols);
        const now = new Date();
        const dateStr = String(now.getDate()).padStart(2, '0') + '/' +
                        String(now.getMonth() + 1).padStart(2, '0') + '/' +
                        now.getFullYear() + ' ' +
                        String(now.getHours()).padStart(2, '0') + ':' +
                        String(now.getMinutes()).padStart(2, '0');

        let html = '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">';
        html += '<title>' + escapeHtml(cfg.entityName || 'Dữ liệu') + '</title>';
        html += '<style>';
        html += '* { box-sizing: border-box; }';
        html += 'body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; padding: 20px; color: #0f172a; }';
        html += 'h1 { font-size: 20px; margin: 0 0 8px; }';
        html += '.meta { font-size: 12px; color: #64748b; margin-bottom: 4px; }';
        html += 'table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }';
        html += 'th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }';
        html += 'th { background: #f1f5f9; font-weight: 700; }';
        html += 'tr:nth-child(even) td { background: #f8fafc; }';
        html += '@media print { body { padding: 0; } @page { margin: 10mm; } }';
        html += '</style></head><body>';
        html += '<h1>' + escapeHtml(cfg.entityName || 'Dữ liệu') + '</h1>';
        html += '<div class="meta">Công ty TNHH Một Con Sen · In ngày: ' + dateStr + '</div>';
        html += '<div class="meta">Tổng: <b>' + rows.length + '</b> mục</div>';
        html += '<table><thead><tr>';
        headers.forEach(h => { html += '<th>' + escapeHtml(String(h)) + '</th>'; });
        html += '</tr></thead><tbody>';
        data.forEach(r => {
            html += '<tr>';
            r.forEach(v => { html += '<td>' + escapeHtml(String(v == null ? '' : v)) + '</td>'; });
            html += '</tr>';
        });
        html += '</tbody></table></body></html>';

        const win = window.open('', '_blank');
        if (!win) {
            showToast('Vui lòng cho phép popup để in', 'warning');
            return;
        }
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 400);
        showToast('Đang mở hộp thoại in...', 'success');
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