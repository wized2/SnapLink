/**
 * GET /api/captures?linkId=xxx
 * Returns link existence, redirect URL, and current capture count.
 */
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const linkId = url.searchParams.get('linkId');

    if (!linkId) {
        return new Response(JSON.stringify({ error: 'Missing linkId' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const raw = await env.KV.get(`link:${linkId}`);
        if (!raw) {
            return new Response(JSON.stringify({ linkExists: false }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let data;
        try {
            data = JSON.parse(raw);
        } catch {
            data = raw;
        }

        return new Response(JSON.stringify({
            linkExists: true,
            redirectUrl: data.redirectUrl,
            capturesCount: data.captures ? data.captures.length : 0,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
