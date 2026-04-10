export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN;

  if (!url || !token) {
    const keys = Object.keys(process.env).filter(k => k.includes('REST_API'));
    return res.status(500).json({ 
        error: "Vercel KV Settings Missing. Please connect Vercel KV in the Storage tab.",
        foundKeys: keys
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
          // Vercel KV REST stores HTTP POST bodies as literal strings. 
          // If we pass an array, it gets stringified.
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
      // The body comes mathematically parsed from Vercel Serverless
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

  res.status(405).json({ error: "Method not allowed" });
}
