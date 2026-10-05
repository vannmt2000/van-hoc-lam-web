// ===== ĐẶT LẠI MẬT KHẨU =====
const form = document.getElementById('reset-form');
const newPassInput = document.getElementById('new-password');
const confirmInput = document.getElementById('confirm-password');
const messageEl = document.getElementById('message');
const submitBtn = document.getElementById('submit-btn');

function showMessage(msg, type) {
    type = type || 'error';
    messageEl.textContent = msg;
    messageEl.className = 'message show ' + type;
}

// Đọc access_token từ URL (Supabase gửi kèm khi bấm link trong email)
function getTokenFromUrl() {
    // Supabase gửi token trong hash: #access_token=xxx&type=recovery
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    return params.get('access_token');
}

const token = getTokenFromUrl();

if (!token) {
    showMessage('❌ Link không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại.', 'error');
    submitBtn.disabled = true;
}

form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const newPass = newPassInput.value;
    const confirm = confirmInput.value;

    if (newPass.length < 6) {
        showMessage('Mật khẩu phải có ít nhất 6 ký tự.');
        return;
    }
    if (newPass !== confirm) {
        showMessage('Mật khẩu nhập lại không khớp.');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang xử lý...';

    try {
        const response = await fetch('/api/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: token, new_password: newPass })
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage('Lỗi: ' + (result.error || 'Không đổi được mật khẩu'), 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Đặt Lại Mật Khẩu';
            return;
        }

        showMessage('✅ Đổi mật khẩu thành công! Đang chuyển về trang đăng nhập...', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);

    } catch (err) {
        showMessage('Lỗi kết nối: ' + err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Đặt Lại Mật Khẩu';
    }
});