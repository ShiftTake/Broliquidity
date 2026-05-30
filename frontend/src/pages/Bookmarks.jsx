
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from "firebase/firestore";
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
    async function fetchBookmarks() {
      setLoading(true);
      try {
        // Get bookmarks for the user
        const bookmarksSnap = await getDocs(
          query(collection(db, "bookmarks"), where("userId", "==", user.uid))
        );
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
    }
    fetchBookmarks();
  }, [user]);

  return (
    <div className="max-w-2xl mx-auto mt-12">
      <h3 className="text-lg font-bold mb-4">Bookmarked Posts</h3>
      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : posts.length === 0 ? (
        <div className="text-slate-400">Your saved posts will appear here.</div>
      ) : (
        <ul className="space-y-4">
          {posts.map(post => (
            <li key={post.id} className="glass p-5 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <img
                  src={post.photoURL || "/mainlogo.png"}
                  alt={post.author ? `${post.author}'s profile` : "Profile"}
                  className="w-8 h-8 rounded-full object-cover border-2 border-[#b6ff22] bg-slate-800"
                  aria-label={post.author ? `${post.author}'s profile image` : "Profile image"}
                  title={post.author ? `${post.author}'s profile` : "Profile"}
                />
                <div>
                  <div className="text-xs text-slate-400">{post.category?.toUpperCase()}</div>
                  <div className="text-xs text-slate-500">{post.createdAt ? new Date(post.createdAt).toLocaleString() : ""}</div>
                  {post.communityId && <div className="text-xs text-brogreen">c/{post.communityId}</div>}
                </div>
              </div>
              <div className="text-white mb-2">{post.content}</div>
              <Comments postId={post.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
