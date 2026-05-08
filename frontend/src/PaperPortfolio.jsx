import React, { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { collection, query, onSnapshot } from "firebase/firestore";
import axios from "axios";

export default function PaperPortfolio() {
  const [positions, setPositions] = useState({});
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/paperTrades`));
    const unsub = onSnapshot(q, async (snap) => {
      const trades = snap.docs.map((d) => d.data());
      // Aggregate positions
      const pos = {};
      trades.forEach((t) => {
        if (!t.symbol || !t.quantity || !t.price || !t.side) return;
        if (!pos[t.symbol]) pos[t.symbol] = { qty: 0, cost: 0 };
        if (t.side === "buy") {
          pos[t.symbol].qty += Number(t.quantity);
          pos[t.symbol].cost += Number(t.quantity) * Number(t.price);
        } else if (t.side === "sell") {
          pos[t.symbol].qty -= Number(t.quantity);
          pos[t.symbol].cost -= Number(t.quantity) * Number(t.price);
        }
      });
      setPositions(pos);
      // Fetch latest prices
      const syms = Object.keys(pos).filter((s) => pos[s].qty !== 0);
      const priceObj = {};
      await Promise.all(
        syms.map(async (sym) => {
          try {
            const res = await axios.get(`/api/getQuote?symbol=${encodeURIComponent(sym)}`);
            priceObj[sym] = res.data.c;
          } catch {
            priceObj[sym] = null;
          }
        })
      );
      setPrices(priceObj);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (!auth.currentUser) return <div className="text-slate-400">Sign in to view portfolio.</div>;
  if (loading) return <div className="text-slate-400">Loading portfolio...</div>;
  if (!Object.keys(positions).length) return <div className="text-slate-400">No positions yet.</div>;

  let totalValue = 0;
  let totalCost = 0;
  Object.entries(positions).forEach(([sym, pos]) => {
    if (pos.qty === 0) return;
    const price = prices[sym] || 0;
    totalValue += pos.qty * price;
    totalCost += pos.cost;
  });
  const totalPL = totalValue - totalCost;

  return (
    <div className="rounded-2xl bg-white/10 p-6 mb-6 shadow-lg">
      <h3 className="font-black text-lg mb-4">Paper Portfolio</h3>
      <table className="w-full text-xs mb-2">
        <thead>
          <tr className="text-slate-500">
            <th className="text-left">Symbol</th>
            <th>Qty</th>
            <th>Avg Cost</th>
            <th>Last Price</th>
            <th>P/L</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(positions).map(([sym, pos]) => {
            if (pos.qty === 0) return null;
            const price = prices[sym] || 0;
            const avgCost = pos.qty ? pos.cost / pos.qty : 0;
            const pl = pos.qty * (price - avgCost);
            return (
              <tr key={sym} className="border-t border-slate-200 dark:border-white/10">
                <td className="font-bold">{sym}</td>
                <td>{pos.qty}</td>
                <td>${avgCost.toFixed(2)}</td>
                <td>${price ? price.toFixed(2) : "-"}</td>
                <td className={pl >= 0 ? "text-green-600" : "text-red-500"}>{pl >= 0 ? "+" : ""}${pl.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="font-bold text-sm mt-2">Total Value: ${totalValue.toFixed(2)} | P/L: <span className={totalPL >= 0 ? "text-green-600" : "text-red-500"}>{totalPL >= 0 ? "+" : ""}{totalPL.toFixed(2)}</span></div>
    </div>
  );
}
