export default async function handler(req, res) {
  const BIN_COMPONENTS = '019d75bb-de6f-7687-ac4c-b247e499d4a6';
  const BIN_TRASH = '019d75bc-d674-7946-be6d-41f9ea74369f';
  const API_BASE = 'https://jsonblob.com/api/jsonBlob/';

  const key = req.query.key || 'workspace_components';
  const targetBin = key === 'workspace_trash' ? BIN_TRASH : BIN_COMPONENTS;

  if (req.method === 'GET') {
    try {
      const response = await fetch(API_BASE + targetBin, {
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
      });
      const data = await response.json();
      return res.status(200).json(data);
    } catch(err) {
      return res.status(500).json({ error: err.message, fallback: [] });
    }
  }

  if (req.method === 'POST') {
    try {
      const response = await fetch(API_BASE + targetBin, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(req.body || [])
      });
      const data = await response.json();
      return res.status(200).json(data);
    } catch(err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
