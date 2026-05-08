import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from "./firebase";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, doc, increment, getDoc } from "firebase/firestore";
import { auth } from "./firebase";
import Comments from "./Comments";

function BullBearButton({ postId, bullish, bearish }) {
  const handleVote = async (type) => {
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, {
      [type]: increment(1)
    });
  };
  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        aria-label="Vote Bullish"
        title="Vote Bullish"
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-900/30 hover:bg-green-600/30 text-green-300 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-green-400"
        onClick={() => handleVote("bullish")}
      >
        {/* Upward green stock chart arrow */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 15 12 9 18 15" /><line x1="12" y1="9" x2="12" y2="21" /></svg>
        Bullish {bullish || 0}
      </button>
      <button
        aria-label="Vote Bearish"
        title="Vote Bearish"
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-900/30 hover:bg-red-600/30 text-red-300 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-red-400"
        onClick={() => handleVote("bearish")}
      >
        {/* Downward red stock chart arrow */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
        Bearish {bearish || 0}
      </button>
    </div>
  );
}


function PostThread() {
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("stocks");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const user = auth.currentUser;

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Fetch user profile photos for each post
      const postsWithPhotos = await Promise.all(snapshot.docs.map(async docSnap => {
        const data = docSnap.data();
        let photoURL = "/mainlogo.png";
        if (data.authorId) {
          try {
            const userDoc = await getDoc(doc(db, "users", data.authorId));
            if (userDoc.exists()) {
              photoURL = userDoc.data().photoURL || photoURL;
            }
          } catch {}
        }
        return { id: docSnap.id, ...data, photoURL };
      }));
      setPosts(postsWithPhotos);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!user) {
      setError("You must be signed in to post.");
      return;
    }
    if (!content.trim()) {
      setError("Post content cannot be empty.");
      return;
    }
    try {
      await addDoc(collection(db, "posts"), {
        content,
        category,
        createdAt: serverTimestamp(),
        author: user.email || user.displayName || "anon",
        authorId: user.uid,
        bullish: 0,
        bearish: 0
      });
      setContent("");
      setCategory("stocks");
    } catch (err) {
      setError("Failed to post. Try again.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-12">
      <form onSubmit={handleSubmit} className="glass p-6 rounded-2xl mb-8">
        <h3 className="text-xl font-bold mb-4">Start a Conversation</h3>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="mb-3 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
        >
          <option value="stocks">Stocks</option>
          <option value="options">Options</option>
          <option value="crypto">Crypto</option>
          <option value="jobs">Jobs</option>
          <option value="careers">Careers</option>
          <option value="other">Other</option>
        </select>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full mb-3 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
          rows={3}
        />
        {error && <div className="text-red-400 mb-2">{error}</div>}
        <button type="submit" className="px-6 py-2 rounded-xl bg-[#b6ff22] text-black font-bold hover:scale-105 transition">
          Post
        </button>
      </form>
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h3 className="text-lg font-bold">Recent Posts</h3>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none"
          >
            <option value="all">All</option>
            <option value="stocks">Stocks</option>
            <option value="options">Options</option>
            <option value="crypto">Crypto</option>
            <option value="jobs">Jobs</option>
            <option value="careers">Careers</option>
            <option value="other">Other</option>
          </select>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none"
          >
            <option value="newest">Newest</option>
            <option value="bullish">Most Bullish</option>
            <option value="bearish">Most Bearish</option>
          </select>
        </div>
        {loading ? (
          <div className="text-slate-400">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="text-slate-400">No posts yet.</div>
        ) : (
          <ul className="space-y-4">
            {posts
              .filter(post => filter === "all" || post.category === filter)
              .sort((a, b) => {
                if (sort === "newest") {
                  return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
                } else if (sort === "bullish") {
                  return (b.bullish || 0) - (a.bullish || 0);
                } else if (sort === "bearish") {
                  return (b.bearish || 0) - (a.bearish || 0);
                }
                return 0;
              })
              .map(post => (
                <li key={post.id} className="glass p-5 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <Link to={`/profile/${post.authorId}`} className="flex items-center gap-2 group">
                      <img
                        src={post.photoURL || "/mainlogo.png"}
                        alt={post.author ? `${post.author}'s profile` : "Profile"}
                        className="w-8 h-8 rounded-full object-cover border-2 border-[#b6ff22] bg-slate-800 group-hover:scale-110 transition"
                        aria-label={post.author ? `${post.author}'s profile image` : "Profile image"}
                        title={post.author ? `${post.author}'s profile` : "Profile"}
                      />
                      <span className="text-xs font-bold text-broblue group-hover:underline">@{post.author?.split('@')[0] || 'user'}</span>
                    </Link>
                    <div>
                      <div className="text-xs text-slate-400">{post.category.toUpperCase()}</div>
                      <div className="text-xs text-slate-500">{post.createdAt?.toDate ? post.createdAt.toDate().toLocaleString() : ""}</div>
                    </div>
                    <button
                      className="ml-auto px-2 py-1 rounded-lg bg-slate-800 text-xs text-white hover:bg-slate-700"
                      title="Copy post link"
                      onClick={() => {
                        const url = `${window.location.origin}/post/${post.id}`;
                        navigator.clipboard.writeText(url);
                        alert("Post link copied!");
                      }}
                    >
                      Share
                    </button>
                  </div>
                  <div className="text-white mb-2">{post.content}</div>
                  <BullBearButton postId={post.id} bullish={post.bullish} bearish={post.bearish} />
                  <Comments postId={post.id} />
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default PostThread;
