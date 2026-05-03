
import React from "react";
import "../index.css";
import AuthForm from "./AuthForm";
import PostThread from "./PostThread";
import UserProfile from "./UserProfile";
import FinanceNotifications from "./FinanceNotifications";

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-[#2563eb]/35 to-[#b6ff22]/25 text-white font-inter">
      <header className="px-6 py-5">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/mainlogo.png" alt="Bro Liquidity Logo" className="w-14 h-14 rounded-2xl object-cover" />
            <div>
              <h1 className="font-black text-xl tracking-tight">Bro Liquidity</h1>
              <p className="text-xs text-slate-400">Trades. Licenses. Careers.</p>
            </div>
          </div>
          <div className="flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#features" className="hover:text-[#b6ff22]">Features</a>
            <a href="#community" className="hover:text-[#b6ff22]">Community</a>
            <a href="#waitlist" className="hover:text-[#b6ff22]">Join Waitlist</a>
            <FinanceNotifications />
          </div>
        </nav>
      </header>
      <main>
        <section className="max-w-7xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/20 border border-blue-400/30 text-sm font-bold text-[#b6ff22] mb-6">
              Finance talk without the corporate filter
            </div>
            <h2 className="text-5xl md:text-7xl font-black leading-tight tracking-tight">
              Reddit for <span className="text-[#b6ff22]">finance bros</span>.
            </h2>
            <p className="mt-6 text-lg md:text-xl text-slate-300 max-w-xl">
              Bro Liquidity is a community platform for stock trade discussions, finance jobs, licensing exams, career moves, and market takes.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <a href="#waitlist" className="px-8 py-4 rounded-2xl bg-[#b6ff22] text-black font-black text-center hover:scale-105 transition">
                Join the Waitlist
              </a>
              <a href="#features" className="px-8 py-4 rounded-2xl border border-white/20 font-black text-center hover:border-[#b6ff22] transition">
                Explore Features
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-[#b6ff22]/20 blur-3xl rounded-full"></div>
            <img src="/mainlogo.png" alt="Bro Liquidity mascot logo" className="relative logo-glow rounded-[2rem] w-full max-w-lg mx-auto" />
          </div>
        </section>
        <AuthForm />
        <UserProfile />
        <PostThread />
        {/* Platform features and community sections will go here */}
      </main>
    </div>
  );
}

export default App;
