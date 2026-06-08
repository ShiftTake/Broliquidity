import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { db, auth } from "../../src/firebase";
import {
  collection,
  deleteDoc,
  query,
  where,
  getDocs,
  getDoc,
  doc as firestoreDoc
} from "firebase/firestore";
import { ensureUserHasAvatar, getAvatarUrl, getRandomDefaultAvatar } from "../../src/avatarDefaults";
import { followUser, unfollowUser, getFollowing } from "../../src/following";

export default function UserProfile() {
  const router = useRouter();
  const { userId } = router.query;
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [tab, setTab] = useState("posts");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const isOwnProfile = auth.currentUser?.uid === userId;

  const handleDeletePost = async (post) => {
    if (!auth.currentUser?.uid || auth.currentUser.uid !== userId || !post?.id) return;
    const postOwnerId = post.authorId || post.userId || post.user?.uid;
    if (postOwnerId !== auth.currentUser.uid) return;
    const shouldDelete = window.confirm("Delete this post permanently?");
    if (!shouldDelete) return;

    try {
      await deleteDoc(firestoreDoc(db, "posts", post.id));
      setPosts((prev) => prev.filter((row) => row.id !== post.id));
    } catch {
      // Keep profile rendering resilient if delete fails.
    }
  };

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
        displayName: ensuredUser.displayName || usersDoc.data()?.displayName || profileDoc.data()?.displayName || ensuredUser.email || userId,
        photoURL: (auth.currentUser?.uid === userId ? auth.currentUser?.photoURL : "") ||
          (profileDoc.exists() ? profileDoc.data().photoURL : "") ||
          (usersDoc.exists() ? usersDoc.data().photoURL : "") ||
          ensuredUser.photoURL
      };
      setProfile(mergedProfile);
      // Fetch posts
      const [authorPostsSnap, userIdPostsSnap, nestedUidPostsSnap] = await Promise.all([
        getDocs(query(collection(db, "posts"), where("authorId", "==", userId))),
        getDocs(query(collection(db, "posts"), where("userId", "==", userId))),
        getDocs(query(collection(db, "posts"), where("user.uid", "==", userId)))
      ]);

      const byId = new Map();
      [...authorPostsSnap.docs, ...userIdPostsSnap.docs, ...nestedUidPostsSnap.docs].forEach((postDoc) => {
        byId.set(postDoc.id, { id: postDoc.id, ...postDoc.data() });
      });

      const normalizedPosts = await Promise.all(
        [...byId.values()].map(async (postData) => {
          const authorUid = postData.authorId || postData.userId || postData.user?.uid || userId;
          try {
            const ensuredAuthor = await ensureUserHasAvatar(db, authorUid);
            const resolvedAvatar =
              (auth.currentUser?.uid === authorUid ? auth.currentUser?.photoURL : null) ||
              ensuredAuthor.photoURL ||
              postData.user?.avatar ||
              getRandomDefaultAvatar();

            return {
              ...postData,
              authorId: authorUid,
              user: {
                ...(postData.user || {}),
                uid: authorUid,
                name: postData.user?.name || ensuredAuthor.displayName || ensuredAuthor.username || ensuredAuthor.email || "User",
                handle: postData.user?.handle || (ensuredAuthor.email ? `@${ensuredAuthor.email.split("@")[0]}` : "@user"),
                avatar: resolvedAvatar
              }
            };
          } catch {
            return {
              ...postData,
              authorId: authorUid,
              user: {
                ...(postData.user || {}),
                uid: authorUid,
                avatar: postData.user?.avatar || getRandomDefaultAvatar()
              }
            };
          }
        })
      );

      const sortedPosts = normalizedPosts.sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : ((a.createdAt?.seconds || 0) * 1000);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : ((b.createdAt?.seconds || 0) * 1000);
        return bTime - aTime;
      });
      setPosts(sortedPosts);
      // Fetch communities (with names)
      const commQ = query(collection(db, "memberships"), where("userId", "==", userId));
      const commSnap = await getDocs(commQ);
      const comms = commSnap.docs.map(d => d.data());
      // Fetch community names for each membership
      const commDetails = await Promise.all(
        comms.map(async m => {
          try {
            const cDoc = await getDoc(firestoreDoc(db, "communities", m.communityId));
            return {
              ...m,
              communityName: cDoc.exists() ? cDoc.data().name : m.communityId,
              avatar: cDoc.exists() ? (cDoc.data().avatar || getRandomDefaultAvatar()) : getRandomDefaultAvatar(),
              members: cDoc.exists() ? (cDoc.data().members || 0) : 0,
              description: cDoc.exists() ? (cDoc.data().description || "") : ""
            };
          } catch {
            return { ...m, communityName: m.communityId, avatar: getRandomDefaultAvatar(), members: 0, description: "" };
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

  if (loading) {
    return <div className="min-h-screen bg-white dark:bg-[#050816] px-4 py-10 text-center font-bold text-slate-500 dark:text-slate-400">Loading profile...</div>;
  }
  if (!profile) {
    return <div className="min-h-screen bg-white dark:bg-[#050816] px-4 py-10 text-center font-bold text-slate-500 dark:text-slate-400">User not found.</div>;
  }

  const resolvedProfileAvatar = getAvatarUrl({ uid: userId, ...profile }, userId);

  return (
    <div className="min-h-screen bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden xl:block w-72 shrink-0">
          <div className="sticky top-6 space-y-4">
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-brogreen">Public Profile</p>
              <h1 className="mt-2 text-2xl font-black">{profile.username || profile.displayName || profile.email || "User"}</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">A public feed-style view of this user's timeline and community presence.</p>
            </div>
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick Links</h2>
              <div className="mt-4 space-y-2">
                <Link href="/feed" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 font-black hover:bg-slate-50 dark:hover:bg-white/5">Main Feed</Link>
                {isOwnProfile ? (
                  <Link href="/profile" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 font-black hover:bg-slate-50 dark:hover:bg-white/5">Your Profile Feed</Link>
                ) : null}
                <Link href="/follow" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 font-black hover:bg-slate-50 dark:hover:bg-white/5">Followers & Following</Link>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <section className="panel overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] shadow-sm">
            <div className="border-b border-slate-200 dark:border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <Link href="/feed" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xl font-black hover:bg-slate-50 dark:hover:bg-white/5">←</Link>
                <div>
                  <h2 className="text-xl font-black">Public Profile</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Browse this user with the same overall rhythm as the feed and own-profile experience.</p>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 dark:border-white/10 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <img
                  src={resolvedProfileAvatar}
                  alt={profile.username ? `${profile.username}'s profile` : "Profile"}
                  className="h-24 w-24 rounded-full border-4 border-brogreen object-cover bg-slate-200"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = getAvatarUrl({ uid: userId }, userId);
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="truncate text-2xl font-black">{profile.username || profile.displayName || profile.email || userId}</h3>
                    <span className="rounded-full bg-slate-100 dark:bg-white/5 px-3 py-1 text-xs font-black text-slate-500 dark:text-slate-400">@{(profile.email || "user").split("@")[0]}</span>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">{profile.bio || "No bio yet."}</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-2 font-black">{posts.length} Posts</div>
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-2 font-black">{communities.length} Communities</div>
                  </div>
                  {!isOwnProfile && (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className={
                          "rounded-2xl px-4 py-2 text-sm font-black " +
                          (isFollowing
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100")
                        }
                        onClick={handleFollowToggle}
                        disabled={followBusy || !auth.currentUser}
                      >
                        {!auth.currentUser ? "Sign in to Follow" : followBusy ? "Saving..." : isFollowing ? "Following" : "Follow"}
                      </button>
                      <Link
                        href={`/dm?userId=${userId}`}
                        className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-black text-slate-900 dark:text-slate-100 shadow-sm hover:bg-slate-50 dark:hover:bg-white/5"
                      >
                        Message
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 dark:border-white/10 px-5">
              <div className="flex gap-6 text-sm font-black">
                <button
                  type="button"
                  className={"border-b-2 py-4 " + (tab === "posts" ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100" : "border-transparent text-slate-500 dark:text-slate-400")}
                  onClick={() => setTab("posts")}
                >
                  Timeline
                </button>
                <button
                  type="button"
                  className={"border-b-2 py-4 " + (tab === "communities" ? "border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100" : "border-transparent text-slate-500 dark:text-slate-400")}
                  onClick={() => setTab("communities")}
                >
                  Communities
                </button>
              </div>
            </div>

            {tab === "posts" ? (
              <section>
                {posts.length === 0 ? (
                  <div className="p-6 text-sm text-slate-500 dark:text-slate-400">No posts yet.</div>
                ) : (
                  <ul>
                    {posts.map((post) => (
                      <li key={post.id} className="relative border-b border-slate-100 dark:border-white/10 px-5 py-5 last:border-b-0">
                        {isOwnProfile ? (
                          <button
                            type="button"
                            className="absolute right-4 top-4 text-lg font-black leading-none text-brogreen hover:opacity-80"
                            onClick={() => handleDeletePost(post)}
                            aria-label="Delete post"
                            title="Delete"
                          >
                            x
                          </button>
                        ) : null}
                        <div className="flex gap-4">
                          <img
                            src={getAvatarUrl({
                              uid: post.user?.uid || userId,
                              photoURL: post.user?.avatar || profile.photoURL
                            }, post.user?.uid || userId)}
                            alt={profile.username || profile.displayName || "User"}
                            className="h-12 w-12 rounded-full border border-slate-200 dark:border-white/10 object-cover"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = getAvatarUrl({ uid: post.user?.uid || userId }, post.user?.uid || userId);
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="truncate text-base font-black">{profile.username || profile.displayName || profile.email || "User"}</span>
                              <span className="truncate text-xs text-slate-500 dark:text-slate-400">@{(profile.email || "user").split("@")[0]}</span>
                              <span className="text-xs text-slate-400">· {post.time || "recent"}</span>
                            </div>
                            <div className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{post.content || ""}</div>
                            {post.image && (
                              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
                                <img src={post.image} alt="Post attachment" className="w-full object-cover" />
                              </div>
                            )}
                            <div className="mt-4 flex flex-wrap gap-3 text-xs font-black text-slate-500 dark:text-slate-400">
                              {Array.isArray(post.categories) && post.categories.length > 0 ? (
                                post.categories.map((category) => (
                                  <span key={category} className="rounded-full bg-slate-100 dark:bg-white/5 px-3 py-1">{category}</span>
                                ))
                              ) : post.category ? (
                                <span className="rounded-full bg-slate-100 dark:bg-white/5 px-3 py-1">{post.category}</span>
                              ) : null}
                              {post.community ? <span className="rounded-full bg-slate-100 dark:bg-white/5 px-3 py-1">c/{post.community}</span> : null}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : (
              <section>
                {communities.length === 0 ? (
                  <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Not part of any communities yet.</div>
                ) : (
                  <ul className="grid gap-4 p-5 md:grid-cols-2">
                    {communities.map((community, index) => (
                      <li key={`${community.communityId}-${index}`} className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <img src={community.avatar} alt={community.communityName || community.communityId} className="h-12 w-12 rounded-full border border-slate-200 dark:border-white/10 object-cover" />
                          <div className="min-w-0">
                            <div className="truncate font-black text-slate-900 dark:text-slate-100">{community.communityName || community.communityId}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{community.members || 0} members</div>
                          </div>
                        </div>
                        {community.description ? (
                          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{community.description}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </section>
        </main>

        <aside className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-6 space-y-4">
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-lg font-black">Profile Notes</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This public profile now follows the same layout language as the private profile feed, with consistent cards, tabs, and side rails.</p>
            </div>
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Actions</h2>
              <div className="mt-4 space-y-2 text-sm font-black">
                {!isOwnProfile ? (
                  <button
                    type="button"
                    className="block w-full rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5"
                    onClick={handleFollowToggle}
                    disabled={followBusy || !auth.currentUser}
                  >
                    {!auth.currentUser ? "Sign in to Follow" : followBusy ? "Saving..." : isFollowing ? "Following" : "Follow User"}
                  </button>
                ) : (
                  <Link href="/profile" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5">Open Your Profile Feed</Link>
                )}
                <Link href={`/dm?userId=${userId}`} className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5">Message User</Link>
                <Link href="/communities" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5">Browse Communities</Link>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
