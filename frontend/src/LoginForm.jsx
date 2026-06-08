import React, { useState } from "react";
import { useRouter } from "next/router";
import { auth } from "../src/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const getAuthErrorMessage = (code) => {
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
      case "auth/invalid-email":
        return "Invalid email or password.";
      case "auth/user-disabled":
        return "This account has been disabled.";
      case "auth/too-many-requests":
        return "Too many login attempts. Please try again later.";
      case "auth/network-request-failed":
        return "Network error. Check your connection and try again.";
      default:
        return "Login failed. Please try again.";
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/feed");
    } catch (err) {
      setError(getAuthErrorMessage(err?.code));
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-[#2563eb]/30 blur-3xl" />
        <div className="absolute right-[-6rem] top-16 h-80 w-80 rounded-full bg-[#b6ff22]/18 blur-3xl" />
        <div className="absolute bottom-[-9rem] left-1/3 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,460px)]">
        <section className="glass rounded-[2rem] p-8 sm:p-10 lg:p-12">
          <div className="flex items-center gap-3">
            <img src="/mainlogo.png" alt="BroLiquidity" className="h-14 w-14 rounded-2xl object-cover logo-glow" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#b6ff22]">BroLiquidity</p>
              <h1 className="text-lg font-black tracking-tight text-white">Finance talk with signal</h1>
            </div>
          </div>

          <div className="mt-10 max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-slate-400">Welcome back</p>
            <h2 className="mt-4 text-4xl font-black leading-[0.95] text-white sm:text-5xl lg:text-6xl">
              Log in and get back to the desks that matter.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Jump back into market conversations, community threads, and saved posts from a cleaner, sharper entry point.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-wide text-[#b6ff22]">Feed</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Resume your feed without digging through clutter.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-wide text-[#b6ff22]">Communities</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Catch up on rooms, moderation updates, and live threads.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-wide text-[#b6ff22]">Profile</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Get back to your timeline, saves, and account tools fast.</p>
            </div>
          </div>
        </section>

        <section className="glass rounded-[2rem] p-8 sm:p-10 shadow-2xl shadow-black/25">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#b6ff22]">Login</p>
              <h3 className="mt-3 text-3xl font-black tracking-tight text-white">Access your account</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">Use your email and password to continue.</p>
            </div>
            <Link href="/register" className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-slate-200 transition hover:border-[#b6ff22]/60 hover:text-[#b6ff22]">
              Sign up
            </Link>
          </div>

          <form onSubmit={handleLogin} className="mt-8 flex flex-col gap-4">
            <label className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">
              Email
              <input
                type="email"
                placeholder="you@example.com"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/95 px-5 py-3 text-sm font-semibold text-slate-900 caret-slate-900 outline-none placeholder:text-slate-500 focus:border-[#b6ff22]/50 focus:ring-2 focus:ring-[#b6ff22]/10"
                style={{ color: "#0f172a", WebkitTextFillColor: "#0f172a" }}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">
              Password
              <input
                type="password"
                placeholder="Enter your password"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/95 px-5 py-3 text-sm font-semibold text-slate-900 caret-slate-900 outline-none placeholder:text-slate-500 focus:border-[#b6ff22]/50 focus:ring-2 focus:ring-[#b6ff22]/10"
                style={{ color: "#0f172a", WebkitTextFillColor: "#0f172a" }}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <button type="submit" className="w-full rounded-2xl bg-[#b6ff22] px-4 py-3 text-sm font-black text-black transition hover:brightness-95">
              Login
            </button>

            <div className="flex items-center justify-between gap-4 text-sm">
              <Link href="/forgot-password" className="font-black text-slate-300 underline decoration-white/20 underline-offset-4 transition hover:text-white">
                Forgot Password?
              </Link>
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Secure sign in</span>
            </div>

            {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-300">{error}</div>}
          </form>

          <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-slate-300">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-black text-[#b6ff22] underline decoration-[#b6ff22]/30 underline-offset-4">
              Create one
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
