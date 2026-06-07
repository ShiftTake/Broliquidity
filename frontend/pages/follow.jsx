import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../src/firebase";
import { followUser, getFollowers, getFollowing, unfollowUser } from "../src/following";
import { ensureUserHasAvatar } from "../src/avatarDefaults";

export default function Follow() {
  const router = useRouter();
  const [viewer, setViewer] = useState(null);
  const [tab, setTab] = useState("followers");
  const [usersById, setUsersById] = useState({});
  const [followerIds, setFollowerIds] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyByUid, setBusyByUid] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((nextUser) => {
      setViewer(nextUser || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const requestedTab = router.query?.tab;
    if (requestedTab === "followers" || requestedTab === "following") {
      setTab(requestedTab);
    }
  }, [router.query?.tab]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const current = viewer;
        if (!current) {
          setFollowerIds([]);
          setFollowingIds([]);
          setUsersById({});
          setLoading(false);
          return;
        }

        const usersSnap = await getDocs(collection(db, "users"));
        const normalizedUsers = await Promise.all(
          usersSnap.docs.map(async (d) => {
            const normalized = await ensureUserHasAvatar(db, d.id);
            return { uid: d.id, ...normalized };
          })
        );

        const byId = {};
        normalizedUsers.forEach((u) => {
          byId[u.uid] = u;
        });
        setUsersById(byId);

        const [myFollowing, myFollowers] = await Promise.all([
          getFollowing(current.uid),
          getFollowers(current.uid)
        ]);
        setFollowingIds(myFollowing);
        setFollowerIds(myFollowers);
      } catch (e) {
        setError("Failed to load followers/following");
      }
      setLoading(false);
    }

    loadData();
  }, [viewer]);

  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    router.replace(
      {
        pathname: "/follow",
        query: { tab: nextTab }
      },
      undefined,
      { shallow: true }
    );
  };

  const handleToggleFollow = async (targetUid) => {
    if (!viewer?.uid || !targetUid || busyByUid[targetUid]) return;

    setBusyByUid((prev) => ({ ...prev, [targetUid]: true }));
    try {
      if (followingIds.includes(targetUid)) {
        await unfollowUser(targetUid);
        setFollowingIds((prev) => prev.filter((uid) => uid !== targetUid));
      } else {
        await followUser(targetUid);
        setFollowingIds((prev) => (prev.includes(targetUid) ? prev : [...prev, targetUid]));
      }
    } catch {
      setError("Could not update follow status. Please try again.");
    }
    setBusyByUid((prev) => ({ ...prev, [targetUid]: false }));
  };

  const currentUid = viewer?.uid;
  const activeIds = tab === "following" ? followingIds : followerIds;
  const list = useMemo(
    () => activeIds
      .filter((uid) => uid !== currentUid)
      .map((uid) => ({ uid, ...(usersById[uid] || {}) })),
    [activeIds, currentUid, usersById]
  );

  const followerCount = followerIds.length;
  const followingCount = followingIds.length;

  if (!viewer && !loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#050816] px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-8 text-center shadow-sm">
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">Sign in to view followers and following</h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">This page uses the same feed-style shell so account relationships feel like a core social surface.</p>
          <Link href="/login" className="mt-6 inline-flex rounded-2xl bg-brogreen px-5 py-3 font-black text-black">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-white dark:bg-[#050816] px-4 py-10 text-center font-black text-slate-500 dark:text-slate-400">Loading followers and following...</div>;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden xl:block w-72 shrink-0">
          <div className="sticky top-6 space-y-4">
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-brogreen">Network</p>
              <h1 className="mt-2 text-2xl font-black">Followers & Following</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">A feed-style view of your social graph with follow controls and quick actions.</p>
            </div>
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick Links</h2>
              <div className="mt-4 space-y-2">
                <Link href="/feed" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 font-black hover:bg-slate-50 dark:hover:bg-white/5">Main Feed</Link>
                <Link href="/profile" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 font-black hover:bg-slate-50 dark:hover:bg-white/5">Your Profile</Link>
                <Link href="/dm" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 font-black hover:bg-slate-50 dark:hover:bg-white/5">Direct Messages</Link>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <section className="panel overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] shadow-sm">
            <div className="border-b border-slate-200 dark:border-white/10 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Link href="/feed" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xl font-black hover:bg-slate-50 dark:hover:bg-white/5">←</Link>
                  <div>
                    <h2 className="text-xl font-black">Followers & Following</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Browse your connections in the same visual language as the feed.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-white/10 p-1">
                  <button
                    type="button"
                    className={
                      "rounded-xl px-4 py-2 text-sm font-black transition " +
                      (tab === "followers" ? "bg-brogreen text-black" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5")
                    }
                    onClick={() => handleTabChange("followers")}
                  >
                    Followers
                  </button>
                  <button
                    type="button"
                    className={
                      "rounded-xl px-4 py-2 text-sm font-black transition " +
                      (tab === "following" ? "bg-brogreen text-black" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5")
                    }
                    onClick={() => handleTabChange("following")}
                  >
                    Following
                  </button>
                </div>
              </div>
            </div>

            {error ? (
              <div className="border-b border-slate-200 dark:border-white/10 px-5 py-3 text-sm font-black text-red-500">{error}</div>
            ) : null}

            {list.length === 0 ? (
              <div className="p-6">
                <div className="rounded-3xl border border-dashed border-slate-200 dark:border-white/10 p-8 text-center">
                  <h3 className="text-lg font-black">No {tab} yet</h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {tab === "followers"
                      ? "No one is following you yet. Share posts to grow your network."
                      : "You are not following anyone yet. Use Explore or profile pages to follow people."}
                  </p>
                </div>
              </div>
            ) : (
              <ul>
                {list.map((u) => {
                  const displayName = u.displayName || (u.email ? u.email.split("@")[0] : u.uid);
                  const isFollowingUser = followingIds.includes(u.uid);
                  const actionLabel = busyByUid[u.uid]
                    ? "Saving..."
                    : isFollowingUser
                      ? (tab === "following" ? "Unfollow" : "Following")
                      : (tab === "followers" ? "Follow Back" : "Follow");

                  return (
                    <li key={u.uid} className="border-b border-slate-100 dark:border-white/10 px-5 py-4 last:border-b-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <img
                          src={u.photoURL || "/defaults/default1.png"}
                          className="h-12 w-12 rounded-full border-2 border-brogreen object-cover bg-slate-700"
                          alt={displayName}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-black">{displayName}</div>
                          <div className="truncate text-xs text-slate-500 dark:text-slate-400">@{(u.email ? u.email.split("@")[0] : u.uid)}</div>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            type="button"
                            className={
                              "rounded-xl px-3 py-2 text-xs font-black transition " +
                              (isFollowingUser
                                ? "border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                : "bg-brogreen text-black")
                            }
                            onClick={() => handleToggleFollow(u.uid)}
                            disabled={Boolean(busyByUid[u.uid])}
                          >
                            {actionLabel}
                          </button>
                          <Link href={`/profile/${u.uid}`} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-black hover:bg-slate-50 dark:hover:bg-white/5">
                            Profile
                          </Link>
                          <Link href={`/dm?userId=${u.uid}`} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-black hover:bg-slate-50 dark:hover:bg-white/5">
                            Message
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </main>

        <aside className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-6 space-y-4">
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-lg font-black">Overview</h2>
              <div className="mt-4 grid gap-3 text-sm font-black">
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3">{followingCount} Following</div>
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3">{followerCount} Followers</div>
              </div>
            </div>
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Active Tab</h2>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                {tab === "followers"
                  ? "Followers shows who follows your account, with quick follow-back controls."
                  : "Following shows the accounts you follow, with one-tap unfollow controls."}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
