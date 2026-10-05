// Netlify Function - code này KHÔNG BAO GIỜ hiện trên browser
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    // Chỉ cho phép POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    try {
        const { email, password } = JSON.parse(event.body);

        // ⚠️ Đọc từ Environment Variables (bí mật, không lộ ra ngoài)
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY  // Có thể dùng service_role vì code này ở server
        );

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: error.message })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                user: { id: data.user.id, email: data.user.email },
                access_token: data.session.access_token
            })
        };

    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
