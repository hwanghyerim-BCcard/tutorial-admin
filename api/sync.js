export default async function handler(req, res) {
  let url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  let token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  // Fallback: If only REDIS_URL is provided (e.g. rediss://default:PASSWORD@endpoint:port)
  if ((!url || !token) && process.env.REDIS_URL) {
    try {
      const redisUrl = new URL(process.env.REDIS_URL);
      // REST API for Upstash replaces rediss:// with https://
      url = `https://${redisUrl.host}`;
      token = redisUrl.password;
    } catch(e) {
      console.error("REDIS_URL parse error", e);
    }
  }

  if (!url || !token) {
    const envKeys = Object.keys(process.env);
    return res.status(500).json({ 
        error: "Vercel KV / Upstash Settings Missing.",
        foundKeys: envKeys.filter(k => k.includes('REDIS') || k.includes('KV') || k.includes('UPSTASH'))
    });
  }

  const key = req.query.key || 'workspace_components';

  if (req.method === 'GET') {
    try {
      const response = await fetch(`${url}/get/${key}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      let parsed = [];
      if (data.result) {
        try {
          if (typeof data.result === 'string') {
              parsed = JSON.parse(data.result);
          } else {
              parsed = data.result;
          }
        } catch (e) {
          console.error("JSON parse error:", e);
        }
      }
      return res.status(200).json(parsed);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      // Vercel serverless request limits check
      const bodyStr = JSON.stringify(req.body || []);
      const response = await fetch(`${url}/set/${key}`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`, 
          "Content-Type": "application/json" 
        },
        body: bodyStr
      });
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
