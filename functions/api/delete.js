/**
 * DELETE /api/delete?linkId=xxx
 * Deletes a link and removes it from the creator's list.
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
        // Get link data to find creatorId
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
        const creatorId = linkData.creatorId;

        // Delete the link key
        await env.KV.delete(linkKey);

        // Remove linkId from creator's list
        if (creatorId) {
            const creatorKey = `creator:${creatorId}`;
            let listRaw = await env.KV.get(creatorKey);
            let list = [];
            if (listRaw) {
                try {
                    const parsed = JSON.parse(listRaw);
                    if (Array.isArray(parsed)) list = parsed;
                } catch (_) {}
            }
            list = list.filter(id => id !== linkId);
            await env.KV.put(creatorKey, JSON.stringify(list));
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Delete error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
