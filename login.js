// ===== CẤU HÌNH SUPABASE =====
const SUPABASE_URL = 'https://pffbnfysvhiumzhfvnos.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmJuZnlzdmhpdW16aGZ2bm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNTMxODYsImV4cCI6MjEwNjcyOTE4Nn0.qQpHpeXW4xnGdLxLIwDhBIabYipSwqAxAhtvRPDiGMs';

// Kiểm tra CDN đã load chưa
if (typeof window.supabase === 'undefined') {
    alert('LỖI: Không tải được thư viện Supabase. Kiểm tra mạng!');
    throw new Error('Supabase CDN chưa load');
}

// Đặt tên là supabaseClient để không trùng với window.supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('✅ Đã kết nối Supabase');

// ===== LẤY PHẦN TỬ HTML =====
const form = document.getElementById('email-login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const messageEl = document.getElementById('message');
const submitBtn = document.querySelector('.email-btn');

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

// ===== XỬ LÝ ĐĂNG NHẬP =====
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
        console.log('🔐 Đang đăng nhập:', email);

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
                    msg = '❌ Email hoặc mật khẩu không đúng. Nếu chưa có tài khoản, hãy bấm "Đăng ký ngay" bên dưới.';
                } else if (msg.includes('Email not confirmed')) {
                    msg = '📧 Email chưa xác nhận. Vui lòng kiểm tra hộp thư.';
                } else if (msg.includes('Too many requests')) {
                    msg = '⏳ Bạn đã thử quá nhiều lần. Vui lòng đợi vài phút.';
                }
                showMessage(msg, 'error');
                return;
            }

            console.log('✅ Đăng nhập OK:', data);
            showMessage('✅ Đăng nhập thành công! Đang chuyển hướng...', 'success');

            setTimeout(function() {
                alert('Đăng nhập thành công!\nEmail: ' + data.user.email);
            }, 800);

        } catch (err) {
            setLoading(false);
            console.error('Lỗi không xác định:', err);
            showMessage('Lỗi: ' + err.message, 'error');
        }
    });
}

console.log('✅ login.js đã load xong!');
