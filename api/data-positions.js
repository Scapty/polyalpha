// Vercel serverless proxy for Polymarket Data API — open positions by user
export default async function handler(req, res) {
  const query = new URL(req.url, `http://${req.headers.host}`).search;
  const url = `https://data-api.polymarket.com/positions${query}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=15");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "Data API unreachable", message: err.message });
  }
}
