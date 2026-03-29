const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getTimestamp(trade) {
  if (trade.match_time) return new Date(trade.match_time).getTime();
  if (typeof trade.timestamp === "number") {
    return trade.timestamp > 1e12 ? trade.timestamp : trade.timestamp * 1000;
  }
  if (trade.created_at) return new Date(trade.created_at).getTime();
  return null;
}

function cellColor(count, maxCount) {
  if (count === 0) return "rgba(255,255,255,0.03)";
  const intensity = count / maxCount;
  const alpha = 0.15 + intensity * 0.85;
  return `rgba(45, 212, 168, ${alpha})`;
}

function formatHour(h) {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

export default function ActivityHeatmap({ trades }) {
  if (!trades || trades.length < 20) {
    return (
      <div
        style={{
          background: "var(--bg-deep)",
          border: "1px solid var(--border, rgba(255,255,255,0.06))",
          borderRadius: 0,
          padding: "20px 24px",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary, #F0F0F5)", marginBottom: 4, fontFamily: "var(--font-display, 'Space Grotesk')" }}>
          Activity Pattern
        </p>
        <p style={{ fontSize: 13, color: "var(--text-muted, #555568)", fontFamily: "var(--font-body, 'Inter')" }}>
          Not enough trades to generate activity pattern (need at least 20, have {trades?.length || 0})
        </p>
      </div>
    );
  }

  const matrix = Array.from({ length: 24 }, () => Array(7).fill(0));
  let totalMapped = 0;

  trades.forEach((trade) => {
    const ts = getTimestamp(trade);
    if (!ts) return;
    const d = new Date(ts);
    const hour = d.getUTCHours();
    const dayIdx = (d.getUTCDay() + 6) % 7;
    matrix[hour][dayIdx]++;
    totalMapped++;
  });

  const maxCount = Math.max(1, ...matrix.flat());
  const hourTotals = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const activeHours = hourTotals.filter((h) => h > 0).length;
  const peakHour = hourTotals.indexOf(Math.max(...hourTotals));

  let insight;
  if (activeHours >= 22) {
    insight = `Active ${activeHours}/24 hours including overnight, consistent with automated trading`;
  } else if (activeHours >= 16) {
    insight = `Active ${activeHours}/24 hours with brief quiet periods, could indicate automated or multi-timezone trading`;
  } else if (activeHours <= 10) {
    const startHour = hourTotals.findIndex((h) => h > 0);
    const endHour = 23 - [...hourTotals].reverse().findIndex((h) => h > 0);
    insight = `Activity concentrated between ${formatHour(startHour)} and ${formatHour(endHour)} UTC, consistent with human trading hours`;
  } else {
    insight = `Active ${activeHours}/24 hours with peak activity around ${formatHour(peakHour)} UTC`;
  }

  return (
    <div
      style={{
        background: "var(--bg-deep)",
        border: "1px solid var(--border, rgba(255,255,255,0.06))",
        borderRadius: 0,
        padding: "20px 24px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary, #F0F0F5)", margin: 0, fontFamily: "var(--font-display, 'Space Grotesk')" }}>
          Activity Pattern
        </h3>
        <span style={{ fontSize: 10, color: "var(--text-muted, #555568)", fontFamily: "var(--font-mono, 'JetBrains Mono')" }}>
          UTC · {activeHours}/24h active
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "28px repeat(7, 1fr)",
          gap: 2,
          maxWidth: 420,
        }}
      >
        <div />
        {DAYS.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: 10,
              fontFamily: "var(--font-mono, 'JetBrains Mono')",
              color: "var(--text-ghost, #333345)",
              paddingBottom: 4,
            }}
          >
            {d}
          </div>
        ))}

        {matrix.map((row, hour) => (
          <div key={hour} style={{ display: "contents" }}>
            <div
              style={{
                fontSize: 9,
                fontFamily: "var(--font-mono, 'JetBrains Mono')",
                color: "var(--text-ghost, #333345)",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 6,
              }}
            >
              {hour % 3 === 0 ? formatHour(hour) : ""}
            </div>
            {row.map((count, day) => (
              <div
                key={`${hour}-${day}`}
                title={`${DAYS[day]} ${String(hour).padStart(2, "0")}:00 UTC: ${count} trade${count !== 1 ? "s" : ""}`}
                style={{
                  aspectRatio: "1",
                  background: cellColor(count, maxCount),
                  borderRadius: 0,
                  minHeight: 12,
                  transition: "background 150ms ease",
                  cursor: "default",
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "var(--text-ghost, #333345)", fontFamily: "var(--font-mono, 'JetBrains Mono')" }}>
          <span>Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: 0,
                background: intensity === 0 ? "rgba(255,255,255,0.03)" : `rgba(45, 212, 168, ${0.15 + intensity * 0.85})`,
              }}
            />
          ))}
          <span>More</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted, #555568)", textAlign: "right", flex: 1, fontFamily: "var(--font-body, 'Inter')" }}>
          {insight}
        </div>
      </div>
    </div>
  );
}
