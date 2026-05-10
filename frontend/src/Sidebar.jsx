
import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import SidebarSearch from "./SidebarSearch";
import SidebarBroLLM from "./SidebarBroLLM";

const navItems = [
  { name: "Home", path: "/" },
  { name: "Explore", path: "/explore" },
  { name: "Communities", path: "/communities" },
  { name: "Following", path: "/following" },
  { name: "Bookmarks", path: "/bookmarks" },
  { name: "Bro LLM", path: "/bro-llm", isBroLLM: true },
  { name: "Direct Messages", path: "/dm" },
  { name: "Profile", path: "/profile" }
];

export default function Sidebar() {
  const location = useLocation();
  const [showBroLLM, setShowBroLLM] = useState(false);
  return (
    <aside className="w-full max-w-xs p-6 bg-white text-black rounded-2xl shadow-lg flex flex-col gap-2">
      <div className="flex items-center gap-3 mb-8">
        <img
          src="/mainlogo.png"
          alt="BroLiquidity Logo"
          className="w-12 h-12 rounded-2xl object-cover focus:outline-none focus:ring-2 focus:ring-brogreen hover:scale-105 transition"
          tabIndex={0}
          aria-label="BroLiquidity Logo"
          title="BroLiquidity Home"
        />
        <div>
          <h2 className="font-black text-lg">BroLiquidity</h2>
          <p className="text-xs text-slate-500">Trades • Licenses • Jobs</p>
        </div>
      </div>
      <SidebarSearch />
      {/* Bro LLM modal trigger for /feed */}
      {location.pathname === "/feed" && (
        <>
          <button
            className="w-full px-4 py-3 rounded-xl font-bold text-lg transition focus:outline-none focus:ring-2 focus:ring-brogreen bg-lime-50 text-slate-700 mb-2"
            onClick={() => setShowBroLLM((v) => !v)}
            aria-label="Bro LLM"
            title="Bro LLM"
            tabIndex={0}
          >
            {showBroLLM ? "Close Bro LLM" : "Bro LLM"}
          </button>
          {showBroLLM && (
            <div className="bg-white rounded-2xl shadow-xl p-2 mt-2 max-h-96 overflow-y-auto">
              <SidebarBroLLM />
            </div>
          )}
        </>
      )}
      <nav className="flex flex-col gap-2 flex-1">
        {navItems.map(item => {
          if (item.isBroLLM && location.pathname === "/feed") {
            // Don't render Bro LLM nav link on /feed, handled above
            return null;
          }
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `px-4 py-3 rounded-xl font-bold text-lg transition focus:outline-none focus:ring-2 focus:ring-brogreen ${isActive ? "bg-lime-100 text-black" : "hover:bg-lime-50 text-slate-700"}`
              }
              end={item.path === "/"}
              aria-label={item.name}
              title={item.name}
              tabIndex={0}
            >
              {item.name}
            </NavLink>
          );
        })}
      </nav>
      <button className="mt-8 px-8 py-4 rounded-2xl bg-lime-400 text-black font-black text-center hover:scale-105 transition">
        Post
      </button>
    </aside>
  );
}
