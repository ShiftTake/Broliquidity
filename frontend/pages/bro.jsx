
import React from "react";
import BroLLMChat from "../src/BroLLMChat";

export default function BroPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#050816]">
      <div className="w-full max-w-2xl panel rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#050816]">
          <a href="/feed" className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl soft-card text-xs font-black tracking-wide text-slate-500 hover:text-broblue transition-colors">
            ← BACK TO FEED
          </a>
          <div className="text-right flex flex-col items-end">
            <h1 className="font-black text-lg leading-none">Bro</h1>
          </div>
          <div className="flex items-center gap-2">
            <img src="/mainlogo.png" alt="BroLiquidity Logo" className="w-10 h-10 rounded-2xl object-cover border border-slate-200 dark:border-white/10" />
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="soft-card rounded-2xl rounded-tl-none p-4 text-sm font-semibold leading-relaxed max-w-[85%] mb-4">
            Yo! Welcome to the desk. Ask me anything about trade theses, options metrics, or interview intelligence. Let's maximize that upside.
          </div>
          <BroLLMChat fullPage />
        </div>
        <div className="flex items-center justify-between px-6 py-2 border-t border-slate-100 dark:border-white/10 bg-white dark:bg-[#050816]">
          <p className="text-[10px] text-slate-400 font-medium">Powered by Gemini Pro Architecture</p>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">System Terminal Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
