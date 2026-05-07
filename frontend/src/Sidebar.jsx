import React from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  { name: "Home", path: "/" },
  { name: "Explore", path: "/explore" },
  { name: "Communities", path: "/communities" },
  { name: "Following", path: "/following" },
  { name: "Bookmarks", path: "/bookmarks" },
  { name: "Bro LLM", path: "/bro-llm" },
  { name: "Direct Messages", path: "/dm" },
  { name: "Profile", path: "/profile" }
];

export default function Sidebar() {
  return (
    <aside className="w-full max-w-xs p-6 bg-white text-black rounded-2xl shadow-lg flex flex-col gap-2">
      <div className="flex items-center gap-3 mb-8">
        <img src="/mainlogo.png" alt="BroLiquidity Logo" className="w-12 h-12 rounded-2xl object-cover" />
        <div>
          <h2 className="font-black text-lg">BroLiquidity</h2>
          <p className="text-xs text-slate-500">Trades • Licenses • Jobs</p>
        </div>
      </div>
      <nav className="flex flex-col gap-2 flex-1">
        {navItems.map(item => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `px-4 py-3 rounded-xl font-bold text-lg transition ${isActive ? "bg-lime-100" : "hover:bg-lime-50"}`
            }
            end={item.path === "/"}
          >
            {item.name}
          </NavLink>
        ))}
      </nav>
      <button className="mt-8 px-8 py-4 rounded-2xl bg-lime-400 text-black font-black text-center hover:scale-105 transition">
        Post
      </button>
    </aside>
  );
}
