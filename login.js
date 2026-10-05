// ===== CẤU HÌNH SUPABASE =====
const SUPABASE_URL = 'https://pffbnfysvhiumzhfvnos.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmJuZnlzdmhpdW16aGZ2bm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNTMxODYsImV4cCI6MjEwNjcyOTE4Nn0.qQpHpeXW4xnGdLxLIwDhBIabYipSwqAxAhtvRPDiGMs';

// Kiểm tra CDN đã load chưa
if (typeof window.supabase === 'undefined') {
    alert('LỖI: Không tải được thư viện Supabase. Kiểm tra mạng!');
    throw new Error('Supabase CDN chưa load');
}

// ⚠️ Đặt tên là supabaseClient để KHÔNG trùng với window.supabase của CDN
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('✅ Đã kết nối Supabase');

// ===== LẤY PHẦN TỬ HTML =====
const form = document.getElementById('email-login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const messageEl = document.getElementById('message');
const submitBtn = document.querySelector('.email-btn');
// const signupLink = document.getElementById('signup-link');

// ===== HIỂN THỊ THÔNG BÁO =====
function showMessage(msg, type) {
    type = type || 'error';
    if (!messageEl) return;
    messageEl.textContent = msg;
    messageEl.className = 'message show ' + type;
    console.log('📢', msg);
}

function hideMessage() {
    if (messageEl) messageEl.className = 'message';
}

function setLoading(isLoading, text) {
    text = text || 'Đăng Nhập';
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? 'Đang xử lý...' : text;
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
        console.log('🔐 Đăng nhập:', email);

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            setLoading(false);

            if (error) {
                console.error('Lỗi đăng nhập:', error);
                let msg = error.message;
                if (msg.includes('Invalid login credentials')) {
                    msg = '❌ Email hoặc mật khẩu không đúng.';
                } else if (msg.includes('Email not confirmed')) {
                    msg = '📧 Email chưa xác nhận.';
                }
                showMessage(msg, 'error');
                return;
            }

            console.log('✅ Đăng nhập OK:', data);
            showMessage('✅ Đăng nhập thành công!', 'success');
            alert('Đăng nhập thành công!\nEmail: ' + data.user.email);

        } catch (err) {
            setLoading(false);
            console.error('Lỗi:', err);
            showMessage('Lỗi: ' + err.message, 'error');
        }
    });
}

// ===== ĐĂNG KÝ =====
//if (signupLink) {
    signupLink.addEventListener('click', async function(e) {
        e.preventDefault();
        hideMessage();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showMessage('Nhập email và mật khẩu vào 2 ô trên, rồi bấm "Đăng ký ngay".');
            return;
        }

        if (password.length < 6) {
            showMessage('Mật khẩu phải có ít nhất 6 ký tự.');
            return;
        }

        setLoading(true, 'Đăng Ký');
        console.log('📝 Đăng ký:', email);

        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password
            });

            setLoading(false, 'Đăng Nhập');

            if (error) {
                console.error('Lỗi đăng ký:', error);
                showMessage('Lỗi đăng ký: ' + error.message, 'error');
                return;
            }

            console.log('✅ Đăng ký OK:', data);
            showMessage('🎉 Đăng ký thành công! Giờ đăng nhập được rồi.', 'success');

        } catch (err) {
            setLoading(false, 'Đăng Nhập');
            console.error('Lỗi:', err);
            showMessage('Lỗi: ' + err.message, 'error');
        }
    });
//}

console.log('✅ Script đã load xong!');