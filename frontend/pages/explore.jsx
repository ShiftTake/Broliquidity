import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Link from "next/link";
import StockInfo from "../src/StockInfo";
import { onAuthStateChanged } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../src/firebase";

const cryptoSymbols = new Set(["BTC","ETH","SOL","XRP","DOGE","BNB","ADA","LTC","USDT","USDC","AVAX","DOT","MATIC","LINK","UNI","SHIB"]);
const optionSymbols = new Set(["SPY","QQQ","IWM","GLD","SLV","TLT","VIX"]);

function inferAssetTypeExplore(symbol) {
  const s = (symbol || "").toUpperCase();
  if (cryptoSymbols.has(s)) return "crypto";
  if (optionSymbols.has(s)) return "options";
  return "stocks";
}

export default function Explore() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [selectedDescription, setSelectedDescription] = useState("Apple Inc.");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [watchlistNotice, setWatchlistNotice] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setWatchlist([]);
      return;
    }

    const watchlistRef = collection(db, "users", user.uid, "watchlist");
    const unsubscribe = onSnapshot(
      watchlistRef,
      (snapshot) => {
        const items = snapshot.docs
          .map((watchlistDoc) => ({ id: watchlistDoc.id, ...watchlistDoc.data() }))
          .sort((a, b) => (a.symbol || "").localeCompare(b.symbol || ""));
        setWatchlist(items);
      },
      () => {
        setWatchlist([]);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const watchlistSymbols = useMemo(() => new Set(watchlist.map((item) => item.symbol)), [watchlist]);

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

  const handleSelectResult = (result) => {
    setSelectedSymbol(result.symbol);
    setSelectedDescription(result.description || result.symbol);
  };

  const handleAddToWatchlist = async (symbol, name) => {
    const normalizedSymbol = (symbol || "").trim().toUpperCase();
    if (!normalizedSymbol) return;

    if (!user?.uid) {
      setWatchlistNotice("Sign in to add stocks to your watchlist.");
      return;
    }

    try {
      const watchlistDocRef = doc(db, "users", user.uid, "watchlist", normalizedSymbol);
      await setDoc(
        watchlistDocRef,
        {
          symbol: normalizedSymbol,
          name: name || normalizedSymbol,
          assetType: inferAssetTypeExplore(normalizedSymbol),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      setWatchlistNotice(`${normalizedSymbol} added to your watchlist.`);
    } catch (addError) {
      setWatchlistNotice("Could not update watchlist right now.");
    }
  };

  const handleRemoveFromWatchlist = async (symbol) => {
    if (!user?.uid || !symbol) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "watchlist", symbol));
      setWatchlistNotice(`${symbol} removed from your watchlist.`);
    } catch (removeError) {
      setWatchlistNotice("Could not remove this stock right now.");
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden xl:block w-72 shrink-0">
          <div className="sticky top-6 space-y-4">
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-brogreen">Explore</p>
              <h1 className="mt-2 text-2xl font-black">Stock Explorer</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Search tickers and companies with the same feed visual rhythm.</p>
            </div>
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick Links</h2>
              <div className="mt-4 space-y-2">
                <Link href="/feed" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 font-black hover:bg-slate-50 dark:hover:bg-white/5">Main Feed</Link>
                <Link href="/bookmarks" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 font-black hover:bg-slate-50 dark:hover:bg-white/5">Saved posts</Link>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">My Watchlist</h2>
                {!user ? <Link href="/login" className="text-xs font-black text-brogreen">Sign in</Link> : null}
              </div>
              <div className="mt-3 space-y-2">
                {watchlist.length ? watchlist.map((item) => (
                  <div key={item.symbol} className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-white/10 px-3 py-2">
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => {
                        setSelectedSymbol(item.symbol);
                        setSelectedDescription(item.name || item.symbol);
                      }}
                    >
                      <div className="font-mono text-xs font-black text-slate-900 dark:text-slate-100">{item.symbol}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{item.name || item.symbol}</div>
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-red-50 px-2 py-1 text-[11px] font-black text-red-500"
                      onClick={() => handleRemoveFromWatchlist(item.symbol)}
                    >
                      Remove
                    </button>
                  </div>
                )) : <p className="text-xs text-slate-500 dark:text-slate-400">No saved stocks yet.</p>}
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <section className="overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] shadow-sm">
            <div className="border-b border-slate-200 dark:border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <Link href="/feed" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xl font-black hover:bg-slate-50 dark:hover:bg-white/5">←</Link>
                <div>
                  <h2 className="text-xl font-black">Explore Tickers</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Find symbols and load fundamentals in one place.</p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search stocks, tickers, companies..."
                  className="flex-1 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
                <button type="submit" className="rounded-2xl bg-brogreen px-5 py-3 text-sm font-black text-black disabled:opacity-60" disabled={searching}>
                  {searching ? "Searching..." : "Search"}
                </button>
              </form>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-600">{error}</div>
              ) : null}

              {results.length > 0 ? (
                <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816]">
                  <div className="border-b border-slate-200 dark:border-white/10 px-4 py-3 text-sm font-black">Results</div>
                  <ul>
                    {results.map((r) => (
                      <li key={r.symbol} className="border-b border-slate-100 dark:border-white/10 last:border-b-0">
                        <div className="flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5">
                          <button
                            type="button"
                            className="flex-1 text-left"
                            onClick={() => handleSelectResult(r)}
                          >
                            <div className="font-mono text-sm font-black text-slate-900 dark:text-slate-100">{r.symbol}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{r.description}</div>
                          </button>
                          <button
                            type="button"
                            className="rounded-xl bg-brogreen px-3 py-2 text-[11px] font-black text-black disabled:opacity-60"
                            onClick={() => handleAddToWatchlist(r.symbol, r.description)}
                            disabled={watchlistSymbols.has((r.symbol || "").toUpperCase())}
                          >
                            {watchlistSymbols.has((r.symbol || "").toUpperCase()) ? "Added" : "Add"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {watchlistNotice ? (
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3 text-xs font-black text-slate-700 dark:text-slate-300">
                  {watchlistNotice}
                </div>
              ) : null}

              <div className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3">
                <div>
                  <p className="font-mono text-xs font-black text-slate-900 dark:text-slate-100">{selectedSymbol}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{selectedDescription}</p>
                </div>
                <button
                  type="button"
                  className="rounded-xl bg-brogreen px-4 py-2 text-xs font-black text-black disabled:opacity-60"
                  onClick={() => handleAddToWatchlist(selectedSymbol, selectedDescription)}
                  disabled={watchlistSymbols.has((selectedSymbol || "").toUpperCase())}
                >
                  {watchlistSymbols.has((selectedSymbol || "").toUpperCase()) ? "In Watchlist" : "Add to Watchlist"}
                </button>
              </div>

              <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-4">
                <StockInfo symbol={selectedSymbol} />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
