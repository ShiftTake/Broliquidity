// ...existing code...
// STRICT STATIC JSX CLONE OF feed.html (NO LOGIC, NO HOOKS, NO LOGIC, NO FUNCTIONS)
import React, { useEffect, useState } from "react";
import { auth, db } from "../src/firebase";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { query, collection, orderBy, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
// (duplicate import removed)
  // Voting handlers
  const handleVote = async (post, type) => {
    // Demo posts fallback: update local state only
    if (!post.id || typeof post.id === "number") {
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id !== post.id) return p;
        if (type === "bullish") {
          const bullishVotes = (p.bullishVotes || 0) + 1;
          return { ...p, bullishVotes };
        } else if (type === "bearish") {
          const bearishVotes = (p.bearishVotes || 0) + 1;
          return { ...p, bearishVotes };
        }
        return p;
      }));
      return;
    }
    // Firestore atomic increment
    try {
      const postRef = doc(db, "posts", post.id);
      if (type === "bullish") {
        await updateDoc(postRef, { bullishVotes: firestoreIncrement(1) });
      } else if (type === "bearish") {
        await updateDoc(postRef, { bearishVotes: firestoreIncrement(1) });
      }
    } catch (err) {
      // Optionally show error (not required by requirements)
    }
  };

const initialPosts = [
  {
    id: 1,
    user: {
      name: "Jane Doe",
      avatar: "https://ui-avatars.com/api/?name=JD&background=050816&color=B6FF22",
      handle: "@janedoe"
    },
    time: "2m",
    content: "Just passed my SIE! Ready for the next step.",
    image: null,
    comments: 3,
    likes: 12,
    bookmarked: false
  },
  {
    id: 2,
    user: {
      name: "John Smith",
      avatar: "https://ui-avatars.com/api/?name=JS&background=050816&color=B6FF22",
      handle: "@johnsmith"
    },
    time: "10m",
    content: "Anyone prepping for the Series 7? Tips welcome!",
    image: null,
    comments: 1,
    likes: 7,
    bookmarked: true
  }
  // Add more static posts as needed for visual parity
];

const initialRecommendedPosts = [
  {
    id: 101,
    user: {
      name: "Ava Analyst",
      avatar: "https://ui-avatars.com/api/?name=AA&background=050816&color=B6FF22",
      handle: "@avaanalyst"
    },
    time: "5m",
    content: "Check out this new ETF for 2026!",
    image: null,
    comments: 2,
    likes: 9,
    bookmarked: false
  },
  {
    id: 102,
    user: {
      name: "Ben Bullish",
      avatar: "https://ui-avatars.com/api/?name=BB&background=050816&color=B6FF22",
      handle: "@benbullish"
    },
    time: "12m",
    content: "Bullish on tech for the next quarter.",
    image: null,
    comments: 0,
    likes: 4,
    bookmarked: true
  }
  // Add more static recommended posts as needed for visual parity
];

const initialWatchlist = [
  { symbol: "AAPL", name: "Apple Inc.", active: true },
  { symbol: "TSLA", name: "Tesla Inc.", active: false },
  { symbol: "BTC", name: "Bitcoin", active: false },
];

const initialCommunities = [
  { id: 1, name: "Equity Bros", members: 120, avatar: "https://ui-avatars.com/api/?name=EB&background=050816&color=B6FF22" },
  { id: 2, name: "Options Desk", members: 87, avatar: "https://ui-avatars.com/api/?name=OD&background=050816&color=B6FF22" },
  { id: 3, name: "Crypto Degens", members: 203, avatar: "https://ui-avatars.com/api/?name=CD&background=050816&color=B6FF22" },
];
const initialFollowing = [
  { id: 1, name: "Jane Doe", handle: "@janedoe", avatar: "https://ui-avatars.com/api/?name=JD&background=050816&color=B6FF22" },
  { id: 2, name: "John Smith", handle: "@johnsmith", avatar: "https://ui-avatars.com/api/?name=JS&background=050816&color=B6FF22" },
];
const initialTrendingTopics = [
  { id: 1, topic: "#SIEPass", posts: 32 },
  { id: 2, topic: "#OptionsFlow", posts: 21 },
  { id: 3, topic: "#CryptoWinter", posts: 17 },
];

const initialCommentsByPost = {
  1: [
    { id: 1, user: { name: "Alice", avatar: "https://ui-avatars.com/api/?name=Alice&background=050816&color=B6FF22" }, content: "Congrats!" },
    { id: 2, user: { name: "Bob", avatar: "https://ui-avatars.com/api/?name=Bob&background=050816&color=B6FF22" }, content: "Well done!" }
  ],
  2: [
    { id: 3, user: { name: "Charlie", avatar: "https://ui-avatars.com/api/?name=Charlie&background=050816&color=B6FF22" }, content: "Good luck!" }
  ],
  101: [],
  102: []
};

