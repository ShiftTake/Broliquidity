import React, { useState } from "react";
import { useRouter } from "next/router";
import { auth, db } from "../src/firebase";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import Link from "next/link";

export default function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleGoogleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      await setDoc(doc(db, "profiles", user.uid), {
        username: user.displayName || user.email,
        bio: '',
        email: user.email,
        createdAt: new Date()
      }, { merge: true });
      router.push("/feed");
    } catch (err) {
      setError("Google sign-in failed: " + err.message);
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
      await updateProfile(userCredential.user, { displayName });
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email,
        displayName,
        photoURL: userCredential.user.photoURL || '',
        bio: ""
      });
      router.push("/feed");
    } catch (err) {
      setError("Account creation failed: " + err.message);
    }
  };

  return (
    <div className="bg-[#050816] text-white font-sans flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-8 rounded-2xl glass shadow-lg">
        <h2 className="text-3xl font-black mb-6 text-center">Create Your Account</h2>
        <button onClick={handleGoogleSignIn} className="w-full px-4 py-3 rounded-2xl bg-[#b6ff22] text-black font-black hover:scale-105 transition mb-4">Sign up with Google</button>
        <div className="mb-4 text-slate-400 font-bold text-center">or</div>
        <form onSubmit={handleRegister} className="flex flex-col gap-3">
          <input type="email" placeholder="Email" className="px-5 py-3 rounded-2xl bg-white text-black outline-none font-semibold w-full" required value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="px-5 py-3 rounded-2xl bg-white text-black outline-none font-semibold w-full" required value={password} onChange={e => setPassword(e.target.value)} />
          <input type="password" placeholder="Confirm Password" className="px-5 py-3 rounded-2xl bg-white text-black outline-none font-semibold w-full" required value={password2} onChange={e => setPassword2(e.target.value)} />
          <input type="text" placeholder="Username (display name)" className="px-5 py-3 rounded-2xl bg-white text-black outline-none font-semibold w-full" required value={displayName} onChange={e => setDisplayName(e.target.value)} />
          <button type="submit" className="w-full px-4 py-3 rounded-2xl bg-blue-600 text-white font-bold hover:scale-105 transition">Create Account</button>
          {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
        </form>
        <div className="mt-6 text-center text-slate-400 text-sm">
          Already have an account? <Link href="/login" className="text-[#b6ff22] underline">Login</Link>
        </div>
      </div>
    </div>
  );
}
