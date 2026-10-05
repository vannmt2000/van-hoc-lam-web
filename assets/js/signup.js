// ============================================
// LOGIC ĐĂNG KÝ - Dùng Cloudflare Functions
// ============================================

const form = document.getElementById('signup-form');
const fullnameInput = document.getElementById('fullname');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmInput = document.getElementById('confirm-password');
const messageEl = document.getElementById('message');
const submitBtn = document.querySelector('.email-btn');

function showMessage(msg, type) {
    type = type || 'error';
    if (!messageEl) return;
    messageEl.textContent = msg;
    messageEl.className = 'message show ' + type;
}

function setLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? 'Đang xử lý...' : 'Đăng Ký';
}

form.addEventListener('submit', async function(e) {
    e.preventDefault();
    messageEl.className = 'message';

    const fullname = fullnameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    if (!fullname) return showMessage('Vui lòng nhập họ và tên.');
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return showMessage('Email không hợp lệ.');
    if (password.length < 6) return showMessage('Mật khẩu phải có ít nhất 6 ký tự.');
    if (password !== confirm) return showMessage('Mật khẩu nhập lại không khớp.');

    setLoading(true);

    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, fullname })
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage('Lỗi: ' + (result.error || 'Không đăng ký được'), 'error');
            return;
        }

        showMessage('🎉 Đăng ký thành công! Đang chuyển đến trang đăng nhập...', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);

    } catch (err) {
        showMessage('Lỗi: ' + err.message, 'error');
    } finally {
        setLoading(false);
    }
});

console.log('✅ signup.js đã load xong!');
