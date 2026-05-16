import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { db } from "../../src/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export default function Community() {
  const router = useRouter();
  const { communityId } = router.query;
  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memberCount, setMemberCount] = useState(0);
  const [members, setMembers] = useState([]);
  // ...other state omitted for brevity

  useEffect(() => {
    if (!communityId) return;
    async function fetchData() {
      setLoading(true);
      // Fetch community info
      const cDoc = await db.collection("communities").doc(communityId).get();
      if (cDoc.exists) {
        const cData = { id: cDoc.id, ...cDoc.data() };
        setCommunity(cData);
      } else {
        setCommunity(null);
      }
      // Fetch posts for this community
      const postsSnap = await db.collection("posts").where("communityId", "==", communityId).orderBy("createdAt", "desc").get();
      setPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      // Fetch members
      const memSnap = await getDocs(query(collection(db, "memberships"), where("communityId", "==", communityId)));
      setMemberCount(memSnap.size);
      setMembers(memSnap.docs.map(d => d.data().userId));
      setLoading(false);
    }
    fetchData();
  }, [communityId]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (!community) return <div className="p-8">Community not found.</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">c/{community.id}</h2>
      <div className="mb-4 text-slate-500">{community.description || "No description."}</div>
      <div className="mb-4">Members: {memberCount}</div>
      <h3 className="font-bold mb-2">Posts</h3>
      <ul className="space-y-4">
        {posts.map(post => (
          <li key={post.id} className="bg-white/10 rounded-xl p-4">
            <div className="mb-2 font-bold">{post.author}</div>
            <div>{post.content}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
