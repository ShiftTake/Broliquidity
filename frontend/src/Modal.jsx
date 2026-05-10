import React from "react";

export default function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 relative max-w-lg w-full">
        <button
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 text-2xl font-black flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700 transition"
          aria-label="Close modal"
          title="Close"
          onClick={onClose}
        >
          &times;
        </button>
        {children}
      </div>
    </div>
  );
}
