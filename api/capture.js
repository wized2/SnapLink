import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  const { creatorId } = req.query;
  if (!creatorId) return res.status(400).json({ error: 'Missing creatorId' });

  const linkIds = await redis.smembers(`creator:${creatorId}`);
  if (!linkIds || linkIds.length === 0) {
    return res.status(200).json({ links: [] });
  }

  const links = [];
  for (const id of linkIds) {
    const raw = await redis.get(`link:${id}`);
    if (raw) {
      const data = JSON.parse(raw);
      links.push({
        linkId: id,
        redirectUrl: data.redirectUrl,
        createdAt: data.createdAt,
        captures: data.captures.slice(0, 4),
      });
    }
  }
  res.status(200).json({ links });
}
