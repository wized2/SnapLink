/**
 * POST /api/capture
 * Receives multipart/form-data with frontImage, backImage, linkId and metadata.
 * Uploads images to ImgBB (free), stores URLs in KV.
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

        // Helper: upload a file to ImgBB and return URL
        async function uploadToImgBB(file) {
            if (!file) return null;

            // Convert File to base64
            const arrayBuffer = await file.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

            const apiKey = env.IMGBB_API_KEY;
            if (!apiKey) {
                throw new Error('IMGBB_API_KEY environment variable is not set.');
            }

            const imgbbForm = new FormData();
            imgbbForm.append('key', apiKey);
            imgbbForm.append('image', base64);
            imgbbForm.append('name', 'snaplink.jpg');

            const response = await fetch('https://api.imgbb.com/1/upload', {
                method: 'POST',
                body: imgbbForm,
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error?.message || 'ImgBB upload failed');
            }
            return data.data.url; // direct public URL
        }

        // Upload both images concurrently
        const [frontUrl, backUrl] = await Promise.all([
            uploadToImgBB(frontFile),
            uploadToImgBB(backFile),
        ]);

        // Build capture object
        const capture = {
            timestamp: Date.now(),
            frontImageUrl: frontUrl,
            backImageUrl: backUrl,
            metadata,
        };

        // Enforce 4‑capture limit (remove oldest)
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
