// Cloudflare Pages Function - Đăng ký
export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { email, password, fullname } = await request.json();

        const response = await fetch(`${env.SUPABASE_URL}/auth/v1/signup`, {
            method: 'POST',
            headers: {
                'apikey': env.SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password,
                data: { full_name: fullname }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return new Response(JSON.stringify({ 
                error: data.msg || data.error_description || 'Đăng ký thất bại' 
            }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ 
            user: data.user ? { id: data.user.id, email: data.user.email } : null,
            message: 'Đăng ký thành công' 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
