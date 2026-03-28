import { getMarketCategory } from "../../utils/api";

const CATEGORY_COLORS = {
  Crypto: "#f7931a",
  Politics: "#8b5cf6",
  Economics: "#3b82f6",
  Sports: "#00d4aa",
  "Pop Culture": "#ff4466",
  Tech: "#06b6d4",
  Science: "#a855f7",
  Other: "rgba(255,255,255,0.3)",
};

export default function MarketCategoryBreakdown({ trades }) {
  if (!trades || trades.length === 0) return null;

  // Count trades by category
  const counts = {};
  trades.forEach((t) => {
    const cat = getMarketCategory({ title: t.title || "" });
    counts[cat] = (counts[cat] || 0) + 1;
  });

  // Sort by count descending
  const categories = Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      pct: Math.round((count / trades.length) * 100),
      color: CATEGORY_COLORS[name] || CATEGORY_COLORS.Other,
    }))
    .sort((a, b) => b.count - a.count);

  const maxCount = categories[0]?.count || 1;
  const topCat = categories[0];

  // Generate insight
  let insight = "";
  if (topCat && topCat.pct >= 70) {
    insight = `This trader's activity is ${topCat.pct}% concentrated in ${topCat.name} markets \u2014 ${
      topCat.name === "Crypto"
        ? "typical of automated strategies targeting short-term price movements"
        : topCat.name === "Politics"
          ? "suggesting a specialist with deep domain knowledge"
          : "indicating a focused trading strategy"
    }`;
  } else if (topCat && topCat.pct >= 50) {
    insight = `Primarily focused on ${topCat.name} (${topCat.pct}%), with secondary activity in ${categories[1]?.name || "other"} markets`;
  } else {
    insight = `Diversified across ${categories.length} categories \u2014 no single category dominates, suggesting broad market interest`;
  }

  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 15,
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        Markets Traded by Category
      </h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
        Distribution across market types
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {categories.map((cat, i) => (
          <div
            key={cat.name}
            style={{
              animation: `fadeInUp 0.3s var(--ease-out) ${i * 50}ms both`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                {cat.name}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                {cat.count} ({cat.pct}%)
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: "rgba(255,255,255,0.06)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(cat.count / maxCount) * 100}%`,
                  height: "100%",
                  background: cat.color,
                  borderRadius: 3,
                  transition: "width 0.8s var(--ease-out)",
                  opacity: 0.85,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Insight */}
      <p
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          lineHeight: 1.6,
          marginTop: 16,
          padding: "10px 14px",
          background: "rgba(255,255,255,0.03)",
          borderRadius: "var(--radius-sm)",
          borderLeft: `3px solid ${topCat?.color || "var(--accent)"}`,
          margin: "16px 0 0",
        }}
      >
        {insight}
      </p>
    </div>
  );
}
