import { db, auth } from "./firebase";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  runTransaction,
  where,
  serverTimestamp,
  setDoc
} from "firebase/firestore";

export const STARTING_PAPER_CASH = 100000;

const ACCOUNT_COLLECTION = "paperMeta";
const ACCOUNT_DOC = "account";
const PREFERENCES_DOC = "preferences";
const ORDERS_COLLECTION = "paperOrders";

function addBusinessDays(startDate, businessDays) {
  const next = new Date(startDate);
  let remaining = businessDays;
  while (remaining > 0) {
    next.setDate(next.getDate() + 1);
    const day = next.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return next;
}

function getAccountRef(uid) {
  return doc(db, "users", uid, ACCOUNT_COLLECTION, ACCOUNT_DOC);
}

function getPreferencesRef(uid) {
  return doc(db, "users", uid, ACCOUNT_COLLECTION, PREFERENCES_DOC);
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseExpirationDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    const millis = numeric > 9999999999 ? numeric : numeric * 1000;
    const fromNumeric = new Date(millis);
    return Number.isNaN(fromNumeric.getTime()) ? null : fromNumeric;
  }

  const parsedMillis = Date.parse(String(value));
  if (!Number.isFinite(parsedMillis) || parsedMillis <= 0) return null;
  return new Date(parsedMillis);
}

function normalizeOrderType(value) {
  return value === "limit" ? "limit" : "market";
}

function isLimitOrderMarketable(side, marketPrice, limitPrice) {
  if (side === "buy") return marketPrice <= limitPrice;
  if (side === "sell") return marketPrice >= limitPrice;
  return false;
}

function getLimitFillPrice(side, marketPrice, limitPrice) {
  if (side === "buy") return Math.min(marketPrice, limitPrice);
  if (side === "sell") return Math.max(marketPrice, limitPrice);
  return marketPrice;
}

function toTimestampDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function getEasternTimeParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    weekday: partMap.weekday,
    hour: Number(partMap.hour || 0),
    minute: Number(partMap.minute || 0)
  };
}

export function isMarketOpenNow(currentDate = new Date()) {
  const { weekday, hour, minute } = getEasternTimeParts(currentDate);
  if (weekday === "Sat" || weekday === "Sun") return false;

  const totalMinutes = hour * 60 + minute;
  const marketOpenMinutes = (9 * 60) + 30;
  const marketCloseMinutes = 16 * 60;
  return totalMinutes >= marketOpenMinutes && totalMinutes < marketCloseMinutes;
}

export async function getTradeSharePreference() {
  const user = auth.currentUser;
  if (!user) return "ask";

  const prefSnap = await getDoc(getPreferencesRef(user.uid));
  if (!prefSnap.exists()) return "ask";
  const pref = prefSnap.data()?.tradeSharePreference;
  return pref === "always" || pref === "never" || pref === "ask" ? pref : "ask";
}

