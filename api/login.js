module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, password } = req.body;

        const response = await fetch(
            process.env.SUPABASE_URL + '/auth/v1/token?grant_type=password',
            {
                method: 'POST',
                headers: {
                    'apikey': process.env.SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            }
        );

        const data = await response.json();

        // Log để debug (xem CMD khi test)
        console.log('Supabase response:', JSON.stringify(data, null, 2));

        if (!response.ok) {
            // Xử lý đặc biệt cho case email chưa confirm
            const errCode = data.error_code || data.code || '';
            const errMsg = data.error_description || data.msg || data.error || 'Invalid login credentials';

            return res.status(response.status).json({
                error: errMsg,
                error_code: errCode
            });
        }

        return res.status(200).json({
            access_token: data.access_token,
            user: { id: data.user.id, email: data.user.email }
        });

    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: err.message });
    }
};
