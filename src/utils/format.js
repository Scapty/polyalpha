export function formatUSD(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatVolume(value) {
  if (!value) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatPct(value) {
  return `${Number(value).toFixed(1)}%`;
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatCents(decimal) {
  return `${Math.round(decimal * 100)}¢`;
}

export function parseOutcomePrices(market) {
  try {
    const prices = JSON.parse(market.outcomePrices || '["0.5","0.5"]');
    return {
      yes: parseFloat(prices[0]),
      no: parseFloat(prices[1]),
    };
  } catch {
    return { yes: 0.5, no: 0.5 };
  }
}
