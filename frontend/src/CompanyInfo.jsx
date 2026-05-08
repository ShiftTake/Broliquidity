import React, { useEffect, useState } from "react";
import axios from "axios";

export default function CompanyInfo({ symbol }) {
  const [info, setInfo] = useState(null);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError("");
    // Fetch company profile
    axios
      .get(`/api/companyProfile?symbol=${encodeURIComponent(symbol)}`)
      .then((res) => {
        setInfo(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // Fetch news
    axios
      .get(`/api/companyNews?symbol=${encodeURIComponent(symbol)}`)
      .then((res) => setNews(res.data.articles || []))
      .catch(() => {});
  }, [symbol]);

  if (loading) return <div className="text-slate-400">Loading company info...</div>;
  if (!info) return null;

  return (
    <div className="mt-6 flex flex-col md:flex-row gap-8 items-start">
      <div className="flex items-center gap-4">
        {info.logo && <img src={info.logo} alt="Logo" className="w-14 h-14 rounded-xl bg-white border" />}
        <div>
          <div className="text-lg font-black">{info.name || symbol}</div>
          <div className="text-xs text-slate-500">{info.exchange} • {info.finnhubIndustry}</div>
          <div className="text-xs text-slate-400 mt-1">{info.weburl && <a href={info.weburl} target="_blank" rel="noopener noreferrer" className="underline">Website</a>}</div>
        </div>
      </div>
      <div className="flex-1">
        <div className="text-sm text-slate-300 mb-2">{info.description}</div>
        <div className="mt-4">
          <div className="font-bold text-slate-400 mb-2">Recent News</div>
          <ul className="space-y-2">
            {news.length === 0 ? (
              <li className="text-xs text-slate-500">No recent news.</li>
            ) : news.slice(0, 4).map((n, i) => (
              <li key={i}>
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline font-bold">
                  {n.headline || n.title}
                </a>
                <div className="text-xs text-slate-500">{n.source} • {n.datetime ? new Date(n.datetime).toLocaleDateString() : ""}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
