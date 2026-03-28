// Vercel serverless proxy for Polymarket Gamma API (bypasses CORS)
export default async function handler(req, res) {
  const query = new URL(req.url, `http://${req.headers.host}`).search;
  const url = `https://gamma-api.polymarket.com/markets${query}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=60');
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Gamma API unreachable', message: err.message });
  }
}
