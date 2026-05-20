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

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/feed");
    } catch (err) {
      setError("Login failed: " + err.message);
    }
  };

  return (
    <div className="bg-[#050816] text-white font-sans flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-8 rounded-2xl glass shadow-lg">
        <h2 className="text-3xl font-black mb-6 text-center">Login</h2>
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <input type="email" placeholder="Email" className="px-5 py-3 rounded-2xl bg-white text-black outline-none font-semibold w-full" required value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="px-5 py-3 rounded-2xl bg-white text-black outline-none font-semibold w-full" required value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit" className="w-full px-4 py-3 rounded-2xl bg-blue-600 text-white font-bold hover:scale-105 transition">Login</button>
          {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
        </form>
        <div className="mt-6 text-center text-slate-400 text-sm">
          Don't have an account? <Link href="/register" className="text-[#b6ff22] underline">Create one</Link>
        </div>
      </div>
    </div>
  );
}
