import React, { useEffect, useState } from "react";
import CreateCommunity from "../CreateCommunity";
import { db, auth } from "../firebase";
import { collection, onSnapshot, query, orderBy, doc, setDoc, deleteDoc } from "firebase/firestore";

export default function Communities() {
  const [communities, setCommunities] = useState([]);
  const [joined, setJoined] = useState({});
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  // Fetch all communities in real-time
  useEffect(() => {
    const q = query(collection(db, "communities"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setCommunities(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch user's joined communities
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "memberships"));
    const unsub = onSnapshot(q, snap => {
      const joinedMap = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.userId === user.uid) {
          joinedMap[data.communityId] = true;
        }
      });
      setJoined(joinedMap);
    });
    return () => unsub();
  }, [user]);

  // Join a community
  const handleJoin = async (communityId) => {
    if (!user) return alert("Sign in to join communities.");
    const ref = doc(db, "memberships", `${user.uid}_${communityId}`);
    await setDoc(ref, { userId: user.uid, communityId, joinedAt: Date.now() });
  };

  // Leave a community
  const handleLeave = async (communityId) => {
    if (!user) return;
    const ref = doc(db, "memberships", `${user.uid}_${communityId}`);
    await deleteDoc(ref);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <CreateCommunity />
      <div className="mt-10">
        <h2 className="text-2xl font-bold mb-4">All Communities</h2>
        {loading ? (
          <div>Loading communities...</div>
        ) : communities.length === 0 ? (
          <div>No communities found.</div>
        ) : (
          <ul className="space-y-4">
            {communities.map(c => (
              <li key={c.id} className="flex items-center justify-between bg-white/10 rounded-xl p-4">
                <span className="font-bold">c/{c.id}</span>
                {joined[c.id] ? (
                  <button className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold" onClick={() => handleLeave(c.id)}>
                    Leave
                  </button>
                ) : (
                  <button className="px-4 py-2 rounded-xl bg-brogreen text-black font-bold" onClick={() => handleJoin(c.id)}>
                    Join
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
