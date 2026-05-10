import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { db, auth } from "./firebase";
import Link from "next/link";
import Comments from "./Comments";

// Helper to fetch joined communities for the current user
async function getJoinedCommunities(userId) {
  const snap = await db.collection("memberships").where("userId", "==", userId).get();
  return snap.docs.map(d => d.data().communityId);
}

function Feed() {
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("stocks");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [communityFilter, setCommunityFilter] = useState("all");
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [postCommunity, setPostCommunity] = useState("");
  const [showPostModal, setShowPostModal] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    const unsubscribe = db.collection("posts").orderBy("createdAt", "desc").onSnapshot(async (snapshot) => {
      const postsWithPhotos = await Promise.all(snapshot.docs.map(async docSnap => {
        const data = docSnap.data();
        let photoURL = "/mainlogo.png";
        if (data.authorId) {
          try {
            const userDoc = await db.collection("users").doc(data.authorId).get();
            if (userDoc.exists) {
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

  // Fetch joined communities for filter dropdown
  useEffect(() => {
    if (!user) return;
    getJoinedCommunities(user.uid).then(setJoinedCommunities);
  }, [user]);

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
    // If user selected a community, require that they are a member
    if (postCommunity && !joinedCommunities.includes(postCommunity)) {
      setError("You must join the community first.");
      return;
    }
    try {
      await db.collection("posts").add({
        content,
        category,
        communityId: postCommunity || null,
        createdAt: new Date(),
        author: user.email || user.displayName || "anon",
        authorId: user.uid,
        bullish: 0,
        bearish: 0
      });
      setContent("");
      setCategory("stocks");
      setPostCommunity("");
    } catch (err) {
      setError("Failed to post. Try again.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-12">
      <button
        className="mb-6 px-6 py-3 rounded-2xl bg-[#b6ff22] text-black font-black text-lg hover:scale-105 transition"
        onClick={() => setShowPostModal(true)}
      >
        Create Post
      </button>

      <Modal open={showPostModal} onClose={() => { console.log('Modal close button clicked'); setShowPostModal(false); }}>
        <form onSubmit={e => { handleSubmit(e); if (!error) setShowPostModal(false); }} className="glass p-6 rounded-2xl mb-2">
          <h3 className="text-xl font-bold mb-4">Start a Conversation</h3>
          <div className="flex flex-col md:flex-row gap-3 mb-3">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
            >
              <option value="stocks">Stocks</option>
              <option value="options">Options</option>
              <option value="crypto">Crypto</option>
              <option value="jobs">Jobs</option>
              <option value="careers">Careers</option>
              <option value="other">Other</option>
            </select>
            {/* Community select for posting */}
            <select
              value={postCommunity}
              onChange={e => setPostCommunity(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
            >
              <option value="">No Community</option>
              {joinedCommunities.map(cid => (
                <option key={cid} value={cid}>c/{cid}</option>
              ))}
            </select>
          </div>
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
      </Modal>

      <div>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h3 className="text-lg font-bold">Recent Posts</h3>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="stocks">Stocks</option>
            <option value="options">Options</option>
            <option value="crypto">Crypto</option>
            <option value="jobs">Jobs</option>
            <option value="careers">Careers</option>
            <option value="other">Other</option>
          </select>
          {/* Community filter dropdown */}
          <select
            value={communityFilter}
            onChange={e => setCommunityFilter(e.target.value)}
            className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none"
          >
            <option value="all">All Communities</option>
            {joinedCommunities.map(cid => (
              <option key={cid} value={cid}>c/{cid}</option>
            ))}
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
              .filter(post => (filter === "all" || post.category === filter))
              .filter(post => (communityFilter === "all" || post.communityId === communityFilter))
              .sort((a, b) => {
                if (sort === "newest") {
                  return new Date(b.createdAt) - new Date(a.createdAt);
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
                    <Link href={`/profile/${post.authorId}`} legacyBehavior>
                      <a className="flex items-center gap-2 group">
                      <img
                        src={post.photoURL || "/mainlogo.png"}
                        alt={post.author ? `${post.author}'s profile` : "Profile"}
                        className="w-8 h-8 rounded-full object-cover border-2 border-[#b6ff22] bg-slate-800 group-hover:scale-110 transition"
                        aria-label={post.author ? `${post.author}'s profile image` : "Profile image"}
                        title={post.author ? `${post.author}'s profile` : "Profile"}
                      />
                      <span className="text-xs font-bold text-broblue group-hover:underline">@{post.author?.split('@')[0] || 'user'}</span>
                      </a>
                    </Link>
                    <div>
                      <div className="text-xs text-slate-400">{post.category.toUpperCase()}</div>
                      <div className="text-xs text-slate-500">{post.createdAt ? new Date(post.createdAt).toLocaleString() : ""}</div>
                      {post.communityId && <div className="text-xs text-brogreen">c/{post.communityId}</div>}
                    </div>
                  </div>
                  <div className="text-white mb-2">{post.content}</div>
                  {/* Add BullBearButton and Comments as needed */}
                  <Comments postId={post.id} />
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Feed;
