const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function getApiKey() {
  return localStorage.getItem("polyalpha_api_key") || "";
}

export function setApiKey(key) {
  localStorage.setItem("polyalpha_api_key", key);
}

export function hasApiKey() {
  return !!getApiKey();
}

// --- Mock analysis (when no API key) ---

function generateMockAnalysis(market, yesPrice) {
  return {
    summary: `This market asks: "${market.question}". The current Polymarket price implies a ${yesPrice}% probability of YES. Without an API key, we cannot provide a real-time AI analysis with web search.`,
    factors: [
      "Market volume and liquidity levels suggest active interest from traders",
      "The current price reflects the consensus view of all Polymarket participants",
      "Historical patterns in similar markets may provide context for this probability",
    ],
    assessment: `The market is currently priced at ${yesPrice}%. To get a real AI assessment with web search for current news, set your Anthropic API key using the button in the header.`,
    citations: [],
    isDemo: true,
  };
}

// --- Real AI analysis with web search ---

export async function analyzeMarket(market, yesPrice, noPrice, volume, liquidity) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return generateMockAnalysis(market, yesPrice);
  }

  const totalVolume = market.volumeNum || market.volume || volume || 0;
  const vol24h = market.volume24hr || volume || 0;

  const prompt = `You are analyzing a Polymarket prediction market. Use the web search tool to look up recent information about this topic.

Market: "${market.question}"
Current YES price: ${yesPrice}¢ (implies ${yesPrice}% probability)
Current NO price: ${noPrice}¢
24h Volume: $${Number(vol24h).toLocaleString()}
Total Volume: $${Number(totalVolume).toLocaleString()}
Liquidity: $${Number(liquidity).toLocaleString()}

Instructions:
1. Search the web for recent news about this topic
2. Summarize what this market is about (1-2 sentences)
3. List 3 key factors that could affect the outcome
4. Assess whether the current ${yesPrice}% market price seems reasonable based on your research
5. Note any recent developments that could move the price

Format your response with these exact section headers:
**Summary:** (1-2 sentences about the market)
**Key Factors:**
- Factor 1
- Factor 2
- Factor 3
**Price Assessment:** (is ${yesPrice}% reasonable? Why or why not?)
**Recent Developments:** (anything from your web search)

IMPORTANT: Do NOT fabricate a probability estimate. Only reference information you found via web search or that you are confident about. If you lack information, say so honestly.`;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 3,
          },
        ],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    // Extract text content and citations from the response
    const textBlocks = [];
    const citations = [];

    for (const block of data.content || []) {
      if (block.type === "text") {
        textBlocks.push(block.text);
        // Extract citations from this text block
        if (block.citations) {
          for (const cite of block.citations) {
            if (cite.url && !citations.find((c) => c.url === cite.url)) {
              citations.push({
                url: cite.url,
                title: cite.title || cite.url,
              });
            }
          }
        }
      }
      // server_tool_use and web_search_tool_result blocks are handled by the API
    }

    const fullText = textBlocks.join("\n\n");

    // Parse sections from the response
    const summaryMatch = fullText.match(/\*\*Summary:\*\*\s*([\s\S]*?)(?=\*\*Key Factors:|$)/i);
    const factorsMatch = fullText.match(/\*\*Key Factors:\*\*\s*([\s\S]*?)(?=\*\*Price Assessment:|$)/i);
    const assessmentMatch = fullText.match(/\*\*Price Assessment:\*\*\s*([\s\S]*?)(?=\*\*Recent Developments:|$)/i);
    const developmentsMatch = fullText.match(/\*\*Recent Developments:\*\*\s*([\s\S]*?)$/i);

    const summary = summaryMatch ? summaryMatch[1].trim() : fullText.slice(0, 300);
    const factorsRaw = factorsMatch ? factorsMatch[1].trim() : "";
    const assessment = assessmentMatch
      ? assessmentMatch[1].trim()
      : developmentsMatch
        ? ""
        : fullText.slice(300);
    const developments = developmentsMatch ? developmentsMatch[1].trim() : "";

    // Parse factors into array
    const factors = factorsRaw
      .split(/\n/)
      .map((line) => line.replace(/^[-•*]\s*/, "").trim())
      .filter((line) => line.length > 5);

    return {
      summary,
      factors: factors.length > 0 ? factors : ["Analysis did not identify specific factors"],
      assessment: [assessment, developments].filter(Boolean).join("\n\n"),
      citations,
      fullText,
      isDemo: false,
    };
  } catch (err) {
    console.warn("Claude API failed, using mock analysis:", err.message);
    return generateMockAnalysis(market, yesPrice);
  }
}

