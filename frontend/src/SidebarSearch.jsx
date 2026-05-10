import React, { useState } from "react";
// useNavigate removed for Next.js migration
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";

export default function SidebarSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearching(true);
    setError("");
    try {
      // Search users
      const usersSnap = await getDocs(collection(db, "users"));
      const users = usersSnap.docs
        .map(d => ({ uid: d.id, ...d.data(), type: "user" }))
        .filter(u => (u.displayName || u.email || "").toLowerCase().includes(query.toLowerCase()));
      // Search communities
      const commSnap = await getDocs(collection(db, "communities"));
      const communities = commSnap.docs
        .map(d => ({ id: d.id, ...d.data(), type: "community" }))
        .filter(c => (c.name || "").toLowerCase().includes(query.toLowerCase()));
      setResults([...users, ...communities]);
    } catch (e) {
      setError("Search failed");
    }
    setSearching(false);
  };

  return (
    <form onSubmit={handleSearch} className="mb-4">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search users or communities..."
        className="w-full px-4 py-2 rounded-xl border border-slate-300 mb-2"
      />
      <button type="submit" className="w-full px-4 py-2 rounded-xl bg-brogreen text-black font-bold mb-2" disabled={searching}>
        {searching ? "Searching..." : "Search"}
      </button>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      {results.length > 0 && (
        <ul className="bg-white/10 rounded-xl p-2 space-y-2">
          {results.map(r => (
            <li key={r.type + r.uid + r.id}>
              <button
                className="w-full text-left px-2 py-1 rounded hover:bg-brogreen/20"
                onClick={() => {
                  if (r.type === "user") navigate(`/profile/${r.uid}`);
                  else if (r.type === "community") navigate(`/communities/${r.id}`);
                }}
              >
                {r.type === "user" ? (
                  <>
                    <span className="font-bold">{r.displayName || r.email}</span>
                    <span className="text-xs text-slate-500 ml-2">User</span>
                  </>
                ) : (
                  <>
                    <span className="font-bold">{r.name}</span>
                    <span className="text-xs text-slate-500 ml-2">Community</span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
