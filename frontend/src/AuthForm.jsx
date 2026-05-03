import React, { useState } from "react";
import { auth } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
  const handleGoogleSignIn = async () => {
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      setUser(userCredential.user);
    } catch (err) {
      setError(err.message);
    }
  };

function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        setUser(userCredential.user);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        setUser(userCredential.user);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <div className="glass max-w-md mx-auto mt-12 p-8 rounded-2xl shadow-lg">
      {user ? (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Welcome, {user.email}</h2>
          <button onClick={handleSignOut} className="mt-4 px-6 py-2 rounded-xl bg-[#b6ff22] text-black font-bold hover:scale-105 transition">Sign Out</button>
        </div>
      ) : (
        <>
          <form onSubmit={handleAuth}>
            <h2 className="text-2xl font-bold mb-6">{isSignUp ? "Sign Up" : "Sign In"}</h2>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mb-4 px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mb-4 px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
              required
            />
            {error && <div className="text-red-400 mb-4">{error}</div>}
            <button type="submit" className="w-full px-4 py-2 rounded-xl bg-[#b6ff22] text-black font-bold hover:scale-105 transition mb-3">
              {isSignUp ? "Sign Up" : "Sign In"}
            </button>
            <div className="text-center mb-3">
              <button
                type="button"
                className="text-[#b6ff22] hover:underline text-sm"
                onClick={() => setIsSignUp((v) => !v)}
              >
                {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
              </button>
            </div>
          </form>
          <div className="flex items-center my-4">
            <div className="flex-grow border-t border-slate-700"></div>
            <span className="mx-3 text-slate-400 text-xs">or</span>
            <div className="flex-grow border-t border-slate-700"></div>
          </div>
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white text-black font-bold hover:scale-105 transition border border-slate-200"
            type="button"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
            Sign in with Google
          </button>
        </>
      )}
    </div>
  );
}

export default AuthForm;
