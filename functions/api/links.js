/**
 * GET /api/links?creatorId=xxx
 * Returns all links belonging to a creator, with up to 4 captures each.
 */
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const creatorId = url.searchParams.get('creatorId');

    if (!creatorId) {
        return new Response(JSON.stringify({ error: 'Missing creatorId' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        // Get the list of link IDs from the creator's key
        const creatorKey = `creator:${creatorId}`;
        const rawList = await env.KV.get(creatorKey);
        let linkIds = [];
        if (rawList) {
            try {
                const parsed = JSON.parse(rawList);
                if (Array.isArray(parsed)) linkIds = parsed;
            } catch (_) {}
        }

        if (linkIds.length === 0) {
            return new Response(JSON.stringify({ links: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const links = [];
        for (const id of linkIds) {
            const raw = await env.KV.get(`link:${id}`);
            if (raw) {
                let data;
                try {
                    data = JSON.parse(raw);
                } catch {
                    data = raw;
                }
                links.push({
                    linkId: id,
                    redirectUrl: data.redirectUrl,
                    createdAt: data.createdAt,
                    captures: data.captures ? data.captures.slice(0, 4) : [],
                });
            }
        }

        return new Response(JSON.stringify({ links }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Links error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
