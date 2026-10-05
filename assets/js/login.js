// ============================================
// LOGIC ĐĂNG NHẬP
// (Đã có supabaseClient từ config.js)
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
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            setLoading(false);

            if (error) {
                let msg = error.message;
                if (msg.includes('Invalid login credentials')) {
                    msg = '❌ Email hoặc mật khẩu không đúng. Nếu chưa có tài khoản, hãy bấm "Đăng ký ngay".';
                }
                showMessage(msg, 'error');
                return;
            }

            showMessage('✅ Đăng nhập thành công!', 'success');
            setTimeout(function() {
                alert('Đăng nhập thành công!\nEmail: ' + data.user.email);
            }, 500);

        } catch (err) {
            setLoading(false);
            showMessage('Lỗi: ' + err.message, 'error');
        }
    });
}

console.log('✅ login.js đã load xong!');
