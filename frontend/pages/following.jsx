import React, { useEffect, useState } from "react";
import Link from "next/link";
import { db, auth } from "../src/firebase";
import { collection, getDocs } from "firebase/firestore";
import { followUser, unfollowUser, getFollowing } from "../src/following";
import { ensureUserHasAvatar } from "../src/avatarDefaults";

export default function Following() {
  const [users, setUsers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);
      setError("");
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const userList = await Promise.all(
          usersSnap.docs.map(async (d) => {
            const normalized = await ensureUserHasAvatar(db, d.id);
            return { uid: d.id, ...normalized };
          })
        );
        setUsers(userList);
        if (auth.currentUser) {
          const f = await getFollowing(auth.currentUser.uid);
          setFollowing(f);
        }
      } catch (e) {
        setError("Failed to load users");
      }
      setLoading(false);
    }
    fetchUsers();
  }, []);

  const handleFollow = async (uid) => {
    try {
      await followUser(uid);
      setFollowing((prev) => [...prev, uid]);
    } catch (e) {
      alert(e.message);
    }
  };

  const handleUnfollow = async (uid) => {
    try {
      await unfollowUser(uid);
      setFollowing((prev) => prev.filter((id) => id !== uid));
    } catch (e) {
      alert(e.message);
    }
  };

  if (!auth.currentUser) return <div className="p-8 text-slate-400">Sign in to follow users.</div>;
  if (loading) return <div className="p-8 text-slate-400">Loading users...</div>;
  if (error) return <div className="p-8 text-red-400">{error}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900 p-8">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-black mb-2 text-slate-900">People on BroLiquidity</h2>
            <p className="text-sm text-slate-500">Follow and unfollow users from one place.</p>
          </div>
          <Link href="/feed" legacyBehavior>
            <a className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-900 shadow-sm hover:bg-slate-50" aria-label="Back to feed" title="Back to feed">
              <span aria-hidden="true">←</span>
              <span className="hidden sm:inline">Back to Feed</span>
            </a>
          </Link>
        </div>
        <ul className="space-y-4">
        {users.filter(u => u.uid !== auth.currentUser.uid).map((u) => (
          <li key={u.uid} className="flex items-center gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
            <img
              src={u.photoURL || "/mainlogo.png"}
              alt={u.displayName || u.email || "User"}
              className="w-12 h-12 rounded-full object-cover border-2 border-brogreen bg-slate-700"
            />
            <div className="min-w-0">
              <div className="font-bold text-slate-900 truncate">{u.displayName || u.email || u.uid}</div>
              <div className="text-xs text-slate-500 truncate">{u.email}</div>
            </div>
            {following.includes(u.uid) ? (
              <button className="ml-auto px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs" onClick={() => handleUnfollow(u.uid)}>
                Unfollow
              </button>
            ) : (
              <button className="ml-auto px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold text-xs shadow-sm" onClick={() => handleFollow(u.uid)}>
                Follow
              </button>
            )}
          </li>
        ))}
        </ul>
      </div>
    </div>
  );
}
