// Vercel serverless proxy for Polymarket Data API leaderboard (bypasses CORS)
export default async function handler(req, res) {
  const query = new URL(req.url, `http://${req.headers.host}`).search;
  const url = `https://data-api.polymarket.com/v1/leaderboard${query}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=120');
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Data API unreachable', message: err.message });
  }
}
