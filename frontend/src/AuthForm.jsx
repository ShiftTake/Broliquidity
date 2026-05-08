import React, { useState } from "react";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Assign random default profile image
        const randomIdx = Math.floor(Math.random() * 15) + 1;
        const defaultPhotoURL = `/default${randomIdx}.png`;
        await updateProfile(userCredential.user, { photoURL: defaultPhotoURL });
        // Also store in Firestore user profile
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email,
          displayName: userCredential.user.displayName || "",
          photoURL: defaultPhotoURL,
          bio: ""
        });
        setUser({ ...userCredential.user, photoURL: defaultPhotoURL });
        navigate("/feed");
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        setUser(userCredential.user);
        navigate("/feed");
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
            <label htmlFor="auth-email" className="block text-xs text-slate-400 mb-1">Email address</label>
            <input
              id="auth-email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mb-4 px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
              required
              aria-label="Email address"
              autoComplete="email"
            />
            <label htmlFor="auth-password" className="block text-xs text-slate-400 mb-1">Password</label>
            <input
              id="auth-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mb-4 px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
              required
              aria-label="Password"
              autoComplete="current-password"
            />
            {error && <div className="text-red-400 mb-4">{error}</div>}
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-xl bg-[#b6ff22] text-black font-bold hover:scale-105 transition mb-3 focus:outline-none focus:ring-2 focus:ring-brogreen"
              aria-label={isSignUp ? "Sign up for BroLiquidity" : "Sign in to BroLiquidity"}
              title={isSignUp ? "Sign up for BroLiquidity" : "Sign in to BroLiquidity"}
            >
              {isSignUp ? "Sign Up" : "Sign In"}
            </button>
            <div className="text-center mb-3">
              <button
                type="button"
                className="text-[#b6ff22] hover:underline text-sm focus:outline-none focus:ring-2 focus:ring-brogreen"
                onClick={() => setIsSignUp((v) => !v)}
                aria-label={isSignUp ? "Switch to sign in" : "Switch to sign up"}
                title={isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
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
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white text-black font-bold hover:scale-105 transition border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brogreen"
            type="button"
            aria-label="Sign in with Google"
            title="Sign in with Google"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google logo" className="w-5 h-5" />
            Sign in with Google
          </button>
        </>
      )}
    </div>
  );
}

export default AuthForm;
