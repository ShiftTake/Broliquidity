

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { setGeminiApiKey, askBroLLM } from "../src/broai.js";

export default function BroPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  // Initialize the API key on mount
  useEffect(() => {
    // Note: We are using your key here to get it working, 
    // but you should eventually move this to a .env.local file!
    setGeminiApiKey("AIzaSyBXMdogkBz-B_Poo7-ZDGH2XsSRj4qPXCE");
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    setInput(""); // Clear input box instantly
    setMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setLoading(true);

    try {
      // Call your real AI logic from broai.js
      const response = await askBroLLM(userText);
      setMessages((prev) => [...prev, { sender: "bro", text: response }]);
    } catch (error) {
      console.error("LLM Error:", error);
      setMessages((prev) => [
        ...prev,
        { sender: "bro", text: "Yo, the terminal is glitching. Check the connection." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#050816]">
      <div className="w-full max-w-2xl panel rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#050816]">
          <Link className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl soft-card text-xs font-black tracking-wide text-slate-500 hover:text-broblue transition-colors" href="/feed">
            ← BACK TO FEED
          </Link>
          <div className="text-right flex flex-col items-end">
            <h1 className="font-black text-lg leading-none text-slate-800 dark:text-white">Bro</h1>
          </div>
          <div className="flex items-center gap-2">
            <img src="/mainlogo.png" alt="BroLiquidity Logo" className="w-10 h-10 rounded-2xl object-cover border border-slate-200 dark:border-white/10" />
          </div>
        </div>

        {/* CHAT MESSAGE AREA */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide bg-slate-50/50 dark:bg-[#050816]/30">
            {/* Welcome Message */}
            <div className="soft-card rounded-2xl rounded-tl-none p-4 text-sm font-semibold leading-relaxed max-w-[85%] text-slate-800 dark:text-white">
              Yo! Welcome to the desk. Ask me anything about trade theses, options metrics, or interview intelligence. Let's maximize that upside.
            </div>
            {/* Render User and AI Messages */}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-sm font-medium shadow-sm ${
                  msg.sender === "user" 
                    ? "bg-broblue text-white rounded-tr-none" 
                    : "bg-brogreen text-black rounded-tl-none"
                }`}>
                  <span className="font-black mr-2 uppercase text-[10px] opacity-60 tracking-wider block mb-1">
                    {msg.sender === "user" ? "You" : "Bro"}
                  </span>
                  {msg.text}
                </div>
              </div>
            ))}
            {/* Loading Indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-brogreen text-black max-w-[85%] shadow-sm">
                  <span className="italic text-sm font-medium opacity-70">Crunching numbers...</span>
                </div>
              </div>
            )}
          </div>
          {/* INPUT FORM */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-slate-100 dark:border-white/10 bg-white dark:bg-[#050816]">
            <div className="flex items-center gap-2 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Bro Anything..."
                autoComplete="off"
                disabled={loading}
                className="w-full px-5 py-4 pr-24 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 outline-none text-sm font-semibold text-slate-800 dark:text-white placeholder:text-slate-400 focus:border-broblue transition-all"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="absolute right-2 top-2 bottom-2 px-5 rounded-xl bg-brogreen text-black font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all shadow-md disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </div>

        {/* FOOTER */}
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
