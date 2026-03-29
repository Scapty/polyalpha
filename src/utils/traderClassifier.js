/**
 * Trader Classifier — algo score + AI explanation
 *
 * classifyTrader(address, metrics) → { score, classification, confidence, factors, reasoning, strategy, keySignals }
 * fallbackClassification(metrics)  → same, no AI
 * clearClassificationCache(address)
 *
 * Classification is binary: "Bot" or "Human". No "Uncertain".
 * Score comes from the ALGO. AI only explains.
 * Cache: 24-hour localStorage.
 */

import { scoreWallet } from "./botScoring";
import { enrichWithAI } from "./aiAnalysis";

const CACHE_PREFIX = "polyalpha_trader_class_";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function getApiKey() {
  return localStorage.getItem("polyalpha_api_key") || "";
}

function getCached(address) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + address.toLowerCase());
    if (!raw) return null;
    const { result, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL_MS) return null;
    return result;
  } catch {
    return null;
  }
}

function setCache(address, result) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + address.toLowerCase(),
      JSON.stringify({ result, timestamp: Date.now() })
    );
  } catch {}
}

export function clearClassificationCache(address) {
  try {
    localStorage.removeItem(CACHE_PREFIX + address.toLowerCase());
  } catch {}
}

export function fallbackClassification(metrics) {
  if (!metrics || metrics.insufficient) {
    return {
      score: null,
      classification: "Insufficient Data",
      confidence: 0,
      reasoning: `Only ${metrics?.tradeCount || 0} trades found. Need at least 5.`,
      keySignals: [],
      strategy: null,
      factors: null,
      fromCache: false,
      usingFallback: true,
    };
  }

  const result = scoreWallet(metrics);
  return {
    score: result.score,
    classification: result.classification,
    confidence: result.classification === "Bot" ? 80 : 75,
    reasoning: "Add an Anthropic API key for AI-powered reasoning.",
    keySignals: [],
    strategy: "unknown",
    factors: result.factors,
    fromCache: false,
    usingFallback: true,
  };
}

export async function classifyTrader(address, metrics) {
  if (!metrics || metrics.insufficient) {
    return fallbackClassification(metrics);
  }

  const cached = getCached(address);
  if (cached) return { ...cached, fromCache: true };

  const apiKey = getApiKey();
  if (!apiKey) return fallbackClassification(metrics);

  const result = scoreWallet(metrics);
  const ai = await enrichWithAI(address, metrics, result).catch(() => null);

  const out = {
    score: result.score,
    classification: result.classification,
    confidence: result.classification === "Bot" ? 85 : 80,
    factors: result.factors,
    reasoning: ai?.reasoning ?? "Classification based on weighted factor analysis.",
    strategy: ai?.strategy ?? "unknown",
    keySignals: ai?.keySignals ?? [],
    fromCache: false,
    usingFallback: false,
  };
  setCache(address, out);
  return out;
}
