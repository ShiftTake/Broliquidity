import React, { useState } from "react";
import { db, auth } from "./firebase";
import { collection, addDoc, serverTimestamp, doc, setDoc } from "firebase/firestore";
import { defaultAvatarOptions, getRandomDefaultAvatar } from "./avatarDefaults";

function CreateCommunity({ onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDefaultAvatar, setSelectedDefaultAvatar] = useState("");
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
        avatar: selectedDefaultAvatar || getRandomDefaultAvatar(),
        members: 1,
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });

      await setDoc(doc(db, "memberships", `${user.uid}_${docRef.id}`), {
        userId: user.uid,
        communityId: docRef.id,
        joinedAt: Date.now()
      }, { merge: true });

      setSuccess("Community created!");
      setName("");
      setDescription("");
      setSelectedDefaultAvatar("");
      if (onCreated) onCreated(docRef.id);
    } catch (err) {
      setError("Failed to create community. Try a different name.");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleCreate} className="space-y-3">
      <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Launch a New Desk</h3>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Community name"
        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-black text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brogreen/40"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brogreen/40"
        rows={2}
      />
      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Select Avatar</p>
        <div className="grid grid-cols-5 gap-2">
          {defaultAvatarOptions.map((avatarUrl) => (
            <button
              key={avatarUrl}
              type="button"
              onClick={() => setSelectedDefaultAvatar(avatarUrl)}
              className={"rounded-xl border-2 p-0.5 " + (selectedDefaultAvatar === avatarUrl ? "border-brogreen" : "border-transparent hover:border-slate-300 dark:hover:border-white/30")}
              aria-label="Select default avatar"
            >
              <img src={avatarUrl} alt="Default avatar" className="h-10 w-10 rounded-lg object-cover" />
            </button>
          ))}
        </div>
      </div>
      {error && <div className="rounded-xl border border-red-200 px-3 py-2 text-xs font-black text-red-500 dark:border-red-400/40">{error}</div>}
      {success && <div className="rounded-xl border border-green-200 px-3 py-2 text-xs font-black text-green-600 dark:border-green-400/40 dark:text-green-400">{success}</div>}
      <button type="submit" className="rounded-2xl bg-brogreen px-6 py-2 text-sm font-black text-black disabled:opacity-50" disabled={loading}>
        {loading ? "Creating..." : "Create Community"}
      </button>
    </form>
  );
}

export default CreateCommunity;
