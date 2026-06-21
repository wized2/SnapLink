import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  const { linkId } = req.query;
  if (!linkId) return res.status(400).json({ error: 'Missing linkId' });

  const raw = await redis.get(`link:${linkId}`);
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
