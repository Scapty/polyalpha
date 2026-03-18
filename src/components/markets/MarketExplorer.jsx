import { useState, useEffect } from "react";
import { fetchMarkets, getMarketCategory } from "../../utils/api";
import MarketCard from "./MarketCard";
import MarketFilters from "./MarketFilters";
import LoadingSkeleton from "../shared/LoadingSkeleton";
import DataBadge from "../shared/DataBadge";

export default function MarketExplorer({ onAnalyze, setIsLive, setMarkets: setParentMarkets }) {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localIsLive, setLocalIsLive] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("volume");

  useEffect(() => {
    loadMarkets();
  }, []);

  async function loadMarkets() {
    setLoading(true);
    const { markets: data, isLive } = await fetchMarkets();
    setMarkets(data);
    setIsLive(isLive);
    setLocalIsLive(isLive);
    setParentMarkets(data);
    setLoading(false);
  }

  const filtered = markets
    .filter((m) => {
      if (search && !m.question?.toLowerCase().includes(search.toLowerCase())) return false;
      if (category !== "All" && getMarketCategory(m) !== category) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "volume") return (b.volume24hr || b.volume || 0) - (a.volume24hr || a.volume || 0);
      if (sort === "liquidity") return (b.liquidity || 0) - (a.liquidity || 0);
      if (sort === "recent") return new Date(b.endDate || 0) - new Date(a.endDate || 0);
      return 0;
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Live Markets
          </h1>
          {!loading && <DataBadge status={localIsLive ? "live" : "demo"} />}
        </div>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          {loading ? "Loading..." : `${filtered.length} active markets from ${localIsLive ? "Polymarket API" : "demo data"}`}
        </p>
      </div>

      <MarketFilters
        search={search}
        onSearch={setSearch}
        category={category}
        onCategory={setCategory}
        sort={sort}
        onSort={setSort}
      />

      {loading ? (
        <LoadingSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <p style={{ fontSize: 14 }}>No markets found matching your filters.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
          {filtered.map((market, i) => (
            <MarketCard key={market.id || market.slug || i} market={market} index={i} onAnalyze={onAnalyze} />
          ))}
        </div>
      )}
    </div>
  );
}
