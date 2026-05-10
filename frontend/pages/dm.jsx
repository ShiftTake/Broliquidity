import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";

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
    // Check if conversation exists
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

  return (
    <div className="p-8 flex gap-8">
      <div className="w-64">
        <h2 className="text-xl font-bold mb-4">Conversations</h2>
        <ul className="space-y-2 mb-6">
          {conversations.map(c => (
            <li key={c.id}>
              <button className={`w-full text-left px-3 py-2 rounded-lg ${selected === c.id ? "bg-brogreen/30" : "hover:bg-brogreen/10"}`} onClick={() => setSelected(c.id)}>
                {c.participants.filter(pid => pid !== user.uid).join(", ")}
              </button>
            </li>
          ))}
        </ul>
        <h3 className="font-bold mb-2">Start New DM</h3>
        <ul className="space-y-2">
          {users.map(u => (
            <li key={u.id}>
              <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-brogreen/10" onClick={() => startConversation(u.id)}>
                {u.displayName || u.email || u.id}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1 flex flex-col">
        <h2 className="text-xl font-bold mb-4">Messages</h2>
        <div className="flex-1 overflow-y-auto bg-white/10 rounded-xl p-4 mb-4" style={{ minHeight: 300 }}>
          {messages.map(m => (
            <div key={m.id} className={`mb-2 ${m.sender === user.uid ? "text-right" : "text-left"}`}>
              <span className={`inline-block px-3 py-2 rounded-xl ${m.sender === user.uid ? "bg-brogreen text-black" : "bg-white/20 text-black"}`}>{m.text}</span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        {selected && (
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 rounded-xl border border-slate-300"
            />
            <button type="submit" className="px-4 py-2 rounded-xl bg-brogreen text-black font-bold">Send</button>
          </form>
        )}
      </div>
    </div>
  );
}
