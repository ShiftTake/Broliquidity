import React, { useState } from "react";
import { placePaperTrade } from "./paperTrading";

export default function PaperTradeButtons({ symbol, price }) {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleTrade = async (side) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await placePaperTrade(symbol, quantity, price, side);
      setSuccess(`Paper ${side} order placed!`);
    } catch (e) {
      setError(e.message || "Error placing order");
    }
    setLoading(false);
  };

  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      <input
        type="number"
        min={1}
        value={quantity}
        onChange={e => setQuantity(Number(e.target.value))}
        className="col-span-1 px-2 py-3 rounded-2xl border text-xs text-center"
        style={{ minWidth: 0 }}
        disabled={loading}
      />
      <button
        className="px-4 py-3 rounded-2xl bg-green-600 text-white font-black text-xs"
        onClick={() => handleTrade("buy")}
        disabled={loading}
      >
        Paper Buy
      </button>
      <button
        className="px-4 py-3 rounded-2xl bg-red-500 text-white font-black text-xs"
        onClick={() => handleTrade("sell")}
        disabled={loading}
      >
        Paper Sell
      </button>
      {error && <div className="col-span-3 text-xs text-red-500 mt-2">{error}</div>}
      {success && <div className="col-span-3 text-xs text-green-600 mt-2">{success}</div>}
    </div>
  );
}
