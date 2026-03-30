// Vercel serverless proxy for Kalshi Markets API (bypasses CORS)
export default async function handler(req, res) {
  const query = new URL(req.url, `http://${req.headers.host}`).search;
<<<<<<< Updated upstream
    const targetUrl = `https://api.elections.kalshi.com/trade-api/v2/markets${query}`;

      try {
          const response = await fetch(targetUrl);
              const data = await response.json();
                  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
                      res.status(response.status).json(data);
                        } catch (err) {
                            res.status(502).json({ error: 'Kalshi API unreachable', message: err.message });
                              }
                              }
=======
  const targetUrl = `https://trading-api.kalshi.com/trade-api/v2/markets${query}`;

  try {
    const response = await fetch(targetUrl);
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Kalshi API unreachable', message: err.message });
  }
}
>>>>>>> Stashed changes
