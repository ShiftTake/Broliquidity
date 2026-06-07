import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { auth, db } from "../src/firebase";

const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const formatDateTime = (value) => {
  if (!value) return "-";
  if (value?.toDate) return value.toDate().toLocaleString();
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "number") return new Date(value).toLocaleString();
  return "-";
};

const isCreatedToday = (value) => {
  if (!value) return false;
  const dt = value?.toDate ? value.toDate() : value instanceof Date ? value : typeof value === "number" ? new Date(value) : null;
  if (!dt) return false;
  const now = new Date();
  return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
};

const createdAtToMs = (value) => {
  if (!value) return 0;
  if (value?.toDate) return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const sortByCreatedDesc = (items) =>
  [...items].sort((a, b) => createdAtToMs(b?.createdAt) - createdAtToMs(a?.createdAt));

export default function AdminPage() {
  const [viewer, setViewer] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [managerSessionAccess, setManagerSessionAccess] = useState(false);
  const [managerEmailInput, setManagerEmailInput] = useState("");
  const [managerPasswordInput, setManagerPasswordInput] = useState("");
  const [managerLoginError, setManagerLoginError] = useState("");
  const [users, setUsers] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [posts, setPosts] = useState([]);
  const [postReports, setPostReports] = useState([]);
  const [commentReports, setCommentReports] = useState([]);
  const [actionBusy, setActionBusy] = useState("");
  const [dataError, setDataError] = useState("");
  const [directorySearch, setDirectorySearch] = useState("");

  useEffect(() => {
    let active = true;
    const checkManagerSession = async () => {
      try {
        const res = await fetch("/api/manager-auth", { method: "GET" });
        if (!active) return;
        setManagerSessionAccess(res.ok);
      } catch {
        if (!active) return;
        setManagerSessionAccess(false);
      }
      if (active) setSessionLoading(false);
    };

    checkManagerSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setViewer(firebaseUser);
      if (!firebaseUser) {
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }

      const email = String(firebaseUser.email || "").toLowerCase();
      const emailAllowed = adminEmails.includes(email);

      let roleAllowed = false;
      try {
        const adminDoc = await getDoc(doc(db, "admins", firebaseUser.uid));
        roleAllowed = adminDoc.exists();
      } catch {
        roleAllowed = false;
      }

      setIsAdmin(emailAllowed || roleAllowed);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const hasManagerAccess = isAdmin || managerSessionAccess;

  useEffect(() => {
    if (!hasManagerAccess) return undefined;
    setDataError("");

    const usersUnsub = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const rows = snapshot.docs.map((row) => ({ id: row.id, ...row.data() }));
        setUsers(sortByCreatedDesc(rows));
      },
      (err) => {
        setUsers([]);
        setDataError(err?.message || "Could not load users.");
      }
    );

    const communitiesUnsub = onSnapshot(
      collection(db, "communities"),
      (snapshot) => {
        const rows = snapshot.docs.map((row) => ({ id: row.id, ...row.data() }));
        setCommunities(sortByCreatedDesc(rows));
      },
      () => setCommunities([])
    );

    const postsUnsub = onSnapshot(
      collection(db, "posts"),
      (snapshot) => {
        const rows = snapshot.docs.map((row) => ({ id: row.id, ...row.data() }));
        setPosts(sortByCreatedDesc(rows));
      },
      () => setPosts([])
    );

    const postReportsUnsub = onSnapshot(
      collection(db, "postReports"),
      (snapshot) => {
        const rows = snapshot.docs.map((row) => ({ id: row.id, ...row.data() }));
        setPostReports(sortByCreatedDesc(rows));
      },
      () => setPostReports([])
    );

    const commentReportsUnsub = onSnapshot(
      collection(db, "commentReports"),
      (snapshot) => {
        const rows = snapshot.docs.map((row) => ({ id: row.id, ...row.data() }));
        setCommentReports(sortByCreatedDesc(rows));
      },
      () => setCommentReports([])
    );

    return () => {
      usersUnsub();
      communitiesUnsub();
      postsUnsub();
      postReportsUnsub();
      commentReportsUnsub();
    };
  }, [hasManagerAccess]);

  const filteredUsers = useMemo(() => {
    const needle = directorySearch.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((row) => {
      const username = String(row.username || row.displayName || "").toLowerCase();
      const email = String(row.email || "").toLowerCase();
      return username.includes(needle) || email.includes(needle);
    });
  }, [users, directorySearch]);

  const filteredCommunities = useMemo(() => {
    const needle = directorySearch.trim().toLowerCase();
    if (!needle) return communities;
    return communities.filter((row) => {
      const name = String(row.name || "").toLowerCase();
      const category = String(row.category || "").toLowerCase();
      return name.includes(needle) || category.includes(needle);
    });
  }, [communities, directorySearch]);

  const handleManagerLogin = async (e) => {
    e.preventDefault();
    setManagerLoginError("");

    try {
      const res = await fetch("/api/manager-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: managerEmailInput,
          password: managerPasswordInput
        })
      });

      if (!res.ok) {
        setManagerLoginError("Invalid manager credentials.");
        return;
      }

      setManagerSessionAccess(true);
      setManagerPasswordInput("");
    } catch {
      setManagerLoginError("Manager login is temporarily unavailable.");
    }
  };

  const handleManagerLogout = async () => {
    try {
      await fetch("/api/manager-auth", { method: "DELETE" });
    } catch {
      // Best effort logout.
    }
    setManagerSessionAccess(false);
    setManagerEmailInput("");
    setManagerPasswordInput("");
    setManagerLoginError("");
  };

  const analytics = useMemo(() => {
    const blockedUsers = users.filter((row) => Boolean(row.blocked)).length;
    const newUsersToday = users.filter((row) => isCreatedToday(row.createdAt)).length;
    const postsToday = posts.filter((row) => isCreatedToday(row.createdAt)).length;
    const openPostReports = postReports.filter((row) => (row.status || "open") === "open").length;
    const openCommentReports = commentReports.filter((row) => (row.status || "open") === "open").length;

    return {
      totalUsers: users.length,
      blockedUsers,
      newUsersToday,
      totalPosts: posts.length,
      postsToday,
      openReports: openPostReports + openCommentReports
    };
  }, [users, posts, postReports, commentReports]);

  const toggleUserBlock = async (targetUser) => {
    if (!targetUser?.id) return;
    const nextBlocked = !targetUser.blocked;
    const actionKey = `user:${targetUser.id}`;
    setActionBusy(actionKey);
    try {
      await setDoc(
        doc(db, "users", targetUser.id),
        {
          blocked: nextBlocked,
          blockedAt: nextBlocked ? serverTimestamp() : null,
          blockedBy: nextBlocked ? viewer?.uid || "manager" : null,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    } finally {
      setActionBusy("");
    }
  };

  const deletePost = async (post) => {
    if (!post?.id) return;
    const ok = window.confirm("Delete this post permanently?");
    if (!ok) return;
    const actionKey = `post:${post.id}`;
    setActionBusy(actionKey);
    try {
      await deleteDoc(doc(db, "posts", post.id));
    } finally {
      setActionBusy("");
    }
  };

  if (authLoading || sessionLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
        <p className="font-black">Loading manager console...</p>
      </div>
    );
  }

  if (!hasManagerAccess) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100 px-6 py-10">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 dark:border-white/10 p-6">
          <h1 className="text-2xl font-black">Manager Login</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Use manager credentials to access this console.</p>
          <form className="mt-5 space-y-3" onSubmit={handleManagerLogin}>
            <input
              type="email"
              value={managerEmailInput}
              onChange={(e) => setManagerEmailInput(e.target.value)}
              placeholder="Manager email"
              className="w-full rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 bg-white dark:bg-white/5"
              required
            />
            <input
              type="password"
              value={managerPasswordInput}
              onChange={(e) => setManagerPasswordInput(e.target.value)}
              placeholder="Manager password"
              className="w-full rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 bg-white dark:bg-white/5"
              required
            />
            {managerLoginError ? <p className="text-sm text-red-500 font-semibold">{managerLoginError}</p> : null}
            <p className="text-xs text-slate-500">Configured server-side with MANAGER_LOGIN_EMAIL, MANAGER_LOGIN_PASSWORD_HASH, and MANAGER_SESSION_SECRET.</p>
            <div className="flex items-center gap-3">
              <button type="submit" className="inline-flex rounded-2xl bg-brogreen px-4 py-2 font-black text-black">Login</button>
              <Link href="/feed" className="inline-flex rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-2 font-black">Back to Feed</Link>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100 px-6 py-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black">BroLiquidity Manager Console</h1>
            <p className="text-sm text-slate-500">Signed in as {viewer?.email || managerEmailInput || "Manager"}</p>
          </div>
          <div className="flex items-center gap-2">
            {managerSessionAccess ? (
              <button
                type="button"
                onClick={handleManagerLogout}
                className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-2 font-black"
              >
                Manager Logout
              </button>
            ) : null}
            <Link href="/feed" className="rounded-2xl bg-brogreen px-4 py-2 font-black text-black">
              Back to Feed
            </Link>
          </div>
        </div>

        {dataError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            Manager data warning: {dataError}
          </div>
        ) : null}

        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4"><p className="text-xs text-slate-500">Total Users</p><p className="text-2xl font-black">{analytics.totalUsers}</p></div>
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4"><p className="text-xs text-slate-500">New Users Today</p><p className="text-2xl font-black">{analytics.newUsersToday}</p></div>
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4"><p className="text-xs text-slate-500">Blocked Users</p><p className="text-2xl font-black">{analytics.blockedUsers}</p></div>
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4"><p className="text-xs text-slate-500">Total Posts</p><p className="text-2xl font-black">{analytics.totalPosts}</p></div>
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4"><p className="text-xs text-slate-500">Posts Today</p><p className="text-2xl font-black">{analytics.postsToday}</p></div>
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4"><p className="text-xs text-slate-500">Open Reports</p><p className="text-2xl font-black">{analytics.openReports}</p></div>
        </section>

        <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4">
          <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Search Users or Communities</label>
          <input
            type="text"
            value={directorySearch}
            onChange={(e) => setDirectorySearch(e.target.value)}
            placeholder="Search by user email/username or community name"
            className="w-full rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 bg-white dark:bg-white/5"
          />
        </section>

        <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">Users</h2>
            <span className="text-xs text-slate-500">{filteredUsers.length} shown</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 dark:border-white/10">
                  <th className="py-2">Email</th>
                  <th className="py-2">Username</th>
                  <th className="py-2">Date Joined</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((row) => {
                  const busy = actionBusy === `user:${row.id}`;
                  const username = row.username || row.displayName || (row.email ? row.email.split("@")[0] : "User");
                  return (
                    <tr key={row.id} className="border-b border-slate-100 dark:border-white/5">
                      <td className="py-2 text-slate-500">{row.email || "-"}</td>
                      <td className="py-2 font-semibold">{username}</td>
                      <td className="py-2 text-slate-500">{formatDateTime(row.createdAt)}</td>
                      <td className="py-2">
                        <span className={"inline-flex rounded-full px-2 py-1 text-xs font-black " + (row.blocked ? "bg-red-500/15 text-red-500" : "bg-green-500/15 text-green-600")}>
                          {row.blocked ? "Blocked" : "Active"}
                        </span>
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => toggleUserBlock(row)}
                          className={"rounded-xl px-3 py-1 text-xs font-black " + (row.blocked ? "bg-green-600 text-white" : "bg-red-600 text-white") + (busy ? " opacity-60" : "")}
                        >
                          {busy ? "Saving..." : row.blocked ? "Unblock" : "Block"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">Communities</h2>
            <span className="text-xs text-slate-500">{filteredCommunities.length} shown</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 dark:border-white/10">
                  <th className="py-2">Name</th>
                  <th className="py-2">Category</th>
                  <th className="py-2">Members</th>
                  <th className="py-2">Date Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredCommunities.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 dark:border-white/5">
                    <td className="py-2 font-semibold">{row.name || "-"}</td>
                    <td className="py-2 text-slate-500">{row.category || "-"}</td>
                    <td className="py-2 text-slate-500">{Number(row.members || 0)}</td>
                    <td className="py-2 text-slate-500">{formatDateTime(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black">Posts Moderation</h2>
            <span className="text-xs text-slate-500">Delete violating posts directly</span>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {posts.slice(0, 200).map((post) => {
              const busy = actionBusy === `post:${post.id}`;
              return (
                <div key={post.id} className="rounded-2xl border border-slate-200 dark:border-white/10 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">{post.user?.name || post.author || post.authorId || "Unknown"} • {formatDateTime(post.createdAt)}</p>
                      <p className="mt-1 text-sm font-semibold line-clamp-2">{post.content || "(no text)"}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => deletePost(post)}
                      className={"shrink-0 rounded-xl bg-red-600 px-3 py-1 text-xs font-black text-white" + (busy ? " opacity-60" : "")}
                    >
                      {busy ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
            <h2 className="text-lg font-black mb-3">Post Reports</h2>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {postReports.length ? postReports.slice(0, 100).map((report) => (
                <div key={report.id} className="rounded-2xl border border-slate-200 dark:border-white/10 p-3 text-xs">
                  <p className="font-black">Post: {report.postId || "-"}</p>
                  <p className="text-slate-500">Reporter: {report.reporterId || "-"}</p>
                  <p className="text-slate-500">Status: {report.status || "open"}</p>
                </div>
              )) : <p className="text-sm text-slate-500">No post reports.</p>}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
            <h2 className="text-lg font-black mb-3">Comment Reports</h2>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {commentReports.length ? commentReports.slice(0, 100).map((report) => (
                <div key={report.id} className="rounded-2xl border border-slate-200 dark:border-white/10 p-3 text-xs">
                  <p className="font-black">Comment: {report.commentId || "-"}</p>
                  <p className="text-slate-500">Post: {report.postId || "-"}</p>
                  <p className="text-slate-500">Status: {report.status || "open"}</p>
                </div>
              )) : <p className="text-sm text-slate-500">No comment reports.</p>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
