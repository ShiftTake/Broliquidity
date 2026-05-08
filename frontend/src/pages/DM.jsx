import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function DM() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [users, setUsers] = useState([]);
  const user = auth.currentUser;
  const navigate = useNavigate();
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
      text: newMessage,
      sender: user.uid,
      createdAt: serverTimestamp()
    });
    setNewMessage("");
  };

  return (
    <div className="flex max-w-4xl mx-auto mt-10 bg-white rounded-xl shadow-lg min-h-[500px]">
      {/* Sidebar: Conversations and New DM */}
      <div className="w-1/3 border-r p-4 flex flex-col gap-4">
        <div>
          <h2 className="font-bold mb-2">Direct Messages</h2>
          <ul className="space-y-2">
            {conversations.map(c => {
              const otherId = c.participants.find(id => id !== user?.uid);
              const otherUser = users.find(u => u.id === otherId);
              return (
                <li key={c.id}>
                  <button className={`w-full text-left px-2 py-2 rounded-lg ${selected === c.id ? "bg-brogreen/30" : "hover:bg-brogreen/10"}`} onClick={() => setSelected(c.id)}>
                    @{otherUser?.displayName || otherUser?.email || otherId}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h3 className="font-bold mb-1 mt-4">New Message</h3>
          <ul className="space-y-1">
            {users.map(u => (
              <li key={u.id}>
                <button className="w-full text-left px-2 py-1 rounded hover:bg-brogreen/10" onClick={() => startConversation(u.id)}>
                  @{u.displayName || u.email || u.id}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {/* Main: Messages */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-6 overflow-y-auto">
          {selected ? (
            <>
              <ul className="space-y-3">
                {messages.map(m => (
                  <li key={m.id} className={`flex ${m.sender === user?.uid ? "justify-end" : "justify-start"}`}>
                    <div className={`rounded-xl px-4 py-2 max-w-xs ${m.sender === user?.uid ? "bg-brogreen text-black" : "bg-slate-200 text-slate-800"}`}>
                      {m.text}
                    </div>
                  </li>
                ))}
                <div ref={messagesEndRef} />
              </ul>
            </>
          ) : (
            <div className="text-slate-400 text-center mt-20">Select a conversation or start a new one.</div>
          )}
        </div>
        {selected && (
          <form onSubmit={sendMessage} className="flex gap-2 p-4 border-t">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300"
              placeholder="Type a message..."
            />
            <button type="submit" className="px-4 py-2 rounded-xl bg-brogreen text-black font-bold">Send</button>
          </form>
        )}
      </div>
    </div>
  );
}
}
