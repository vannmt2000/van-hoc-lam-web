module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, password, fullname } = req.body;

        const response = await fetch(
            process.env.SUPABASE_URL + '/auth/v1/signup',
            {
                method: 'POST',
                headers: {
                    'apikey': process.env.SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    data: { full_name: fullname }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ 
                error: data.msg || data.error_description || 'Đăng ký thất bại' 
            });
        }

        return res.status(200).json({ 
            user: data.user ? { id: data.user.id, email: data.user.email } : null,
            message: 'Đăng ký thành công' 
        });

    } catch (err) {
        console.error('Signup error:', err);
        return res.status(500).json({ error: err.message });
    }
};
