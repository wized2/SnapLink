import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_KV_REST_API_URL,
  token: process.env.UPSTASH_KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { redirectUrl, creatorId, creatorEmail } = req.body;
  if (!redirectUrl || !creatorId) {
    return res.status(400).json({ error: 'Missing redirectUrl or creatorId' });
  }
  const linkId = generateId();
  const linkData = {
    redirectUrl,
    creatorId,
    creatorEmail: creatorEmail || '',
    createdAt: Date.now(),
    captures: [],
  };
  await redis.set(`link:${linkId}`, JSON.stringify(linkData));
  await redis.sadd(`creator:${creatorId}`, linkId);
  res.status(200).json({ linkId });
}

function generateId() {
  const chars = 'abcdefghijkmnopqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}
