/**
 * DELETE /api/clear-captures?linkId=xxx
 * Clears all captures for a link (sets captures array to empty).
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
        const linkKey = `link:${linkId}`;
        const linkRaw = await env.KV.get(linkKey);
        if (!linkRaw) {
            return new Response(JSON.stringify({ error: 'Link not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        let linkData;
        try { linkData = JSON.parse(linkRaw); } catch { linkData = linkRaw; }
        linkData.captures = [];

        await env.KV.put(linkKey, JSON.stringify(linkData));

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Clear captures error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
