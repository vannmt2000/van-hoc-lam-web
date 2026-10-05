// ============================================
// LOGIC ĐĂNG NHẬP - Dùng Cloudflare Functions
// ============================================

const form = document.getElementById('email-login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const messageEl = document.getElementById('message');
const submitBtn = document.querySelector('.email-btn');

function showMessage(msg, type) {
    type = type || 'error';
    if (!messageEl) return;
    messageEl.textContent = msg;
    messageEl.className = 'message show ' + type;
}

function hideMessage() {
    if (messageEl) messageEl.className = 'message';
}

function setLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? 'Đang xử lý...' : 'Đăng Nhập';
}

if (form) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideMessage();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showMessage('Vui lòng nhập đầy đủ email và mật khẩu.');
            return;
        }

        setLoading(true);

        try {
            // 🔥 ĐỔI URL: /api/login (Cloudflare) thay vì /.netlify/functions/login
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (!response.ok) {
                let msg = '❌ Email hoặc mật khẩu không đúng. Nếu chưa có tài khoản, hãy bấm "Đăng ký ngay".';
                if (result.error && !result.error.includes('Invalid login')) {
                    msg = 'Lỗi: ' + result.error;
                }
                showMessage(msg, 'error');
                return;
            }

            // Lưu token
            if (result.access_token) {
                localStorage.setItem('access_token', result.access_token);
            }
            if (result.user) {
                localStorage.setItem('user', JSON.stringify(result.user));
            }

            showMessage('✅ Đăng nhập thành công!', 'success');
            setTimeout(function() {
                alert('Đăng nhập thành công!\nEmail: ' + (result.user ? result.user.email : email));
            }, 500);

        } catch (err) {
            showMessage('Lỗi kết nối: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    });
}

console.log('✅ login.js đã load xong!');
