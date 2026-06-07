import React, { useEffect, useState } from "react";
import {
  getTradeSharePreference,
  isMarketOpenNow,
  placePaperOrder,
  setTradeSharePreference
} from "./paperTrading";

export default function PaperTradeButtons({ symbol, price, allowSell = true }) {
  const [quantity, setQuantity] = useState(1);
  const [orderType, setOrderType] = useState("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [sharePreference, setSharePreference] = useState("ask");
  const [pendingSide, setPendingSide] = useState("");
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prefLoading, setPrefLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const marketOpen = isMarketOpenNow();

  useEffect(() => {
    let mounted = true;
    const loadPreference = async () => {
      setPrefLoading(true);
      try {
        const pref = await getTradeSharePreference();
        if (mounted) setSharePreference(pref);
      } catch (prefError) {
        if (mounted) setSharePreference("ask");
      }
      if (mounted) setPrefLoading(false);
    };
    loadPreference();
    return () => {
      mounted = false;
    };
  }, []);

  const executeTrade = async (side, shareAsPost) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const nextOptions = { shareAsPost };
      let nextMessage = `Paper ${side} order placed!`;
      if (orderType === "limit") {
        nextOptions.orderType = "limit";
        nextOptions.limitPrice = Number(limitPrice);
        const result = await placePaperOrder(symbol, quantity, price, side, nextOptions);
        nextMessage = result?.status === "pending"
          ? `Paper ${side} limit order placed and waiting to fill.`
          : `Paper ${side} limit order filled immediately!`;
      } else {
        await placePaperOrder(symbol, quantity, price, side, nextOptions);
        nextMessage = shareAsPost
          ? `Paper ${side} order placed and shared to feed!`
          : `Paper ${side} order placed!`;
      }
      setSuccess(nextMessage);
    } catch (e) {
      setError(e.message || "Error placing order");
    }
    setLoading(false);
  };

  const handleTrade = async (side) => {
    if (!marketOpen) {
      setError("Market is closed. Paper trades are only allowed during market hours.");
      return;
    }

    if (sharePreference === "always") {
      await executeTrade(side, true);
      return;
    }
    if (sharePreference === "never") {
      await executeTrade(side, false);
      return;
    }

    setPendingSide(side);
    setShowSharePrompt(true);
  };

  const handlePromptChoice = async (choice) => {
    if (!pendingSide) return;

    try {
      if (choice === "always") {
        await setTradeSharePreference("always");
        setSharePreference("always");
        setShowSharePrompt(false);
        await executeTrade(pendingSide, true);
        setPendingSide("");
        return;
      }

      if (choice === "never") {
        await setTradeSharePreference("never");
        setSharePreference("never");
        setShowSharePrompt(false);
        await executeTrade(pendingSide, false);
        setPendingSide("");
        return;
      }

      if (choice === "this-time-post") {
        setShowSharePrompt(false);
        await executeTrade(pendingSide, true);
        setPendingSide("");
        return;
      }

      setShowSharePrompt(false);
      await executeTrade(pendingSide, false);
      setPendingSide("");
    } catch (prefError) {
      setError(prefError?.message || "Could not update sharing preference.");
    }
  };

  const handleAskEveryTime = async () => {
    setLoading(true);
    try {
      await setTradeSharePreference("ask");
      setSharePreference("ask");
    } catch (prefError) {
      setError(prefError?.message || "Could not update sharing preference.");
    }
    setLoading(false);
  };

  return (
    <div className="mt-4 flex flex-wrap gap-2 items-stretch">
      <input
        type="number"
        min={1}
        value={quantity}
        onChange={e => setQuantity(Number(e.target.value))}
        className="flex-1 min-w-[72px] px-2 py-3 rounded-2xl border text-xs text-center"
        disabled={loading || prefLoading}
      />
      <select
        value={orderType}
        onChange={(e) => setOrderType(e.target.value)}
        className="flex-1 min-w-[96px] px-2 py-3 rounded-2xl border text-xs font-black text-center"
        disabled={loading || prefLoading}
      >
        <option value="market">Market</option>
        <option value="limit">Limit</option>
      </select>
      {orderType === "limit" ? (
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={limitPrice}
          onChange={(e) => setLimitPrice(e.target.value)}
          placeholder="Limit"
          className="flex-1 min-w-[96px] px-2 py-3 rounded-2xl border text-xs text-center"
          disabled={loading || prefLoading}
        />
      ) : null}
      <button
        className="flex-1 min-w-[96px] px-4 py-3 rounded-2xl bg-green-600 text-white font-black text-xs"
        onClick={() => handleTrade("buy")}
        disabled={loading || prefLoading || !marketOpen}
      >
        Paper Buy
      </button>
      {allowSell ? (
        <button
          className="flex-1 min-w-[96px] px-4 py-3 rounded-2xl bg-red-500 text-white font-black text-xs"
          onClick={() => handleTrade("sell")}
          disabled={loading || prefLoading || !marketOpen}
        >
          Paper Sell
        </button>
      ) : null}
      <div className="w-full text-[11px] font-black text-slate-500">
        {marketOpen ? "Market status: Open" : "Market status: Closed"}
      </div>
      <div className="w-full flex items-center justify-between text-[11px] font-black text-slate-500">
        <span>
          Share preference: {sharePreference === "always" ? "Always post" : sharePreference === "never" ? "Never post" : "Ask each trade"}
        </span>
        {sharePreference !== "ask" ? (
          <button type="button" className="text-brogreen" onClick={handleAskEveryTime} disabled={loading || prefLoading}>
            Ask each trade
          </button>
        ) : null}
      </div>
      {showSharePrompt ? (
        <div className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3 space-y-2">
          <p className="text-xs font-black text-slate-700 dark:text-slate-200">Share this {pendingSide} trade to your feed?</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="rounded-xl bg-brogreen px-2 py-2 text-[11px] font-black text-black" onClick={() => handlePromptChoice("always")}>
              Always post
            </button>
            <button type="button" className="rounded-xl bg-slate-200 dark:bg-white/10 px-2 py-2 text-[11px] font-black" onClick={() => handlePromptChoice("never")}>
              Never post
            </button>
            <button type="button" className="rounded-xl bg-green-600 px-2 py-2 text-[11px] font-black text-white" onClick={() => handlePromptChoice("this-time-post")}>
              Post this trade
            </button>
            <button type="button" className="rounded-xl bg-red-500 px-2 py-2 text-[11px] font-black text-white" onClick={() => handlePromptChoice("this-time-private")}>
              Keep private
            </button>
          </div>
        </div>
      ) : null}
      {error && <div className="w-full text-xs text-red-500 mt-2">{error}</div>}
      {success && <div className="w-full text-xs text-green-600 mt-2">{success}</div>}
    </div>
  );
}
