const FALLBACK_URL = 'https://pffbnfysvhiumzhfvnos.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmJuZnlzdmhpdW16aGZ2bm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNTMxODYsImV4cCI6MjEwNjcyOTE4Nn0.qQpHpeXW4xnGdLxLIwDhBIabYipSwqAxAhtvRPDiGMs';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { access_token, new_password } = req.body;

        if (!access_token || !new_password) {
            return res.status(400).json({ error: 'Thiếu thông tin' });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }

        const supabaseUrl = process.env.SUPABASE_URL || FALLBACK_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY || FALLBACK_KEY;

        const response = await fetch(supabaseUrl + '/auth/v1/user', {
            method: 'PUT',
            headers: {
                'apikey': supabaseKey,
                'Authorization': 'Bearer ' + access_token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: new_password })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ 
                error: data.msg || data.error_description || 'Không đổi được mật khẩu' 
            });
        }

        return res.status(200).json({ message: 'Đổi mật khẩu thành công' });

    } catch (err) {
        console.error('Reset password error:', err);
        return res.status(500).json({ error: err.message });
    }
};