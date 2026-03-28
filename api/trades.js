// Vercel serverless proxy for Polymarket CLOB API (bypasses CORS)
export default async function handler(req, res) {
  const query = new URL(req.url, `http://${req.headers.host}`).search;
  const url = `https://clob.polymarket.com/trades${query}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'CLOB API unreachable', message: err.message });
  }
}
