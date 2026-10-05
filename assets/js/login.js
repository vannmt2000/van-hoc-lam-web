// login.js mới - KHÔNG còn chứa anon key
const form = document.getElementById('email-login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const messageEl = document.getElementById('message');
const submitBtn = document.querySelector('.email-btn');

function showMessage(msg, type) {
    type = type || 'error';
    messageEl.textContent = msg;
    messageEl.className = 'message show ' + type;
}

form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage('Vui lòng nhập đầy đủ.');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang xử lý...';

    try {
        // 🔥 Gọi Netlify Function thay vì gọi Supabase trực tiếp
        const response = await fetch('/.netlify/functions/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage('❌ Email hoặc mật khẩu không đúng.', 'error');
            return;
        }

        // Lưu token để dùng sau
        localStorage.setItem('access_token', result.access_token);
        localStorage.setItem('user', JSON.stringify(result.user));

        showMessage('✅ Đăng nhập thành công!', 'success');
        setTimeout(() => alert('Chào ' + result.user.email), 500);

    } catch (err) {
        showMessage('Lỗi kết nối: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Đăng Nhập';
    }
});
