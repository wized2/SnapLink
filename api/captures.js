import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    const { linkId } = req.query;
    if (!linkId) return res.status(400).json({ error: 'Missing linkId' });

    const raw = await kv.get(`link:${linkId}`);
    if (!raw) {
        return res.status(200).json({ linkExists: false });
    }
    const data = JSON.parse(raw);
    res.status(200).json({
        linkExists: true,
        redirectUrl: data.redirectUrl,
        capturesCount: data.captures.length,
    });
}
