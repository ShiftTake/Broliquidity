import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { db, auth } from "../../firebase";

export default function UserProfile() {
  const router = useRouter();
  const { userId } = router.query;
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [upvotes, setUpvotes] = useState([]);
  const [following, setFollowing] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [tab, setTab] = useState("posts");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    async function fetchProfile() {
      setLoading(true);
      // Fetch user profile
      const doc = await db.collection("profiles").doc(userId).get();
      setProfile(doc.exists ? doc.data() : null);
      // Fetch posts
      const postsSnap = await db.collection("posts").where("authorId", "==", userId).get();
      setPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      // Fetch upvotes
      const upvotesSnap = await db.collection("votes").where("userId", "==", userId).where("type", "==", "upvote").get();
      setUpvotes(upvotesSnap.docs.map(d => d.data()));
      // Fetch following
      const followingSnap = await db.collection("follows").where("followerId", "==", userId).get();
      setFollowing(followingSnap.docs.map(d => d.data()));
      // Fetch communities (with names)
      const commSnap = await db.collection("memberships").where("userId", "==", userId).get();
      const comms = commSnap.docs.map(d => d.data());
      // Fetch community names for each membership
      const commDetails = await Promise.all(
        comms.map(async m => {
          try {
            const cDoc = await db.collection("communities").doc(m.communityId).get();
            return { ...m, communityName: cDoc.exists ? cDoc.data().name : m.communityId };
          } catch {
            return { ...m, communityName: m.communityId };
          }
        })
      );
      setCommunities(commDetails);
      setLoading(false);
    }
    fetchProfile();
  }, [userId]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!profile) return <div className="p-8 text-center">User not found.</div>;

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="flex items-center gap-6 mb-6">
        <img
          src={profile.photoURL || `/default-avatar.png`}
          alt={profile.username ? `${profile.username}'s profile` : "Profile"}
          className="w-24 h-24 rounded-full object-cover border-4 border-brogreen"
        />
        <div>
          <h2 className="text-2xl font-black">{profile.username || profile.displayName || profile.email || userId}</h2>
          <p className="text-slate-500">{profile.bio || "No bio yet."}</p>
        </div>
      </div>
      {/* Tabs and content omitted for brevity */}
    </div>
  );
}
