// ===== CẤU HÌNH SUPABASE =====
const SUPABASE_URL = 'https://pffbnfysvhiumzhfvnos.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmJuZnlzdmhpdW16aGZ2bm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNTMxODYsImV4cCI6MjEwNjcyOTE4Nn0.qQpHpeXW4xnGdLxLIwDhBIabYipSwqAxAhtvRPDiGMs';

if (typeof window.supabase === 'undefined') {
    alert('LỖI: Không tải được thư viện Supabase. Kiểm tra mạng!');
    throw new Error('Supabase CDN chưa load');
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('✅ Supabase đã kết nối');

// ===== LẤY PHẦN TỬ =====
const form = document.getElementById('signup-form');
const fullnameInput = document.getElementById('fullname');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmInput = document.getElementById('confirm-password');
const messageEl = document.getElementById('message');
const submitBtn = document.getElementById('submit-btn');

// ===== HÀM TIỆN ÍCH =====
function showMessage(msg, type) {
    type = type || 'error';
    messageEl.textContent = msg;
    messageEl.className = 'message show ' + type;
    console.log('📢', msg);
}

function hideMessage() {
    messageEl.className = 'message';
}

function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? 'Đang xử lý...' : 'Đăng Ký';
}

// ===== XỬ LÝ ĐĂNG KÝ =====
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    hideMessage();

    const fullname = fullnameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    // ===== VALIDATION =====
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

    // ===== GỬI LÊN SUPABASE =====
    setLoading(true);
    console.log('📝 Đăng ký:', { email, fullname });

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullname,
                    display_name: fullname
                }
            }
        });

        setLoading(false);

        if (error) {
            console.error('Lỗi đăng ký:', error);

            let msg = error.message;
            if (msg.includes('already registered') || msg.includes('User already registered')) {
                msg = '📧 Email này đã được đăng ký rồi. Hãy đăng nhập hoặc dùng email khác.';
            } else if (msg.includes('Password should be')) {
                msg = '🔒 Mật khẩu quá yếu.';
            } else if (msg.includes('rate limit')) {
                msg = '⏳ Bạn thao tác quá nhanh. Vui lòng đợi 1 phút rồi thử lại.';
            } else if (msg.includes('invalid')) {
                msg = '❌ Email không hợp lệ.';
            }

            showMessage(msg, 'error');
            return;
        }

        console.log('✅ Đăng ký thành công:', data);

        // Đăng ký xong có session luôn (do đã tắt confirm email)
        if (data.session) {
            showMessage('🎉 Đăng ký thành công! Đang chuyển hướng...', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
        } else {
            showMessage('🎉 Đăng ký thành công! Bây giờ bạn có thể đăng nhập.', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        }

    } catch (err) {
        setLoading(false);
        console.error('Lỗi:', err);
        showMessage('Lỗi: ' + err.message, 'error');
    }
});

console.log('✅ signup.js đã load xong!');