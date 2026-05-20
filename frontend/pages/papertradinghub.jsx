import React from "react";

export default function PaperTradingHub() {
  return (
    <div className="font-sans antialiased min-h-screen bg-[#f8fafc] text-[#0f172a] dark:bg-[#050816] dark:text-white pb-12">
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#050816]/90 backdrop-blur-xl px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/feed" className="px-4 py-2 rounded-2xl soft-card text-xs font-black tracking-wider text-slate-500 hover:text-broblue transition-colors">← BACK TO FEED</a>
            <div>
              <span className="text-[10px] font-black tracking-[0.28em] uppercase text-brogreen block">BROLIQUIDITY DESK</span>
              <h1 className="text-xl font-black">Paper Trading Hub</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <form className="flex items-center gap-2">
              <input type="number" min="1" step="1000" className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold w-28 outline-none focus:border-broblue" placeholder="Reset Capital" />
              <button type="submit" className="px-3 py-2 rounded-xl bg-broblue text-white text-xs font-black uppercase tracking-wider">Reset</button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ...rest of the static content would go here... */}
        <div className="lg:col-span-2 space-y-6">
          <section className="panel rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <p className="text-xs font-black tracking-[0.2em] uppercase text-slate-400">Total Portfolio Value</p>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 mt-1 mb-4">
              <h2 className="text-4xl font-black tracking-tight">$100,000.00</h2>
              <div className="text-sm font-black text-emerald-500 flex items-center gap-1">+0.00%</div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
