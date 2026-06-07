import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { auth, db } from "../src/firebase";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";

export default function NotificationsPage() {
  const [viewer, setViewer] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [explorerPosts, setExplorerPosts] = useState([]);
  const [explorerLoading, setExplorerLoading] = useState(true);
  const [explorerQuery, setExplorerQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((nextUser) => {
      setViewer(nextUser || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!viewer?.email) {
      setNotifications([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("recipient", "==", viewer.email)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((notificationDoc) => ({ id: notificationDoc.id, ...notificationDoc.data() }))
        .sort((a, b) => {
          const aMs = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : ((a.createdAt?.seconds || 0) * 1000);
          const bMs = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : ((b.createdAt?.seconds || 0) * 1000);
          return bMs - aMs;
        });

      setNotifications(rows);
      setLoading(false);
    }, () => {
      setNotifications([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [viewer?.email]);

  useEffect(() => {
    setExplorerLoading(true);
    const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((postDoc) => ({ id: postDoc.id, ...postDoc.data() }))
        .filter((post) => typeof post.content === "string" && post.content.trim().length > 0)
        .map((post) => {
          const createdAtMs = post.createdAt?.toDate
            ? post.createdAt.toDate().getTime()
            : ((post.createdAt?.seconds || 0) * 1000);
          const comments = post.comments || 0;
          const bullishVotes = post.bullishVotes || 0;
          const bearishVotes = post.bearishVotes || 0;
          const engagement = comments + bullishVotes + bearishVotes;
          return {
            ...post,
            createdAtMs,
            engagement,
            authorName: post.user?.name || "User",
            authorHandle: post.user?.handle || "@user",
            authorAvatar: post.user?.avatar || "/defaults/default1.png"
          };
        })
        .sort((a, b) => {
          if (b.engagement !== a.engagement) return b.engagement - a.engagement;
          return b.createdAtMs - a.createdAtMs;
        });

      setExplorerPosts(rows);
      setExplorerLoading(false);
    }, () => {
      setExplorerPosts([]);
      setExplorerLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  const explorerResults = useMemo(() => {
    const queryText = explorerQuery.trim().toLowerCase();
    const baseRows = queryText
      ? explorerPosts.filter((post) => {
        const content = (post.content || "").toLowerCase();
        const author = (post.authorName || "").toLowerCase();
        const handle = (post.authorHandle || "").toLowerCase();
        const community = (post.community || "").toLowerCase();
        return content.includes(queryText) || author.includes(queryText) || handle.includes(queryText) || community.includes(queryText);
      })
      : explorerPosts;

    return baseRows.slice(0, 8);
  }, [explorerPosts, explorerQuery]);

  const formatTypeLabel = (type) => {
    if (type === "comment") return "New Comment";
    if (type === "bullish") return "Uptrend";
    if (type === "bearish") return "Downtrend";
    if (type === "follow") return "New Follow";
    return "Notification";
  };

  const formatTimestamp = (createdAt) => {
    if (!createdAt) return "Recent";
    if (createdAt.toDate) return createdAt.toDate().toLocaleString();
    if (createdAt.seconds) return new Date(createdAt.seconds * 1000).toLocaleString();
    return "Recent";
  };

  const handleMarkRead = async (notificationId) => {
    if (!notificationId) return;
    try {
      await updateDoc(doc(db, "notifications", notificationId), {
        read: true,
        readAt: serverTimestamp()
      });
    } catch {
      // Keep the page interactive.
    }
  };

  const handleMarkAllRead = async () => {
    if (!notifications.length || markingAll) return;
    setMarkingAll(true);

    try {
      await Promise.all(
        notifications
          .filter((notification) => !notification.read)
          .map((notification) =>
            updateDoc(doc(db, "notifications", notification.id), {
              read: true,
              readAt: serverTimestamp()
            })
          )
      );
    } catch {
      // Keep the page interactive.
    }

    setMarkingAll(false);
  };

  if (!viewer && !loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#050816] px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-8 text-center shadow-sm">
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">Sign in to view notifications</h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Your account alerts, replies, follows, and finance updates will appear here.</p>
          <Link href="/login" className="mt-6 inline-flex rounded-2xl bg-brogreen px-5 py-3 font-black text-black">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden xl:block w-72 shrink-0">
          <div className="sticky top-6 space-y-4">
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-brogreen">Notifications</p>
              <h1 className="mt-2 text-2xl font-black">Alert Center</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">A feed-style view of replies, follows, votes, and finance updates tied to your account.</p>
            </div>
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick Links</h2>
              <div className="mt-4 space-y-2">
                <Link href="/feed" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 font-black hover:bg-slate-50 dark:hover:bg-white/5">Main Feed</Link>
                <Link href="/dm" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 font-black hover:bg-slate-50 dark:hover:bg-white/5">Direct Messages</Link>
                <Link href="/explore" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 font-black hover:bg-slate-50 dark:hover:bg-white/5">Stock Explorer</Link>
                <Link href="/profile" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 font-black hover:bg-slate-50 dark:hover:bg-white/5">Your Profile</Link>
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
                    <h2 className="text-xl font-black">Notifications</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Everything that needs your attention, in the same rhythm as the feed.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-2xl bg-brogreen px-4 py-2 text-sm font-black text-black disabled:opacity-50"
                  onClick={handleMarkAllRead}
                  disabled={markingAll || unreadCount === 0}
                >
                  {markingAll ? "Updating..." : unreadCount === 0 ? "All Read" : "Mark All Read"}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-6 text-sm font-black text-slate-500 dark:text-slate-400">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6">
                <div className="rounded-3xl border border-dashed border-slate-200 dark:border-white/10 p-8 text-center">
                  <h3 className="text-lg font-black">No notifications yet</h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">When people interact with you or the system sends account alerts, they will land here.</p>
                </div>
              </div>
            ) : (
              <ul>
                {notifications.map((notification) => (
                  <li key={notification.id} className="border-b border-slate-100 dark:border-white/10 px-5 py-5 last:border-b-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-brogreen/10 px-3 py-1 text-xs font-black text-brogreen">{formatTypeLabel(notification.type)}</span>
                          {!notification.read ? <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-black text-white dark:bg-white dark:text-slate-900">Unread</span> : null}
                        </div>
                        <p className="mt-3 text-sm text-slate-800 dark:text-slate-100">{notification.message || "You have a new notification."}</p>
                        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">{formatTimestamp(notification.createdAt)}</div>
                      </div>
                      {!notification.read ? (
                        <button
                          type="button"
                          className="rounded-2xl border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-black hover:bg-slate-50 dark:hover:bg-white/5"
                          onClick={() => handleMarkRead(notification.id)}
                        >
                          Mark Read
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Stock Explorer</h2>
                  <p className="text-xs text-slate-500">Discover high-engagement posts using a feed-style explorer surface.</p>
                </div>
                <Link href="/explore" className="rounded-2xl bg-brogreen px-4 py-2 text-xs font-black text-black">Open Full Explorer</Link>
              </div>
              <div className="mt-4">
                <input
                  type="text"
                  value={explorerQuery}
                  onChange={(event) => setExplorerQuery(event.target.value)}
                  placeholder="Search posts, users, handles, or communities..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            {explorerLoading ? (
              <div className="p-6 text-sm font-black text-slate-500">Loading stock explorer...</div>
            ) : explorerResults.length === 0 ? (
              <div className="p-6">
                <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center">
                  <h3 className="text-lg font-black">No explorer matches yet</h3>
                  <p className="mt-2 text-sm text-slate-500">Try a different search term or come back as more posts are published.</p>
                </div>
              </div>
            ) : (
              <ul>
                {explorerResults.map((post) => (
                  <li key={post.id} className="border-b border-slate-100 px-5 py-5 last:border-b-0">
                    <div className="flex items-start gap-3">
                      <img
                        src={post.authorAvatar}
                        alt={post.authorName}
                        className="h-11 w-11 rounded-full border-2 border-brogreen object-cover bg-slate-200"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-black text-slate-900">{post.authorName}</span>
                          <span className="truncate text-xs text-slate-500">{post.authorHandle}</span>
                          {post.community ? (
                            <span className="rounded-full bg-brogreen/10 px-2 py-1 text-[10px] font-black text-brogreen">{post.community}</span>
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-3 text-sm text-slate-800">{post.content}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-black text-slate-500">
                          <span>{post.comments || 0} comments</span>
                          <span>{post.bullishVotes || 0} uptrend</span>
                          <span>{post.bearishVotes || 0} downtrend</span>
                          <span>{post.engagement} engagement</span>
                        </div>
                        <div className="mt-3">
                          <Link href="/feed" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black hover:bg-slate-50">Open in Feed</Link>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>

        <aside className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-6 space-y-4">
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-lg font-black">Overview</h2>
              <div className="mt-4 grid gap-3 text-sm font-black">
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3">{notifications.length} Total Alerts</div>
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3">{unreadCount} Unread</div>
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3">{explorerPosts.length} Indexed Posts</div>
              </div>
            </div>
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Notes</h2>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">This page mirrors the feed shell so alerts feel like part of the same product surface rather than a detached utility page.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
