
import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../src/firebase";
import { addDoc, collection, doc, endAt, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, startAt, where } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/router";
import { getAvatarUrl } from "../src/avatarDefaults";

export default function DM() {
  const router = useRouter();
  const dmTargetId = Array.isArray(router.query.userId) ? router.query.userId[0] : router.query.userId;
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [usersById, setUsersById] = useState({});
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState("");
  const [autoStartedDm, setAutoStartedDm] = useState(false);
  const user = auth.currentUser;
  const messagesEndRef = useRef(null);

  const upsertUsers = (incomingUsers) => {
    setUsersById((prev) => {
      const next = { ...prev };
      incomingUsers.forEach((u) => {
        if (!u?.id) return;
        const merged = { ...(next[u.id] || {}), ...u };
        next[u.id] = {
          ...merged,
          photoURL: getAvatarUrl(merged, u.id)
        };
      });
      return next;
    });
  };

  // Fetch conversations
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "conversations"), where("participants", "array-contains", user.uid));
    const unsub = onSnapshot(q, snap => {
      setConversations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user?.uid) {
      setUsersById({});
      return;
    }

    const otherParticipantIds = [...new Set(
      conversations
        .flatMap((c) => c.participants || [])
        .filter((uid) => uid && uid !== user.uid)
    )];

    if (!otherParticipantIds.length) return;

    let cancelled = false;
    const loadConversationUsers = async () => {
      const loadedUsers = await Promise.all(
        otherParticipantIds.map(async (uid) => {
          try {
            const userSnap = await getDoc(doc(db, "users", uid));
            const userData = userSnap.exists() ? userSnap.data() : {};
            return { id: uid, ...userData };
          } catch {
            return { id: uid };
          }
        })
      );

      if (!cancelled) {
        upsertUsers(loadedUsers);
      }
    };

    loadConversationUsers();
    return () => {
      cancelled = true;
    };
  }, [conversations, user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setSearchResults([]);
      return;
    }

    const term = search.trim().toLowerCase();
    if (term.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const [emailSnap, displayNameSnap] = await Promise.all([
          getDocs(query(collection(db, "users"), orderBy("email"), startAt(term), endAt(`${term}\uf8ff`), limit(12))),
          getDocs(query(collection(db, "users"), orderBy("displayName"), startAt(term), endAt(`${term}\uf8ff`), limit(12)))
        ]);

        const matchedById = new Map();
        [...emailSnap.docs, ...displayNameSnap.docs].forEach((snap) => {
          if (!snap?.id || snap.id === user.uid) return;
          matchedById.set(snap.id, { id: snap.id, ...(snap.data() || {}) });
        });

        const results = [...matchedById.values()];
        if (!cancelled) {
          setSearchResults(results);
          upsertUsers(results);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      }
      if (!cancelled) {
        setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [search, user?.uid]);

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
    if (!user || !otherId || otherId === user.uid) return;
    let convo = conversations.find(c => c.participants.includes(otherId));
    if (!convo) {
      const targetUserSnap = await getDoc(doc(db, "users", otherId));
      if (!targetUserSnap.exists()) {
        return;
      }

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

  useEffect(() => {
    setAutoStartedDm(false);
  }, [dmTargetId]);

  useEffect(() => {
    if (!user || !dmTargetId || dmTargetId === user.uid) return;

    const existing = conversations.find((c) => c.participants?.includes(dmTargetId));
    if (existing) {
      if (selected !== existing.id) setSelected(existing.id);
      return;
    }

    if (autoStartedDm) return;

    setAutoStartedDm(true);
    startConversation(dmTargetId);
  }, [dmTargetId, user, conversations, autoStartedDm, selected]);

  if (!user) return <div className="p-8 text-slate-400">Sign in to use direct messages.</div>;

  // Find the other user in the current conversation
  const activeConvo = conversations.find(c => c.id === selected);
  const otherUserId = activeConvo?.participants?.find(pid => pid !== user.uid);
  const otherUser = otherUserId ? usersById[otherUserId] : null;

  // Avatar helper
  const getAvatar = (u) => {
    return getAvatarUrl(u, u?.id || "user");
  };

  const conversationUsers = [...new Set(
    conversations
      .flatMap((c) => c.participants || [])
      .filter((uid) => uid && uid !== user.uid)
  )]
    .map((uid) => usersById[uid] || { id: uid })
    .sort((a, b) => (a.displayName || a.email || a.id || "").localeCompare(b.displayName || b.email || b.id || ""));

  const filteredUsers = (search.trim().length >= 2 ? searchResults : conversationUsers)
    .filter((u) => u?.id)
    .map((u) => ({ ...u, photoURL: getAvatarUrl(u, u.id) }));

  return (
    <div className="min-h-screen bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#050816]/90 backdrop-blur-xl px-4 py-4 md:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/feed" className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-black tracking-wide text-slate-500 dark:text-slate-300 hover:text-broblue transition-colors">
            ← BACK TO FEED
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-black text-lg tracking-tight">SECURE CHAT PROTOCOL</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto p-4 lg:p-6 gap-6 flex flex-col md:flex-row overflow-hidden" style={{ minHeight: "calc(100vh - 88px)" }}>
        {/* Sidebar */}
        <aside className="w-full md:w-80 panel rounded-3xl flex flex-col overflow-hidden shadow-sm border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40">
          <div className="p-4 border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-black text-base">Direct Messages</span>
            </div>
            <input
              type="text"
              className="w-full mt-2 px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 outline-none text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-broblue transition-all"
              placeholder="Search users…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide bg-slate-50/20 dark:bg-transparent max-h-72 md:max-h-none">
            <div className="divide-y divide-slate-100">
              {searching ? (
                <div className="px-4 py-3 text-sm font-semibold text-slate-500">Searching users...</div>
              ) : null}
              {!searching && filteredUsers.length === 0 ? (
                <div className="px-4 py-3 text-sm font-semibold text-slate-500">
                  {search.trim().length >= 2 ? "No users found for this search." : "No conversations yet. Search for a user to start a DM."}
                </div>
              ) : null}
              {filteredUsers.map(u => {
                const convo = conversations.find(c => c.participants.includes(u.id));
                const isActive = convo && convo.id === selected;
                return (
                  <button
                    key={u.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-left
                      ${isActive
                        ? "bg-brogreen/20 shadow-lg shadow-brogreen/10"
                        : "hover:bg-slate-100 dark:hover:bg-white/5"
                      }`}
                    onClick={() => startConversation(u.id)}
                  >
                    <img
                      src={getAvatar(u)}
                      alt={u.displayName || u.email || u.id}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = getAvatarUrl({ id: u.id }, u.id);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-bold text-slate-900 dark:text-slate-100">{u.displayName || u.email || u.id}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span className="text-xs text-slate-400">online</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
        {/* Main Chat Panel */}
        <main className="flex-1 panel rounded-3xl flex flex-col overflow-hidden shadow-sm border border-slate-200 dark:border-white/10 relative bg-white dark:bg-[#050816]">
          {/* Chat Header */}
          <div id="active-chat-header" className="flex items-center gap-4 px-5 py-5 md:px-8 md:py-6 border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#050816]/90 min-h-[80px]">
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
          <div id="dm-chat" className="flex-1 overflow-y-auto px-5 py-5 md:px-8 md:py-6 bg-slate-50/20 dark:bg-transparent space-y-4 max-h-[calc(100vh-88px-80px-88px)] scrollbar-hide">
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
                      ? "bg-brogreen text-black rounded-2xl rounded-tr-sm font-bold shadow-lg"
                      : "bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-sm shadow"
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
            <form id="dm-form" onSubmit={sendMessage} className="flex items-center gap-4 px-5 py-5 md:px-8 md:py-6 border-t border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#050816]/90">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 px-5 py-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 outline-none text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-broblue transition-all"
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
