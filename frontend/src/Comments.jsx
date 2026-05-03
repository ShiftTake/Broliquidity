import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { auth } from "./firebase";

function Comments({ postId }) {
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const user = auth.currentUser;

  useEffect(() => {
    const q = query(collection(db, `posts/${postId}/comments`), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, [postId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!user) {
      setError("You must be signed in to comment.");
      return;
    }
    if (!comment.trim()) {
      setError("Comment cannot be empty.");
      return;
    }
    try {
      await addDoc(collection(db, `posts/${postId}/comments`), {
        text: comment,
        author: user.email || user.displayName || "anon",
        createdAt: serverTimestamp()
      });
      setComment("");
    } catch (err) {
      setError("Failed to comment. Try again.");
    }
  };

  return (
    <div className="mt-4 ml-2 border-l border-slate-700 pl-4">
      <form onSubmit={handleSubmit} className="mb-2">
        <input
          type="text"
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none mb-1"
        />
        {error && <div className="text-red-400 mb-1 text-xs">{error}</div>}
        <button type="submit" className="px-4 py-1 rounded-xl bg-[#b6ff22] text-black font-bold text-xs hover:scale-105 transition">
          Comment
        </button>
      </form>
      <ul className="space-y-2">
        {comments.map(c => (
          <li key={c.id} className="bg-slate-800/60 rounded-lg px-3 py-2">
            <div className="text-xs text-slate-400 mb-1">{c.author} • {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString() : ""}</div>
            <div className="text-white text-sm">{c.text}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Comments;
