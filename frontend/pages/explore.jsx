import React, { useState } from "react";
import axios from "axios";
import StockInfo from "../StockInfo";

export default function Explore() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearching(true);
    setError("");
    try {
      const res = await axios.get(`/api/searchSymbol?query=${encodeURIComponent(query)}`);
      setResults(res.data.result || []);
    } catch (e) {
      setError("Search failed");
    }
    setSearching(false);
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-black mb-6">Explore trending topics and stocks</h2>
      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search stocks, tickers, companies..."
          className="px-4 py-2 rounded-xl border border-slate-300 flex-1"
        />
        <button type="submit" className="px-4 py-2 rounded-xl bg-brogreen text-black font-bold" disabled={searching}>
          {searching ? "Searching..." : "Search"}
        </button>
      </form>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      {results.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold mb-2">Results</h3>
          <ul className="space-y-2">
            {results.map(r => (
              <li key={r.symbol}>
                <button
                  className="text-left w-full px-3 py-2 rounded-lg bg-white/10 hover:bg-brogreen/20 font-mono"
                  onClick={() => setSelectedSymbol(r.symbol)}
                >
                  {r.symbol} <span className="text-slate-500">{r.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <StockInfo symbol={selectedSymbol} />
    </div>
  );
}
