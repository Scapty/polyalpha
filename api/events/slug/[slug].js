// Vercel serverless proxy for Polymarket Gamma API — /events/slug/{slug}
export default async function handler(req, res) {
  const { slug } = req.query;
  const url = `https://gamma-api.polymarket.com/events/slug/${encodeURIComponent(slug)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=15');
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Gamma API unreachable', message: err.message });
  }
}
