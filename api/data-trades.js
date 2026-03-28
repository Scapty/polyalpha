// Vercel serverless proxy for Polymarket Data API — trades by user
export default async function handler(req, res) {
  const query = new URL(req.url, `http://${req.headers.host}`).search;
  const url = `https://data-api.polymarket.com/trades${query}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=60");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "Data API unreachable", message: err.message });
  }
}
