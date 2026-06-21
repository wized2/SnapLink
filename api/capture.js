import { kv } from '@vercel/kv';
import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const form = new formidable.IncomingForm();
    const { fields, files } = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
            if (err) reject(err);
            else resolve({ fields, files });
        });
    });

    const linkId = fields.linkId;
    if (!linkId) return res.status(400).json({ error: 'Missing linkId' });

    const linkKey = `link:${linkId}`;
    const linkDataRaw = await kv.get(linkKey);
    if (!linkDataRaw) return res.status(404).json({ error: 'Link not found' });
    const linkData = JSON.parse(linkDataRaw);

    async function uploadToImgBB(filePath) {
        const fileBuffer = fs.readFileSync(filePath);
        const base64 = fileBuffer.toString('base64');
        const apiKey = process.env.IMGBB_API_KEY;
        if (!apiKey) throw new Error('IMGBB_API_KEY not set');

        const formData = new FormData();
        formData.append('key', apiKey);
        formData.append('image', base64);
        formData.append('name', 'snaplink.jpg');

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error?.message || 'ImgBB upload failed');
        }
        return data.data.url;
    }

    try {
        const frontFile = files.frontImage;
        const backFile = files.backImage;
        const [frontUrl, backUrl] = await Promise.all([
            frontFile ? uploadToImgBB(frontFile.filepath) : null,
            backFile ? uploadToImgBB(backFile.filepath) : null,
        ]);

        let metadata = {};
        try { metadata = JSON.parse(fields.metadata); } catch (_) {}

        const capture = {
            timestamp: Date.now(),
            frontImageUrl: frontUrl || null,
            backImageUrl: backUrl || null,
            metadata,
        };

        let captures = linkData.captures || [];
        if (captures.length >= 4) {
            captures.shift();
        }
        captures.push(capture);
        linkData.captures = captures;

        await kv.set(linkKey, JSON.stringify(linkData));

        res.status(200).json({
            success: true,
            captureCount: captures.length,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
}
