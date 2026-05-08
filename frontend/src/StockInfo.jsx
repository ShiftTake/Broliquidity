import React, { useEffect, useState } from "react";
import axios from "axios";
import StockChart from "./StockChart";
import CompanyInfo from "./CompanyInfo";
import PaperTradeButtons from "./PaperTradeButtons";

export default function StockInfo({ symbol }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError("");
    axios
      .get(`/api/getQuote?symbol=${encodeURIComponent(symbol)}`)
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to fetch quote");
        setLoading(false);
      });
  }, [symbol]);

  if (!symbol) return null;
  if (loading) return <div className="text-slate-400">Loading quote...</div>;
  if (error) return <div className="text-red-400">{error}</div>;
  if (!data) return null;

  const price = data.c;
  const prevClose = data.pc;
  const change = price - prevClose;
  const percent = prevClose ? (change / prevClose) * 100 : 0;
  const up = change > 0;

  return (
    <div className="rounded-2xl bg-white/10 p-6 mb-6 flex flex-col gap-6 shadow-lg">
      <div className="flex items-center gap-6">
        <div>
          <div className="text-2xl font-black">{symbol}</div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-3xl font-black ${up ? "text-green-400" : "text-red-400"}`}>{price?.toFixed(2)}</span>
            <span className={`font-bold ${up ? "text-green-400" : "text-red-400"}`}>
              {up ? "▲" : "▼"} {change.toFixed(2)} ({percent.toFixed(2)}%)
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Prev Close: {prevClose?.toFixed(2)}</div>
        </div>
      </div>
      <PaperTradeButtons symbol={symbol} price={price} />
      <StockChart symbol={symbol} />
      <CompanyInfo symbol={symbol} />
    </div>
  );
}
