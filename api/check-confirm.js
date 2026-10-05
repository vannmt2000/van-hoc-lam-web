const FALLBACK_URL = 'https://pffbnfysvhiumzhfvnos.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZmJuZnlzdmhpdW16aGZ2bm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNTMxODYsImV4cCI6MjEwNjcyOTE4Nn0.qQpHpeXW4xnGdLxLIwDhBIabYipSwqAxAhtvRPDiGMs';

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const email = req.query.email;
        if (!email) {
            return res.status(400).json({ error: 'Missing email' });
        }

        const supabaseUrl = process.env.SUPABASE_URL || FALLBACK_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY || FALLBACK_KEY;

        // Thử login bằng password giả để check xem email đã confirm chưa
        const testRes = await fetch(
            supabaseUrl + '/auth/v1/token?grant_type=password',
            {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: 'check_confirm_' + Date.now() + '_dummy'
                })
            }
        );

        const testData = await testRes.json();
        const errorCode = (testData.error_code || '').toLowerCase();

        // Logic:
        // - error_code = "email_not_confirmed" → CHƯA confirm
        // - error_code = "invalid_credentials" → ĐÃ confirm (chỉ sai password)
        const confirmed = errorCode === 'invalid_credentials' || 
                          (testData.error === 'invalid_grant' && !errorCode.includes('not_confirmed'));

        return res.status(200).json({ confirmed: confirmed });

    } catch (err) {
        console.error('Check confirm error:', err);
        return res.status(500).json({ error: err.message });
    }
};