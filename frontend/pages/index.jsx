


import Link from "next/link";
import { useRouter } from "next/router";
import Image from "next/image";

export default function Index() {
  const router = useRouter();

  return (
    <div className="min-h-screen text-white bg-[#050816] selection:bg-[#b6ff22] selection:text-black flex flex-col justify-between relative overflow-x-hidden">
      {/* BACKGROUND RADIAL GRADIENTS */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-600/35 blur-[120px] rounded-full transform -translate-x-1/4 -translate-y-1/4"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#a3ff12]/20 blur-[120px] rounded-full transform translate-x-1/4 -translate-y-1/4"></div>
      </div>

      {/* HEADER */}
      <header className="px-6 py-5 w-full z-50 relative">
        <nav className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-fit">
            <Image
              src="/mainlogo.png"
              alt="Bro Liquidity Logo"
              width={56}
              height={56}
              className="w-14 h-14 rounded-2xl object-cover logo-glow"
              priority
            />
            <div>
              <h1 className="font-black text-xl tracking-tight leading-tight">
                Bro Liquidity
              </h1>
              <p className="text-xs text-slate-400">
                Trades. Licenses. Careers.
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#features" className="hover:text-[#b6ff22] transition-colors duration-200">
              Features
            </a>
            <a href="#community" className="hover:text-[#b6ff22] transition-colors duration-200">
              Community
            </a>
            <a href="#user-flow" className="hover:text-[#b6ff22] transition-colors duration-200">
              Get Started
            </a>
            <button
              onClick={() => router.push("/login")}
              className="ml-6 px-6 py-2 rounded-2xl bg-[#b6ff22] text-black font-black hover:scale-105 transition-all duration-200"
            >
              Login
            </button>
          </div>
        </nav>
      </header>

      {/* HERO SECTION */}
      <main className="w-full flex-grow relative z-10">
        <section className="max-w-7xl mx-auto px-6 py-12 md:py-20 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Text Column: Displays first on desktop, second on mobile */}
          <div className="flex flex-col justify-center order-2 lg:order-1">
            <div className="inline-flex w-fit items-center gap-2 px-4 py-2 rounded-full bg-blue-600/20 border border-blue-400/30 text-sm font-bold text-[#b6ff22] mb-6">
              Finance talk without the corporate filter
            </div>

            <h2 className="text-4xl md:text-6xl lg:text-7xl font-black leading-tight tracking-tight">
              The community for{" "}
              <span className="text-[#b6ff22]">finance bros</span>.
            </h2>

            <p className="mt-6 text-base md:text-xl text-slate-300 max-w-xl">
              Bro Liquidity is a community platform for stock trade discussions,
              finance jobs, licensing exams, career moves, and market takes.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                href="/register"
                className="px-8 py-4 rounded-2xl bg-[#b6ff22] text-black font-black text-center hover:scale-105 transition duration-200"
              >
                Create an Account
              </Link>
              <a
                href="#features"
                className="px-8 py-4 rounded-2xl border border-white/20 font-black text-center hover:border-[#b6ff22] hover:text-[#b6ff22] transition duration-200"
              >
                Explore Features
              </a>
            </div>
          </div>

          {/* Right Mascot Column: Prevents giant asset overflow */}
          <div className="relative flex justify-center items-center order-1 lg:order-2 max-w-full p-4">
            <div className="absolute w-72 h-72 bg-[#b6ff22]/20 blur-3xl rounded-full pointer-events-none"></div>
            <div className="relative w-full max-w-sm md:max-w-md lg:max-w-lg aspect-square">
              <Image
                src="/mainlogo.png"
                alt="Bro Liquidity mascot logo"
                fill
                sizes="(max-w-768px) 100vw, (max-w-1200px) 50vw, 33vw"
                className="object-contain logo-glow rounded-[2rem]"
                priority
              />
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h3 className="text-4xl font-black">
              Built for the finance crowd
            </h3>
            <p className="text-slate-400 mt-3">
              Trading, licensing, and career conversations in one place.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="glass pop-card rounded-3xl p-7">
              <div className="text-4xl mb-4">📈</div>
              <h4 className="text-2xl font-black mb-3">
                Trade Threads
              </h4>
              <p className="text-slate-300">
                Post stock ideas, market takes, option plays,
                earnings reactions, and watchlists.
              </p>
            </div>

            <div className="glass pop-card rounded-3xl p-7">
              <div className="text-4xl mb-4">📚</div>
              <h4 className="text-2xl font-black mb-3">
                License Talk
              </h4>
              <p className="text-slate-300">
                Discuss Series 7, SIE, CFA, CPA,
                FINRA exams, study plans, and career requirements.
              </p>
            </div>

            <div className="glass pop-card rounded-3xl p-7">
              <div className="text-4xl mb-4">💼</div>
              <h4 className="text-2xl font-black mb-3">
                Finance Jobs
              </h4>
              <p className="text-slate-300">
                Share job openings, interview tips,
                resume feedback, compensation data, and referrals.
              </p>
            </div>
          </div>
        </section>

        {/* COMMUNITY */}
        <section id="community" className="px-6 py-20">
          <div className="max-w-5xl mx-auto glass rounded-[2rem] p-8 md:p-12 text-center">
            <h3 className="text-4xl md:text-5xl font-black mb-5">
              Where market takes meet career moves.
            </h3>
            <p className="text-slate-300 text-lg max-w-3xl mx-auto">
              Bro Liquidity gives finance people a place to talk openly
              about trades, jobs, licenses, networking, and what is
              actually happening in the industry.
            </p>

            <div className="mt-10 grid sm:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-white/5 p-5 border border-white/10">
                <p className="text-3xl font-black text-[#b6ff22]">
                  Stocks
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  Markets & trade ideas
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 p-5 border border-white/10">
                <p className="text-3xl font-black text-[#b6ff22]">
                  Careers
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  Jobs & interviews
                </p>
              </div>

              <div className="rounded-2xl bg-white/5 p-5 border border-white/10">
                <p className="text-3xl font-black text-[#b6ff22]">
                  Licenses
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  Exam prep & advice
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/10 px-6 py-8 text-center text-slate-500 text-sm w-full relative z-10">
        © 2026 Bro Liquidity. Built for finance conversations.
      </footer>
    </div>
  );
}