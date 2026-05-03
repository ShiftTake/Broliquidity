import React, { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";

function NotificationBell({ onClick, unreadCount }) {
  return (
    <button onClick={onClick} className="relative">
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-[#b6ff22]">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-green-500 text-xs text-white rounded-full px-1.5 py-0.5 font-bold">
          {unreadCount}
        </span>
      )}
    </button>
  );
}

function FinanceNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [show, setShow] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("recipient", "==", user.email),
      where("read", "==", false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(notifs);
      setUnreadCount(notifs.length);
    });
    return unsubscribe;
  }, [user]);

  const handleMarkAllRead = async () => {
    for (const notif of notifications) {
      await updateDoc(doc(db, "notifications", notif.id), { read: true });
    }
    setShow(false);
  };

  return (
    <div className="relative inline-block ml-4">
      <NotificationBell onClick={() => setShow(!show)} unreadCount={unreadCount} />
      {show && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-[#b6ff22]/30 rounded-xl shadow-lg z-50">
          <div className="flex justify-between items-center px-4 py-2 border-b border-[#b6ff22]/20">
            <span className="font-bold text-[#b6ff22]">Finance Alerts</span>
            <button onClick={handleMarkAllRead} className="text-xs text-green-400 hover:underline">Mark all read</button>
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <li className="px-4 py-3 text-slate-400">No new alerts.</li>
            ) : notifications.map(n => (
              <li key={n.id} className="px-4 py-3 border-b border-slate-800 last:border-0 text-white">
                <div className="font-semibold text-[#b6ff22] mb-1">{n.type === "comment" ? "New Comment" : n.type === "bullish" ? "Bullish Vote" : n.type === "bearish" ? "Bearish Vote" : "Finance Alert"}</div>
                <div className="text-slate-300 text-sm">{n.message}</div>
                <div className="text-xs text-slate-500 mt-1">{n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : ""}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default FinanceNotifications;
