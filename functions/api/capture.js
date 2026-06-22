/**
 * POST /api/capture
 * Receives multipart/form-data with frontImage, backImage, linkId and metadata.
 * Uploads images to R2 using the native binding, stores URLs in KV.
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
        const formData = await request.formData();
        const linkId = formData.get('linkId');
        const frontFile = formData.get('frontImage');
        const backFile = formData.get('backImage');
        const metadataRaw = formData.get('metadata');

        if (!linkId) {
            return new Response(JSON.stringify({ error: 'Missing linkId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Retrieve existing link data
        const linkKey = `link:${linkId}`;
        const linkDataRaw = await env.KV.get(linkKey);
        if (!linkDataRaw) {
            return new Response(JSON.stringify({ error: 'Link not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        let linkData;
        try {
            linkData = JSON.parse(linkDataRaw);
        } catch {
            linkData = linkDataRaw;
        }

        let metadata = {};
        try {
            metadata = JSON.parse(metadataRaw);
        } catch (_) {}

        // Helper: upload a file to R2 and return a public URL
        async function uploadToR2(file, prefix) {
            if (!file) return null;

            const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
            const key = `captures/${linkId}/${fileName}`;

            // Convert File to ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);

            // Upload using the built‑in R2 binding
            await env.BUCKET.put(key, buffer, {
                httpMetadata: {
                    contentType: 'image/jpeg',
                    cacheControl: 'public, max-age=31536000',
                },
            });

            // Generate a public URL – bucket must be public, or use signed URL
            // For simplicity, we construct the URL (assuming bucket is public)
            // You can also use signed URLs: const signedUrl = await env.BUCKET.get(key).then(obj => obj?.getSignedUrl({ expiresIn: 86400 }));
            const publicUrl = `https://snaplink-images.${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
            return publicUrl;
        }

        // Upload both images concurrently
        const [frontUrl, backUrl] = await Promise.all([
            uploadToR2(frontFile, 'front'),
            uploadToR2(backFile, 'back'),
        ]);

        // Build capture object
        const capture = {
            timestamp: Date.now(),
            frontImageUrl: frontUrl,
            backImageUrl: backUrl,
            metadata,
        };

        // Enforce 4‑capture limit
        let captures = linkData.captures || [];
        if (captures.length >= 4) {
            captures.shift();
        }
        captures.push(capture);
        linkData.captures = captures;

        // Save back to KV
        await env.KV.put(linkKey, JSON.stringify(linkData));

        return new Response(JSON.stringify({
            success: true,
            captureCount: captures.length,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
