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
              alt={u.displayName || u.email || "User"}
              className="w-12 h-12 rounded-full object-cover"
            />
            <span className="font-bold">{u.displayName || u.email || u.uid}</span>
            {following.includes(u.uid) ? (
              <button className="ml-auto px-4 py-2 rounded-xl bg-red-500 text-white font-bold" onClick={() => handleUnfollow(u.uid)}>
                Unfollow
              </button>
            ) : (
              <button className="ml-auto px-4 py-2 rounded-xl bg-brogreen text-black font-bold" onClick={() => handleFollow(u.uid)}>
                Follow
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
