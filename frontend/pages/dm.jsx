
import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../src/firebase";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";

export default function DM() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [users, setUsers] = useState([]);
  const user = auth.currentUser;
  const messagesEndRef = useRef(null);

  // Fetch all users for new DM
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users"));
    const unsub = onSnapshot(q, snap => {
      setUsers(snap.docs.filter(d => d.id !== user.uid).map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  // Fetch conversations
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "conversations"), where("participants", "array-contains", user.uid));
    const unsub = onSnapshot(q, snap => {
      setConversations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selected) return setMessages([]);
    const q = query(collection(db, `conversations/${selected}/messages`), orderBy("createdAt"));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsub();
  }, [selected]);

  // Start or select a conversation
  const startConversation = async (otherId) => {
    if (!user) return;
    let convo = conversations.find(c => c.participants.includes(otherId));
    if (!convo) {
      const doc = await addDoc(collection(db, "conversations"), {
        participants: [user.uid, otherId],
        createdAt: serverTimestamp()
      });
      convo = { id: doc.id, participants: [user.uid, otherId] };
    }
    setSelected(convo.id);
  };

  // Send a message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!user || !selected || !newMessage.trim()) return;
    await addDoc(collection(db, `conversations/${selected}/messages`), {
      sender: user.uid,
      text: newMessage,
      createdAt: serverTimestamp()
    });
    setNewMessage("");
  };

  if (!user) return <div className="p-8 text-slate-400">Sign in to use direct messages.</div>;

  // Find the other user in the current conversation
  const activeConvo = conversations.find(c => c.id === selected);
  const otherUserId = activeConvo?.participants?.find(pid => pid !== user.uid);
  const otherUser = users.find(u => u.id === otherUserId);

  // Avatar helper
  const getAvatar = (u) => {
    const name = u?.displayName || u?.email || "User";
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=050816&color=B6FF22`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-[#0f172a]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <Link href="/feed" className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl soft-card text-xs font-black tracking-wide text-slate-500 hover:text-broblue transition-colors">
          ← BACK TO FEED
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-black text-lg tracking-tight">SECURE CHAT PROTOCOL</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col py-8 px-4">
          <h2 className="text-lg font-black mb-6 px-2">Direct Messages</h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            {users.map(u => {
              // Find if a conversation exists with this user
              const convo = conversations.find(c => c.participants.includes(u.id));
              const isActive = convo && convo.id === selected;
              return (
                <button
                  key={u.id}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all
                    ${isActive
                      ? "bg-brogreen text-black font-black shadow-lg"
                      : "soft-card hover:bg-slate-100 text-slate-700"
                    }`}
                  onClick={() => startConversation(u.id)}
                >
                  <img src={getAvatar(u)} alt={u.displayName || u.email || u.id} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                  <span className="truncate">{u.displayName || u.email || u.id}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div id="active-chat-header" className="flex items-center gap-4 px-8 py-6 border-b border-slate-200 bg-white min-h-[80px]">
            {otherUser ? (
              <>
                <img src={getAvatar(otherUser)} alt={otherUser.displayName || otherUser.email || otherUser.id} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                <div>
                  <div className="font-black text-lg">{otherUser.displayName || otherUser.email || otherUser.id}</div>
                  <div className="text-xs text-slate-400">Direct Message</div>
                </div>
              </>
            ) : (
              <div className="text-slate-400 font-semibold">Select a user to start chatting</div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-8 py-6 bg-[#f8fafc] space-y-4">
            {messages.map(m => {
              const isMe = m.sender === user.uid;
              return (
                <div
                  key={m.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div className={`
                    max-w-[70%] px-5 py-3 mb-1
                    ${isMe
                      ? "bg-brogreen text-black rounded-2xl rounded-tr-sm font-bold"
                      : "bg-white border border-slate-200/60 text-slate-800 rounded-2xl rounded-tl-sm"
                    }
                  `}>
                    {m.text}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          {selected && (
            <form id="dm-form" onSubmit={sendMessage} className="flex items-center gap-4 px-8 py-6 border-t border-slate-200 bg-white">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 px-5 py-4 rounded-2xl bg-slate-100 border border-slate-200/60 outline-none text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-broblue transition-all"
              />
              <button
                type="submit"
                className="px-8 py-4 rounded-2xl bg-brogreen text-black font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all shadow-md"
              >
                Transmit
              </button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
