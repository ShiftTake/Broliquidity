import React, { useState } from "react";

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
    <div className="soft-card rounded-2xl p-3 mb-2 flex items-center gap-3" key={u.name}>
      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.avatar)}&background=050816&color=B6FF22`} className="w-10 h-10 rounded-full border border-slate-200 dark:border-white/10" alt="" />
      <div className="min-w-0">
        <div className="font-black truncate">@{u.name}</div>
        <div className="text-xs text-slate-500 truncate">{u.role}</div>
      </div>
    </div>
  );
}

export default function Follow() {
  const [tab, setTab] = useState("followers");
  const list = tab === "following" ? demoFollowing : demoFollowers;

  return (
    <div className="font-sans antialiased min-h-screen flex flex-col items-center py-10">
      <div className="w-full max-w-md panel rounded-3xl p-6">
        <h1 className="font-black text-2xl mb-6 text-center">Followers & Following</h1>
        <div className="flex justify-center gap-6 mb-6">
          <button
            className={`tab-btn py-2 px-4 font-bold text-lg border-b-2 ${tab === "followers" ? "active-tab" : ""}`}
            onClick={() => setTab("followers")}
          >
            Followers
          </button>
          <button
            className={`tab-btn py-2 px-4 font-bold text-lg border-b-2 ${tab === "following" ? "active-tab" : ""}`}
            onClick={() => setTab("following")}
          >
            Following
          </button>
        </div>
        <div id="follow-list">
          {list.length ? list.map(renderUserMini) : <div className="text-xs text-slate-500 text-center">No users found.</div>}
        </div>
      </div>
      <a href="/feed" className="mt-8 text-brogreen font-black">← Back to Feed</a>
    </div>
  );
}
