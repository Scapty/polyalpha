import { getMarketCategory } from "../../utils/api";

export default function MarketCategoryBreakdown({ trades }) {
  if (!trades || trades.length === 0) return null;

  const counts = {};
  trades.forEach((t) => {
    const cat = getMarketCategory({ title: t.title || "" });
    counts[cat] = (counts[cat] || 0) + 1;
  });

  const categories = Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      pct: Math.round((count / trades.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const maxCount = categories[0]?.count || 1;
  const topCat = categories[0];

  let insight = "";
  if (topCat && topCat.pct >= 70) {
    insight = `${topCat.pct}% concentrated in ${topCat.name} markets${
      topCat.name === "Crypto"
        ? " — typical of automated strategies targeting short-term price movements"
        : topCat.name === "Politics"
          ? " — suggesting a specialist with deep domain knowledge"
          : " — indicating a focused trading strategy"
    }`;
  } else if (topCat && topCat.pct >= 50) {
    insight = `Primarily focused on ${topCat.name} (${topCat.pct}%), with secondary activity in ${categories[1]?.name || "other"} markets`;
  } else {
    insight = `Diversified across ${categories.length} categories — no single category dominates`;
  }

  return (
    <div
      style={{
        background: "var(--bg-deep)",
        border: "1px solid var(--border)",
        borderRadius: 0,
        padding: 24,
      }}
    >
      <h3 style={{ fontSize: 16, fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
        Markets Traded by Category
      </h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
        Distribution across market types
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {categories.map((cat, i) => {
          const barOpacity = 0.4 + (cat.count / maxCount) * 0.6;
          return (
            <div key={cat.name}>
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
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
                  {cat.count} ({cat.pct}%)
                </span>
              </div>
              <div
                style={{
                  height: 4,
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 0,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(cat.count / maxCount) * 100}%`,
                    height: "100%",
                    background: `rgba(45, 212, 168, ${barOpacity})`,
                    borderRadius: 0,
                    transition: "width 0.6s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          lineHeight: 1.6,
          marginTop: 16,
          padding: "10px 14px",
          background: "var(--bg-elevated)",
          borderRadius: 0,
          borderLeft: "3px solid var(--accent)",
        }}
      >
        {insight}
      </p>
    </div>
  );
}
