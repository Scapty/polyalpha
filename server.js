import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST = join(__dirname, "dist");
const PORT = 5175;

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const PROXY_RULES = [
  { prefix: "/api/markets", target: "https://gamma-api.polymarket.com", rewrite: "/markets" },
  { prefix: "/api/data-trades", target: "https://data-api.polymarket.com", rewrite: "/trades" },
  { prefix: "/api/data-activity", target: "https://data-api.polymarket.com", rewrite: "/activity" },
  { prefix: "/api/leaderboard", target: "https://data-api.polymarket.com", rewrite: "/v1/leaderboard" },
];

async function proxyRequest(rule, req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const newPath = req.url.replace(rule.prefix, rule.rewrite);
  const targetUrl = `${rule.target}${newPath}`;

  try {
    const resp = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "User-Agent": "PolyAlpha/1.0",
        Accept: "application/json",
      },
    });

    res.writeHead(resp.status, {
      "Content-Type": resp.headers.get("content-type") || "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    const body = await resp.arrayBuffer();
    res.end(Buffer.from(body));
  } catch (err) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Proxy error", message: err.message }));
  }
}

async function serveStatic(req, res) {
  let pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;
  if (pathname === "/") pathname = "/index.html";

  const filePath = join(DIST, pathname);

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isFile()) {
      const data = await readFile(filePath);
      const ext = extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
      return;
    }
  } catch {}

  // SPA fallback — serve index.html for any non-file route
  try {
    const html = await readFile(join(DIST, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  } catch {
    res.writeHead(404);
    res.end("Not found — run `npm run build` first");
  }
}

const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" });
    res.end();
    return;
  }

  // Check proxy rules
  for (const rule of PROXY_RULES) {
    if (req.url.startsWith(rule.prefix)) {
      return proxyRequest(rule, req, res);
    }
  }

  // Serve static files
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`PolyAlpha server ready at http://localhost:${PORT}`);
});
