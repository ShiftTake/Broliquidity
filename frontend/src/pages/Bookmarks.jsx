
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { db, auth } from "../firebase";
import { collection, query, where, orderBy, getDocs, doc, getDoc, onSnapshot } from "firebase/firestore";
import Comments from "../Comments";

export default function Bookmarks() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Real-time listener for bookmarks, ordered by bookmarkedAt descending
    const q = query(collection(db, "bookmarks"), where("userId", "==", user.uid), orderBy("bookmarkedAt", "desc"));
    const unsubscribe = onSnapshot(q, async (bookmarksSnap) => {
      try {
        const postIds = bookmarksSnap.docs.map(doc => doc.data().postId);
        if (postIds.length === 0) {
          setPosts([]);
          setLoading(false);
          return;
        }
        // Fetch posts by ID
        const postPromises = postIds.map(async postId => {
          const postDoc = await getDoc(doc(db, "posts", postId));
          if (!postDoc.exists()) return null;
          const data = postDoc.data();
          let photoURL = "/mainlogo.png";
          if (data.authorId) {
            try {
              const userDoc = await getDoc(doc(db, "users", data.authorId));
              if (userDoc.exists()) {
                photoURL = userDoc.data().photoURL || photoURL;
              }
            } catch {}
          }
          return { id: postDoc.id, ...data, photoURL };
        });
        const postsArr = (await Promise.all(postPromises)).filter(Boolean);
        setPosts(postsArr);
      } catch (err) {
        setError("Failed to load bookmarks.");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <main className="flex flex-col items-center w-full min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900">
      <div className="w-full max-w-2xl flex flex-col mt-12 px-4 sm:px-0">
        <header className="flex items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Saved posts</h1>
            <p className="text-sm text-slate-500 mt-1">Saved posts in the order you bookmarked them.</p>
          </div>
          <Link href="/feed" legacyBehavior>
            <a className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 font-black text-slate-900 shadow-sm hover:bg-slate-50 transition-colors" aria-label="Back to feed" title="Back to feed">
              <span aria-hidden="true">←</span>
              <span className="hidden sm:inline">Back to Feed</span>
            </a>
          </Link>
        </header>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <span className="text-slate-500 text-lg font-medium">Loading...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24">
            <span className="text-red-500 text-lg font-medium">{error}</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 rounded-3xl border border-dashed border-slate-200 bg-white shadow-sm">
            <svg width="48" height="48" fill="none" viewBox="0 0 48 48" className="mb-4 opacity-50">
              <path d="M12 6a4 4 0 0 0-4 4v32l16-8 16 8V10a4 4 0 0 0-4-4H12Z" stroke="#0f172a" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
            <span className="text-slate-500 text-lg font-semibold text-center">No saved posts yet.<br />Your saved posts will appear here.</span>
          </div>
        ) : (
          <ul className="space-y-4">
            {posts.map(post => (
              <li key={post.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                  <img
                    src={post.photoURL || "/mainlogo.png"}
                    alt={post.author ? `${post.author}'s profile` : "Profile"}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 bg-white"
                    aria-label={post.author ? `${post.author}'s profile image` : "Profile image"}
                    title={post.author ? `${post.author}'s profile` : "Profile"}
                  />
                  <div>
                    <div className="text-xs font-bold text-brogreen">@{post.author?.split('@')[0] || 'user'}</div>
                    <div className="text-xs text-slate-400">{post.category?.toUpperCase()}</div>
                    <div className="text-xs text-slate-500">{post.createdAt ? new Date(post.createdAt).toLocaleString() : ""}</div>
                    {post.communityId && <div className="text-xs text-slate-500">c/{post.communityId}</div>}
                  </div>
                </div>
                <div className="text-slate-900 mb-2">{post.content}</div>
                <Comments postId={post.id} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
