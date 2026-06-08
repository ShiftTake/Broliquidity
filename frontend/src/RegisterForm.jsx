import React, { useState } from "react";
import { useRouter } from "next/router";
import { auth, db } from "../src/firebase";
import { createUserWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, signInWithPopup, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import Link from "next/link";

const getRandomDefaultAvatar = () => {
  const idx = Math.floor(Math.random() * 15) + 1;
  return `/defaults/default${idx}.png`;
};

export default function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const upsertSocialProfile = async (user) => {
    const randomAvatar = user.photoURL || getRandomDefaultAvatar();
    if (!user.photoURL) {
      await updateProfile(user, { photoURL: randomAvatar });
    }

    await setDoc(doc(db, "profiles", user.uid), {
      username: user.displayName || user.email,
      bio: "",
      email: user.email,
      photoURL: randomAvatar,
      createdAt: new Date()
    }, { merge: true });

    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      displayName: user.displayName || "",
      photoURL: randomAvatar,
      bio: "",
      createdAt: new Date()
    }, { merge: true });
  };

  const handleGoogleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      await upsertSocialProfile(user);
      router.push("/feed");
    } catch (err) {
      setError("Google sign-in failed: " + err.message);
    }
  };

  const handleAppleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const provider = new OAuthProvider("apple.com");
      provider.addScope("email");
      provider.addScope("name");
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      await upsertSocialProfile(user);
      router.push("/feed");
    } catch (err) {
      setError("Apple sign-in failed: " + err.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== password2) {
      setError("Passwords do not match");
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const randomAvatar = getRandomDefaultAvatar();
      await updateProfile(userCredential.user, { displayName, photoURL: randomAvatar });
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email,
        displayName,
        photoURL: randomAvatar,
        bio: "",
        createdAt: new Date()
      });
      router.push("/feed");
    } catch (err) {
      setError("Account creation failed: " + err.message);
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
              <h1 className="text-lg font-black tracking-tight text-white">Join the conversation</h1>
            </div>
          </div>

          <div className="mt-10 max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-slate-400">Create account</p>
            <h2 className="mt-4 text-4xl font-black leading-[0.95] text-white sm:text-5xl lg:text-6xl">
              Set up your profile and start posting immediately.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Your account unlocks a profile, communities, saved posts, and the tools you need to get into the feed fast.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-wide text-[#b6ff22]">Identity</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Pick a display name and get a default avatar automatically.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-wide text-[#b6ff22]">Access</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Join desks, save posts, and manage activity with no extra setup.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-wide text-[#b6ff22]">Speed</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Use email or Google sign-up and land in the feed right away.</p>
            </div>
          </div>
        </section>

        <section className="glass rounded-[2rem] p-8 sm:p-10 shadow-2xl shadow-black/25">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#b6ff22]">Sign up</p>
              <h3 className="mt-3 text-3xl font-black tracking-tight text-white">Create your account</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">Start with Google or Apple, or finish the form below.</p>
            </div>
            <Link href="/login" className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-slate-200 transition hover:border-[#b6ff22]/60 hover:text-[#b6ff22]">
              Sign in
            </Link>
          </div>

          <button onClick={handleGoogleSignIn} className="mt-8 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-900 transition hover:brightness-95">
            Sign up with Google
          </button>
          <button onClick={handleAppleSignIn} className="mt-3 w-full rounded-2xl border border-white/20 bg-black px-4 py-3 text-sm font-black text-white transition hover:brightness-110">
            Sign up with Apple
          </button>
          <div className="my-4 text-center text-xs font-black uppercase tracking-[0.24em] text-slate-500">or</div>

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <label className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">
              Email
              <input type="email" placeholder="you@example.com" className="mt-2 w-full rounded-2xl border border-white/10 bg-white/95 px-5 py-3 text-sm font-semibold text-slate-900 caret-slate-900 outline-none placeholder:text-slate-500 focus:border-[#b6ff22]/50 focus:ring-2 focus:ring-[#b6ff22]/10" style={{ color: "#0f172a", WebkitTextFillColor: "#0f172a" }} required value={email} onChange={e => setEmail(e.target.value)} />
            </label>
            <label className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">
              Password
              <input type="password" placeholder="Create a password" className="mt-2 w-full rounded-2xl border border-white/10 bg-white/95 px-5 py-3 text-sm font-semibold text-slate-900 caret-slate-900 outline-none placeholder:text-slate-500 focus:border-[#b6ff22]/50 focus:ring-2 focus:ring-[#b6ff22]/10" style={{ color: "#0f172a", WebkitTextFillColor: "#0f172a" }} required value={password} onChange={e => setPassword(e.target.value)} />
            </label>
            <label className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">
              Confirm Password
              <input type="password" placeholder="Confirm your password" className="mt-2 w-full rounded-2xl border border-white/10 bg-white/95 px-5 py-3 text-sm font-semibold text-slate-900 caret-slate-900 outline-none placeholder:text-slate-500 focus:border-[#b6ff22]/50 focus:ring-2 focus:ring-[#b6ff22]/10" style={{ color: "#0f172a", WebkitTextFillColor: "#0f172a" }} required value={password2} onChange={e => setPassword2(e.target.value)} />
            </label>
            <label className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">
              Username
              <input type="text" placeholder="Username (display name)" className="mt-2 w-full rounded-2xl border border-white/10 bg-white/95 px-5 py-3 text-sm font-semibold text-slate-900 caret-slate-900 outline-none placeholder:text-slate-500 focus:border-[#b6ff22]/50 focus:ring-2 focus:ring-[#b6ff22]/10" style={{ color: "#0f172a", WebkitTextFillColor: "#0f172a" }} required value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </label>
            <button type="submit" className="w-full rounded-2xl bg-[#b6ff22] px-4 py-3 text-sm font-black text-black transition hover:brightness-95">Create Account</button>
            {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-300">{error}</div>}
          </form>

          <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-slate-300">
            Already have an account?{' '}
            <Link href="/login" className="font-black text-[#b6ff22] underline decoration-[#b6ff22]/30 underline-offset-4">
              Login
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
