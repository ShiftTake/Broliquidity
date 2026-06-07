import React, { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../src/firebase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccess("Password reset email sent. Check your inbox for the clickable reset link.");
    } catch (err) {
      setError("Password reset failed: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="bg-[#050816] text-white font-sans flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md p-8 rounded-2xl glass shadow-lg">
        <h1 className="text-3xl font-black text-center mb-3">Reset Password</h1>
        <p className="text-sm text-slate-400 text-center mb-6">
          Enter your email and we will send you a clickable password reset link.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            className="px-5 py-3 rounded-2xl bg-white text-black outline-none font-semibold w-full"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <button
            type="submit"
            className="w-full px-4 py-3 rounded-2xl bg-blue-600 text-white font-bold hover:scale-105 transition disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
          {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
          {success && <div className="text-green-400 text-sm mt-2">{success}</div>}
        </form>

        <div className="mt-6 text-center text-slate-400 text-sm">
          Remember your password? <Link href="/login" className="text-[#b6ff22] underline">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