const Feed = () => {
    // Community creation state
    const [communityName, setCommunityName] = useState("");
    const [communityDesc, setCommunityDesc] = useState("");
    const [communityCategory, setCommunityCategory] = useState("");
    const [communityImage, setCommunityImage] = useState(null);
    const [communityImagePreview, setCommunityImagePreview] = useState(null);
    const [communityBanner, setCommunityBanner] = useState(null);
    const [communityBannerPreview, setCommunityBannerPreview] = useState(null);
    const [communityError, setCommunityError] = useState("");
    const [communityLoading, setCommunityLoading] = useState(false);

    // Modal open handlers
    useEffect(() => {
      const openBtn = document.getElementById("left-create-community");
      if (openBtn) openBtn.onclick = () => setModal("create-community");
      return () => { if (openBtn) openBtn.onclick = null; };
    }, []);
    // Modal close handler
    useEffect(() => {
      const closeBtn = document.getElementById("close-create-community");
      if (closeBtn) closeBtn.onclick = () => setModal("");
      return () => { if (closeBtn) closeBtn.onclick = null; };
    }, []);

    // Image preview/removal for community avatar
    const handleCommunityImage = e => {
      const file = e.target.files[0];
      if (file) {
        setCommunityImage(file);
        setCommunityImagePreview(URL.createObjectURL(file));
      }
    };
    const handleRemoveCommunityImage = () => {
      setCommunityImage(null);
      setCommunityImagePreview(null);
    };
    // Banner preview/removal
    const handleCommunityBanner = e => {
      const file = e.target.files[0];
      if (file) {
        setCommunityBanner(file);
        setCommunityBannerPreview(URL.createObjectURL(file));
      }
    };
    const handleRemoveCommunityBanner = () => {
      setCommunityBanner(null);
      setCommunityBannerPreview(null);
    };

    // Community creation handler
    const handleCreateCommunity = async e => {
      e.preventDefault();
      setCommunityError("");
      if (!communityName.trim()) {
        setCommunityError("Community name is required.");
        return;
      }
      setCommunityLoading(true);
      try {
        let avatarUrl = null;
        let bannerUrl = null;
        if (communityImage) {
          const storage = getStorage();
          const imgRef = storageRef(storage, `community-avatars/${user?.uid || "nouser"}-${Date.now()}-${communityImage.name}`);
          await uploadBytes(imgRef, communityImage);
          avatarUrl = await getDownloadURL(imgRef);
        }
        if (communityBanner) {
          const storage = getStorage();
          const bannerRef = storageRef(storage, `community-banners/${user?.uid || "nouser"}-${Date.now()}-${communityBanner.name}`);
          await uploadBytes(bannerRef, communityBanner);
          bannerUrl = await getDownloadURL(bannerRef);
        }
        // Add to Firestore
        const newCommunity = {
          name: communityName.trim(),
          description: communityDesc.trim(),
          category: communityCategory.trim(),
          avatar: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(communityName)}&background=050816&color=B6FF22`,
          banner: bannerUrl || "",
          members: 1,
          createdAt: new Date(),
          createdBy: user?.uid || "anon"
        };
        const docRef = await addDoc(collection(db, "communities"), newCommunity);
        setCommunitiesCache(prev => [{ id: docRef.id, ...newCommunity }, ...prev]);
        // Reset form
        setCommunityName("");
        setCommunityDesc("");
        setCommunityCategory("");
        setCommunityImage(null);
        setCommunityImagePreview(null);
        setCommunityBanner(null);
        setCommunityBannerPreview(null);
        setModal("");
      } catch (err) {
        setCommunityError("Failed to create community. Try again.");
      }
      setCommunityLoading(false);
    };
  // Firebase user state
  const [user, setUser] = useState(null);
  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);
  const demoPosts = initialPosts;
  const [posts, setPosts] = useState(demoPosts);
  const [sort, setSort] = useState("newest"); // "newest" | "bullish" | "bearish" | "active"
  const [loading, setLoading] = useState(true);
    // Firestore realtime posts subscription
    useEffect(() => {
      setLoading(true);
      let q = query(collection(db, "posts"));
      if (sort === "newest") q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
      else if (sort === "bullish") q = query(collection(db, "posts"), orderBy("bullishVotes", "desc"));
      else if (sort === "bearish") q = query(collection(db, "posts"), orderBy("bearishVotes", "desc"));
      else if (sort === "active") q = query(collection(db, "posts"), orderBy("comments", "desc"));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPosts(data);
          } else {
            setPosts(demoPosts);
          }
          setLoading(false);
        },
        (error) => {
          setPosts(demoPosts);
          setLoading(false);
        }
      );
      return () => unsubscribe();
      // eslint-disable-next-line
    }, [sort]);
  const [recommendedPosts, setRecommendedPosts] = useState(initialRecommendedPosts);
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [activeTicker, setActiveTicker] = useState(watchlist.find(w => w.active)?.symbol || "AAPL");
  // Communities state
  const [communitiesCache, setCommunitiesCache] = useState(initialCommunities);

  // Firestore communities loading with fallback
  useEffect(() => {
    const q = collection(db, "communities");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCommunitiesCache(data);
      } else {
        setCommunitiesCache(initialCommunities);
      }
    }, () => {
      setCommunitiesCache(initialCommunities);
    });
    return () => unsubscribe();
  }, [db]);
  const [following] = useState(initialFollowing);
  const [trendingTopics] = useState(initialTrendingTopics);
  const [expandedComments, setExpandedComments] = useState([]);
  const [commentsByPost, setCommentsByPost] = useState(initialCommentsByPost);
  const [commentInputs, setCommentInputs] = useState({});

  // Firestore-backed comments: subscribe to comments for expanded posts
  useEffect(() => {
    // Only subscribe for Firestore posts (string IDs)
    const unsubscribes = expandedComments.map(postId => {
      if (typeof postId !== "string") return null;
      const commentsRef = collection(db, "posts", postId, "comments");
      const q = query(commentsRef, orderBy("createdAt", "asc"));
      return onSnapshot(q, (snapshot) => {
        setCommentsByPost(prev => ({
          ...prev,
          [postId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        }));
      });
    });
    return () => { unsubscribes.forEach(u => u && u()); };
  }, [expandedComments, db]);

  // Add comment handler
  const handleAddComment = async (post, val) => {
    if (!val.trim()) return;
    // Demo post fallback
    if (!post.id || typeof post.id === "number") {
      setCommentsByPost(prev => ({
        ...prev,
        [post.id]: [
          ...(prev[post.id] || []),
          {
            id: Date.now(),
            user: { name: "You", avatar: "https://ui-avatars.com/api/?name=You&background=050816&color=B6FF22" },
            content: val,
            createdAt: new Date()
          }
        ]
      }));
      setCommentInputs(inputs => ({ ...inputs, [post.id]: "" }));
      // Increment comment count for demo post
      setPosts(prevPosts => prevPosts.map(p => p.id === post.id ? { ...p, comments: (p.comments || 0) + 1 } : p));
      return;
    }
    // Firestore-backed
    try {
      const commentsRef = collection(db, "posts", post.id, "comments");
      await addDoc(commentsRef, {
        user: {
          name: user?.displayName || "User",
          avatar: user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || "U"}&background=050816&color=B6FF22`
        },
        content: val,
        createdAt: serverTimestamp()
      });
      setCommentInputs(inputs => ({ ...inputs, [post.id]: "" }));
      // Increment comment count in Firestore
      const postRef = doc(db, "posts", post.id);
      await updateDoc(postRef, { comments: firestoreIncrement(1) });
    } catch (err) {
      // Optionally handle error
    }
  };
  // --- UI STATE REPLACEMENTS FOR IMPERATIVE DOM ---
  // Post creation state
  const [postDestination, setPostDestination] = useState("timeline");
  const [postCommunity, setPostCommunity] = useState("");
  const [postSubject, setPostSubject] = useState("");
  const [postLabel, setPostLabel] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postImage, setPostImage] = useState(null);
  const [postImagePreview, setPostImagePreview] = useState(null);
  const [allowComments, setAllowComments] = useState(true);
  const [postError, setPostError] = useState("");
  const [postCharCount, setPostCharCount] = useState(0);
  const [postLoading, setPostLoading] = useState(false);

  // Handle post form field changes
  const handlePostDestination = e => setPostDestination(e.target.value);
  const handlePostCommunity = e => setPostCommunity(e.target.value);
  const handlePostSubject = e => setPostSubject(e.target.value);
  const handlePostLabel = e => setPostLabel(e.target.value);
  const handlePostContent = e => {
    setPostContent(e.target.value);
    setPostCharCount(e.target.value.length);
  };
  const handleAllowComments = e => setAllowComments(e.target.checked);

  // Image preview/removal
  const handlePostImage = e => {
    const file = e.target.files[0];
    if (file) {
      setPostImage(file);
      setPostImagePreview(URL.createObjectURL(file));
    }
  };
  const handleRemovePostImage = () => {
    setPostImage(null);
    setPostImagePreview(null);
  };

  // Reset post form
  const resetPostForm = () => {
    setPostDestination("timeline");
    setPostCommunity("");
    setPostSubject("");
    setPostLabel("");
    setPostContent("");
    setPostImage(null);
    setPostImagePreview(null);
    setAllowComments(true);
    setPostError("");
    setPostCharCount(0);
    setPostLoading(false);
  };

  // Post submit handler
  const handlePostSubmit = async e => {
    e.preventDefault();
    setPostError("");
    if (!user) {
      setPostError("You must be signed in to post.");
      return;
    }
    if (!postContent.trim()) {
      setPostError("Post content cannot be empty.");
      return;
    }
    if (!postSubject) {
      setPostError("Please select a subject.");
      return;
    }
    if (!postLabel) {
      setPostError("Please select a label.");
      return;
    }
    if (postDestination === "community" && !postCommunity) {
      setPostError("Please select a community.");
      return;
    }
    setPostLoading(true);
    let imageUrl = null;
    try {
      if (postImage) {
        const storage = getStorage();
        const imgRef = storageRef(storage, `post-images/${user.uid}-${Date.now()}-${postImage.name}`);
        await uploadBytes(imgRef, postImage);
        imageUrl = await getDownloadURL(imgRef);
      }
      const postData = {
        user: {
          name: user.displayName || "User",
          avatar: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || "U"}&background=050816&color=B6FF22`,
          handle: user.email ? `@${user.email.split("@")[0]}` : "@user"
        },
        time: "now",
        content: postContent,
        image: imageUrl,
        comments: 0,
        likes: 0,
        bookmarked: false,
        subject: postSubject,
        label: postLabel,
        allowComments,
        destination: postDestination,
        community: postDestination === "community" ? postCommunity : null,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, "posts"), postData);
      resetPostForm();
      setModal("");
    } catch (err) {
      setPostError("Failed to post. Please try again.");
    }
    setPostLoading(false);
  };
  // Modal visibility state
  const [modal, setModal] = useState(""); // "ticker" | "post" | "profile" | "create-community" | "bro-llm" | "dm" | ""
  // Mobile drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  // Tab state
  const [feedTab, setFeedTab] = useState("for-you"); // "for-you" or "following"
  // Bookmark filter state
  const [selectedFilter, setSelectedFilter] = useState("home");
  // Watchlist form state
  const [watchlistFormOpen, setWatchlistFormOpen] = useState(false);
  // Theme state
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      return localStorage.getItem("theme") || "light";
    }
    return "light";
  });
  // Search dropdowns
  const [assetSearchOpen, setAssetSearchOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  // Theme effect
  React.useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  return (
    <div className={theme === "dark" ? "dark" : ""}>
    <>
        {/* Ticker Quick View Modal */}
        <div id="ticker-modal" className="fixed inset-0 bg-black/70 hidden items-center justify-center z-50 px-4">
          <div className="panel rounded-3xl p-6 w-full max-w-2xl relative overflow-hidden shadow-2xl">
            <button id="close-ticker-modal" className="absolute top-4 right-4 w-9 h-9 rounded-full soft-card text-2xl leading-none" aria-label="Close ticker modal" title="Close" tabIndex={0}>&times;</button>
            <p className="text-xs font-black tracking-[0.28em] uppercase text-brogreen mb-2">Stock Info</p>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-4">
              <div>
                <h2 id="ticker-symbol" className="text-3xl font-black">$---</h2>
                <p id="ticker-name" className="text-sm text-slate-500">Ticker quick view</p>
                <div id="company-info" className="mt-2 text-xs text-slate-500"></div>
              </div>
              <div className="text-right">
                <div id="ticker-price" className="text-2xl font-black">--</div>
                <div id="ticker-change" className="text-sm font-black text-brogreen">--</div>
              </div>
            </div>
            <div className="soft-card rounded-3xl p-4 mb-4">
              <div className="h-24 flex items-end gap-1" id="ticker-sparkline"></div>
            </div>
            <div className="mb-4">
              <iframe id="tv-chart" title="TradingView Chart" aria-label="Stock chart" className="w-full rounded-2xl border h-72" style={{minHeight:'280px'}} src="" frameBorder="0"></iframe>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs font-black">
              <div className="soft-card rounded-2xl p-3"><div className="text-slate-500">Mentions</div><div id="ticker-mentions" className="text-brogreen text-lg">--</div></div>
              <div className="soft-card rounded-2xl p-3"><div className="text-slate-500">Bias</div><div id="ticker-bias" className="text-brogreen text-lg">--</div></div>
              <div className="soft-card rounded-2xl p-3"><div className="text-slate-500">Type</div><div id="ticker-type" className="text-lg">Stock</div></div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button id="ticker-add-btn" className="px-4 py-3 rounded-2xl bg-brogreen text-black dark:text-brogreen font-black text-xs" aria-label="Add to watchlist">Add Watchlist</button>
              <button id="ticker-paper-buy" className="px-4 py-3 rounded-2xl bg-green-600 text-white font-black text-xs" aria-label="Paper buy">Paper Buy</button>
              <button id="ticker-paper-sell" className="px-4 py-3 rounded-2xl bg-red-500 text-white font-black text-xs" aria-label="Paper sell">Paper Sell</button>
            </div>
            <div id="company-news" className="mt-6"></div>
            <div id="ticker-loading" className="hidden absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center z-10"><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-brogreen border-4"></div></div>
            <p className="text-[11px] text-slate-500 mt-4">Prototype market data. Connect Polygon, Finnhub, IEX Cloud, Twelve Data, or CoinGecko for live pricing.</p>
          </div>
        </div>

        {/* Post Modal */}
        <div id="post-modal" className="fixed inset-0 bg-black/70 hidden items-center justify-center z-50 px-4">
          <div className="panel rounded-3xl p-6 w-full max-w-2xl relative shadow-2xl">
            <button id="close-post-modal" className="absolute top-4 right-4 w-9 h-9 rounded-full soft-card text-2xl leading-none" aria-label="Close post modal" title="Close" tabIndex={0}>&times;</button>
            <p className="text-xs font-black tracking-[0.28em] uppercase text-brogreen mb-2">Post</p>
            <h2 className="text-2xl font-black mb-1">Drop it on the floor</h2>
            <p className="text-sm text-slate-500 mb-5">Post to your timeline or a community you belong to.</p>
            <form id="post-form" className="space-y-4" onSubmit={handlePostSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  id="post-destination"
                  className="px-4 py-3 rounded-2xl bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none text-sm font-bold"
                  value={postDestination}
                  onChange={handlePostDestination}
                >
                  <option value="timeline">My Timeline</option>
                  <option value="community">Community</option>
                </select>
                <select
                  id="community-select"
                  className={
                    "px-4 py-3 rounded-2xl bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none text-sm font-bold" +
                    (postDestination === "community" ? "" : " hidden")
                  }
                  value={postCommunity}
                  onChange={handlePostCommunity}
                  disabled={postDestination !== "community"}
                >
                  <option value="">Select Community</option>
                  {communitiesCache.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <select
                  id="post-subject"
                  className="px-4 py-3 rounded-2xl bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none text-sm font-bold"
                  value={postSubject}
                  onChange={handlePostSubject}
                >
                  <option value="">Subject</option>
                  <option value="stocks">Stocks</option>
                  <option value="options">Options</option>
                  <option value="crypto">Crypto</option>
                  <option value="jobs">Jobs</option>
                  <option value="careers">Careers</option>
                  <option value="licenses">Licenses</option>
                  <option value="rich-list">Rich List</option>
                  <option value="other">Other</option>
                </select>
                <select
                  id="post-label"
                  className="px-4 py-3 rounded-2xl bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none text-sm font-bold"
                  value={postLabel}
                  onChange={handlePostLabel}
                >
                  <option value="">Label</option>
                  <option value="General">General</option>
                  <option value="Trade">Trade</option>
                  <option value="Question">Question</option>
                  <option value="News">News</option>
                  <option value="Alert">Alert</option>
                </select>
              </div>
              <textarea
                id="post-content"
                maxLength={700}
                placeholder="Post your trade thesis, interview intel, license question, rich-list take, or desk rumor..."
                className="w-full px-4 py-4 rounded-3xl bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none min-h-[140px] font-semibold resize-y"
                value={postContent}
                onChange={handlePostContent}
              ></textarea>
              {postImagePreview && (
                <div id="post-image-preview" className="rounded-3xl overflow-hidden border border-slate-200 dark:border-white/10 bg-black/20 mb-2">
                  <img src={postImagePreview} alt="Preview" className="w-full object-cover" />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl soft-card font-black cursor-pointer">
                  <span>🖼️ Add Image</span>
                  <input id="post-image" type="file" accept="image/*" className="hidden" onChange={handlePostImage} />
                </label>
                {postImagePreview && (
                  <button type="button" id="remove-post-image" className="px-4 py-3 rounded-2xl soft-card font-black text-red-500" onClick={handleRemovePostImage}>Remove Image</button>
                )}
                <label className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl soft-card font-black cursor-pointer">
                  <input id="allow-comments" type="checkbox" className="accent-lime-400" checked={allowComments} onChange={handleAllowComments} />
                  Allow comments
                </label>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  {postError && <div id="post-error" className="text-red-500 text-sm">{postError}</div>}
                  <div className="text-xs text-slate-500"><span id="char-count">{postCharCount}</span>/700 characters</div>
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-2xl bg-brogreen text-black dark:text-brogreen font-black"
                  disabled={postLoading}
                >{postLoading ? "Posting..." : "Post"}</button>
              </div>
            </form>
          </div>
        </div>

        {/* Profile Modal */}
        <div id="profile-modal" className="fixed inset-0 bg-black/70 hidden items-center justify-center z-50 px-4">
          <div className="panel rounded-3xl p-6 w-full max-w-md relative shadow-2xl">
            <button id="close-profile" className="absolute top-4 right-4 w-9 h-9 rounded-full soft-card text-2xl leading-none" aria-label="Close profile modal" title="Close" tabIndex={0}>&times;</button>
            <h2 className="text-2xl font-black mb-5">Your Profile</h2>
            <div className="flex flex-col items-center gap-4">
              <button id="profile-photo-picker-btn" type="button" className="relative group">
                <img id="profile-photo" src="" alt="Profile Photo" className="w-24 h-24 rounded-full object-cover border-4 border-brogreen bg-slate-200" />
                <span className="absolute inset-0 rounded-full bg-black/55 text-white text-xs font-black hidden group-hover:grid place-items-center">Change</span>
              </button>
              <div id="profile-username-display" className="font-black text-lg text-center"></div>
              <div id="profile-image-picker" className="hidden w-full soft-card rounded-3xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-black">Choose Profile Image</h3>
                    <p className="text-xs text-slate-500">Upload your own or pick a default avatar.</p>
                  </div>
                  <button id="close-profile-image-picker" type="button" className="w-8 h-8 rounded-full soft-card font-black">×</button>
                </div>
                <label className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-brogreen text-black dark:text-brogreen font-black cursor-pointer">
                  Upload Image
                  <input type="file" id="profile-image-upload" accept="image/*" className="hidden" />
                </label>
                <div id="default-avatar-grid" className="grid grid-cols-3 gap-3"></div>
              </div>
              <textarea id="profile-bio" className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none font-semibold" rows={3} placeholder="Add a short finance-bro bio..."></textarea>
              <button id="profile-theme-toggle" className="w-full px-4 py-3 rounded-2xl soft-card font-bold">Toggle Theme</button>
              <button id="save-profile" className="w-full px-6 py-3 rounded-2xl bg-brogreen text-black dark:text-brogreen font-black">Save Profile</button>
              <button id="logout-btn" className="w-full px-4 py-3 rounded-2xl bg-red-600 text-white font-black">Logout</button>
            </div>
          </div>
        </div>

        {/* Create Community Modal */}
        <div id="create-community-modal" className="fixed inset-0 bg-black/70 hidden items-center justify-center z-50 px-4">
          <div className="panel rounded-3xl p-6 w-full max-w-lg relative shadow-2xl" style={{ display: modal === "create-community" ? "block" : "none" }}>
            <button id="close-create-community" className="absolute top-4 right-4 w-9 h-9 rounded-full soft-card text-2xl leading-none" aria-label="Close create community modal" title="Close" tabIndex={0} onClick={() => setModal("")}>×</button>
            <p className="text-xs font-black tracking-[0.28em] uppercase text-brogreen mb-2">Launch a desk</p>
            <h2 className="text-2xl font-black mb-1">Create a Community</h2>
            <p className="text-sm text-slate-500 mb-5">Build a room for traders, analysts, career climbers, or licensing grinders.</p>
            <form onSubmit={handleCreateCommunity}>
              <input
                id="community-name"
                className="mb-3 w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none font-semibold"
                placeholder="Community name"
                value={communityName}
                onChange={e => setCommunityName(e.target.value)}
                disabled={communityLoading}
              />
              <textarea
                id="community-desc"
                className="mb-3 w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none font-semibold"
                rows={3}
                placeholder="Description"
                value={communityDesc}
                onChange={e => setCommunityDesc(e.target.value)}
                disabled={communityLoading}
              ></textarea>
              {/* Category input (optional) */}
              <input
                id="community-category"
                className="mb-3 w-full px-4 py-3 rounded-2xl bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none font-semibold"
                placeholder="Category (optional)"
                value={communityCategory}
                onChange={e => setCommunityCategory(e.target.value)}
                disabled={communityLoading}
              />
              {/* Avatar upload */}
              <div className="mb-3">
                <label className="block font-semibold mb-1">Avatar</label>
                {communityImagePreview && (
                  <div className="mb-2"><img src={communityImagePreview} alt="Preview" className="w-16 h-16 rounded-full object-cover" /></div>
                )}
                <input type="file" accept="image/*" onChange={handleCommunityImage} disabled={communityLoading} />
                {communityImagePreview && (
                  <button type="button" className="ml-2 text-xs text-red-500" onClick={handleRemoveCommunityImage}>Remove</button>
                )}
              </div>
              {/* Banner upload */}
              <div className="mb-3">
                <label className="block font-semibold mb-1">Banner (optional)</label>
                {communityBannerPreview && (
                  <div className="mb-2"><img src={communityBannerPreview} alt="Preview" className="w-full max-h-24 rounded-2xl object-cover" /></div>
                )}
                <input type="file" accept="image/*" onChange={handleCommunityBanner} disabled={communityLoading} />
                {communityBannerPreview && (
                  <button type="button" className="ml-2 text-xs text-red-500" onClick={handleRemoveCommunityBanner}>Remove</button>
                )}
              </div>
              <button
                id="create-community-btn"
                className="w-full px-6 py-3 rounded-2xl bg-brogreen text-black dark:text-brogreen font-black"
                type="submit"
                disabled={communityLoading}
              >{communityLoading ? "Creating..." : "Create Community"}</button>
              {communityError && (
                <div id="community-create-error" className="text-red-500 text-sm mt-3">{communityError}</div>
              )}
            </form>
          </div>
        </div>

        <div className="min-h-screen xl:grid xl:grid-cols-[300px_minmax(520px,760px)_380px] xl:justify-center">
          {/* Left X-style Rail */}
          <aside className="hidden xl:block min-h-screen sticky top-0 border-r border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816]">
            <div className="h-screen overflow-y-auto scrollbar-hide px-5 py-4 flex flex-col">
              <a href="feed.html" className="flex items-center gap-3 mb-6" aria-label="Go to home feed" role="link">
                <img src="mainlogo.png" alt="BroLiquidity Logo" className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-white/10" />
                <div>
                  <h1 className="font-black text-xl leading-tight">BroLiquidity</h1>
                  <p className="text-[11px] text-slate-500 font-bold">Trades • Licenses • Jobs</p>
                </div>
              </a>
              <nav className="space-y-2 text-xl font-bold" role="navigation" aria-label="Sidebar navigation">
                <button className="left-nav active-nav w-full rounded-2xl px-4 py-3 flex items-center gap-4 text-left" data-view="home" aria-label="Home" title="Home" tabIndex={0}>
                  <span>Home</span>
                </button>
                <button className="left-nav w-full rounded-2xl px-4 py-3 flex items-center gap-4 text-left hover:bg-slate-100 dark:hover:bg-white/10" data-view="bookmarks" aria-label="Bookmarks" title="Bookmarks" tabIndex={0}>
                  <span>Bookmarks</span>
                </button>
                <a href="bro.jsx" className="left-nav w-full rounded-2xl px-4 py-3 flex items-center gap-4 text-left hover:bg-slate-100 dark:hover:bg-white/10" data-view="bro-llm" aria-label="Bro LLM" title="Bro LLM" tabIndex={0}>
                  <span>Bro AI</span>
                </a>
                <a href="dm.html" className="left-nav w-full rounded-2xl px-4 py-3 flex items-center gap-4 text-left hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Direct Messages" title="Direct Messages" tabIndex={0}>
                  <span>Direct Messages</span>
                </a>
              </nav>
              <div className="mt-6 space-y-4">
                <section className="panel rounded-3xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-black">Communities</h2>
                    <button id="left-create-community" className="px-4 py-2 rounded-2xl bg-brogreen text-black dark:text-brogreen font-black text-base shadow hover:bg-lime-300 transition-all" aria-label="Create new community" title="Create new community" tabIndex={0}>+ New</button>
                  </div>
                  <div id="left-communities" className="space-y-2">
                    {communitiesCache.map(c => (
                      <button
                        key={c.id}
                        className={
                          "flex items-center gap-3 px-3 py-2 rounded-xl soft-card font-black cursor-pointer w-full text-left" +
                          (selectedFilter === c.id ? " bg-brogreen/10 border border-brogreen" : " hover:bg-brogreen/10")
                        }
                        onClick={() => setSelectedFilter(c.id)}
                        tabIndex={0}
                        aria-label={c.name}
                        title={c.name}
                      >
                        <img src={c.avatar} alt={c.name} className="w-8 h-8 rounded-full object-cover" onError={e => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(c.name) + '&background=050816&color=B6FF22'; }} />
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="text-xs text-slate-500">{c.members} members</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              <div className="mt-6">
                <section className="panel rounded-3xl p-4">
                  <h2 className="font-black text-lg mb-3">Following</h2>
                  <div className="space-y-2">
                    {following.map(f => (
                      <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-xl soft-card font-black cursor-pointer hover:bg-brogreen/10">
                        <img src={f.avatar} alt={f.name} className="w-8 h-8 rounded-full object-cover" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-black text-sm">{f.name}</div>
                          <div className="truncate text-xs text-slate-500">{f.handle}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <div className="mt-auto"></div>
            </div>
          </aside>

          {/* Mobile Header */}
          <header className="xl:hidden sticky top-0 z-40 border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#050816]/90 backdrop-blur-xl">
            <nav className="px-4 py-3 flex items-center justify-between gap-3">
              <button id="mobile-menu-btn" className="w-11 h-11 rounded-2xl soft-card grid place-items-center" aria-label="Open mobile menu" title="Open mobile menu">☰</button>
              <a href="feed.html" className="flex items-center gap-2" aria-label="Go to home feed" role="link">
                <img src="mainlogo.png" className="w-10 h-10 rounded-xl object-cover" alt="BroLiquidity" />
                <span className="font-black">BroLiquidity</span>
              </a>
              <button id="mobile-post-btn" className="px-4 py-2 rounded-2xl bg-brogreen text-black dark:text-brogreen font-black" aria-label="Create a post" title="Create a post">Post</button>
            </nav>
          </header>

          {/* Center Feed */}
          <main className="min-h-screen border-r border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816]">
            <div className="sticky top-0 z-30 bg-white/90 dark:bg-[#050816]/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/10">
              <div className="grid grid-cols-2 text-center font-black">
                <button
                  id="tab-for-you"
                  className={
                    "feed-tab py-4" + (feedTab === "for-you" ? " active-tab" : " text-slate-500")
                  }
                  onClick={() => setFeedTab("for-you")}
                >For you</button>
                <button
                  id="tab-following"
                  className={
                    "feed-tab py-4" + (feedTab === "following" ? " active-tab" : " text-slate-500")
                  }
                  onClick={() => setFeedTab("following")}
                >Following</button>
              </div>
            </div>
            <section className="border-b border-slate-200 dark:border-white/10 p-4">
              <div className="flex gap-3">
                <img id="composer-profile-photo" src="https://ui-avatars.com/api/?name=BL&background=050816&color=B6FF22" className="w-12 h-12 rounded-full object-cover" alt="Profile" />
                <div className="flex-1">
                  <button id="composer-open" className="w-full text-left text-xl text-slate-500 font-semibold py-2">What’s happening?</button>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-4 text-broblue text-lg">
                      <button id="composer-image-open" title="Image">🖼️</button>
                      <button title="Poll">📊</button>
                      <button title="Cashtag">$</button>
                      <button title="Community">💬</button>
                    </div>
                    <button id="composer-post-btn" className="px-6 py-2 rounded-full bg-brogreen text-black dark:text-brogreen font-black">Post</button>
                  </div>
                </div>
              </div>
            </section>
            <section id="recommended-section" className="border-b border-slate-200 dark:border-white/10">
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <h2 className="font-black text-lg">Recommended Posts</h2>
                  <p className="text-xs text-slate-500">Weighted by watchlist, following, and subscribed communities.</p>
                </div>
              </div>
              <ul id="recommended-posts-list">
                {recommendedPosts.map(post => (
                  <li key={post.id} className="border-b border-slate-100 dark:border-white/10 px-4 py-6 flex gap-4">
                    <img src={post.user.avatar} alt={post.user.name} className="w-12 h-12 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-base truncate">{post.user.name}</span>
                        <span className="text-xs text-slate-500 truncate">{post.user.handle}</span>
                        <span className="text-xs text-slate-400">· {post.time}</span>
                      </div>
                      <div className="mb-2 whitespace-pre-line text-slate-800 dark:text-slate-100">{post.content}</div>
                      {post.image && (
                        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 mb-2">
                          <img src={post.image} alt="Post attachment" className="w-full object-cover" />
                        </div>
                      )}
                      <div className="flex items-center gap-6 text-slate-500 text-sm mt-2">
                        <button
                          className="flex items-center gap-1 comment-toggle"
                          data-id={post.id}
                          onClick={() =>
                            setExpandedComments(expandedComments.includes(post.id)
                              ? expandedComments.filter(id => id !== post.id)
                              : [...expandedComments, post.id])
                          }
                        >
                          <span>💬</span>
                          <span>{commentsByPost[post.id]?.length || 0}</span>
                        </button>
                        {/* Bullish vote button */}
                        <button
                          className="flex items-center gap-1"
                          onClick={() => handleVote(post, "bullish")}
                          aria-label="Bullish vote"
                        >
                          <span role="img" aria-label="Bullish">📈</span>
                          <span>{post.bullishVotes || 0}</span>
                        </button>
                        {/* Bearish vote button */}
                        <button
                          className="flex items-center gap-1"
                          onClick={() => handleVote(post, "bearish")}
                          aria-label="Bearish vote"
                        >
                          <span role="img" aria-label="Bearish">📉</span>
                          <span>{post.bearishVotes || 0}</span>
                        </button>
                        {/* Bullish % bar */}
                        <div className="flex items-center gap-1">
                          <div className="w-16 h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-2 bg-brogreen"
                              style={{
                                width: ((post.bullishVotes || 0) + (post.bearishVotes || 0)) > 0
                                  ? `${Math.round(100 * (post.bullishVotes || 0) / ((post.bullishVotes || 0) + (post.bearishVotes || 0)))}%`
                                  : "0%"
                              }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-brogreen">
                            {((post.bullishVotes || 0) + (post.bearishVotes || 0)) > 0
                              ? `${Math.round(100 * (post.bullishVotes || 0) / ((post.bullishVotes || 0) + (post.bearishVotes || 0)))}% Bullish`
                              : "--% Bullish"}
                          </span>
                        </div>
                        <button className={post.bookmarked ? "text-brogreen" : ""}>
                          <span>🔖</span>
                        </button>
                      </div>
                      {/* Comments section */}
                      <div
                        id={`comments-${post.id}`}
                        className={
                          (expandedComments.includes(post.id) ? "block" : "hidden") +
                          " mt-4"
                        }
                      >
                        <div className="space-y-3 mb-3">
                          {(commentsByPost[post.id] || []).map(comment => (
                            <div key={comment.id} className="flex items-start gap-3">
                              <img src={comment.user.avatar} alt={comment.user.name} className="w-8 h-8 rounded-full object-cover" />
                              <div className="flex-1">
                                <div className="font-black text-sm">{comment.user.name}</div>
                                <div className="text-slate-700 dark:text-slate-200 text-sm">{comment.content}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <form
                          className="flex gap-2 mt-2"
                          onSubmit={e => {
                            e.preventDefault();
                            const val = (commentInputs[post.id] || "").trim();
                            handleAddComment(post, val);
                          }}
                        >
                          <input
                            className="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none text-sm"
                            placeholder="Add a comment..."
                            value={commentInputs[post.id] || ""}
                            onChange={e => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                          />
                          <button
                            type="submit"
                            className="px-4 py-2 rounded-xl bg-brogreen text-black dark:text-brogreen font-black text-sm"
                          >
                            Post
                          </button>
                        </form>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-white/10">
                <div>
                  <h2 className="font-black text-lg">Recent Posts</h2>
                  <p id="feed-context" className="text-xs text-slate-500">
                    {feedTab === "following"
                      ? "Following feed, newest first."
                      : selectedFilter === "home"
                        ? "All desks, newest first."
                        : (() => {
                            const comm = communitiesCache.find(c => c.id === selectedFilter);
                            return comm ? `${comm.name} desk, newest first.` : "All desks, newest first.";
                          })()
                    }
                  </p>
                </div>
                <select
                  id="sort-posts"
                  className="px-3 py-2 rounded-full bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 text-sm font-bold outline-none"
                  value={sort}
                  onChange={e => setSort(e.target.value)}
                >
                  <option value="newest">Newest</option>
                  <option value="bullish">Most Uptrended</option>
                  <option value="bearish">Most Downtrended</option>
                  <option value="active">Most Active</option>
                </select>
              </div>
              <ul id="posts-list">
                {posts
                  .filter(post => {
                    if (feedTab === "following") {
                      // Show only posts by following
                      return following.some(f => f.name === post.user.name);
                    }
                    if (selectedFilter === "home") return true;
                    // Community filter
                    if (typeof selectedFilter === "number" || typeof selectedFilter === "string") {
                      const comm = communitiesCache.find(c => c.id === selectedFilter);
                      if (comm && post.community) {
                        return post.community === comm.name || post.community === comm.id;
                      }
                    }
                    return true;
                  })
                  .map(post => (
                  <li key={post.id} className="border-b border-slate-100 dark:border-white/10 px-4 py-6 flex gap-4">
                    <img src={post.user.avatar} alt={post.user.name} className="w-12 h-12 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-base truncate">{post.user.name}</span>
                        <span className="text-xs text-slate-500 truncate">{post.user.handle}</span>
                        <span className="text-xs text-slate-400">· {post.time}</span>
                      </div>
                      <div className="mb-2 whitespace-pre-line text-slate-800 dark:text-slate-100">{post.content}</div>
                      {post.image && (
                        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 mb-2">
                          <img src={post.image} alt="Post attachment" className="w-full object-cover" />
                        </div>
                      )}
                      <div className="flex items-center gap-6 text-slate-500 text-sm mt-2">
                        <button className="flex items-center gap-1 comment-toggle" data-id={post.id}>
                          <span>💬</span>
                          <span>{post.comments}</span>
                        </button>
                        {/* Bullish vote button */}
                        <button
                          className="flex items-center gap-1"
                          onClick={() => handleVote(post, "bullish")}
                          aria-label="Bullish vote"
                        >
                          <span role="img" aria-label="Bullish">📈</span>
                          <span>{post.bullishVotes || 0}</span>
                        </button>
                        {/* Bearish vote button */}
                        <button
                          className="flex items-center gap-1"
                          onClick={() => handleVote(post, "bearish")}
                          aria-label="Bearish vote"
                        >
                          <span role="img" aria-label="Bearish">📉</span>
                          <span>{post.bearishVotes || 0}</span>
                        </button>
                        {/* Bullish % bar */}
                        <div className="flex items-center gap-1">
                          <div className="w-16 h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-2 bg-brogreen"
                              style={{
                                width: ((post.bullishVotes || 0) + (post.bearishVotes || 0)) > 0
                                  ? `${Math.round(100 * (post.bullishVotes || 0) / ((post.bullishVotes || 0) + (post.bearishVotes || 0)))}%`
                                  : "0%"
                              }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-brogreen">
                            {((post.bullishVotes || 0) + (post.bearishVotes || 0)) > 0
                              ? `${Math.round(100 * (post.bullishVotes || 0) / ((post.bullishVotes || 0) + (post.bearishVotes || 0)))}% Bullish`
                              : "--% Bullish"}
                          </span>
                        </div>
                        <button className={post.bookmarked ? "text-brogreen" : ""}>
                          <span>🔖</span>
                        </button>
                      </div>
                      {/* Comments section placeholder for future migration */}
                      <div id={`comments-${post.id}`} className="hidden mt-4">
                        {/* Comments will be rendered here in a later step */}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {loading && (
                <div id="loading" className="p-6 text-center text-slate-500 font-bold">Loading feed...</div>
              )}
            </section>
          </main>

          {/* Right Market Rail */}
          <aside className="hidden xl:block min-h-screen sticky top-0 bg-white dark:bg-[#050816]">
            <div className="h-screen overflow-y-auto scrollbar-hide px-5 py-4 space-y-4">
              <button id="right-profile-card" className="w-full flex items-center justify-between gap-3 p-3 rounded-3xl panel hover:bg-slate-50 dark:hover:bg-white/5 text-left" aria-label="Open profile" title="Open profile" tabIndex={0}>
                <div className="flex items-center gap-3 min-w-0">
                  <img id="right-profile-photo" src="https://ui-avatars.com/api/?name=User&background=050816&color=B6FF22" alt="Profile" className="w-12 h-12 rounded-full object-cover border-2 border-brogreen bg-slate-700" />
                  <div className="min-w-0">
                    <div id="right-profile-name" className="font-black truncate">User</div>
                    <div id="right-profile-handle" className="text-xs text-slate-500 truncate">@bro</div>
                    <div className="flex gap-4 mt-1">
                      <a href="follow.html?tab=following" id="profile-following-link" className="cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300 hover:underline"><span id="profile-following-count">0</span> Following</a>
                      <a href="follow.html?tab=followers" id="profile-followers-link" className="cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300 hover:underline"><span id="profile-followers-count">0</span> Followers</a>
                    </div>
                  </div>
                </div>
                <span className="text-slate-500 font-black">•••</span>
              </button>
              <div className="relative">
                <input id="global-search" className="w-full px-5 py-3 pl-11 rounded-full bg-slate-100 dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none text-sm font-semibold placeholder:text-slate-500" placeholder="Search users or communities..." aria-label="Global search" title="Search users or communities" tabIndex={0} />
                <svg className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx={11} cy={11} r={8}></circle><path d="m21 21-4.3-4.3"></path></svg>
                <div id="global-search-results" className="hidden absolute left-0 right-0 top-14 panel rounded-3xl p-2 z-50 shadow-xl max-h-96 overflow-y-auto"></div>
              </div>
              <section className="panel rounded-3xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="px-4 py-2 rounded-2xl bg-brogreen text-black dark:text-brogreen font-black text-base shadow inline-block mb-2">Markets</p>
                    <div className="flex items-center gap-2">
                      <h2 className="font-black text-xl">Paper Trading Hub</h2>
                      <button id="expand-paper-hub" className="ml-2 p-1 rounded-full bg-broblue text-white" title="Expand Paper Trading Hub" aria-label="Expand Paper Trading Hub">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <button id="theme-toggle-rail" className="text-xs font-black px-3 py-2 rounded-full soft-card" aria-label="Toggle theme" title="Toggle light/dark theme" tabIndex={0}>Theme</button>
                </div>
                <div className="relative mb-4">
                  <input id="asset-search" className="w-full px-4 py-3 pl-10 rounded-2xl bg-slate-100 dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none text-sm font-bold" placeholder="Search stocks, options, or crypto..." aria-label="Asset search" title="Search stocks, options, or crypto" tabIndex={0} />
                  <svg className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx={11} cy={11} r={8}></circle><path d="m21 21-4.3-4.3"></path></svg>
                  <div id="asset-search-results" className="hidden absolute left-0 right-0 top-14 panel rounded-2xl p-2 z-50 max-h-96 overflow-y-auto shadow-xl"></div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className="soft-card rounded-2xl p-3"><div className="text-[10px] text-slate-500 font-black uppercase">Paper Cash</div><div id="paper-cash" className="font-black text-sm">$100,000</div></div>
                  <div className="soft-card rounded-2xl p-3"><div className="text-[10px] text-slate-500 font-black uppercase">P&L</div><div id="paper-pnl" className="font-black text-sm text-green-600">$0</div></div>
                  <div className="soft-card rounded-2xl p-3"><div className="text-[10px] text-slate-500 font-black uppercase">Positions</div><div id="paper-position-count" className="font-black text-sm">0</div></div>
                </div>
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Stocks Watchlist</h3>
                      <span className="text-[10px] font-black px-2 py-1 rounded-full bg-brogreen/15 text-green-600">EQUITIES</span>
                    </div>
                    <div id="popular-stocks-list" className="space-y-2"></div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Options Watchlist</h3>
                      <span className="text-[10px] font-black px-2 py-1 rounded-full bg-purple-500/15 text-purple-500">OPTIONS</span>
                    </div>
                    <div id="popular-options-list" className="space-y-2"></div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Crypto Watchlist</h3>
                      <span className="text-[10px] font-black px-2 py-1 rounded-full bg-broblue/15 text-broblue">CRYPTO</span>
                    </div>
                    <div id="popular-crypto-list" className="space-y-2"></div>
                  </div>
                  <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">My Custom Watchlist</h3>
                        <p className="text-[11px] text-slate-500">Add stocks, options, or crypto.</p>
                      </div>
                      <button id="add-watchlist-btn" className="text-xs font-black text-brogreen">+ Add</button>
                    </div>
                    <div className="flex gap-2 mb-3 hidden" id="watchlist-form">
                      <input id="watchlist-input" className="w-full px-3 py-2 rounded-xl bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none text-sm font-black uppercase" placeholder="AAPL or BTC" maxLength={18} />
                      <button id="save-watchlist-btn" className="px-3 py-2 rounded-xl bg-brogreen text-black dark:text-brogreen font-black">Save</button>
                    </div>
                    <div id="watchlist-list" className="space-y-2">
                      {watchlist.map(item => (
                        <div
                          key={item.symbol}
                          className={
                            "flex items-center gap-3 px-3 py-2 rounded-xl soft-card font-black cursor-pointer" +
                            (activeTicker === item.symbol ? " bg-brogreen/10 border border-brogreen" : "")
                          }
                          onClick={() => setActiveTicker(item.symbol)}
                        >
                          <span className="text-base font-black uppercase flex-1">{item.symbol}</span>
                          <span className="text-xs text-slate-500 flex-1 truncate">{item.name}</span>
                          <button
                            className="ml-2 px-2 py-1 rounded-lg bg-brogreen/10 text-xs text-brogreen font-black"
                            title="Preview Ticker"
                            tabIndex={0}
                          >
                            Preview
                          </button>
                          <button
                            className="ml-2 px-2 py-1 rounded-lg bg-red-100 text-xs text-red-500 font-black"
                            title="Remove from Watchlist"
                            tabIndex={0}
                            onClick={e => {
                              e.stopPropagation();
                              setWatchlist(watchlist.filter(w => w.symbol !== item.symbol));
                              if (activeTicker === item.symbol && watchlist.length > 1) {
                                setActiveTicker(watchlist.find(w => w.symbol !== item.symbol)?.symbol || "");
                              }
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Paper Positions</h3>
                      <button id="clear-paper-positions" className="text-[10px] font-black text-red-500">Clear</button>
                    </div>
                    <div id="paper-positions-list" className="space-y-2"></div>
                  </div>
                </div>
              </section>
              <section className="panel rounded-3xl p-4">
                <h2 className="font-black text-xl mb-3">Trending Topics</h2>
                <div id="right-trending" className="space-y-3">
                  {trendingTopics.map(t => (
                    <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-xl soft-card font-black cursor-pointer hover:bg-brogreen/10">
                      <span className="flex-1 truncate">{t.topic}</span>
                      <span className="text-xs text-slate-500">{t.posts} posts</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </div>

        {/* Mobile Drawer */}
        <div id="mobile-drawer-backdrop" className="fixed inset-0 bg-black/60 hidden z-[60]"></div>
        <aside id="mobile-drawer" className="fixed left-0 top-0 bottom-0 w-[330px] max-w-[88vw] bg-white dark:bg-[#050816] z-[70] -translate-x-full transition-transform border-r border-slate-200 dark:border-white/10 p-5 overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <div className="font-black text-xl">Menu</div>
            <button id="close-mobile-drawer" className="w-10 h-10 rounded-2xl soft-card text-xl font-black">×</button>
          </div>
          <div id="mobile-drawer-content" className="space-y-4">
            {/* Mobile Communities */}
            <section>
              <h2 className="font-black text-lg mb-2">Communities</h2>
              <div className="space-y-2">
                {communitiesCache.map(c => (
                  <button
                    key={c.id}
                    className={
                      "flex items-center gap-3 px-3 py-2 rounded-xl soft-card font-black cursor-pointer w-full text-left" +
                      (selectedFilter === c.id ? " bg-brogreen/10 border border-brogreen" : " hover:bg-brogreen/10")
                    }
                    onClick={() => {
                      setSelectedFilter(c.id);
                      setMobileDrawerOpen(false);
                    }}
                    tabIndex={0}
                    aria-label={c.name}
                    title={c.name}
                  >
                    <img src={c.avatar} alt={c.name} className="w-8 h-8 rounded-full object-cover" onError={e => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(c.name) + '&background=050816&color=B6FF22'; }} />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-slate-500">{c.members} members</span>
                  </button>
                ))}
              </div>
            </section>
            {/* Mobile Following */}
            <section>
              <h2 className="font-black text-lg mb-2 mt-4">Following</h2>
              <div className="space-y-2">
                {following.map(f => (
                  <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-xl soft-card font-black cursor-pointer hover:bg-brogreen/10">
                    <img src={f.avatar} alt={f.name} className="w-8 h-8 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-black text-sm">{f.name}</div>
                      <div className="truncate text-xs text-slate-500">{f.handle}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            {/* Mobile Followers (mocked as following for now) */}
            <section>
              <h2 className="font-black text-lg mb-2 mt-4">Followers</h2>
              <div className="space-y-2">
                {following.map(f => (
                  <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-xl soft-card font-black cursor-pointer hover:bg-brogreen/10">
                    <img src={f.avatar} alt={f.name} className="w-8 h-8 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-black text-sm">{f.name}</div>
                      <div className="truncate text-xs text-slate-500">{f.handle}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            {/* Mobile Trending Topics */}
            <section>
              <h2 className="font-black text-lg mb-2 mt-4">Trending Topics</h2>
              <div className="space-y-2">
                {trendingTopics.map(t => (
                  <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-xl soft-card font-black cursor-pointer hover:bg-brogreen/10">
                    <span className="flex-1 truncate">{t.topic}</span>
                    <span className="text-xs text-slate-500">{t.posts} posts</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </aside>

        <button id="mobile-floating-post" className="xl:hidden fixed bottom-5 right-5 z-40 w-16 h-16 rounded-full bg-brogreen text-black dark:text-brogreen font-black text-2xl shadow-2xl" aria-label="Create a post" title="Create a post">+</button>

        {/* Bro LLM Modal */}
        <div id="bro-llm-modal" className="fixed inset-0 bg-black/70 hidden items-center justify-center z-[100] px-4">
          <div className="panel rounded-3xl p-6 w-full max-w-lg relative shadow-2xl flex flex-col h-[70vh]">
            <button id="close-bro-llm" className="absolute top-4 right-4 w-9 h-9 rounded-full soft-card text-2xl leading-none" aria-label="Close Bro AI modal" title="Close" tabIndex={0}>&times;</button>
            <h2 className="text-2xl font-black mb-2 flex items-center gap-2">Bro <span className="text-xs font-bold text-broblue">(AI)</span></h2>
            <div id="bro-llm-chat" className="flex-1 overflow-y-auto mb-4 p-2 bg-slate-50 dark:bg-white/5 rounded-2xl"></div>
            <form id="bro-llm-form" className="flex gap-2">
              <input id="bro-llm-input" className="flex-1 px-4 py-3 rounded-2xl bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none text-sm font-semibold" placeholder="Ask Bro AI anything..." autoComplete="off" />
              <button type="submit" className="px-4 py-3 rounded-2xl bg-broblue text-white font-black">Send</button>
            </form>
          </div>
        </div>

        {/* DMs Modal */}
        <div id="dm-modal" className="fixed inset-0 bg-black/70 hidden items-center justify-center z-[100] px-4">
          <div className="panel rounded-3xl p-6 w-full max-w-2xl relative shadow-2xl flex flex-col h-[70vh]">
            <button id="close-dm-modal" className="absolute top-4 right-4 w-9 h-9 rounded-full soft-card text-2xl leading-none">&times;</button>
            <h2 className="text-2xl font-black mb-2 flex items-center gap-2">Direct Messages <span className="text-xs font-bold text-broblue">(Beta)</span></h2>
            <div className="flex flex-1 gap-4 overflow-hidden">
              <div className="w-56 bg-slate-50 dark:bg-white/5 rounded-2xl p-2 overflow-y-auto" id="dm-user-list"></div>
              <div className="flex-1 flex flex-col">
                <div id="dm-chat" className="flex-1 overflow-y-auto mb-2 p-2 bg-slate-50 dark:bg-white/5 rounded-2xl"></div>
                <form id="dm-form" className="flex gap-2">
                  <input id="dm-input" className="flex-1 px-4 py-3 rounded-2xl bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none text-sm font-semibold" placeholder="Type a message..." autoComplete="off" />
                  <button type="submit" className="px-4 py-3 rounded-2xl bg-broblue text-white font-black">Send</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </>
      </div>
    );
}

export default Feed;


