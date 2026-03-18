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
  const alpha = 0.12 + intensity * 0.88;
  return `rgba(139, 92, 246, ${alpha})`;
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
      <div className="glass-card" style={{ padding: 24, textAlign: "center" }}>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 15,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Trading Activity Pattern
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Not enough trades to generate activity pattern (need at least 20, have {trades?.length || 0})
        </p>
      </div>
    );
  }

  // Build 24x7 matrix
  const matrix = Array.from({ length: 24 }, () => Array(7).fill(0));
  let totalMapped = 0;

  trades.forEach((trade) => {
    const ts = getTimestamp(trade);
    if (!ts) return;
    const d = new Date(ts);
    const hour = d.getUTCHours();
    const dayIdx = (d.getUTCDay() + 6) % 7; // Mon=0, Sun=6
    matrix[hour][dayIdx]++;
    totalMapped++;
  });

  const maxCount = Math.max(1, ...matrix.flat());

  // Compute activity stats for insight
  const hourTotals = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const activeHours = hourTotals.filter((h) => h > 0).length;

  // Find peak hours
  const peakHour = hourTotals.indexOf(Math.max(...hourTotals));

  // Find quiet hours (consecutive zero-trade hours)
  const quietStart = hourTotals.findIndex((h, i) => {
    if (h > 0) return false;
    // check if it's part of a quiet block
    let count = 0;
    for (let j = 0; j < 4 && hourTotals[(i + j) % 24] === 0; j++) count++;
    return count >= 3;
  });

  // Generate insight
  let insight;
  if (activeHours >= 22) {
    insight = `This trader is active ${activeHours}/24 hours, including overnight \u2014 consistent with automated trading`;
  } else if (activeHours >= 16) {
    insight = `Active ${activeHours}/24 hours with brief quiet periods \u2014 could indicate automated trading or a multi-timezone operation`;
  } else if (activeHours <= 10) {
    const startHour = hourTotals.findIndex((h) => h > 0);
    const endHour = 23 - [...hourTotals].reverse().findIndex((h) => h > 0);
    insight = `Activity concentrated between ${formatHour(startHour)} \u2013 ${formatHour(endHour)} UTC \u2014 consistent with human trading hours`;
  } else {
    insight = `Active ${activeHours}/24 hours with peak activity around ${formatHour(peakHour)} UTC`;
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
        Trading Activity Pattern
      </h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
        Trade frequency by hour of day (UTC) and day of week
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "36px repeat(7, 1fr)",
          gap: 2,
          maxWidth: 500,
        }}
      >
        {/* Header row */}
        <div />
        {DAYS.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: "var(--text-muted)",
              paddingBottom: 4,
            }}
          >
            {d}
          </div>
        ))}

        {/* Data rows */}
        {matrix.map((row, hour) => (
          <div key={hour} style={{ display: "contents" }}>
            <div
              style={{
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
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
                title={`${DAYS[day]} ${String(hour).padStart(2, "0")}:00 UTC \u2014 ${count} trade${count !== 1 ? "s" : ""}`}
                style={{
                  aspectRatio: "1",
                  background: cellColor(count, maxCount),
                  borderRadius: 2,
                  minHeight: 14,
                  transition: "background 0.3s",
                  cursor: "default",
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginTop: 12,
          fontSize: 10,
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <span>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
          <div
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              background:
                intensity === 0
                  ? "rgba(255,255,255,0.03)"
                  : `rgba(139, 92, 246, ${0.12 + intensity * 0.88})`,
            }}
          />
        ))}
        <span>More</span>
      </div>

      {/* Insight */}
      <p
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          lineHeight: 1.6,
          marginTop: 12,
          padding: "10px 14px",
          background: "rgba(255,255,255,0.03)",
          borderRadius: "var(--radius-sm)",
          borderLeft: "3px solid #8b5cf6",
        }}
      >
        {insight}
      </p>
    </div>
  );
}
