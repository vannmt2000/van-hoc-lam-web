const FALLBACK_URL = 'https://pffbnfysvhiumzhfvnos.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmJuZnlzdmhpdW16aGZ2bm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNTMxODYsImV4cCI6MjEwNjcyOTE4Nn0.qQpHpeXW4xnGdLxLIwDhBIabYipSwqAxAhtvRPDiGMs';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Vui lòng nhập email' });
        }

        const supabaseUrl = process.env.SUPABASE_URL || FALLBACK_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY || FALLBACK_KEY;

        // Xác định URL redirect đầy đủ (bao gồm /pages/reset-password.html)
        const host = req.headers.host || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const redirectTo = `${protocol}://${host}/pages/reset-password.html`;

        console.log('Redirect URL:', redirectTo);

        // ⚠️ QUAN TRỌNG: gửi redirect_to trong query string (Supabase mới cần)
        const url = supabaseUrl + '/auth/v1/recover?redirect_to=' + encodeURIComponent(redirectTo);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: email })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return res.status(response.status).json({ 
                error: data.msg || data.error_description || 'Không gửi được email' 
            });
        }

        return res.status(200).json({ 
            message: 'Đã gửi email đặt lại mật khẩu. Kiểm tra hộp thư của bạn!' 
        });

    } catch (err) {
        console.error('Forgot password error:', err);
        return res.status(500).json({ error: err.message });
    }
};