// --- Report generation ---

export async function generateReport({ reportType, tone, markets, sections }) {
  const apiKey = getApiKey();

  const marketsText = markets
    .map((m) => {
      let prices;
      try {
        prices = JSON.parse(m.outcomePrices || '["0.5","0.5"]');
      } catch {
        prices = ["0.5", "0.5"];
      }
      const yp = (parseFloat(prices[0]) * 100).toFixed(0);
      const vol = m.volume24hr || m.volume || 0;
      return `- "${m.question}" | YES: ${yp}% | Volume: $${(vol / 1000).toFixed(0)}K`;
    })
    .join("\n");

  const sectionsText = sections.join(", ");

  const prompt = `You are an expert prediction market analyst writing for ${tone}.

Generate a "${reportType}" intelligence report based on this live Polymarket data:

ACTIVE MARKETS (real-time from Polymarket API):
${marketsText}

CONTEXT: There is growing evidence that AI-powered trading bots dominate Polymarket.
Research this topic using web search to include real, verifiable statistics.

SECTIONS TO INCLUDE: ${sectionsText}

Write the full report in markdown format. Use ## for section headers. Be analytical and insightful. Reference specific markets by name with their current probabilities. End with actionable takeaways.

Important:
- Use web search to verify any statistics you cite about bot trading on Polymarket
- Include a "Markets to Watch" section with 3 specific opportunities
- Add a methodology disclaimer at the end
- Total length: 800-1200 words
- Do NOT use any code fences or backticks to wrap the response — output pure markdown only`;

  if (!apiKey) {
    return { report: generateFallbackReport(reportType, tone, markets), isDemo: true };
  }

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 5,
          },
        ],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    // Extract text content from response (skip tool_use and tool_result blocks)
    const textParts = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text);

    let text = textParts.join("\n\n");
    text = text.replace(/^```(?:markdown)?\n?/gm, "").replace(/```$/gm, "").trim();
    return { report: text, isDemo: false };
  } catch (err) {
    console.warn("Report generation failed, using fallback:", err.message);
    return { report: generateFallbackReport(reportType, tone, markets), isDemo: true };
  }
}

function generateFallbackReport(reportType, tone, markets) {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const totalVol = markets.reduce((sum, m) => sum + (m.volume24hr || m.volume || 0), 0);

  const top3 = markets.slice(0, 3).map((m) => {
    let prices;
    try { prices = JSON.parse(m.outcomePrices || '["0.5","0.5"]'); } catch { prices = ["0.5", "0.5"]; }
    return { question: m.question, yes: (parseFloat(prices[0]) * 100).toFixed(0) };
  });

  return `## Dexio ${reportType}
### ${date}

> **Demo Report** — Generated without AI. Set your Anthropic API key for AI-powered reports with web search.

**Markets Analyzed:** ${markets.length} | **Total Volume (24h):** $${(totalVol / 1_000_000).toFixed(1)}M

---

## Top Markets

${top3.map((m) => `**${m.question}** — Currently at **${m.yes}% YES** on Polymarket.`).join("\n\n")}

## The Bot vs Human Question

A key research question in prediction markets is whether AI-powered trading bots consistently outperform human traders. Evidence suggests automated systems may have significant advantages in speed, consistency, and information processing.

## Markets to Watch

1. **${top3[0]?.question || "High-volume market"}** — At ${top3[0]?.yes || 50}%, worth monitoring for price movements
2. **${top3[1]?.question || "Trending market"}** — Active trading suggests evolving consensus
3. **${top3[2]?.question || "Emerging opportunity"}** — May present research opportunities

## Methodology

This demo report was generated by Dexio using real-time market data from the Polymarket Gamma API. For full AI-powered analysis with web search, configure your Anthropic API key.

*Not financial advice. For educational and informational purposes only.*`;
}
