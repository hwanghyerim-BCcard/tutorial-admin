import Redis from 'ioredis';

export default async function handler(req, res) {
  // If REDIS_URL is provided, we can connect directly using ioredis, bypassing Vercel REST API setup entirely.
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL || process.env.UPSTASH_REDIS_REST_URL;

  if (!redisUrl) {
    const envKeys = Object.keys(process.env);
    return res.status(500).json({ 
        error: "Redis URL Not Found in process.env",
        foundKeys: envKeys.filter(k => k.includes('REDIS') || k.includes('KV') || k.includes('UPSTASH'))
    });
  }
  // Handle generic HTTP ping test
  if (req.method === 'GET' && !req.query.key) {
      return res.status(200).json({ status: "OK", url_found: !!redisUrl });
  }

  let redis;
  try {
      redis = new Redis(redisUrl, {
          connectTimeout: 5000,
          maxRetriesPerRequest: 1
      });
  } catch (e) {
      return res.status(500).json({ error: "Failed to initialize Redis client", details: e.message });
  }

  const { key } = req.query;
  if (!key) {
      redis.disconnect();
      return res.status(400).json({ error: "Missing key parameter" });
  }

  try {
      if (req.method === 'GET') {
          const data = await redis.get(key);
          const parsed = data ? JSON.parse(data) : [];
          redis.disconnect();
          return res.status(200).json(parsed);
      } else if (req.method === 'POST') {
          await redis.set(key, JSON.stringify(req.body));
          redis.disconnect();
          return res.status(200).json({ success: true });
      } else {
          redis.disconnect();
          return res.status(405).json({ error: 'Method not allowed' });
      }
  } catch (err) {
      redis.disconnect();
      console.error('Redis DB Error:', err);
      return res.status(500).json({ error: 'Database Internal Error', details: err.message });
  }
}
