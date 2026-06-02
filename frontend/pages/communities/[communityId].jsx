import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { db } from "../../src/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  getDoc,
  doc as firestoreDoc,
  orderBy,
  setDoc
} from "firebase/firestore";

const defaultAvatarOptions = Array.from({ length: 15 }, (_, i) => `/defaults/default${i + 1}.png`);

const getRandomDefaultAvatar = () => {
  const idx = Math.floor(Math.random() * defaultAvatarOptions.length);
  return defaultAvatarOptions[idx];
};

export default function Community() {
  const router = useRouter();
  const { communityId } = router.query;
  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memberCount, setMemberCount] = useState(0);
  const [members, setMembers] = useState([]);
  // ...other state omitted for brevity

  const ensureUserProfile = async (uid) => {
    if (!uid) return { uid: "unknown", displayName: "Unknown User", photoURL: getRandomDefaultAvatar() };

    const userRef = firestoreDoc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const randomAvatar = getRandomDefaultAvatar();
      await setDoc(userRef, { photoURL: randomAvatar }, { merge: true });
      return { uid, displayName: uid, photoURL: randomAvatar };
    }

    const userData = userSnap.data() || {};
    if (userData.photoURL) {
      return {
        uid,
        displayName: userData.displayName || userData.username || userData.email || uid,
        photoURL: userData.photoURL
      };
    }

    const randomAvatar = getRandomDefaultAvatar();
    await setDoc(userRef, { photoURL: randomAvatar }, { merge: true });
    return {
      uid,
      displayName: userData.displayName || userData.username || userData.email || uid,
      photoURL: randomAvatar
    };
  };

  useEffect(() => {
    if (!communityId) return;
    async function fetchData() {
      setLoading(true);
      // Fetch community info
      const cDocRef = firestoreDoc(db, "communities", communityId);
      const cDoc = await getDoc(cDocRef);
      if (cDoc.exists()) {
        const cData = { id: cDoc.id, ...cDoc.data() };
        setCommunity(cData);
      } else {
        setCommunity(null);
      }
      // Fetch posts for this community
      const postsQ = query(
        collection(db, "posts"),
        where("communityId", "==", communityId),
        orderBy("createdAt", "desc")
      );
      const postsSnap = await getDocs(postsQ);
      const normalizedPosts = await Promise.all(postsSnap.docs.map(async (d) => {
        const post = { id: d.id, ...d.data() };
        const possibleAuthorId = post.authorId || post.userId || post.user?.uid;
        const profile = possibleAuthorId ? await ensureUserProfile(possibleAuthorId) : null;
        return {
          ...post,
          authorName: post.author || post.user?.name || profile?.displayName || "User",
          authorAvatar: post.user?.avatar || post.authorAvatar || profile?.photoURL || getRandomDefaultAvatar()
        };
      }));
      setPosts(normalizedPosts);
      // Fetch members
      const memQ = query(collection(db, "memberships"), where("communityId", "==", communityId));
      const memSnap = await getDocs(memQ);
      setMemberCount(memSnap.size);
      const memberProfiles = await Promise.all(
        memSnap.docs.map(async (d) => {
          const uid = d.data().userId;
          return ensureUserProfile(uid);
        })
      );
      setMembers(memberProfiles);
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
      <div className="mb-6">
        <h3 className="font-bold mb-2">Community Members</h3>
        {members.length === 0 ? (
          <div className="text-sm text-slate-500">No members yet.</div>
        ) : (
          <ul className="space-y-2">
            {members.map((member) => (
              <li key={member.uid} className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2">
                <img
                  src={member.photoURL}
                  alt={member.displayName}
                  className="h-9 w-9 rounded-full border-2 border-brogreen bg-slate-700 object-cover"
                />
                <span className="font-semibold">{member.displayName}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <h3 className="font-bold mb-2">Posts</h3>
      <ul className="space-y-4">
        {posts.map(post => (
          <li key={post.id} className="bg-white/10 rounded-xl p-4">
            <div className="mb-2 flex items-center gap-2">
              <img
                src={post.authorAvatar}
                alt={post.authorName}
                className="h-8 w-8 rounded-full border-2 border-brogreen bg-slate-700 object-cover"
              />
              <div className="font-bold">{post.authorName}</div>
            </div>
            <div>{post.content}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
