import React, { useEffect, useState } from "react";
import Link from "next/link";
import { deleteUser } from "firebase/auth";
import { auth, db } from "../firebase";
import {
  collection,
  doc as firestoreDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where
} from "firebase/firestore";
import { ensureUserHasAvatar, getRandomDefaultAvatar } from "../avatarDefaults";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [tab, setTab] = useState("posts");
  const [loading, setLoading] = useState(true);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleDeletePost = async (post) => {
    if (!user?.uid || !post?.id) return;
    const postOwnerId = post.authorId || post.userId || post.user?.uid;
    if (postOwnerId !== user.uid) return;
    const shouldDelete = window.confirm("Delete this post permanently?");
    if (!shouldDelete) return;

    try {
      await deleteDoc(firestoreDoc(db, "posts", post.id));
      setPosts((prev) => prev.filter((row) => row.id !== post.id));
    } catch {
      // Keep profile rendering resilient if delete fails.
    }
  };

  const deleteDocsByQuery = async (q) => {
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((row) => deleteDoc(row.ref)));
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser || deleteBusy) return;

    const shouldDelete = window.confirm(
      "Delete your account permanently? This will remove your profile and cannot be undone."
    );
    if (!shouldDelete) return;

    setDeleteError("");
    setDeleteBusy(true);

    const uid = auth.currentUser.uid;
    try {
      await Promise.all([
        deleteDocsByQuery(query(collection(db, "posts"), where("authorId", "==", uid))),
        deleteDocsByQuery(query(collection(db, "posts"), where("userId", "==", uid))),
        deleteDocsByQuery(query(collection(db, "posts"), where("user.uid", "==", uid))),
        deleteDocsByQuery(query(collection(db, "memberships"), where("userId", "==", uid))),
        deleteDocsByQuery(query(collection(db, "follows"), where("followerId", "==", uid))),
        deleteDocsByQuery(query(collection(db, "follows"), where("followingId", "==", uid))),
        deleteDocsByQuery(query(collection(db, "conversations"), where("participants", "array-contains", uid)))
      ]);

      await Promise.all([
        deleteDoc(firestoreDoc(db, "profiles", uid)).catch(() => undefined),
        deleteDoc(firestoreDoc(db, "users", uid)).catch(() => undefined)
      ]);

      await deleteUser(auth.currentUser);
      window.location.href = "/";
    } catch (err) {
      if (err?.code === "auth/requires-recent-login") {
        setDeleteError("Please log out and log back in, then try deleting your account again.");
      } else {
        setDeleteError("Failed to delete account. Please try again.");
      }
      setDeleteBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    let profileDocUnsubscribe = null;
    let usersDocUnsubscribe = null;

    const clearProfileListeners = () => {
      if (profileDocUnsubscribe) {
        profileDocUnsubscribe();
        profileDocUnsubscribe = null;
      }
      if (usersDocUnsubscribe) {
        usersDocUnsubscribe();
        usersDocUnsubscribe = null;
      }
    };

    const unsubscribe = auth.onAuthStateChanged(async (nextUser) => {
      if (!active) return;
      clearProfileListeners();
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setPosts([]);
        setCommunities([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const [profileDoc, usersDoc] = await Promise.all([
          getDoc(firestoreDoc(db, "profiles", nextUser.uid)),
          getDoc(firestoreDoc(db, "users", nextUser.uid))
        ]);
        const ensuredUser = await ensureUserHasAvatar(db, nextUser.uid);

        if (!active) return;

        let liveProfileData = profileDoc.exists() ? profileDoc.data() : {};
        let liveUsersData = usersDoc.exists() ? usersDoc.data() : {};

        const buildMergedProfile = () => ({
          ...liveUsersData,
          ...liveProfileData,
          ...ensuredUser,
          photoURL:
            nextUser.photoURL ||
            liveProfileData.photoURL ||
            liveUsersData.photoURL ||
            ensuredUser.photoURL ||
            "/mainlogo.png",
          displayName:
            nextUser.displayName ||
            ensuredUser.displayName ||
            liveProfileData.displayName ||
            liveUsersData.displayName ||
            nextUser.email,
          email:
            nextUser.email ||
            ensuredUser.email ||
            liveProfileData.email ||
            liveUsersData.email ||
            ""
        });

        const mergedProfile = buildMergedProfile();

        profileDocUnsubscribe = onSnapshot(firestoreDoc(db, "profiles", nextUser.uid), (snap) => {
          if (!active) return;
          liveProfileData = snap.exists() ? snap.data() : {};
          setProfile(buildMergedProfile());
        });

        usersDocUnsubscribe = onSnapshot(firestoreDoc(db, "users", nextUser.uid), (snap) => {
          if (!active) return;
          liveUsersData = snap.exists() ? snap.data() : {};
          setProfile(buildMergedProfile());
        });

        const membershipsQuery = query(collection(db, "memberships"), where("userId", "==", nextUser.uid));

        const [authorPostsSnap, userIdPostsSnap, nestedUidPostsSnap, membershipsSnap] = await Promise.all([
          getDocs(query(collection(db, "posts"), where("authorId", "==", nextUser.uid))),
          getDocs(query(collection(db, "posts"), where("userId", "==", nextUser.uid))),
          getDocs(query(collection(db, "posts"), where("user.uid", "==", nextUser.uid))),
          getDocs(membershipsQuery)
        ]);

        const byId = new Map();
        [...authorPostsSnap.docs, ...userIdPostsSnap.docs, ...nestedUidPostsSnap.docs].forEach((postDoc) => {
          byId.set(postDoc.id, { id: postDoc.id, ...postDoc.data() });
        });

        const communityMemberships = await Promise.all(
          membershipsSnap.docs.map(async (membershipDoc) => {
            const membership = membershipDoc.data();
            try {
              const communityDoc = await getDoc(firestoreDoc(db, "communities", membership.communityId));
              if (!communityDoc.exists()) {
                return {
                  id: membership.communityId,
                  name: membership.communityId,
                  avatar: getRandomDefaultAvatar()
                };
              }

              const communityData = communityDoc.data();
              return {
                id: communityDoc.id,
                name: communityData.name || membership.communityId,
                avatar: communityData.avatar || getRandomDefaultAvatar(),
                members: communityData.members || 0,
                description: communityData.description || ""
              };
            } catch {
              return {
                id: membership.communityId,
                name: membership.communityId,
                avatar: getRandomDefaultAvatar()
              };
            }
          })
        );

        if (!active) return;

        setProfile(mergedProfile);
        const normalizedPosts = await Promise.all(
          [...byId.values()].map(async (postData) => {
            const authorUid = postData.authorId || postData.userId || postData.user?.uid || nextUser.uid;

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
        setCommunities(communityMemberships);
      } catch {
        if (!active) return;
        setProfile(null);
        setPosts([]);
        setCommunities([]);
      }

      if (active) {
        setLoading(false);
      }
    });

    return () => {
      active = false;
      clearProfileListeners();
      unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-white dark:bg-[#050816] px-4 py-10 text-center text-slate-500 dark:text-slate-400 font-bold">Loading profile...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#050816] px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-8 text-center shadow-sm">
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">Sign in to view your profile</h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Your personal timeline and communities will appear here once you are authenticated.</p>
          <Link href="/login" className="mt-6 inline-flex rounded-2xl bg-brogreen px-5 py-3 font-black text-black dark:text-brogreen">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const resolvedProfileAvatar = auth.currentUser?.photoURL || profile?.photoURL || user?.photoURL || "/mainlogo.png";

  return (
    <div className="min-h-screen bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden xl:block w-72 shrink-0">
          <div className="sticky top-6 space-y-4">
            <div className="panel rounded-3xl p-5 bg-white dark:bg-[#050816] border border-slate-200 dark:border-white/10 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-brogreen">Profile</p>
              <h1 className="mt-2 text-2xl font-black">Your Feed</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">A feed-style view of your own posts, communities, and account details.</p>
            </div>
            <div className="panel rounded-3xl p-5 bg-white dark:bg-[#050816] border border-slate-200 dark:border-white/10 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick Links</h2>
              <div className="mt-4 space-y-2">
                <Link href="/feed" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 font-black hover:bg-slate-50 dark:hover:bg-white/5">Main Feed</Link>
                <Link href={`/profile/${user.uid}`} className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 font-black hover:bg-slate-50 dark:hover:bg-white/5">Public Profile</Link>
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
                  <h2 className="text-xl font-black">Your Profile Feed</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Your posts and communities in the same browsing rhythm as the main feed.</p>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 dark:border-white/10 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <img
                  src={resolvedProfileAvatar}
                  alt={profile?.displayName || "Your profile"}
                  className="h-24 w-24 rounded-full border-4 border-brogreen object-cover bg-slate-200"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/mainlogo.png";
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-2xl font-black truncate">{profile?.username || profile?.displayName || profile?.email || "User"}</h3>
                    <span className="rounded-full bg-slate-100 dark:bg-white/5 px-3 py-1 text-xs font-black text-slate-500 dark:text-slate-400">@{(profile?.email || user.email || "user").split("@")[0]}</span>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">{profile?.bio || "Add a bio from the feed profile modal to personalize your page."}</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-2 font-black">{posts.length} Posts</div>
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-2 font-black">{communities.length} Communities</div>
                  </div>
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
                  <div className="p-6 text-sm text-slate-500 dark:text-slate-400">No posts yet. Start posting from the feed to build your timeline.</div>
                ) : (
                  <ul>
                    {posts.map((post) => (
                      <li key={post.id} className="relative border-b border-slate-100 dark:border-white/10 px-5 py-5 last:border-b-0">
                        <button
                          type="button"
                          className="absolute right-4 top-4 text-lg font-black leading-none text-brogreen hover:opacity-80"
                          onClick={() => handleDeletePost(post)}
                          aria-label="Delete post"
                          title="Delete"
                        >
                          x
                        </button>
                        <div className="flex gap-4">
                          <img
                            src={resolvedProfileAvatar}
                            alt={profile?.displayName || "User"}
                            className="h-12 w-12 rounded-full border border-slate-200 dark:border-white/10 object-cover"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = "/mainlogo.png";
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="truncate text-base font-black">{profile?.username || profile?.displayName || profile?.email || "User"}</span>
                              <span className="truncate text-xs text-slate-500 dark:text-slate-400">@{(profile?.email || user.email || "user").split("@")[0]}</span>
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
                  <div className="p-6 text-sm text-slate-500 dark:text-slate-400">You have not joined any communities yet.</div>
                ) : (
                  <ul className="grid gap-4 p-5 md:grid-cols-2">
                    {communities.map((community) => (
                      <li key={community.id} className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <img src={community.avatar} alt={community.name} className="h-12 w-12 rounded-full border border-slate-200 dark:border-white/10 object-cover" />
                          <div className="min-w-0">
                            <div className="truncate font-black text-slate-900 dark:text-slate-100">{community.name}</div>
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
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This page mirrors the feed structure so your own profile feels like a natural extension of the main timeline.</p>
            </div>
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Next Actions</h2>
              <div className="mt-4 space-y-2 text-sm font-black">
                <Link href="/feed" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5">Create a Post</Link>
                <Link href="/communities" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5">Discover Communities</Link>
                <Link href="/dm" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5">Open Messages</Link>
              </div>
            </div>
            <div className="panel rounded-3xl border border-red-300/50 dark:border-red-400/30 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-red-600 dark:text-red-300">Account</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Delete your account and associated profile data directly in-app.</p>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteBusy}
                className="mt-4 w-full rounded-2xl border border-red-300 dark:border-red-400/50 px-4 py-3 text-sm font-black text-red-700 dark:text-red-200 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteBusy ? "Deleting Account..." : "Delete Account"}
              </button>
              {deleteError ? <p className="mt-3 text-xs font-bold text-red-600 dark:text-red-300">{deleteError}</p> : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
