
import React from "react";

export default function Feed() {
  // This is a scaffold of the main three-column layout and sidebar structure, matching feed.html
  return (
    <div className="min-h-screen xl:grid xl:grid-cols-[300px_minmax(520px,760px)_380px] xl:justify-center">
      {/* Left Sidebar */}
      <aside className="hidden xl:block min-h-screen sticky top-0 border-r border-slate-200 bg-white">
        <div className="h-screen overflow-y-auto px-5 py-4 flex flex-col">
          {/* Logo and Title */}
          <a href="/feed" className="flex items-center gap-3 mb-6" aria-label="Go to home feed" role="link">
            <img src="/mainlogo.png" alt="BroLiquidity Logo" className="w-14 h-14 rounded-2xl object-cover border border-slate-200" />
            <div>
              <h1 className="font-black text-xl leading-tight">BroLiquidity</h1>
              <p className="text-[11px] text-slate-500 font-bold">Trades • Licenses • Jobs</p>
            </div>
          </a>
          {/* Sidebar nav placeholder */}
          <nav className="space-y-2 text-xl font-bold" role="navigation" aria-label="Sidebar navigation">
            <button className="left-nav active-nav w-full rounded-2xl px-4 py-3 flex items-center gap-4 text-left" data-view="home" aria-label="Home" title="Home" tabIndex={0}>
              <span>Home</span>
            </button>
            <button className="left-nav w-full rounded-2xl px-4 py-3 flex items-center gap-4 text-left hover:bg-slate-100" data-view="bookmarks" aria-label="Bookmarks" title="Bookmarks" tabIndex={0}>
              <span>Bookmarks</span>
            </button>
            <a href="/bro" className="left-nav w-full rounded-2xl px-4 py-3 flex items-center gap-4 text-left hover:bg-slate-100" data-view="bro-llm" aria-label="Bro LLM" title="Bro LLM" tabIndex={0}>
              <span>Bro AI</span>
            </a>
            <a href="/dm" className="left-nav w-full rounded-2xl px-4 py-3 flex items-center gap-4 text-left hover:bg-slate-100" aria-label="Direct Messages" title="Direct Messages" tabIndex={0}>
              <span>Direct Messages</span>
            </a>
          </nav>
          {/* Communities section placeholder */}
          <div className="mt-6 space-y-4">
            <section className="panel rounded-3xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-black">Communities</h2>
                <button className="px-4 py-2 rounded-2xl bg-brogreen text-black font-black text-base shadow hover:bg-lime-300 transition-all" aria-label="Create new community" title="Create new community" tabIndex={0}>+ New</button>
              </div>
              <div className="space-y-2">{/* Communities list placeholder */}</div>
            </section>
          </div>
          <div className="mt-auto"></div>
        </div>
      </aside>

      {/* Center Feed */}
      <main className="min-h-screen border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-200">
          <div className="grid grid-cols-2 text-center font-black">
            <button className="feed-tab active-tab py-4">For you</button>
            <button className="feed-tab py-4 text-slate-500">Following</button>
          </div>
        </div>
        {/* Composer and posts placeholder */}
        <section className="border-b border-slate-200 p-4">
          <div className="flex gap-3">
            <img src="https://ui-avatars.com/api/?name=BL&background=050816&color=B6FF22" className="w-12 h-12 rounded-full object-cover" alt="Profile" />
            <div className="flex-1">
              <button className="w-full text-left text-xl text-slate-500 font-semibold py-2">What’s happening?</button>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-4 text-broblue text-lg">
                  <button title="Image">🖼️</button>
                  <button title="Poll">📊</button>
                  <button title="Cashtag">$</button>
                  <button title="Community">💬</button>
                </div>
                <button className="px-6 py-2 rounded-full bg-brogreen text-black font-black">Post</button>
              </div>
            </div>
          </div>
        </section>
        {/* Posts and loading placeholder */}
        <section>
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200">
            <div>
              <h2 className="font-black text-lg">Recent Posts</h2>
              <p className="text-xs text-slate-500">All desks, newest first.</p>
            </div>
            <select className="px-3 py-2 rounded-full bg-white border border-slate-200 text-sm font-bold outline-none">
              <option value="newest">Newest</option>
              <option value="bullish">Most Uptrended</option>
              <option value="bearish">Most Downtrended</option>
              <option value="active">Most Active</option>
            </select>
          </div>
          <ul>{/* Posts list placeholder */}</ul>
          <div className="p-6 text-center text-slate-500 font-bold">Loading feed...</div>
        </section>
      </main>

      {/* Right Sidebar */}
      <aside className="hidden xl:block min-h-screen sticky top-0 bg-white">
        <div className="h-screen overflow-y-auto px-5 py-4 space-y-4">
          {/* Profile card placeholder */}
          <button className="w-full flex items-center justify-between gap-3 p-3 rounded-3xl panel hover:bg-slate-50 text-left" aria-label="Open profile" title="Open profile" tabIndex={0}>
            <div className="flex items-center gap-3 min-w-0">
              <img src="https://ui-avatars.com/api/?name=User&background=050816&color=B6FF22" alt="Profile" className="w-12 h-12 rounded-full object-cover border-2 border-brogreen bg-slate-700" />
              <div className="min-w-0">
                <div className="font-black truncate">User</div>
                <div className="text-xs text-slate-500 truncate">@bro</div>
                <div className="flex gap-4 mt-1">
                  <a className="cursor-pointer text-xs font-bold text-slate-600 hover:underline"><span>0</span> Following</a>
                  <a className="cursor-pointer text-xs font-bold text-slate-600 hover:underline"><span>0</span> Followers</a>
                </div>
              </div>
            </div>
            <span className="text-slate-500 font-black">•••</span>
          </button>
          {/* Markets and trending placeholder */}
          <section className="panel rounded-3xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="px-4 py-2 rounded-2xl bg-brogreen text-black font-black text-base shadow inline-block mb-2">Markets</p>
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-xl">Paper Trading Hub</h2>
                  <button className="ml-2 p-1 rounded-full bg-broblue text-white" title="Expand Paper Trading Hub" aria-label="Expand Paper Trading Hub">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              <button className="text-xs font-black px-3 py-2 rounded-full soft-card" aria-label="Toggle theme" title="Toggle light/dark theme" tabIndex={0}>Theme</button>
            </div>
            {/* Asset search and watchlist placeholder */}
            <div className="relative mb-4">
              <input className="w-full px-4 py-3 pl-10 rounded-2xl bg-slate-100 border border-slate-200 outline-none text-sm font-bold" placeholder="Search stocks, options, or crypto..." aria-label="Asset search" title="Search stocks, options, or crypto" tabIndex={0} />
              <svg className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
              <div className="hidden absolute left-0 right-0 top-14 panel rounded-2xl p-2 z-50 max-h-96 overflow-y-auto shadow-xl"></div>
            </div>
            {/* Watchlist and positions placeholder */}
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <div className="soft-card rounded-2xl p-3"><div className="text-[10px] text-slate-500 font-black uppercase">Paper Cash</div><div className="font-black text-sm">$100,000</div></div>
              <div className="soft-card rounded-2xl p-3"><div className="text-[10px] text-slate-500 font-black uppercase">P&L</div><div className="font-black text-sm text-green-600">$0</div></div>
              <div className="soft-card rounded-2xl p-3"><div className="text-[10px] text-slate-500 font-black uppercase">Positions</div><div className="font-black text-sm">0</div></div>
            </div>
            {/* Trending topics placeholder */}
            <section className="panel rounded-3xl p-4">
              <h2 className="font-black text-xl mb-3">Trending Topics</h2>
              <div className="space-y-3">{/* Trending topics list placeholder */}</div>
            </section>
          </section>
        </div>
      </aside>
    </div>
  );
}
