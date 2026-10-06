// ============================================
// LOGIC ĐĂNG NHẬP
// Dùng chung client từ config.js
// ============================================

const supabaseClient = window.supabaseClient;

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

// Auto-fill email
const urlParams = new URLSearchParams(window.location.search);
const emailFromUrl = urlParams.get('email');
if (emailFromUrl && emailInput) {
    emailInput.value = decodeURIComponent(emailFromUrl);
    if (passwordInput) passwordInput.focus();
}

// ===== ĐĂNG NHẬP =====
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
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (!response.ok) {
                const errMsg = (result.error || '').toLowerCase();
                const errCode = (result.error_code || '').toLowerCase();

                if (errCode === 'email_not_confirmed' || errMsg.includes('not confirmed')) {
                    messageEl.innerHTML = '📧 <b>Email chưa được xác nhận.</b><br>Vui lòng mở hộp thư để xác nhận.';
                    messageEl.className = 'message show error';
                    setLoading(false);
                    return;
                }

                if (errMsg.includes('invalid login')) {
                    showMessage('❌ Email hoặc mật khẩu không đúng.', 'error');
                    setLoading(false);
                    return;
                }

                showMessage('Lỗi: ' + (result.error || 'Không đăng nhập được'), 'error');
                setLoading(false);
                return;
            }

            console.log('✅ API trả về token');

            const { error: sessionError } = await supabaseClient.auth.setSession({
                access_token: result.access_token,
                refresh_token: result.refresh_token
            });

            if (sessionError) {
                console.error('❌ setSession lỗi:', sessionError);
                showMessage('Lỗi lưu phiên: ' + sessionError.message, 'error');
                setLoading(false);
                return;
            }

            const { data: { session } } = await supabaseClient.auth.getSession();
            console.log('✅ Session check:', session ? 'OK' : 'FAIL', session?.user?.email);

            localStorage.setItem('user', JSON.stringify(result.user));
            showMessage('✅ Đăng nhập thành công! Đang chuyển hướng...', 'success');

            setTimeout(function() {
                const returnUrl = sessionStorage.getItem('return_url');
                if (returnUrl) {
                    sessionStorage.removeItem('return_url');
                    window.location.href = returnUrl;
                } else {
                    window.location.href = 'dashboard.html';
                }
            }, 800);

        } catch (err) {
            console.error('Lỗi login:', err);
            showMessage('Lỗi kết nối: ' + err.message, 'error');
            setLoading(false);
        }
    });
}

// ===== QUÊN MẬT KHẨU =====
const forgotLink = document.getElementById('forgot-password-link');
if (forgotLink) {
    forgotLink.addEventListener('click', async function(e) {
        e.preventDefault();
        hideMessage();

        const email = emailInput.value.trim();

        if (!email) {
            showMessage('Nhập email của bạn vào ô trên, rồi bấm "Quên mật khẩu?".');
            emailInput.focus();
            return;
        }

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            showMessage('Email không hợp lệ.');
            return;
        }

        forgotLink.textContent = 'Đang gửi...';
        forgotLink.style.pointerEvents = 'none';

        try {
            const response = await fetch('/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            });

            const result = await response.json();

            if (!response.ok) {
                showMessage('Lỗi: ' + (result.error || 'Không gửi được email'), 'error');
            } else {
                showMessage('📧 Đã gửi link đặt lại mật khẩu. Kiểm tra hộp thư!', 'success');
            }
        } catch (err) {
            showMessage('Lỗi kết nối: ' + err.message, 'error');
        } finally {
            forgotLink.textContent = 'Quên mật khẩu?';
            forgotLink.style.pointerEvents = '';
        }
    });
}

console.log('✅ login.js loaded');