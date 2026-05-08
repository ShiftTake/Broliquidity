import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { followUser, unfollowUser, getFollowing } from "../following";

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
        const userList = usersSnap.docs.map((d) => ({ uid: d.id, ...d.data() }));
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
    <div className="p-8">
      <h2 className="text-2xl font-black mb-6">People on BroLiquidity</h2>
      <ul className="space-y-4">
        {users.filter(u => u.uid !== auth.currentUser.uid).map((u) => (
          <li key={u.uid} className="flex items-center gap-4 bg-white/10 p-4 rounded-xl">
            <img
              src={u.photoURL || "/mainlogo.png"}
              alt={u.displayName ? `${u.displayName}'s profile` : u.email ? `${u.email}'s profile` : "Profile"}
              className="w-10 h-10 rounded-full object-cover border-2 border-[#b6ff22] bg-slate-800"
              aria-label={u.displayName ? `${u.displayName}'s profile image` : u.email ? `${u.email}'s profile image` : "Profile image"}
              title={u.displayName ? `${u.displayName}'s profile` : u.email ? `${u.email}'s profile` : "Profile"}
            />
            <div className="flex-1">
              <div className="font-bold">{u.displayName || u.email}</div>
              <div className="text-xs text-slate-500">{u.email}</div>
            </div>
            {following.includes(u.uid) ? (
              <button onClick={() => handleUnfollow(u.uid)} className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold text-xs">Unfollow</button>
            ) : (
              <button onClick={() => handleFollow(u.uid)} className="px-4 py-2 rounded-xl bg-brogreen text-black font-bold text-xs">Follow</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
