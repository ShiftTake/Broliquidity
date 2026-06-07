import React, { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";

export default function PaperTradeHistory() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/paperTrades`),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setTrades(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (!auth.currentUser) return <div className="text-slate-400">Sign in to view trade history.</div>;
  if (loading) return <div className="text-slate-400">Loading trade history...</div>;

  const sixtyDaysAgoMs = Date.now() - (60 * 24 * 60 * 60 * 1000);
  const tradesWithin60Days = trades.filter((trade) => {
    const tradeDate = trade.createdAt?.toDate?.();
    if (!tradeDate) return true;
    return tradeDate.getTime() >= sixtyDaysAgoMs;
  });
  const hasMoreThanTen = tradesWithin60Days.length > 10;
  const visibleTrades = showAll ? tradesWithin60Days : tradesWithin60Days.slice(0, 10);

  if (!tradesWithin60Days.length) return <div className="text-slate-400">No trades in the past 60 days.</div>;

  return (
    <div className="rounded-2xl bg-white/10 p-6 mb-6 shadow-lg">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-black text-lg">Paper Trade History</h3>
        {hasMoreThanTen ? (
          <button
            type="button"
            className="text-xs font-black text-brogreen"
            onClick={() => setShowAll((prev) => !prev)}
          >
            {showAll ? "Show less" : "Show all"}
          </button>
        ) : null}
      </div>
      <p className="text-[11px] text-slate-500 mb-3">Showing up to 60 days of trade history.</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500">
            <th className="text-left">Date</th>
            <th>Symbol</th>
            <th>Side</th>
            <th>Qty</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {visibleTrades.map((t) => (
            <tr key={t.id} className="border-t border-slate-200 dark:border-white/10">
              <td>{t.createdAt?.toDate?.().toLocaleString?.() || "-"}</td>
              <td className="font-bold">{t.symbol}</td>
              <td className={t.side === "buy" ? "text-green-600" : "text-red-500"}>{t.side}</td>
              <td>{t.quantity}</td>
              <td>${Number(t.price).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
