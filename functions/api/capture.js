/**
 * POST /api/capture
 * Receives multipart/form-data with frontImage, backImage, linkId and metadata.
 * Uploads images to R2, stores URLs in KV, and enforces a 4‑capture limit.
 */
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        // Parse multipart form data
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

        // Parse metadata
        let metadata = {};
        try {
            metadata = JSON.parse(metadataRaw);
        } catch (_) {}

        // Configure R2 client using environment bindings
        const s3 = new S3Client({
            region: 'auto',
            endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: env.R2_ACCESS_KEY_ID,
                secretAccessKey: env.R2_SECRET_ACCESS_KEY,
            },
        });

        // Helper: upload a file to R2 and return a public URL
        async function uploadToR2(file, prefix) {
            if (!file) return null;

            const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
            const key = `captures/${linkId}/${fileName}`;

            // Convert File to ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);

            // Upload to R2
            const command = new PutObjectCommand({
                Bucket: 'snaplink-images',
                Key: key,
                Body: buffer,
                ContentType: 'image/jpeg',
                CacheControl: 'public, max-age=31536000',
            });
            await s3.send(command);

            // Generate a presigned URL (valid for 1 year)
            const getCommand = new PutObjectCommand({
                Bucket: 'snaplink-images',
                Key: key,
            });
            // For public access, you can construct the URL directly if bucket is public
            // Alternatively, use a signed URL:
            // const url = await getSignedUrl(s3, getCommand, { expiresIn: 31536000 });
            // For simplicity, we'll use the public URL format (bucket must be public or via custom domain)
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

        // Enforce 4‑capture limit (remove oldest)
        let captures = linkData.captures || [];
        if (captures.length >= 4) {
            captures.shift();
        }
        captures.push(capture);
        linkData.captures = captures;

        // Save back to KV (preserve TTL)
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
