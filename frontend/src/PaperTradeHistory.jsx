import React, { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";

export default function PaperTradeHistory() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

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
  if (!trades.length) return <div className="text-slate-400">No trades yet.</div>;

  return (
    <div className="rounded-2xl bg-white/10 p-6 mb-6 shadow-lg">
      <h3 className="font-black text-lg mb-4">Paper Trade History</h3>
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
          {trades.map((t) => (
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
