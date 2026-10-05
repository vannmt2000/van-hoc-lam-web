// ============================================
// VERCEL FUNCTION - ĐĂNG KÝ
// ============================================

const FALLBACK_URL = 'https://pffbnfysvhiumzhfvnos.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmJuZnlzdmhpdW16aGZ2bm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNTMxODYsImV4cCI6MjEwNjcyOTE4Nn0.qQpHpeXW4xnGdLxLIwDhBIabYipSwqAxAhtvRPDiGMs';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, password, fullname } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Thiếu email hoặc mật khẩu' });
        }

        const supabaseUrl = process.env.SUPABASE_URL || FALLBACK_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY || FALLBACK_KEY;

        // Xác định URL redirect sau khi confirm email
        const host = req.headers.host || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const emailRedirectTo = protocol + '://' + host + '/pages/login.html';

        const url = supabaseUrl + '/auth/v1/signup?redirect_to=' + encodeURIComponent(emailRedirectTo);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password,
                data: { full_name: fullname }
            })
        });

        const data = await response.json();

        // Xử lý lỗi
        if (!response.ok) {
            const errMsg = (data.msg || data.error_description || data.error || '').toLowerCase();

            // Rate limit
            if (errMsg.includes('rate limit') || errMsg.includes('rate_limit') || response.status === 429) {
                return res.status(429).json({
                    error: 'Bạn đã yêu cầu gửi email quá nhiều lần. Vui lòng đợi khoảng 1 giờ rồi thử lại.',
                    error_code: 'rate_limit'
                });
            }

            return res.status(response.status).json({
                error: data.msg || data.error_description || data.error || 'Đăng ký thất bại',
                error_code: data.error_code || ''
            });
        }

        // Kiểm tra xem có cần confirm email không
        // Nếu bật confirm email → data.user.email_confirmed_at sẽ null
        const needsConfirmation = !data.user || !data.user.email_confirmed_at;

        return res.status(200).json({
            user: data.user ? { id: data.user.id, email: data.user.email } : null,
            needsConfirmation: needsConfirmation,
            message: needsConfirmation
                ? 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.'
                : 'Đăng ký thành công!'
        });

    } catch (err) {
        console.error('Signup error:', err);
        return res.status(500).json({ error: err.message });
    }
};