export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { symbol, resolution, from, to } = req.query;
  if (!symbol || !from || !to) {
    return res.status(400).json({ error: "Missing candle params" });
  }

  const fromTs = Number(from);
  const toTs = Number(to);
  if (!Number.isFinite(fromTs) || !Number.isFinite(toTs)) {
    return res.status(400).json({ error: "Invalid from/to timestamp" });
  }
  if (fromTs <= 0 || toTs <= 0 || fromTs >= toTs) {
    return res.status(400).json({ error: "Invalid candle range" });
  }
  if ((toTs - fromTs) > 60 * 60 * 24 * 366 * 5) {
    return res.status(400).json({ error: "Requested range is too large" });
  }

  const noDataPayload = { s: "no_data", t: [], c: [], o: [], h: [], l: [], v: [] };

  const baseUrl =
    process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL ||
    "https://us-central1-broliquidity.cloudfunctions.net";

  const intervalByResolution = {
    "1": "1m",
    "5": "5m",
    "15": "15m",
    "30": "30m",
    "60": "60m",
    D: "1d",
    W: "1wk"
  };

  const cryptoSymbols = new Set(["BTC", "ETH", "SOL", "XRP", "DOGE", "BNB", "ADA", "LTC"]);

  const getYahooCandles = async () => {
    const interval = intervalByResolution[String(resolution || "D")] || "1d";
    const normalizedSymbol = String(symbol || "").toUpperCase();
    const yahooSymbol = cryptoSymbols.has(normalizedSymbol) ? `${normalizedSymbol}-USD` : normalizedSymbol;
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${encodeURIComponent(interval)}&period1=${encodeURIComponent(from)}&period2=${encodeURIComponent(to)}`;
    const yahooResponse = await fetch(yahooUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!yahooResponse.ok) {
      const text = await yahooResponse.text();
      throw new Error(`Yahoo candle request failed: ${text.slice(0, 140)}`);
    }

    const yahooData = await yahooResponse.json();
    const result = yahooData?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0] || {};
    const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];

    if (!timestamps.length) {
      return { s: "no_data", t: [], c: [], o: [], h: [], l: [], v: [] };
    }

    return {
      s: "ok",
      t: timestamps,
      c: Array.isArray(quote.close) ? quote.close : [],
      o: Array.isArray(quote.open) ? quote.open : [],
      h: Array.isArray(quote.high) ? quote.high : [],
      l: Array.isArray(quote.low) ? quote.low : [],
      v: Array.isArray(quote.volume) ? quote.volume : []
    };
  };

  try {
    const response = await fetch(
      `${baseUrl}/getCandles?symbol=${encodeURIComponent(symbol)}&resolution=${encodeURIComponent(resolution || "D")}&from=${encodeURIComponent(fromTs)}&to=${encodeURIComponent(toTs)}`
    );

    if (response.ok) {
      const data = await response.json();
      if (data?.s === "ok" && Array.isArray(data?.t) && data.t.length) {
        return res.status(200).json(data);
      }
    }

    const fallbackData = await getYahooCandles();
    return res.status(200).json(fallbackData);
  } catch (error) {
    try {
      const fallbackData = await getYahooCandles();
      return res.status(200).json(fallbackData);
    } catch (fallbackError) {
      return res.status(200).json({
        ...noDataPayload,
        error: "Failed to fetch candles",
        details: fallbackError?.message || error?.message || "Unknown error"
      });
    }
  }
}
