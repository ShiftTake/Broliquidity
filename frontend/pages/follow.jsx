import React, { useState } from "react";
import Link from "next/link";

const demoFollowing = [
  { name: "wallstreetwolf", role: "Equity hot takes", avatar: "WW" },
  { name: "siegrinder", role: "Licensing grind", avatar: "SG" },
  { name: "cap_table_king", role: "Founder wealth watch", avatar: "CK" },
  { name: "exceladdict", role: "Analyst recruiting", avatar: "EA" },
];
const demoFollowers = [
  { name: "optionbro", role: "Options flow", avatar: "OB" },
  { name: "macro_mike", role: "Macro takes", avatar: "MM" },
  { name: "creditqueen", role: "Private credit", avatar: "CQ" },
];

function renderUserMini(u) {
  return (
    <div className="rounded-2xl p-3 mb-2 flex items-center gap-3 bg-white border border-slate-200 shadow-sm" key={u.name}>
      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.avatar)}&background=050816&color=B6FF22`} className="w-12 h-12 rounded-full object-cover border-2 border-brogreen bg-slate-700" alt="" />
      <div className="min-w-0">
        <div className="font-black truncate text-slate-900">@{u.name}</div>
        <div className="text-xs text-slate-500 truncate">{u.role}</div>
      </div>
    </div>
  );
}

export default function Follow() {
  const [tab, setTab] = useState("followers");
  const list = tab === "following" ? demoFollowing : demoFollowers;

  return (
    <div className="font-sans antialiased min-h-screen flex flex-col items-center py-10 bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900">
      <div className="w-full max-w-md rounded-3xl p-6 bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-black text-2xl text-slate-900">Followers & Following</h1>
            <p className="text-sm text-slate-500 mt-1">Browse who follows you and who you follow.</p>
          </div>
          <Link href="/feed" legacyBehavior>
            <a className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-900 shadow-sm hover:bg-slate-50" aria-label="Back to feed" title="Back to feed">
              <span aria-hidden="true">←</span>
              <span className="hidden sm:inline">Feed</span>
            </a>
          </Link>
        </div>
        <div className="flex justify-center gap-6 mb-6 border-b border-slate-200">
          <button
            className={`py-2 px-4 font-bold text-lg border-b-2 ${tab === "followers" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400"}`}
            onClick={() => setTab("followers")}
          >
            Followers
          </button>
          <button
            className={`py-2 px-4 font-bold text-lg border-b-2 ${tab === "following" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400"}`}
            onClick={() => setTab("following")}
          >
            Following
          </button>
        </div>
        <div id="follow-list">
          {list.length ? list.map(renderUserMini) : <div className="text-xs text-slate-500 text-center py-6">No users found.</div>}
        </div>
      </div>
    </div>
  );
}
