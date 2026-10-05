// ============================================
// LOGIC ĐĂNG NHẬP + QUÊN MẬT KHẨU
// ============================================

const form = document.getElementById('email-login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const messageEl = document.getElementById('message');
const submitBtn = document.querySelector('.email-btn');

// ===== HÀM TIỆN ÍCH =====
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

// ============================================
// 1. TỰ ĐỘNG ĐIỀN EMAIL TỪ URL (?email=...)
// ============================================
const urlParams = new URLSearchParams(window.location.search);
const emailFromUrl = urlParams.get('email');
if (emailFromUrl && emailInput) {
    emailInput.value = decodeURIComponent(emailFromUrl);
    if (passwordInput) passwordInput.focus();
}

// ============================================
// 2. KIỂM TRA NẾU VỪA XÁC NHẬN EMAIL
// (Token nằm trong URL dạng #access_token=...&type=signup)
// ============================================
const hash = window.location.hash.substring(1);
const hashParams = new URLSearchParams(hash);
const confirmToken = hashParams.get('access_token');
const confirmType = hashParams.get('type');

if (confirmToken && confirmType === 'signup' && messageEl) {
    messageEl.innerHTML =
        '🎉 <b>Email đã được xác nhận thành công!</b><br>' +
        'Bây giờ bạn có thể đăng nhập bằng email và mật khẩu vừa đăng ký.<br>' +
        '<small style="color:#64748b">Vui lòng nhập mật khẩu để tiếp tục.</small>';
    messageEl.className = 'message show success';
    messageEl.style.textAlign = 'left';

    // Xóa hash khỏi URL cho sạch
    setTimeout(function() {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }, 100);

    // Focus vào ô password
    if (passwordInput) {
        setTimeout(function() { passwordInput.focus(); }, 300);
    }
}

// ============================================
// 3. XỬ LÝ ĐĂNG NHẬP
// ============================================
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

                // ===== EMAIL CHƯA XÁC NHẬN =====
                if (
                    errCode === 'email_not_confirmed' ||
                    errMsg.includes('email not confirmed') ||
                    errMsg.includes('not confirmed') ||
                    errMsg.includes('notconfirmed')
                ) {
                    messageEl.innerHTML =
                        '📧 <b>Email chưa được xác nhận.</b><br>' +
                        'Vui lòng mở hộp thư <b>' + email + '</b> và bấm link xác nhận trước khi đăng nhập.<br>' +
                        '<small style="color:#64748b">(Nhớ check cả hộp thư Spam/Quảng cáo)</small><br>' +
                        '<a href="#" id="resend-confirm" ' +
                        'style="color:#0ea5e9;font-weight:700;text-decoration:underline;display:inline-block;margin-top:6px">' +
                        'Gửi lại email xác nhận →</a>';
                    messageEl.className = 'message show error';
                    messageEl.style.textAlign = 'left';

                    // Gắn sự kiện cho nút "Gửi lại email"
                    setTimeout(function() {
                        const resendBtn = document.getElementById('resend-confirm');
                        if (resendBtn) {
                            resendBtn.addEventListener('click', function(ev) {
                                ev.preventDefault();
                                resendConfirmEmail(email);
                            });
                        }
                    }, 50);

                    setLoading(false);
                    return;
                }

                // ===== SAI MẬT KHẨU =====
                if (errMsg.includes('invalid login') || errMsg.includes('invalid credentials') || errMsg.includes('invalid_grant')) {
                    showMessage('❌ Email hoặc mật khẩu không đúng. Nếu chưa có tài khoản, hãy bấm "Đăng ký ngay".', 'error');
                    setLoading(false);
                    return;
                }

                // Lỗi khác
                showMessage('Lỗi: ' + (result.error || 'Không đăng nhập được'), 'error');
                setLoading(false);
                return;
            }

            // ===== ĐĂNG NHẬP THÀNH CÔNG =====
            if (result.access_token) {
                localStorage.setItem('access_token', result.access_token);
            }
            if (result.user) {
                localStorage.setItem('user', JSON.stringify(result.user));
            }

            showMessage('✅ Đăng nhập thành công! Đang chuyển hướng...', 'success');
            setTimeout(function() {
                alert('Đăng nhập thành công!\nEmail: ' + (result.user ? result.user.email : email));
            }, 500);

        } catch (err) {
            showMessage('Lỗi kết nối: ' + err.message, 'error');
            setLoading(false);
        }
    });
}

// ============================================
// 4. GỬI LẠI EMAIL XÁC NHẬN
// ============================================
async function resendConfirmEmail(email) {
    const resendBtn = document.getElementById('resend-confirm');
    if (resendBtn) {
        resendBtn.textContent = 'Đang gửi...';
        resendBtn.style.pointerEvents = 'none';
    }

    try {
        const response = await fetch('/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        const result = await response.json();

        if (response.ok) {
            showMessage('📧 Đã gửi lại email. Kiểm tra hộp thư (kể cả Spam)!', 'success');
        } else {
            showMessage('Lỗi: ' + (result.error || 'Không gửi được'), 'error');
        }
    } catch (err) {
        showMessage('Lỗi kết nối: ' + err.message, 'error');
    }
}

// ============================================
// 5. XỬ LÝ QUÊN MẬT KHẨU
// ============================================
const forgotLink = document.getElementById('forgot-password-link');
if (forgotLink) {
    forgotLink.addEventListener('click', async function(e) {
        e.preventDefault();
        hideMessage();

        const email = emailInput.value.trim();

        if (!email) {
            showMessage('Nhập email của bạn vào ô trên, rồi bấm "Quên mật khẩu?"');
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
    messageEl.innerHTML =
        '📧 <b>Đã gửi link đặt lại mật khẩu đến:</b><br>' +
        '<b style="color:#0f172a">' + email + '</b><br>' +
        '<small style="color:#64748b">' +
        '• Kiểm tra hộp thư (kể cả Spam/Quảng cáo)<br>' +
        '• <b>Sau 2 phút</b> không thấy mail?<br>' +
        '&nbsp;&nbsp;Có thể email này <b>chưa đăng ký</b>. ' +
        '<a href="signup.html?email=' + encodeURIComponent(email) + '" ' +
        'style="color:#0ea5e9;font-weight:700;text-decoration:underline">' +
        'Đăng ký ngay →</a>' +
        '</small>';
    messageEl.className = 'message show success';
    messageEl.style.textAlign = 'left';
    messageEl.style.lineHeight = '1.7';
}
        } catch (err) {
            showMessage('Lỗi kết nối: ' + err.message, 'error');
        } finally {
            forgotLink.textContent = 'Quên mật khẩu?';
            forgotLink.style.pointerEvents = '';
        }
    });
}

console.log('✅ login.js đã load xong!');