import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { auth, db } from "../src/firebase";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, where } from "firebase/firestore";
import { getRandomDefaultAvatar } from "../src/avatarDefaults";

export default function Communities() {
  const [viewer, setViewer] = useState(null);
  const [communities, setCommunities] = useState([]);
  const [joined, setJoined] = useState({});
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((nextUser) => {
      setViewer(nextUser || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setLoading(true);
    setAccessDenied(false);
    const q = query(collection(db, "communities"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCommunities(snapshot.docs.map((communityDoc) => ({ id: communityDoc.id, ...communityDoc.data() })));
        setLoading(false);
      },
      (error) => {
        setCommunities([]);
        setLoading(false);
        setAccessDenied(error?.code === "permission-denied");
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!viewer?.uid) {
      setJoined({});
      return;
    }

    const membershipQ = query(collection(db, "memberships"), where("userId", "==", viewer.uid));
    const unsubscribe = onSnapshot(
      membershipQ,
      (snapshot) => {
        const joinedMap = {};
        snapshot.docs.forEach((membershipDoc) => {
          const membership = membershipDoc.data();
          joinedMap[membership.communityId] = true;
        });
        setJoined(joinedMap);
      },
      () => {
        // Keep page usable if memberships cannot be read.
        setJoined({});
      }
    );

    return () => unsubscribe();
  }, [viewer?.uid]);

  const joinedCount = useMemo(() => Object.keys(joined).length, [joined]);

  const handleJoin = async (communityId) => {
    if (!viewer?.uid) return;
    try {
      await setDoc(doc(db, "memberships", `${viewer.uid}_${communityId}`), {
        userId: viewer.uid,
        communityId,
        joinedAt: Date.now()
      }, { merge: true });
    } catch {
      // Keep page interactive if join fails.
    }
  };

  const handleLeave = async (communityId) => {
    if (!viewer?.uid) return;
    try {
      await deleteDoc(doc(db, "memberships", `${viewer.uid}_${communityId}`));
    } catch {
      // Keep page interactive if leave fails.
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden xl:block w-72 shrink-0">
          <div className="sticky top-6 space-y-4">
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-brogreen">Communities</p>
              <h1 className="mt-2 text-2xl font-black">Desk Directory</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Create, join, and open any community feed using the same visual style as the main feed.</p>
            </div>
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick Stats</h2>
              <div className="mt-3 space-y-2 text-sm font-black">
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3">{communities.length} Total Communities</div>
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3">{joinedCount} Joined</div>
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
                  <h2 className="text-xl font-black">Community Feed Directory</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Launch a desk, subscribe, and open full community feeds.</p>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 dark:border-white/10 p-5">
              <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-brogreen">Create Community</p>
                <h3 className="mt-2 text-lg font-black">Launch a new desk</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Use the full creation flow with profile imagery, banner upload, and instant redirect to your new community page.</p>
                <Link href="/communities/create" className="mt-4 inline-flex rounded-2xl bg-brogreen px-4 py-2 text-sm font-black text-black">
                  Open Create Community
                </Link>
              </div>
            </div>

            <section>
              {loading ? (
                <div className="p-6 text-sm font-black text-slate-500 dark:text-slate-400">Loading communities...</div>
              ) : accessDenied ? (
                <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                  Communities are restricted right now. Sign in and try again.
                </div>
              ) : communities.length === 0 ? (
                <div className="p-6 text-sm text-slate-500 dark:text-slate-400">No communities found yet.</div>
              ) : (
                <ul>
                  {communities.map((community) => {
                    const isJoined = Boolean(joined[community.id]);
                    return (
                      <li key={community.id} className="border-b border-slate-100 dark:border-white/10 px-5 py-5 last:border-b-0">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <img
                              src={community.avatar || getRandomDefaultAvatar()}
                              alt={community.name || community.id}
                              className="h-12 w-12 rounded-full border border-slate-200 dark:border-white/10 object-cover"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-base font-black">{community.name || community.id}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{community.members || 0} members</div>
                              {community.description ? (
                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{community.description}</p>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {viewer ? (
                              isJoined ? (
                                <button
                                  type="button"
                                  className="rounded-2xl border border-red-200 px-4 py-2 text-xs font-black text-red-500 hover:bg-red-50 dark:border-red-400/40 dark:hover:bg-red-500/10"
                                  onClick={() => handleLeave(community.id)}
                                >
                                  Leave
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="rounded-2xl bg-brogreen px-4 py-2 text-xs font-black text-black dark:text-brogreen"
                                  onClick={() => handleJoin(community.id)}
                                >
                                  Join
                                </button>
                              )
                            ) : (
                              <Link href="/login" className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-2 text-xs font-black">Sign in</Link>
                            )}
                            <Link href={`/communities/${community.id}`} className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-2 text-xs font-black hover:bg-slate-50 dark:hover:bg-white/5">
                              Open Feed
                            </Link>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </section>
        </main>
      </div>
    </div>
  );
}
