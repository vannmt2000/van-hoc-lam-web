// ============================================
// LOGIC ĐĂNG KÝ
// ============================================

const form = document.getElementById('signup-form');
const fullnameInput = document.getElementById('fullname');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmInput = document.getElementById('confirm-password');
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
    submitBtn.textContent = isLoading ? 'Đang xử lý...' : 'Đăng Ký';
}

// ===== XỬ LÝ SUBMIT FORM =====
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    hideMessage();

    const fullname = fullnameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    // Validation
    if (!fullname) {
        showMessage('Vui lòng nhập họ và tên.');
        fullnameInput.focus();
        return;
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        showMessage('Email không hợp lệ.');
        emailInput.focus();
        return;
    }
    if (password.length < 6) {
        showMessage('Mật khẩu phải có ít nhất 6 ký tự.');
        passwordInput.focus();
        return;
    }
    if (password !== confirm) {
        showMessage('Mật khẩu nhập lại không khớp.');
        confirmInput.focus();
        return;
    }

    setLoading(true);

    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, fullname })
        });

        const result = await response.json();

        // ===== XỬ LÝ LỖI =====
        if (!response.ok) {
            const errMsg = (result.error || '').toLowerCase();

            // Rate limit
            if (result.error_code === 'rate_limit' || errMsg.includes('rate limit')) {
                messageEl.innerHTML =
                    '⏳ <b>Bạn đã yêu cầu gửi email quá nhiều lần.</b><br>' +
                    'Vui lòng đợi khoảng <b>1 giờ</b> rồi thử lại.<br>' +
                    '<small style="color:#64748b">(Giới hạn Supabase free: 3-4 email/giờ)</small>';
                messageEl.className = 'message show error';
                messageEl.style.textAlign = 'left';
                setLoading(false);
                return;
            }

            // Email đã tồn tại
            if (errMsg.includes('already registered') || errMsg.includes('already been registered') || errMsg.includes('user already')) {
                messageEl.innerHTML =
                    '📧 Email này đã được đăng ký. ' +
                    '<a href="login.html?email=' + encodeURIComponent(email) + '" ' +
                    'style="color:#0ea5e9;font-weight:700;text-decoration:underline">' +
                    'Đăng nhập ngay →</a>';
                messageEl.className = 'message show error';
                messageEl.style.textAlign = 'left';
                setLoading(false);
                return;
            }

            // Lỗi khác
            showMessage('Lỗi: ' + (result.error || 'Không đăng ký được'), 'error');
            setLoading(false);
            return;
        }

        // ===== ĐĂNG KÝ THÀNH CÔNG =====
        if (result.needsConfirmation) {
            // Cần xác nhận email → hiện hướng dẫn
            messageEl.innerHTML =
                '📧 <b>Đăng ký thành công!</b><br>' +
                'Vui lòng mở email <b>' + email + '</b> và bấm link xác nhận.<br>' +
                '<small style="color:#64748b">' +
                '(Nhớ check cả hộp thư Spam/Quảng cáo)<br>' +
                '💡 <b>Mẹo:</b> Sau khi xác nhận xong, bạn có thể đóng tab này.' +
                '</small><br>' +
                '<a href="login.html?email=' + encodeURIComponent(email) + '" ' +
                'style="color:#0ea5e9;font-weight:700;text-decoration:underline;display:inline-block;margin-top:8px">' +
                'Đã xác nhận xong → Đến trang đăng nhập</a>';
            messageEl.className = 'message show success';
            messageEl.style.textAlign = 'left';
            messageEl.style.lineHeight = '1.7';
            setLoading(false);
            return;
        }

        // Không cần confirm (trường hợp tắt confirm email)
        showMessage('🎉 Đăng ký thành công! Đang chuyển đến trang đăng nhập...', 'success');
        setTimeout(function() {
            window.location.href = 'login.html';
        }, 1500);

    } catch (err) {
        showMessage('Lỗi kết nối: ' + err.message, 'error');
        setLoading(false);
    }
});

// ===== TỰ ĐỘNG ĐIỀN EMAIL NẾU URL CÓ ?email=... =====
// (Khi user bấm link "Đăng ký ngay" từ trang login hoặc quên mật khẩu)
const urlParams = new URLSearchParams(window.location.search);
const emailFromUrl = urlParams.get('email');
if (emailFromUrl && emailInput) {
    emailInput.value = decodeURIComponent(emailFromUrl);
}

console.log('✅ signup.js đã load xong!');