// Vercel serverless proxy for Kalshi API (bypasses CORS)
export default async function handler(req, res) {
  const query = new URL(req.url, `http://${req.headers.host}`).search;
  const url = `https://api.elections.kalshi.com/trade-api/v2${query ? '' : '/events'}${query}`;

  // Route based on path after /api/kalshi
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  let targetUrl;

  if (pathname.includes('/api/kalshi/markets')) {
    const params = new URL(req.url, `http://${req.headers.host}`).search;
    targetUrl = `https://api.elections.kalshi.com/trade-api/v2/markets${params}`;
  } else {
    const params = new URL(req.url, `http://${req.headers.host}`).search;
    targetUrl = `https://api.elections.kalshi.com/trade-api/v2/events${params}`;
  }

  try {
    const response = await fetch(targetUrl);
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Kalshi API unreachable', message: err.message });
  }
}