export async function setTradeSharePreference(preference) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const normalized = preference === "always" || preference === "never" || preference === "ask"
    ? preference
    : "ask";
  await setDoc(
    getPreferencesRef(user.uid),
    {
      tradeSharePreference: normalized,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  return normalized;
}

export async function ensurePaperAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const accountRef = getAccountRef(user.uid);
  const snap = await getDoc(accountRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }

  const defaultAccount = {
    cashBalance: STARTING_PAPER_CASH,
    positions: {},
    positionCostBasis: {},
    optionPositions: {},
    optionPositionCostBasis: {},
    resetEligibleAt: null,
    wentBrokeAt: null,
    lastResetAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(accountRef, defaultAccount, { merge: true });
  return defaultAccount;
}

/**
 * Place a paper trade (buy/sell) for the current user.
 * @param {string} symbol - Stock symbol
 * @param {number} quantity - Number of shares
 * @param {number} price - Price per share
 * @param {string} side - "buy" or "sell"
 * @param {{ shareAsPost?: boolean, assetType?: "stock"|"option", underlyingSymbol?: string, optionType?: "call"|"put", strike?: number, expiration?: number|string|Date, contractMultiplier?: number }} options
 * @returns {Promise}
 */
export async function placePaperTrade(symbol, quantity, price, side, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  if (!isMarketOpenNow()) throw new Error("Market is closed. Paper trades are only allowed during market hours.");

  const normalizedSymbol = (symbol || "").trim().toUpperCase();
  const normalizedQuantity = Math.max(1, Math.floor(normalizeNumber(quantity)));
  const normalizedPrice = normalizeNumber(price);

  if (!normalizedSymbol) throw new Error("Missing symbol");
  if (!normalizedPrice || normalizedPrice <= 0) throw new Error("Invalid price");
  if (side !== "buy" && side !== "sell") throw new Error("Invalid trade side");

  const shareAsPost = Boolean(options?.shareAsPost);
  const assetType = options?.assetType === "option" ? "option" : "stock";
  const normalizedUnderlyingSymbol = String(options?.underlyingSymbol || "").trim().toUpperCase();
  const normalizedOptionType = options?.optionType === "put" ? "put" : "call";
  const normalizedStrike = normalizeNumber(options?.strike);
  const parsedExpiration = parseExpirationDate(options?.expiration);
  const contractMultiplier = assetType === "option"
    ? Math.max(1, Math.floor(normalizeNumber(options?.contractMultiplier || 100)))
    : 1;
  const tradeNotional = normalizedQuantity * normalizedPrice * contractMultiplier;

  if (assetType === "option") {
    if (!normalizedUnderlyingSymbol) throw new Error("Missing underlying symbol");
    if (!Number.isFinite(normalizedStrike) || normalizedStrike <= 0) throw new Error("Invalid option strike");
    if (!(parsedExpiration instanceof Date) || Number.isNaN(parsedExpiration.getTime())) {
      throw new Error("Invalid option expiration");
    }
  }

  const now = Timestamp.now();
  const accountRef = getAccountRef(user.uid);
  const tradeRef = doc(collection(db, "users", user.uid, "paperTrades"));

  const tradePayload = await runTransaction(db, async (transaction) => {
    const accountSnap = await transaction.get(accountRef);
    const accountData = accountSnap.exists() ? accountSnap.data() : {};

    const cashBalance = normalizeNumber(accountData.cashBalance || STARTING_PAPER_CASH);
    const positionMapKey = assetType === "option" ? "optionPositions" : "positions";
    const costBasisMapKey = assetType === "option" ? "optionPositionCostBasis" : "positionCostBasis";
    const existingPositions = { ...(accountData[positionMapKey] || {}) };
    const existingCostBasis = { ...(accountData[costBasisMapKey] || {}) };
    const currentQty = normalizeNumber(existingPositions[normalizedSymbol] || 0);
    const currentAvgCost = normalizeNumber(existingCostBasis[normalizedSymbol] || 0);

    let nextCash = cashBalance;
    let nextQty = currentQty;
    let realizedPnl = null;

    if (side === "buy") {
      if (cashBalance < tradeNotional) {
        throw new Error("Insufficient paper cash");
      }
      nextCash = cashBalance - tradeNotional;
      nextQty = currentQty + normalizedQuantity;
    } else {
      if (currentQty < normalizedQuantity) {
        throw new Error(assetType === "option" ? "Not enough contracts to paper sell" : "Not enough shares to paper sell");
      }
      nextCash = cashBalance + tradeNotional;
      nextQty = currentQty - normalizedQuantity;
      realizedPnl = (normalizedPrice - currentAvgCost) * normalizedQuantity * contractMultiplier;
    }

    const nextPositions = { ...existingPositions };
    const nextCostBasis = { ...existingCostBasis };
    if (nextQty <= 0) {
      delete nextPositions[normalizedSymbol];
      delete nextCostBasis[normalizedSymbol];
    } else {
      nextPositions[normalizedSymbol] = nextQty;
      if (side === "buy") {
        const nextAverageCost = ((currentQty * currentAvgCost) + (normalizedQuantity * normalizedPrice)) / nextQty;
        nextCostBasis[normalizedSymbol] = nextAverageCost;
      } else {
        nextCostBasis[normalizedSymbol] = currentAvgCost;
      }
    }

    const accountUpdate = {
      cashBalance: nextCash,
      positions: assetType === "option" ? (accountData.positions || {}) : nextPositions,
      positionCostBasis: assetType === "option" ? (accountData.positionCostBasis || {}) : nextCostBasis,
      optionPositions: assetType === "option" ? nextPositions : (accountData.optionPositions || {}),
      optionPositionCostBasis: assetType === "option" ? nextCostBasis : (accountData.optionPositionCostBasis || {}),
      updatedAt: now,
      createdAt: accountData.createdAt || now,
      lastResetAt: accountData.lastResetAt || null,
      resetEligibleAt: accountData.resetEligibleAt || null,
      wentBrokeAt: accountData.wentBrokeAt || null
    };

    if (nextCash <= 0 && !accountData.resetEligibleAt) {
      const eligibleDate = addBusinessDays(new Date(), 5);
      accountUpdate.wentBrokeAt = now;
      accountUpdate.resetEligibleAt = Timestamp.fromDate(eligibleDate);
    }

    transaction.set(accountRef, accountUpdate, { merge: true });

    const payload = {
      uid: user.uid,
      symbol: normalizedSymbol,
      assetType,
      underlyingSymbol: assetType === "option" ? normalizedUnderlyingSymbol : normalizedSymbol,
      quantity: normalizedQuantity,
      price: normalizedPrice,
      contractMultiplier,
      notional: tradeNotional,
      side,
      realizedPnl,
      cashAfterTrade: nextCash,
      createdAt: now,
      sharedToFeed: shareAsPost
    };

    if (assetType === "option") {
      payload.optionType = normalizedOptionType;
      payload.strike = normalizedStrike;
      payload.expiration = Timestamp.fromDate(parsedExpiration);
    }

    transaction.set(tradeRef, payload);
    return payload;
  });

  if (shareAsPost) {
    const sideLabel = side === "buy" ? "bought" : "sold";
    const displayName = user.displayName || user.email?.split("@")[0] || "Trader";
    const pnlText = side === "sell"
      ? ` | Trade PnL: ${(Number(tradePayload.realizedPnl || 0) >= 0 ? "+" : "-")}$${Math.abs(Number(tradePayload.realizedPnl || 0)).toFixed(2)}`
      : "";
    const tradeLine = assetType === "option"
      ? `Paper ${sideLabel} ${normalizedQuantity} ${normalizedSymbol} contracts @ $${normalizedPrice.toFixed(2)} (${normalizedOptionType.toUpperCase()} ${normalizedUnderlyingSymbol} $${normalizedStrike.toFixed(2)})${pnlText}`
      : `Paper ${sideLabel} ${normalizedQuantity} ${normalizedSymbol} @ $${normalizedPrice.toFixed(2)}${pnlText}`;
    await addDoc(collection(db, "posts"), {
      author: displayName,
      authorId: user.uid,
      content: tradeLine,
      createdAt: serverTimestamp(),
      comments: 0,
      bullishVotes: 0,
      bearishVotes: 0,
      user: {
        uid: user.uid,
        name: displayName,
        avatar: user.photoURL || "/defaults/default1.png",
        handle: user.email ? `@${user.email.split("@")[0]}` : "@trader"
      },
      paperTrade: {
        symbol: normalizedSymbol,
        assetType,
        underlyingSymbol: assetType === "option" ? normalizedUnderlyingSymbol : normalizedSymbol,
        quantity: normalizedQuantity,
        price: normalizedPrice,
        contractMultiplier,
        notional: tradeNotional,
        side,
        realizedPnl,
        ...(assetType === "option"
          ? {
              optionType: normalizedOptionType,
              strike: normalizedStrike,
              expiration: parsedExpiration
            }
          : {})
      }
    });
  }

  return tradePayload;
}

export async function placePaperOrder(symbol, quantity, marketPrice, side, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const normalizedOrderType = normalizeOrderType(options?.orderType);
  if (normalizedOrderType !== "limit") {
    return placePaperTrade(symbol, quantity, marketPrice, side, options);
  }

  if (!isMarketOpenNow()) {
    throw new Error("Market is closed. Limit orders can only be placed during market hours in this app.");
  }

  const normalizedLimitPrice = normalizeNumber(options?.limitPrice);
  if (!normalizedLimitPrice || normalizedLimitPrice <= 0) {
    throw new Error("Invalid limit price");
  }

  const normalizedMarketPrice = normalizeNumber(marketPrice);
  if (!normalizedMarketPrice || normalizedMarketPrice <= 0) {
    throw new Error("Invalid market price");
  }

  if (isLimitOrderMarketable(side, normalizedMarketPrice, normalizedLimitPrice)) {
    return placePaperTrade(symbol, quantity, getLimitFillPrice(side, normalizedMarketPrice, normalizedLimitPrice), side, options);
  }

  const normalizedSymbol = (symbol || "").trim().toUpperCase();
  if (!normalizedSymbol) throw new Error("Missing symbol");
  if (side !== "buy" && side !== "sell") throw new Error("Invalid trade side");

  const assetType = options?.assetType === "option" ? "option" : "stock";
  const normalizedUnderlyingSymbol = String(options?.underlyingSymbol || "").trim().toUpperCase();
  const normalizedOptionType = options?.optionType === "put" ? "put" : "call";
  const normalizedStrike = normalizeNumber(options?.strike);
  const parsedExpiration = parseExpirationDate(options?.expiration);
  if (assetType === "option") {
    if (!normalizedUnderlyingSymbol) throw new Error("Missing underlying symbol");
    if (!Number.isFinite(normalizedStrike) || normalizedStrike <= 0) throw new Error("Invalid option strike");
    if (!(parsedExpiration instanceof Date) || Number.isNaN(parsedExpiration.getTime())) {
      throw new Error("Invalid option expiration");
    }
  }

  const ordersRef = collection(db, "users", user.uid, ORDERS_COLLECTION);
  const pendingOrder = {
    symbol: normalizedSymbol,
    side,
    orderType: "limit",
    limitPrice: normalizedLimitPrice,
    marketPrice: normalizedMarketPrice,
    quantity: Math.max(1, Math.floor(normalizeNumber(quantity))),
    assetType,
    underlyingSymbol: assetType === "option" ? normalizedUnderlyingSymbol : normalizedSymbol,
    ...(assetType === "option"
      ? {
          optionType: normalizedOptionType,
          strike: normalizedStrike,
          expiration: parsedExpiration
        }
      : {}),
    shareAsPost: Boolean(options?.shareAsPost),
    status: "pending",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  const orderDoc = await addDoc(ordersRef, pendingOrder);
  return { id: orderDoc.id, ...pendingOrder };
}

export async function processPendingPaperOrders(symbolPrices = {}) {
  const user = auth.currentUser;
  if (!user) return [];

  const resolveSymbolPrice = async (symbol) => {
    const normalizedSymbol = String(symbol || "").toUpperCase();
    const localPrice = Number(symbolPrices[normalizedSymbol]);
    if (localPrice > 0) return localPrice;

    try {
      const response = await fetch(`/api/getQuote?symbol=${encodeURIComponent(normalizedSymbol)}`);
      if (!response.ok) return 0;
      const data = await response.json();
      return Number(data?.c || 0);
    } catch {
      return 0;
    }
  };

  const ordersSnap = await getDocs(
    query(
      collection(db, "users", user.uid, ORDERS_COLLECTION),
      where("status", "==", "pending")
    )
  );

  const processed = [];
  for (const orderDoc of ordersSnap.docs) {
    const order = orderDoc.data() || {};
    const symbol = String(order.symbol || "").toUpperCase();
    const marketPrice = await resolveSymbolPrice(symbol);
    const limitPrice = Number(order.limitPrice || 0);
    if (!symbol || !marketPrice || !limitPrice) continue;
    if (!isLimitOrderMarketable(order.side, marketPrice, limitPrice)) continue;

    const fillPrice = getLimitFillPrice(order.side, marketPrice, limitPrice);
    try {
      await updateDoc(doc(db, "users", user.uid, ORDERS_COLLECTION, orderDoc.id), {
        status: "filling",
        fillPrice,
        updatedAt: Timestamp.now()
      });
      const tradePayload = await placePaperTrade(symbol, order.quantity, fillPrice, order.side, {
        shareAsPost: order.shareAsPost,
        assetType: order.assetType,
        underlyingSymbol: order.underlyingSymbol,
        optionType: order.optionType,
        strike: order.strike,
        expiration: order.expiration,
        contractMultiplier: order.contractMultiplier || 1
      });
      await updateDoc(doc(db, "users", user.uid, ORDERS_COLLECTION, orderDoc.id), {
        status: "filled",
        fillPrice,
        tradeId: tradePayload?.uid ? null : null,
        updatedAt: Timestamp.now()
      });
      processed.push({ id: orderDoc.id, ...order, fillPrice });
    } catch (error) {
      await updateDoc(doc(db, "users", user.uid, ORDERS_COLLECTION, orderDoc.id), {
        status: "pending",
        updatedAt: Timestamp.now(),
        lastError: error?.message || "Failed to fill order"
      });
    }
  }

  return processed;
}

export async function resetPaperAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const accountRef = getAccountRef(user.uid);
  const now = Timestamp.now();

  await runTransaction(db, async (transaction) => {
    const accountSnap = await transaction.get(accountRef);
    const accountData = accountSnap.exists() ? accountSnap.data() : {};
    const cashBalance = normalizeNumber(accountData.cashBalance || STARTING_PAPER_CASH);
    const resetEligibleAt = accountData.resetEligibleAt || null;

    if (!resetEligibleAt) {
      if (cashBalance > 0) {
        throw new Error("Reset unlocks only after your paper cash reaches $0.");
      }
      throw new Error("Reset not available yet.");
    }

    const eligibleDate = toTimestampDate(resetEligibleAt);
    if (!eligibleDate || eligibleDate > new Date()) {
      const when = eligibleDate ? eligibleDate.toLocaleDateString() : "later";
      throw new Error(`Reset locked until ${when}.`);
    }

    transaction.set(
      accountRef,
      {
        cashBalance: STARTING_PAPER_CASH,
        positions: {},
        positionCostBasis: {},
        optionPositions: {},
        optionPositionCostBasis: {},
        lastResetAt: now,
        resetEligibleAt: null,
        wentBrokeAt: null,
        updatedAt: now,
        createdAt: accountData.createdAt || now
      },
      { merge: true }
    );
  });
}
