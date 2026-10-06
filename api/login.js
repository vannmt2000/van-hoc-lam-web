// ============================================
// VERCEL FUNCTION - ĐĂNG NHẬP
// ============================================

const FALLBACK_URL = 'https://pffbnfysvhiumzhfvnos.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmJuZnlzdmhpdW16aGZ2bm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNTMxODYsImV4cCI6MjEwNjcyOTE4Nn0.qQpHpeXW4xnGdLxLIwDhBIabYipSwqAxAhtvRPDiGMs';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Thiếu email hoặc mật khẩu' });
        }

        const supabaseUrl = process.env.SUPABASE_URL || FALLBACK_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY || FALLBACK_KEY;

        console.log('Login attempt:', email);

        const response = await fetch(
            supabaseUrl + '/auth/v1/token?grant_type=password',
            {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            const errCode = (data.error_code || '').toLowerCase();
            const errMsg = (data.error_description || data.msg || data.error || '').toLowerCase();

            return res.status(response.status).json({
                error: data.error_description || data.msg || data.error || 'Invalid login credentials',
                error_code: errCode || errMsg
            });
        }

        return res.status(200).json({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in,
            token_type: data.token_type,
            user: {
                id: data.user.id,
                email: data.user.email
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: err.message });
    }
};