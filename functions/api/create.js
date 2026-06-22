/**
 * POST /api/create
 * Creates a new link with a 6‑character ID and stores it in KV.
 * Links automatically expire after 15 days (1296000 seconds).
 */
export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = await request.json();
        const { redirectUrl, creatorId, creatorEmail } = body;

        if (!redirectUrl || !creatorId) {
            return new Response(JSON.stringify({ error: 'Missing redirectUrl or creatorId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const linkId = generateId();
        const linkData = {
            redirectUrl,
            creatorId,
            creatorEmail: creatorEmail || '',
            createdAt: Date.now(),
            captures: [],
        };

        // Store with 15‑day TTL (1296000 seconds)
        await env.KV.put(`link:${linkId}`, JSON.stringify(linkData), {
            expirationTtl: 60 * 60 * 24 * 15,
        });

        // Add link ID to creator's set
        await env.KV.sadd(`creator:${creatorId}`, linkId);

        return new Response(JSON.stringify({ linkId }), {
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

function generateId() {
    const chars = 'abcdefghijkmnopqrstuvwxyz23456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}
