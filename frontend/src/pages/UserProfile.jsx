import React, { useEffect, useState } from "react";
// useParams, useNavigate removed for Next.js migration
import { db, auth } from "../firebase";

export default function UserProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [upvotes, setUpvotes] = useState([]);
  const [following, setFollowing] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [tab, setTab] = useState("posts");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
          aria-label={profile.username ? `${profile.username}'s profile image` : "Profile image"}
          title={profile.username ? `${profile.username}'s profile` : "Profile"}
        />
        <div>
          <h2 className="text-2xl font-black">@{profile.username || userId}</h2>
          <p className="text-slate-500 mt-1">{profile.bio || "No bio yet."}</p>
          <button
            className="mt-2 px-4 py-2 rounded-xl bg-broblue text-white font-bold"
            onClick={() => navigate(`/dm?user=${userId}`)}
          >
            Message
          </button>
        </div>
      </div>
      <div className="flex gap-4 mb-6">
        <button className={`px-4 py-2 rounded-xl font-bold ${tab === "posts" ? "bg-brogreen text-black" : "bg-slate-100"}`} onClick={() => setTab("posts")}>Posts</button>
        <button className={`px-4 py-2 rounded-xl font-bold ${tab === "upvotes" ? "bg-brogreen text-black" : "bg-slate-100"}`} onClick={() => setTab("upvotes")}>Upvotes</button>
        <button className={`px-4 py-2 rounded-xl font-bold ${tab === "following" ? "bg-brogreen text-black" : "bg-slate-100"}`} onClick={() => setTab("following")}>Following</button>
        <button className={`px-4 py-2 rounded-xl font-bold ${tab === "communities" ? "bg-brogreen text-black" : "bg-slate-100"}`} onClick={() => setTab("communities")}>Communities</button>
      </div>
      <div>
        {tab === "posts" && (
          <div>
            <h3 className="font-black mb-2">Posts</h3>
            {posts.length ? posts.map(post => (
              <div key={post.id} className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold">{post.title || post.content?.slice(0, 40) || "Untitled"}</div>
                <div className="text-slate-500 text-sm mt-1">{post.content}</div>
              </div>
            )) : <div className="text-slate-400">No posts yet.</div>}
          </div>
        )}
        {tab === "upvotes" && (
          <div>
            <h3 className="font-black mb-2">Upvoted Posts</h3>
            {upvotes.length ? upvotes.map((vote, i) => (
              <div key={i} className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold">Post ID: {vote.postId}</div>
              </div>
            )) : <div className="text-slate-400">No upvotes yet.</div>}
          </div>
        )}
        {tab === "following" && (
          <div>
            <h3 className="font-black mb-2">Following</h3>
            {following.length ? following.map((f, i) => (
              <div key={i} className="mb-2">@{f.followingUsername || f.followingId}</div>
            )) : <div className="text-slate-400">Not following anyone yet.</div>}
          </div>
        )}
        {tab === "communities" && (
          <div>
            <h3 className="font-black mb-2">Communities</h3>
            {communities.length ? communities.map((c, i) => (
              <div key={i} className="mb-2">c/{c.communityName || c.communityId}</div>
            )) : <div className="text-slate-400">No communities yet.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
