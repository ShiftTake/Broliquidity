import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const OPTION_CHAIN_CACHE_TTL_MS = Math.max(5000, Number(process.env.OPTION_CHAIN_CACHE_TTL_MS || 20000));
const OPTION_CHAIN_STALE_TTL_MS = Math.max(OPTION_CHAIN_CACHE_TTL_MS, Number(process.env.OPTION_CHAIN_STALE_TTL_MS || 120000));
const OPTION_CHAIN_MAX_CACHE_ENTRIES = Math.max(20, Number(process.env.OPTION_CHAIN_MAX_CACHE_ENTRIES || 200));
const optionChainCache = new Map();

const getCacheKey = (symbol, dateValue) => `${symbol}::${dateValue || "latest"}`;

const toEpochSeconds = (value) => {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 9999999999 ? Math.floor(numeric / 1000) : Math.floor(numeric);
  }

  const parsedMs = Date.parse(String(value));
  if (Number.isFinite(parsedMs) && parsedMs > 0) {
    return Math.floor(parsedMs / 1000);
  }

  return null;
};

const pruneCache = (nowMs) => {
  for (const [key, entry] of optionChainCache.entries()) {
    if (!entry || entry.staleAt <= nowMs) {
      optionChainCache.delete(key);
    }
  }
  if (optionChainCache.size <= OPTION_CHAIN_MAX_CACHE_ENTRIES) return;
  for (const [key] of optionChainCache.entries()) {
    optionChainCache.delete(key);
    if (optionChainCache.size <= OPTION_CHAIN_MAX_CACHE_ENTRIES) break;
  }
};

const normalizeOptionChainPayload = (result, normalizedSymbol) => {
  const optionSet = result?.options?.[0] || { calls: [], puts: [] };
  const expirationDates = (result?.expirationDates || [])
    .map((value) => toEpochSeconds(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  const normalizeContracts = (contracts) => (contracts || []).map((contract) => {
    const expiration = toEpochSeconds(contract?.expiration ?? contract?.expirationDate);
    return {
      ...contract,
      expiration: expiration || contract?.expiration || null
    };
  });

  return {
    expirationDates,
    underlyingSymbol: result?.quote?.symbol || normalizedSymbol,
    quote: result?.quote || null,
    calls: normalizeContracts(optionSet.calls),
    puts: normalizeContracts(optionSet.puts)
  };
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { symbol, date } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol" });
  }

  const normalizedSymbol = String(symbol).toUpperCase();
  const normalizedDate = date ? String(date) : "";
  const cacheKey = getCacheKey(normalizedSymbol, normalizedDate);
  const nowMs = Date.now();
  const cached = optionChainCache.get(cacheKey);

  if (cached && cached.expiresAt > nowMs) {
    return res.status(200).json(cached.payload);
  }

  try {
    const options = {};
    if (normalizedDate) {
      const parsedDate = toEpochSeconds(normalizedDate);
      if (!Number.isFinite(parsedDate) || parsedDate <= 0) {
        return res.status(400).json({ error: "Invalid date" });
      }
      options.date = parsedDate;
    }

    const result = await yahooFinance.options(normalizedSymbol, options);
    const payload = normalizeOptionChainPayload(result, normalizedSymbol);
    optionChainCache.set(cacheKey, {
      payload,
      expiresAt: nowMs + OPTION_CHAIN_CACHE_TTL_MS,
      staleAt: nowMs + OPTION_CHAIN_STALE_TTL_MS
    });
    pruneCache(nowMs);

    return res.status(200).json(payload);
  } catch (error) {
    if (cached && cached.staleAt > nowMs) {
      return res.status(200).json(cached.payload);
    }
    return res.status(502).json({
      error: "Failed to fetch option chain",
      details: error?.message || "Unknown error"
    });
  }
}
