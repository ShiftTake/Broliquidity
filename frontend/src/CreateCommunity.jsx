import React, { useState } from "react";
import { db, auth } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

function CreateCommunity({ onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const user = auth.currentUser;

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!user) {
      setError("You must be signed in to create a community.");
      return;
    }
    if (!name.trim()) {
      setError("Community name is required.");
      return;
    }
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, "communities"), {
        name: name.trim(),
        description: description.trim(),
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });
      setSuccess("Community created!");
      setName("");
      setDescription("");
      if (onCreated) onCreated(docRef.id);
    } catch (err) {
      setError("Failed to create community. Try a different name.");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleCreate} className="glass p-6 rounded-2xl mb-8 max-w-lg mx-auto">
      <h3 className="text-xl font-bold mb-4">Create a Community</h3>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Community name"
        className="w-full mb-3 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full mb-3 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
        rows={2}
      />
      {error && <div className="text-red-400 mb-2">{error}</div>}
      {success && <div className="text-green-400 mb-2">{success}</div>}
      <button type="submit" className="px-6 py-2 rounded-xl bg-[#b6ff22] text-black font-bold hover:scale-105 transition" disabled={loading}>
        {loading ? "Creating..." : "Create"}
      </button>
    </form>
  );
}

export default CreateCommunity;
