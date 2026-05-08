import React, { useState } from "react";
import BroLLMChat from "./BroLLMChat";

export default function SidebarBroLLM() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      <button
        className="w-full px-4 py-2 rounded-xl bg-brogreen text-black font-bold mb-2 hover:scale-105 transition"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close Bro LLM" : "Ask Bro (AI)"}
      </button>
      {open && (
        <div className="bg-white rounded-2xl shadow-xl p-2 mt-2 max-h-96 overflow-y-auto">
          <BroLLMChat />
        </div>
      )}
    </div>
  );
}
