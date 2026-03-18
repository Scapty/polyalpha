const categories = ["All", "Crypto", "Politics", "Economics", "Tech", "Science", "Sports"];
const sortOptions = [
  { value: "volume", label: "Volume" },
  { value: "liquidity", label: "Liquidity" },
  { value: "recent", label: "Recent" },
];

export default function MarketFilters({ search, onSearch, category, onCategory, sort, onSort }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Search + Sort row */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <svg
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.3 }}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px 10px 40px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-body)",
              fontSize: 13.5,
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--border-medium)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border-subtle)")}
          />
        </div>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          style={{
            padding: "10px 14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            outline: "none",
            cursor: "pointer",
            minWidth: 130,
          }}
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ background: "var(--bg-surface)" }}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategory(cat)}
            style={{
              padding: "6px 16px",
              background: category === cat ? "var(--accent-dim)" : "transparent",
              border: `1px solid ${category === cat ? "rgba(0,212,170,0.2)" : "var(--border-subtle)"}`,
              borderRadius: 100,
              color: category === cat ? "var(--accent)" : "var(--text-muted)",
              fontSize: 12.5,
              fontFamily: "var(--font-body)",
              fontWeight: category === cat ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.2s var(--ease-out)",
            }}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
