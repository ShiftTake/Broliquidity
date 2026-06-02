import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { db, auth } from "../../src/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc as firestoreDoc
} from "firebase/firestore";
import { ensureUserHasAvatar } from "../../src/avatarDefaults";
import { followUser, unfollowUser, getFollowing } from "../../src/following";

export default function UserProfile() {
  const router = useRouter();
  const { userId } = router.query;
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [upvotes, setUpvotes] = useState([]);
  const [following, setFollowing] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [tab, setTab] = useState("posts");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const isOwnProfile = auth.currentUser?.uid === userId;

  useEffect(() => {
    if (!userId) return;
    async function fetchProfile() {
      setLoading(true);
      // Fetch profile and ensure a persisted avatar exists for this user.
      const [profileDoc, usersDoc] = await Promise.all([
        getDoc(firestoreDoc(db, "profiles", userId)),
        getDoc(firestoreDoc(db, "users", userId))
      ]);
      const ensuredUser = await ensureUserHasAvatar(db, userId);
      const mergedProfile = {
        ...(usersDoc.exists() ? usersDoc.data() : {}),
        ...(profileDoc.exists() ? profileDoc.data() : {}),
        ...ensuredUser,
        photoURL: (profileDoc.exists() ? profileDoc.data().photoURL : "") ||
          (usersDoc.exists() ? usersDoc.data().photoURL : "") ||
          ensuredUser.photoURL
      };
      setProfile(mergedProfile);
      // Fetch posts
      const postsQ = query(collection(db, "posts"), where("authorId", "==", userId));
      const postsSnap = await getDocs(postsQ);
      setPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      // Fetch upvotes
      const upvotesQ = query(collection(db, "votes"), where("userId", "==", userId), where("type", "==", "upvote"));
      const upvotesSnap = await getDocs(upvotesQ);
      setUpvotes(upvotesSnap.docs.map(d => d.data()));
      // Fetch following
      const followingQ = query(collection(db, "follows"), where("followerId", "==", userId));
      const followingSnap = await getDocs(followingQ);
      setFollowing(followingSnap.docs.map(d => d.data()));
      // Fetch communities (with names)
      const commQ = query(collection(db, "memberships"), where("userId", "==", userId));
      const commSnap = await getDocs(commQ);
      const comms = commSnap.docs.map(d => d.data());
      // Fetch community names for each membership
      const commDetails = await Promise.all(
        comms.map(async m => {
          try {
            const cDoc = await getDoc(firestoreDoc(db, "communities", m.communityId));
            return { ...m, communityName: cDoc.exists() ? cDoc.data().name : m.communityId };
          } catch {
            return { ...m, communityName: m.communityId };
          }
        })
      );
      setCommunities(commDetails);

      if (auth.currentUser && auth.currentUser.uid !== userId) {
        const myFollowing = await getFollowing(auth.currentUser.uid);
        setIsFollowing(myFollowing.includes(userId));
      }
      setLoading(false);
    }
    fetchProfile();
  }, [userId]);

  const handleFollowToggle = async () => {
    if (!auth.currentUser || !userId || isOwnProfile || followBusy) return;
    setFollowBusy(true);
    try {
      if (isFollowing) {
        await unfollowUser(userId);
        setIsFollowing(false);
      } else {
        await followUser(userId);
        setIsFollowing(true);
      }
    } catch (err) {
      // Preserve UX without hard-failing page render.
    }
    setFollowBusy(false);
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!profile) return <div className="p-8 text-center">User not found.</div>;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 text-slate-900">
      <div className="flex items-center justify-between gap-4 mb-6">
        <Link href="/feed" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-900 shadow-sm hover:bg-slate-50">
          <span aria-hidden="true">←</span>
          <span>Back to Feed</span>
        </Link>
      </div>

      <div className="flex items-center gap-6 mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <img
          src={profile.photoURL || "/defaults/default1.png"}
          alt={profile.username ? `${profile.username}'s profile` : "Profile"}
          className="w-24 h-24 rounded-full object-cover border-4 border-brogreen"
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black">{profile.username || profile.displayName || profile.email || userId}</h2>
          <p className="text-slate-500">{profile.bio || "No bio yet."}</p>
          {!isOwnProfile && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={
                  "rounded-2xl px-4 py-2 text-sm font-black " +
                  (isFollowing
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-900")
                }
                onClick={handleFollowToggle}
                disabled={followBusy || !auth.currentUser}
              >
                {!auth.currentUser ? "Sign in to Follow" : followBusy ? "Saving..." : isFollowing ? "Following" : "Follow"}
              </button>
              <Link
                href={`/dm?userId=${userId}`}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-900 shadow-sm hover:bg-slate-50"
              >
                Message
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          className={"px-4 py-2 text-sm font-black " + (tab === "posts" ? "text-slate-900 border-b-2 border-slate-900" : "text-slate-500")}
          onClick={() => setTab("posts")}
        >
          Timeline
        </button>
        <button
          type="button"
          className={"px-4 py-2 text-sm font-black " + (tab === "communities" ? "text-slate-900 border-b-2 border-slate-900" : "text-slate-500")}
          onClick={() => setTab("communities")}
        >
          Communities
        </button>
      </div>

      {tab === "posts" ? (
        <div className="space-y-3">
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No posts yet.</div>
          ) : (
            posts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <img
                    src={profile.photoURL || "/defaults/default1.png"}
                    alt={profile.username || profile.displayName || "User"}
                    className="h-9 w-9 rounded-full object-cover border-2 border-brogreen"
                  />
                  <div>
                    <div className="font-bold text-slate-900">{profile.username || profile.displayName || profile.email || "User"}</div>
                    <div className="text-xs text-slate-500">{post.time || "recent"}</div>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-800">{post.content || ""}</p>
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {communities.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Not part of any communities yet.</div>
          ) : (
            communities.map((c, i) => (
              <div key={`${c.communityId}-${i}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="font-bold text-slate-900">c/{c.communityName || c.communityId}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
