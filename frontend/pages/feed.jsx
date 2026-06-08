// ...existing code...
// STRICT STATIC JSX CLONE OF feed.html (NO LOGIC, NO HOOKS, NO LOGIC, NO FUNCTIONS)
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { auth, db } from "../src/firebase";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { query, collection, orderBy, onSnapshot, doc, setDoc, deleteDoc, getDoc, getDocs, where, addDoc, serverTimestamp, updateDoc, increment as firestoreIncrement, runTransaction, startAt, endAt, limit } from "firebase/firestore";
import { onAuthStateChanged, signOut, updateProfile } from "firebase/auth";
import { ensureUserHasAvatar, getRandomDefaultAvatar } from "../src/avatarDefaults";
import { getFollowing, getFollowers } from "../src/following";
import { STARTING_PAPER_CASH, ensurePaperAccount, isMarketOpenNow, placePaperOrder, placePaperTrade, processPendingPaperOrders } from "../src/paperTrading";

const trendingTokenRegex = /(?:^|\s)([#$][A-Za-z][\w]{1,19})\b/g;

const extractTrendingTokens = (text) => {
  if (!text || typeof text !== "string") return [];
  const matches = [...text.matchAll(trendingTokenRegex)];
  return matches
    .map((match) => match[1])
    .filter(Boolean)
    .map((token) => `#${token.slice(1).toUpperCase()}`);
};

const normalizePostCreatedAtMs = (createdAt) => {
  if (!createdAt) return 0;
  if (createdAt?.toDate) return createdAt.toDate().getTime();
  if (createdAt?.seconds) return createdAt.seconds * 1000;
  if (createdAt instanceof Date) return createdAt.getTime();
  return 0;
};

const getTradeTimestampMs = (trade) => {
  if (!trade || typeof trade !== "object") return 0;

  const timestampCandidate =
    trade.executedAt ||
    trade.createdAt ||
    trade.updatedAt ||
    trade.timestamp ||
    trade.time ||
    null;

  if (!timestampCandidate) return 0;
  if (typeof timestampCandidate?.toDate === "function") return timestampCandidate.toDate().getTime();
  if (typeof timestampCandidate?.seconds === "number") return timestampCandidate.seconds * 1000;
  if (timestampCandidate instanceof Date) return timestampCandidate.getTime();

  const parsed = Date.parse(String(timestampCandidate));
  return Number.isFinite(parsed) ? parsed : 0;
};

const defaultAvatarOptions = Array.from({ length: 15 }, (_, i) => `/defaults/default${i + 1}.png`);

const getDeterministicDefaultAvatar = (seed) => {
  const normalized = String(seed || "user");
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % defaultAvatarOptions.length;
  return defaultAvatarOptions[idx] || defaultAvatarOptions[0];
};

const defaultCryptoAssets = [
  { symbol: "BTC", name: "Bitcoin", assetType: "crypto" },
  { symbol: "ETH", name: "Ethereum", assetType: "crypto" },
  { symbol: "SOL", name: "Solana", assetType: "crypto" },
  { symbol: "XRP", name: "XRP", assetType: "crypto" },
  { symbol: "DOGE", name: "Dogecoin", assetType: "crypto" },
  { symbol: "BNB", name: "BNB", assetType: "crypto" },
  { symbol: "ADA", name: "Cardano", assetType: "crypto" }
];

const defaultOptionAssets = [
  { symbol: "AAPL", name: "Apple Options", assetType: "options" },
  { symbol: "TSLA", name: "Tesla Options", assetType: "options" },
  { symbol: "NVDA", name: "NVIDIA Options", assetType: "options" },
  { symbol: "SPY", name: "SPY Options", assetType: "options" },
  { symbol: "QQQ", name: "QQQ Options", assetType: "options" }
];

const cryptoSymbolSet = new Set(defaultCryptoAssets.map((a) => a.symbol));
const optionSymbolSet = new Set(defaultOptionAssets.map((a) => a.symbol));

function inferAssetType(symbol) {
  const s = (symbol || "").toUpperCase();
  if (cryptoSymbolSet.has(s)) return "crypto";
  if (optionSymbolSet.has(s)) return "options";
  return "stocks";
}

const pnlChartRanges = ["day", "week", "mtd", "ytd", "ltd"];
const pnlRangeLabels = {
  day: "Day",
  week: "Week",
  mtd: "MTD",
  ytd: "YTD",
  ltd: "LTD"
};

const activeTickerChartRanges = ["day", "week", "mtd", "ytd", "ltd"];
const activeTickerChartRangeLabels = {
  day: "Day",
  week: "Week",
  mtd: "MTD",
  ytd: "YTD",
  ltd: "LTD"
};

const getStartOfLocalDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getStartOfLocalWeek = (date) => {
  const next = getStartOfLocalDay(date);
  const day = next.getDay();
  const distanceToMonday = day === 0 ? 6 : day - 1;
  next.setDate(next.getDate() - distanceToMonday);
  return next;
};

const getStartOfLocalMonth = (date) => {
  const next = getStartOfLocalDay(date);
  next.setDate(1);
  return next;
};

const getStartOfLocalYear = (date) => {
  const next = getStartOfLocalDay(date);
  next.setMonth(0, 1);
  return next;
};

const formatActiveTickerAxisLabel = (timestamp, range) => {
  const safeTs = Number(timestamp || 0);
  if (!safeTs) return "--";
  const date = new Date(safeTs);
  if (Number.isNaN(date.getTime())) return "--";

  if (range === "day") {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (range === "week") {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  if (range === "mtd" || range === "ytd") {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString([], { month: "short", year: "2-digit" });
};

const getActiveTickerChartRequest = (range, firstTradeMs = 0) => {
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  let fromMs = nowMs - 24 * 60 * 60 * 1000;
  let resolution = "5";

  if (range === "day") {
    fromMs = getStartOfLocalDay(new Date(nowMs)).getTime();
    resolution = "5";
  } else if (range === "week") {
    fromMs = getStartOfLocalWeek(new Date(nowMs)).getTime();
    resolution = "30";
  } else if (range === "mtd") {
    fromMs = getStartOfLocalMonth(new Date(nowMs)).getTime();
    resolution = "60";
  } else if (range === "ytd") {
    fromMs = getStartOfLocalYear(new Date(nowMs)).getTime();
    resolution = "D";
  } else if (range === "ltd") {
    fromMs = Number(firstTradeMs || 0) || nowMs - 365 * 24 * 60 * 60 * 1000;
    resolution = "D";
  }

  const fromSec = Math.min(Math.floor(fromMs / 1000), nowSec - 60);
  return {
    resolution,
    from: Math.max(0, fromSec),
    to: nowSec
  };
};

const selectNearestContracts = (contracts, spotPrice, limit = 6) => {
  const spot = Number(spotPrice || 0);
  if (!Array.isArray(contracts) || !contracts.length) return [];

  return contracts
    .filter((contract) => Number(contract?.strike || 0) > 0)
    .map((contract) => {
      const strike = Number(contract?.strike || 0);
      const distance = spot > 0 ? Math.abs(strike - spot) : strike;
      const liquidity = Number(contract?.openInterest || 0) + Number(contract?.volume || 0);
      return { contract, distance, liquidity };
    })
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.liquidity !== b.liquidity) return b.liquidity - a.liquidity;
      return Number(a.contract?.strike || 0) - Number(b.contract?.strike || 0);
    })
    .slice(0, Math.max(1, Number(limit || 6)))
    .map((entry) => entry.contract)
    .sort((a, b) => Number(a?.strike || 0) - Number(b?.strike || 0));
};

const normalizePostAuthorAvatar = async (post) => {
  const authorUid = post?.authorId || post?.uid || post?.user?.uid || null;
  const fallbackSeed = authorUid || post.user?.name || post.author || post.id || "user";
  const fallbackAvatar = post.user?.avatar || getDeterministicDefaultAvatar(fallbackSeed);

  if (!authorUid) {
    return {
      ...post,
      user: {
        ...(post.user || {}),
        name: post.user?.name || post.author || "User",
        handle: post.user?.handle || "@user",
        avatar: fallbackAvatar
      }
    };
  }

  const ensuredProfile = await ensureUserHasAvatar(db, authorUid);
  const displayName =
    ensuredProfile.displayName ||
    ensuredProfile.username ||
    post.user?.name ||
    post.author ||
    "User";

  const isCurrentUser = auth.currentUser?.uid && authorUid === auth.currentUser.uid;
  const resolvedAvatar =
    (isCurrentUser ? auth.currentUser?.photoURL : null) ||
    ensuredProfile.photoURL ||
    fallbackAvatar;

  return {
    ...post,
    authorId: authorUid,
    user: {
      ...(post.user || {}),
      uid: authorUid,
      name: displayName,
      handle: post.user?.handle || (ensuredProfile.email ? `@${ensuredProfile.email.split("@")[0]}` : "@user"),
      avatar: resolvedAvatar
    }
  };
};

function WatchlistRow({ item, activeTicker, setActiveTicker, onRemove, quoteData }) {
  const price = quoteData?.c;
  const prevClose = quoteData?.pc;
  const change = price != null && prevClose ? price - prevClose : null;
  const changePct = prevClose && change != null ? (change / prevClose) * 100 : null;
  const up = change != null ? change >= 0 : null;
  return (
    <div
      className={
        "flex items-center gap-2 px-3 py-2 rounded-xl soft-card font-black cursor-pointer mb-2" +
        (activeTicker === item.symbol ? " bg-brogreen/10 border border-brogreen" : "")
      }
      onClick={() => setActiveTicker(item.symbol)}
    >
      <span className="text-xs font-black uppercase w-14 shrink-0">{item.symbol}</span>
      {price != null ? (
        <span className="text-xs font-black text-slate-900 dark:text-slate-100">${Number(price).toFixed(2)}</span>
      ) : null}
      {changePct != null ? (
        <span className={`text-[10px] font-black ${up ? "text-green-600" : "text-red-500"}`}>
          {up ? "+" : ""}{changePct.toFixed(2)}%
        </span>
      ) : null}
      <span className="text-[10px] text-slate-400 flex-1 truncate hidden sm:inline">{item.name}</span>
      <button
        className="ml-auto shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-xs font-black leading-none"
        title="Remove"
        onClick={async (e) => {
          e.stopPropagation();
          await onRemove(item.symbol);
        }}
      >
        ✕
      </button>
    </div>
  );
}

function Feed() {
  const router = useRouter();
  const [user, setUser] = useState(null);
    // Community creation state
    const [communityName, setCommunityName] = useState("");
    const [communityDesc, setCommunityDesc] = useState("");
    const [communityCategory, setCommunityCategory] = useState("");
    const [communityImage, setCommunityImage] = useState(null);
    const [communityImagePreview, setCommunityImagePreview] = useState(null);
    const [communityDefaultAvatar, setCommunityDefaultAvatar] = useState("");
    const [communityBanner, setCommunityBanner] = useState(null);
    const [communityBannerPreview, setCommunityBannerPreview] = useState(null);
    const [communityError, setCommunityError] = useState("");
    const [communityLoading, setCommunityLoading] = useState(false);


    // Image preview/removal for community avatar
    const handleCommunityImage = e => {
      const file = e.target.files[0];
      if (file) {
        setCommunityImage(file);
        setCommunityDefaultAvatar("");
        setCommunityImagePreview(URL.createObjectURL(file));
      }
    };
    const handleSelectCommunityDefaultAvatar = (avatarUrl) => {
      setCommunityImage(null);
      setCommunityDefaultAvatar(avatarUrl);
      setCommunityImagePreview(avatarUrl);
    };
    const handleRemoveCommunityImage = () => {
      setCommunityImage(null);
      setCommunityDefaultAvatar("");
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
    const handleCreateCommunity = async (e) => {
      e.preventDefault();
      setCommunityError("");

      if (!user?.uid) {
        setCommunityError("You must be signed in to create a community.");
        return;
      }
      if (!communityName.trim()) {
        setCommunityError("Community name is required.");
        return;
      }

      setCommunityLoading(true);
      try {
        let avatarUrl = communityDefaultAvatar || getRandomDefaultAvatar();
        let bannerUrl = null;

        if (communityImage) {
          const storage = getStorage();
          const imgRef = storageRef(storage, `community-images/${user.uid}-${Date.now()}-${communityImage.name}`);
          await uploadBytes(imgRef, communityImage);
          avatarUrl = await getDownloadURL(imgRef);
        }

        if (communityBanner) {
          const storage = getStorage();
          const bannerRef = storageRef(storage, `community-banners/${user.uid}-${Date.now()}-${communityBanner.name}`);
          await uploadBytes(bannerRef, communityBanner);
          bannerUrl = await getDownloadURL(bannerRef);
        }

        const communityRef = await addDoc(collection(db, "communities"), {
          name: communityName.trim(),
          description: communityDesc.trim(),
          category: communityCategory.trim(),
          avatar: avatarUrl,
          banner: bannerUrl,
          members: 1,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          topModeratorId: user.uid,
          assistantModeratorIds: []
        });

        await setDoc(doc(db, "memberships", `${user.uid}_${communityRef.id}`), {
          userId: user.uid,
          communityId: communityRef.id,
          joinedAt: Date.now(),
          role: "owner"
        }, { merge: true });

        setCommunityName("");
        setCommunityDesc("");
        setCommunityCategory("");
        setCommunityImage(null);
        setCommunityImagePreview(null);
        setCommunityDefaultAvatar("");
        setCommunityBanner(null);
        setCommunityBannerPreview(null);
        setModal("");
      } catch (err) {
        setCommunityError("Failed to create community. Please try again.");
      } finally {
        setCommunityLoading(false);
      }
    };

  const [posts, setPosts] = useState([]);
  const [sort, setSort] = useState("recommended"); // "recommended" | "newest" | "bullish" | "bearish" | "active"
  const [loading, setLoading] = useState(true);

  const handleToggleBookmark = async (post) => {
    if (!user || !post?.id) return;
    try {
      const bookmarksRef = collection(db, "bookmarks");
      const bookmarksQ = query(
        bookmarksRef,
        where("userId", "==", user.uid),
        where("postId", "==", post.id)
      );
      const snap = await getDocs(bookmarksQ);

      if (snap.empty) {
        await addDoc(bookmarksRef, {
          userId: user.uid,
          postId: post.id,
          bookmarkedAt: new Date()
        });
        setPosts((prevPosts) =>
          prevPosts.map((p) => (p.id === post.id ? { ...p, bookmarked: true } : p))
        );
        return;
      }

      await Promise.all(snap.docs.map((docu) => deleteDoc(doc(db, "bookmarks", docu.id))));
      setPosts((prevPosts) =>
        prevPosts.map((p) => (p.id === post.id ? { ...p, bookmarked: false } : p))
      );
    } catch (err) {
      // Keep bookmark errors non-blocking to preserve feed UX.
    }
  };

  const handleVote = async (post, type) => {
    if (!post?.id || !user?.uid) return;

    try {
      const postRef = doc(db, "posts", post.id);
      const voteRef = doc(db, "votes", `${user.uid}_${post.id}`);
      let nextBullish = post.bullishVotes || 0;
      let nextBearish = post.bearishVotes || 0;
      let changed = false;

      await runTransaction(db, async (transaction) => {
        const [postSnap, voteSnap] = await Promise.all([
          transaction.get(postRef),
          transaction.get(voteRef)
        ]);

        if (!postSnap.exists()) return;

        const previousVote = voteSnap.exists() ? voteSnap.data()?.voteType : null;
        if (previousVote === type) return;

        let bullishVotes = postSnap.data()?.bullishVotes || 0;
        let bearishVotes = postSnap.data()?.bearishVotes || 0;

        if (previousVote === "bullish") bullishVotes = Math.max(0, bullishVotes - 1);
        if (previousVote === "bearish") bearishVotes = Math.max(0, bearishVotes - 1);

        if (type === "bullish") bullishVotes += 1;
        if (type === "bearish") bearishVotes += 1;

        transaction.update(postRef, {
          bullishVotes,
          bearishVotes
        });
        transaction.set(voteRef, {
          userId: user.uid,
          postId: post.id,
          voteType: type,
          updatedAt: serverTimestamp()
        }, { merge: true });

        nextBullish = bullishVotes;
        nextBearish = bearishVotes;
        changed = true;
      });

      if (!changed) return;

      setPosts((prevPosts) =>
        prevPosts.map((p) => {
          if (p.id !== post.id) return p;
          return {
            ...p,
            bullishVotes: nextBullish,
            bearishVotes: nextBearish
          };
        })
      );
    } catch (err) {
      // Keep vote errors non-blocking to preserve feed UX.
    }
  };

  const handleDeletePost = async (post) => {
    if (!post?.id || typeof post.id === "number") return;
    const postOwnerId = post.authorId || post.userId || post.user?.uid;
    if (!user?.uid || postOwnerId !== user.uid) return;
    const shouldDelete = window.confirm("Delete this post permanently?");
    if (!shouldDelete) return;

    try {
      await deleteDoc(doc(db, "posts", post.id));
      setPosts((prevPosts) => prevPosts.filter((p) => p.id !== post.id));
      setCommentsByPost((prev) => {
        const next = { ...prev };
        delete next[post.id];
        return next;
      });
    } catch (err) {
      // Keep delete failures non-blocking for feed rendering.
    }
  };

    // Firestore realtime posts subscription
    useEffect(() => {
      setLoading(true);
      let q = query(collection(db, "posts"));
      if (sort === "newest" || sort === "recommended" || sort === "active") q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
      else if (sort === "bullish") q = query(collection(db, "posts"), orderBy("bullishVotes", "desc"));
      else if (sort === "bearish") q = query(collection(db, "posts"), orderBy("bearishVotes", "desc"));
      const unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          if (!snapshot.empty) {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const normalizedData = await Promise.all(data.map((post) => normalizePostAuthorAvatar(post)));
            setPosts(normalizedData);
          } else {
            setPosts([]);
          }
          setLoading(false);
        },
        (error) => {
          setPosts([]);
          setLoading(false);
        }
      );
      return () => unsubscribe();
      // eslint-disable-next-line
    }, [sort]);
  const [watchlist, setWatchlist] = useState([]);
  const [activeTicker, setActiveTicker] = useState("AAPL");
  // Communities state
  const [communitiesCache, setCommunitiesCache] = useState([]);
  const [joinedCommunityIds, setJoinedCommunityIds] = useState([]);

  // Firestore communities loading
  useEffect(() => {
    const q = collection(db, "communities");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCommunitiesCache(data);
      } else {
        setCommunitiesCache([]);
      }
    }, () => {
      setCommunitiesCache([]);
    });
    return () => unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!user?.uid) {
      setJoinedCommunityIds([]);
      return;
    }

    const membershipsQuery = query(collection(db, "memberships"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(membershipsQuery, (snapshot) => {
      setJoinedCommunityIds(snapshot.docs.map((membershipDoc) => membershipDoc.data().communityId).filter(Boolean));
    }, () => {
      setJoinedCommunityIds([]);
    });

    return () => unsubscribe();
  }, [db, user]);
  // Add comment handler
  const handleAddComment = async (post, val) => {
    if (!val.trim()) return;
    // Firestore-backed
    try {
      const commentsRef = collection(db, "posts", post.id, "comments");
      await addDoc(commentsRef, {
        user: {
          name: user?.displayName || "User",
          avatar: user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || "U"}&background=050816&color=B6FF22`,
          uid: user?.uid || null
        },
        userId: user?.uid || null,
        content: val,
        createdAt: serverTimestamp(),
        likeCount: 0,
        likedBy: []
      });
      setCommentInputs(inputs => ({ ...inputs, [post.id]: "" }));
      // Increment comment count in Firestore
      const postRef = doc(db, "posts", post.id);
      await updateDoc(postRef, { comments: firestoreIncrement(1) });
    } catch (err) {
      // Optionally handle error
    }
  };
  const [followingIds, setFollowingIds] = useState([]);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [followersUsers, setFollowersUsers] = useState([]);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [activeTopic, setActiveTopic] = useState("");
  const [expandedComments, setExpandedComments] = useState([]);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [replyInputs, setReplyInputs] = useState({});
  const [activeReplyTarget, setActiveReplyTarget] = useState(null);
  const [repliesByComment, setRepliesByComment] = useState({});

  useEffect(() => {
    let active = true;

    const mapUsersByIds = async (ids) => {
      if (!ids?.length) return [];
      const uniqueIds = [...new Set(ids.filter(Boolean))];
      return Promise.all(
        uniqueIds.map(async (uid) => {
          try {
            const userSnap = await getDoc(doc(db, "users", uid));
            const userData = userSnap.exists() ? userSnap.data() : {};
            const displayName = userData.displayName || userData.username || userData.email || uid;
            return {
              id: uid,
              name: displayName,
              handle: userData.email ? `@${userData.email.split("@")[0]}` : `@${uid.slice(0, 8)}`,
              avatar: userData.photoURL || getDeterministicDefaultAvatar(uid)
            };
          } catch {
            return {
              id: uid,
              name: uid,
              handle: `@${uid.slice(0, 8)}`,
              avatar: getDeterministicDefaultAvatar(uid)
            };
          }
        })
      );
    };

    const loadSocialData = async () => {
      if (!user) {
        if (active) {
          setFollowingIds([]);
          setFollowingUsers([]);
          setFollowersUsers([]);
        }
        return;
      }

      try {
        const [following, followers] = await Promise.all([
          getFollowing(user.uid),
          getFollowers(user.uid)
        ]);
        if (!active) return;
        setFollowingIds(following);

        const [followingMapped, followersMapped] = await Promise.all([
          mapUsersByIds(following),
          mapUsersByIds(followers)
        ]);

        if (!active) return;
        setFollowingUsers(followingMapped);
        setFollowersUsers(followersMapped);
      } catch (err) {
        if (!active) return;
        setFollowingIds([]);
        setFollowingUsers([]);
        setFollowersUsers([]);
      }
    };

    loadSocialData();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const firestorePostIds = posts
      .map((post) => post.id)
      .filter((postId) => typeof postId === "string");

    if (!firestorePostIds.length) return undefined;

    const unsubscribes = firestorePostIds.map((postId) => {
      const commentsRef = collection(db, "posts", postId, "comments");
      const commentsQuery = query(commentsRef, orderBy("createdAt", "asc"));
      return onSnapshot(commentsQuery, (snapshot) => {
        setCommentsByPost((prev) => ({
          ...prev,
          [postId]: snapshot.docs.map((commentDoc) => ({ id: commentDoc.id, ...commentDoc.data() }))
        }));
      });
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe && unsubscribe());
    };
  }, [db, posts]);

  useEffect(() => {
    const targets = expandedComments
      .filter((postId) => typeof postId === "string")
      .flatMap((postId) =>
        (commentsByPost[postId] || [])
          .map((comment) => ({ postId, commentId: comment.id }))
          .filter((entry) => typeof entry.commentId === "string")
      );

    if (!targets.length) return undefined;

    const unsubscribes = targets.map(({ postId, commentId }) => {
      const repliesRef = collection(db, "posts", postId, "comments", commentId, "replies");
      const repliesQuery = query(repliesRef, orderBy("createdAt", "asc"));
      return onSnapshot(repliesQuery, (snapshot) => {
        setRepliesByComment((prev) => ({
          ...prev,
          [`${postId}_${commentId}`]: snapshot.docs.map((replyDoc) => ({ id: replyDoc.id, ...replyDoc.data() }))
        }));
      });
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe && unsubscribe());
    };
  }, [commentsByPost, db, expandedComments]);

  useEffect(() => {
    const topicMap = new Map();
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

    posts.forEach((post) => {
      const tokens = Array.from(new Set(extractTrendingTokens(post.content || "")));
      if (!tokens.length) return;

      const postCreatedAtMs = normalizePostCreatedAtMs(post.createdAt);
      const recencyWeight = postCreatedAtMs >= oneDayAgo ? 2 : 1;

      tokens.forEach((topic) => {
        const row = topicMap.get(topic) || { topic, posts: 0, score: 0 };
        row.posts += 1;
        row.score += recencyWeight;
        topicMap.set(topic, row);
      });
    });

    const nextTopics = [...topicMap.values()]
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.posts !== a.posts) return b.posts - a.posts;
        return a.topic.localeCompare(b.topic);
      })
      .slice(0, 8)
      .map((topicRow, index) => ({
        id: `${topicRow.topic}_${index}`,
        topic: topicRow.topic,
        posts: topicRow.posts
      }));

    setTrendingTopics(nextTopics);
  }, [posts]);

  const handleAddReply = async (post, comment, value) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const replyKey = `${post.id}_${comment.id}`;

    if (!post?.id || typeof post.id === "number" || typeof comment?.id !== "string") {
      setRepliesByComment((prev) => ({
        ...prev,
        [replyKey]: [
          ...(prev[replyKey] || []),
          {
            id: `${Date.now()}`,
            user: {
              name: user?.displayName || "You",
              avatar: user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || "You"}&background=050816&color=B6FF22`
            },
            content: trimmed,
            createdAt: new Date()
          }
        ]
      }));
      setReplyInputs((prev) => ({ ...prev, [replyKey]: "" }));
      setActiveReplyTarget(null);
      return;
    }

    try {
      const repliesRef = collection(db, "posts", post.id, "comments", comment.id, "replies");
      await addDoc(repliesRef, {
        user: {
          name: user?.displayName || "User",
          avatar: user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || "U"}&background=050816&color=B6FF22`
        },
        content: trimmed,
        createdAt: serverTimestamp()
      });
      setReplyInputs((prev) => ({ ...prev, [replyKey]: "" }));
      setActiveReplyTarget(null);
    } catch {
      // Non-blocking
    }
  };

  const handleReportComment = async (post, comment) => {
    if (!user?.uid || !post?.id || !comment?.id) return;

    const shouldReport = window.confirm("Are you sure you want to report this post?");
    if (!shouldReport) return;

    try {
      const reportRef = doc(db, "commentReports", `${user.uid}_${post.id}_${comment.id}`);
      await setDoc(reportRef, {
        reporterId: user.uid,
        postId: post.id,
        commentId: comment.id,
        commentContent: comment.content || "",
        commentAuthorName: comment.user?.name || "User",
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch {
      // Non-blocking
    }
  };

  const handleReportPost = async (post) => {
    if (!user?.uid || !post?.id) return;

    const shouldReport = window.confirm("Are you sure you want to report this post?");
    if (!shouldReport) return;

    if (typeof post.id !== "string") return;

    try {
      const reportRef = doc(db, "postReports", `${user.uid}_${post.id}`);
      await setDoc(reportRef, {
        reporterId: user.uid,
        postId: post.id,
        postContent: post.content || "",
        postAuthorName: post.user?.name || "User",
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch {
      // Non-blocking
    }
  };

  const handleToggleCommentLike = async (post, comment) => {
    if (!user?.uid || !post?.id || !comment?.id) return;

    const likedBy = Array.isArray(comment.likedBy) ? comment.likedBy : [];
    const alreadyLiked = likedBy.includes(user.uid);

    if (typeof post.id !== "string" || typeof comment.id !== "string") {
      setCommentsByPost((prev) => ({
        ...prev,
        [post.id]: (prev[post.id] || []).map((row) => {
          if (row.id !== comment.id) return row;
          const rowLikedBy = Array.isArray(row.likedBy) ? row.likedBy : [];
          const rowAlreadyLiked = rowLikedBy.includes(user.uid);
          const nextLikedBy = rowAlreadyLiked
            ? rowLikedBy.filter((uid) => uid !== user.uid)
            : [...rowLikedBy, user.uid];
          return {
            ...row,
            likedBy: nextLikedBy,
            likeCount: rowAlreadyLiked ? Math.max(0, (row.likeCount || 0) - 1) : (row.likeCount || 0) + 1
          };
        })
      }));
      return;
    }

    try {
      const commentRef = doc(db, "posts", post.id, "comments", comment.id);
      let nextLikeCount = comment.likeCount || 0;
      let nextLikedBy = likedBy;

      await runTransaction(db, async (transaction) => {
        const commentSnap = await transaction.get(commentRef);
        if (!commentSnap.exists()) return;

        const data = commentSnap.data() || {};
        const currentLikedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
        const currentLikeCount = data.likeCount || 0;
        const isLiked = currentLikedBy.includes(user.uid);

        nextLikedBy = isLiked
          ? currentLikedBy.filter((uid) => uid !== user.uid)
          : [...currentLikedBy, user.uid];
        nextLikeCount = isLiked ? Math.max(0, currentLikeCount - 1) : currentLikeCount + 1;

        transaction.update(commentRef, {
          likedBy: nextLikedBy,
          likeCount: nextLikeCount
        });
      });

      setCommentsByPost((prev) => ({
        ...prev,
        [post.id]: (prev[post.id] || []).map((row) =>
          row.id === comment.id ? { ...row, likedBy: nextLikedBy, likeCount: nextLikeCount } : row
        )
      }));
    } catch {
      // Non-blocking
    }
  };

  // --- UI STATE REPLACEMENTS FOR IMPERATIVE DOM ---
  // Post creation state
  const [postDestination, setPostDestination] = useState("timeline");
  const [postCommunity, setPostCommunity] = useState("");
  const [postCommunityId, setPostCommunityId] = useState("");
  const [postCategories, setPostCategories] = useState([]);
  const [postNewsCategory, setPostNewsCategory] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postHasPoll, setPostHasPoll] = useState(false);
  const [postPollQuestion, setPostPollQuestion] = useState("");
  const [postPollOptionA, setPostPollOptionA] = useState("");
  const [postPollOptionB, setPostPollOptionB] = useState("");
  const [allowComments, setAllowComments] = useState(true);
  const [postError, setPostError] = useState("");
  const [postSuccess, setPostSuccess] = useState("");
  const [postCharCount, setPostCharCount] = useState(0);
  const [postLoading, setPostLoading] = useState(false);
  const [communityMenuOpen, setCommunityMenuOpen] = useState(false);
  const communityMenuRef = useRef(null);
  const assetSearchRef = useRef(null);
  const globalSearchRef = useRef(null);

  const postCategoryOptions = ["Prediction Markets", "Collectible Items", "Crypto", "Options", "FX", "News"];
  const postNewsCategoryOptions = ["Stock News", "Politics", "World News"];
  const isNewsCategorySelected = postCategories.includes("News");
  const joinedCommunities = communitiesCache.filter((community) => community?.createdBy === user?.uid || joinedCommunityIds.includes(community.id));
  const selectedJoinedCommunity = joinedCommunities.find((community) => community.id === postCommunityId) || joinedCommunities.find((community) => community.name === postCommunity) || null;

  const isPostDraftDirty =
    postContent.trim().length > 0 ||
    postCategories.length > 0 ||
    postNewsCategory !== "" ||
    postCommunity !== "" ||
    postCommunityId !== "" ||
    postHasPoll ||
    postPollQuestion.trim().length > 0 ||
    postPollOptionA.trim().length > 0 ||
    postPollOptionB.trim().length > 0;

  const isPollReady =
    !postHasPoll ||
    (postPollQuestion.trim().length > 0 && postPollOptionA.trim().length > 0 && postPollOptionB.trim().length > 0);

  const canPost =
    (postContent.trim().length > 0 || postHasPoll) &&
    postCategories.length > 0 &&
    (!isNewsCategorySelected || postNewsCategory !== "") &&
    isPollReady &&
    (postDestination === "timeline" || (postDestination === "community" && postCommunity !== "" && postCommunityId !== ""));

  // Handle post form field changes
  const handlePostDestination = nextDestination => {
    setPostDestination(nextDestination);
    if (nextDestination !== "community") {
      setPostCommunity("");
      setPostCommunityId("");
      setCommunityMenuOpen(false);
    }
  };
  const handleSelectPostCommunity = (community) => {
    setPostCommunity(community.name);
    setPostCommunityId(community.id);
    setCommunityMenuOpen(false);
  };
  const handlePostCategory = nextCategory => {
    let nextCategories = [];
    setPostCategories((currentCategories) => {
      const isSelected = currentCategories.includes(nextCategory);
      if (isSelected) {
        nextCategories = currentCategories.filter((category) => category !== nextCategory);
        return nextCategories;
      }
      if (currentCategories.length >= 3) {
        nextCategories = currentCategories;
        return currentCategories;
      }
      nextCategories = [...currentCategories, nextCategory];
      return nextCategories;
    });
    if (!nextCategories.includes("News")) {
      setPostNewsCategory("");
    }
  };
  const handlePostNewsCategory = nextNewsCategory => setPostNewsCategory(nextNewsCategory);
  const handlePostContent = e => {
    setPostContent(e.target.value);
    setPostCharCount(e.target.value.length);
  };
  const handleAllowComments = e => setAllowComments(e.target.checked);
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!communityMenuRef.current?.contains(event.target)) {
        setCommunityMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Reset post form
  const resetPostForm = () => {
    setPostDestination("timeline");
    setPostCommunity("");
    setPostCommunityId("");
    setPostCategories([]);
    setPostNewsCategory("");
    setPostContent("");
    setPostHasPoll(false);
    setPostPollQuestion("");
    setPostPollOptionA("");
    setPostPollOptionB("");
    setAllowComments(true);
    setPostError("");
    setPostCharCount(0);
    setPostLoading(false);
    setCommunityMenuOpen(false);
  };

  const handleClosePostModal = () => {
    if (postLoading) return;
    if (isPostDraftDirty) {
      const discard = window.confirm("Discard this draft post?");
      if (!discard) return;
    }
    resetPostForm();
    setModal("");
  };

  // Post submit handler
  const handlePostSubmit = async e => {
    e.preventDefault();
    if (postLoading) return;
    setPostError("");
    setPostSuccess("");
    if (!user) {
      setPostError("You must be signed in to post.");
      return;
    }
    if (!postContent.trim() && !postHasPoll) {
      setPostError("Add content or include a poll before posting.");
      return;
    }
    if (postCategories.length === 0) {
      setPostError("Please select up to three categories.");
      return;
    }
    if (isNewsCategorySelected && !postNewsCategory) {
      setPostError("Please select a news category.");
      return;
    }
    if (postDestination === "community" && (!postCommunity || !postCommunityId)) {
      setPostError("Please select a community.");
      return;
    }
    if (postHasPoll && !isPollReady) {
      setPostError("Poll question and both options are required.");
      return;
    }

    const blockedWordPattern = /\b(nigger|nigga|rape)\b/i;
    const textToModerate = [
      postContent,
      postPollQuestion,
      postPollOptionA,
      postPollOptionB
    ].filter(Boolean).join(" ");

    if (blockedWordPattern.test(textToModerate)) {
      const moderationMessage = "Your post contains prohibited language and cannot be published.";
      setPostError(moderationMessage);
      window.alert(moderationMessage);
      return;
    }

    setPostLoading(true);
    try {
      const postData = {
        user: {
          name: user.displayName || "User",
          avatar: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || "U"}&background=050816&color=B6FF22`,
          handle: user.email ? `@${user.email.split("@")[0]}` : "@user"
        },
        authorId: user.uid,
        time: "now",
        content: postContent,
        image: null,
        comments: 0,
        likes: 0,
        bookmarked: false,
        category: postCategories[0],
        categories: postCategories,
        newsCategory: isNewsCategorySelected ? postNewsCategory : null,
        allowComments,
        poll: postHasPoll
          ? {
              question: postPollQuestion.trim(),
              options: [
                { id: "option-1", label: postPollOptionA.trim(), votes: 0 },
                { id: "option-2", label: postPollOptionB.trim(), votes: 0 }
              ],
              totalVotes: 0
            }
          : null,
        destination: postDestination,
        community: postDestination === "community" ? postCommunity : null,
        communityId: postDestination === "community" ? postCommunityId : null,
        createdAt: serverTimestamp()
      };
      const createdPost = {
        ...postData,
        createdAt: new Date(),
        user: {
          ...postData.user,
          uid: user.uid
        }
      };
      const docRef = await addDoc(collection(db, "posts"), postData);
      setPosts((prevPosts) => [{ id: docRef.id, ...createdPost }, ...prevPosts]);
      setPostSuccess("Posted successfully.");
      resetPostForm();
      setModal("");
    } catch (err) {
      setPostError("Failed to post. Please try again.");
    }
    setPostLoading(false);
  };

  const handleShareHistoricalTrade = async (trade) => {
    if (!user?.uid || !trade?.id) return;

    const normalizedSymbol = String(trade.symbol || "").toUpperCase();
    const normalizedSide = String(trade.side || "trade").toLowerCase();
    const assetType = trade.assetType === "option" ? "option" : "stock";
    const underlyingSymbol = String(trade.underlyingSymbol || normalizedActiveTicker || normalizedSymbol).toUpperCase();
    const optionType = String(trade.optionType || "call").toLowerCase() === "put" ? "put" : "call";
    const strike = Number(trade.strike || 0);
    const contractMultiplier = Number(trade.contractMultiplier || 1);
    const quantity = Number(trade.quantity || 0);
    const price = Number(trade.price || 0);
    const realizedPnl = Number(trade.realizedPnl || 0);
    const pnlText = normalizedSide === "sell"
      ? ` | Trade PnL: ${realizedPnl >= 0 ? "+" : "-"}$${Math.abs(realizedPnl).toFixed(2)}`
      : "";
    const tradeSummary = assetType === "option"
      ? `${normalizedSide.toUpperCase()} ${quantity} ${normalizedSymbol} contracts @ $${price.toFixed(2)} (${optionType.toUpperCase()} ${underlyingSymbol} $${strike.toFixed(2)})`
      : `${normalizedSide.toUpperCase()} ${quantity} ${normalizedSymbol} @ $${price.toFixed(2)}`;

    try {
      await addDoc(collection(db, "posts"), {
        author: user.displayName || user.email?.split("@")[0] || "Trader",
        authorId: user.uid,
        content: `Shared paper trade: ${tradeSummary}${pnlText}`,
        createdAt: serverTimestamp(),
        comments: 0,
        bullishVotes: 0,
        bearishVotes: 0,
        user: {
          uid: user.uid,
          name: user.displayName || user.email?.split("@")[0] || "Trader",
          avatar: user.photoURL || "/defaults/default1.png",
          handle: user.email ? `@${user.email.split("@")[0]}` : "@trader"
        },
        paperTrade: {
          symbol: normalizedSymbol,
          assetType,
          underlyingSymbol,
          quantity,
          price,
          contractMultiplier,
          notional: Number(trade.notional || quantity * price * contractMultiplier),
          side: normalizedSide,
          realizedPnl: normalizedSide === "sell" ? realizedPnl : null,
          ...(assetType === "option"
            ? {
                optionType,
                strike,
                expiration: trade.expiration || null
              }
            : {}),
          originalTradeId: trade.id
        }
      });

      await updateDoc(doc(db, "users", user.uid, "paperTrades", trade.id), {
        sharedToFeed: true,
        sharedAt: serverTimestamp()
      });
    } catch {
      // Non-blocking for feed UX.
    }
  };
  // Modal visibility state
  const [modal, setModal] = useState(""); // "ticker" | "post" | "profile" | "create-community" | "bro-llm" | "dm" | ""
  const [profileImagePickerOpen, setProfileImagePickerOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState("");
  const [profileUploadFile, setProfileUploadFile] = useState(null);
  const [profileBio, setProfileBio] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [assigningRandomAvatar, setAssigningRandomAvatar] = useState(false);
  // Mobile drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  // Tab state
  const [feedTab, setFeedTab] = useState("for-you"); // "for-you" or "following"
  // Bookmark filter state
  const [selectedFilter, setSelectedFilter] = useState("home");

  const filteredPosts = useMemo(
    () => posts.filter((post) => {
      if (feedTab === "following") {
        // Show only posts by following (safe null checks + legacy name fallback)
        const authorUid = post.authorId || post.user?.uid;
        if (authorUid && followingIds.includes(authorUid)) {
          // continue
        } else {
          const comments = commentsByPost[post.id] || [];
          const followedComment = comments.some((comment) => {
            const commenterUid = comment.userId || comment.user?.uid;
            if (commenterUid) return followingIds.includes(commenterUid);
            const commenterName = comment.user?.name?.trim()?.toLowerCase();
            if (!commenterName) return false;
            return followingUsers.some((f) => f?.name?.trim()?.toLowerCase() === commenterName);
          });
          if (!followedComment) {
            const postName = post.user?.name?.trim()?.toLowerCase();
            if (!postName || !followingUsers.some((f) => f?.name?.trim()?.toLowerCase() === postName)) {
              return false;
            }
          }
        }
      }

      if (selectedFilter !== "home") {
        if (typeof selectedFilter === "number" || typeof selectedFilter === "string") {
          const comm = communitiesCache.find((c) => c.id === selectedFilter);
          if (comm && post.community) {
            const matchesCommunity = post.community === comm.name || post.community === comm.id;
            if (!matchesCommunity) return false;
          }
        }
      }

      if (!activeTopic) return true;
      return extractTrendingTokens(post.content || "").includes(activeTopic);
    }),
    [activeTopic, commentsByPost, communitiesCache, feedTab, followingIds, followingUsers, posts, selectedFilter]
  );

  const visiblePosts = useMemo(() => {
    const ranked = [...filteredPosts];

    // Keep non-For-You tabs predictable and chronological.
    if (feedTab !== "for-you") {
      return ranked.sort((a, b) => normalizePostCreatedAtMs(b.createdAt) - normalizePostCreatedAtMs(a.createdAt));
    }

    if (sort === "newest") {
      return ranked.sort((a, b) => normalizePostCreatedAtMs(b.createdAt) - normalizePostCreatedAtMs(a.createdAt));
    }

    if (sort === "bullish") {
      return ranked.sort((a, b) => Number(b.bullishVotes || 0) - Number(a.bullishVotes || 0));
    }

    if (sort === "bearish") {
      return ranked.sort((a, b) => Number(b.bearishVotes || 0) - Number(a.bearishVotes || 0));
    }

    if (sort === "active") {
      return ranked.sort((a, b) => {
        const aComments = Number(a.comments || commentsByPost[a.id]?.length || 0);
        const bComments = Number(b.comments || commentsByPost[b.id]?.length || 0);
        const aVotes = Number(a.bullishVotes || 0) + Number(a.bearishVotes || 0);
        const bVotes = Number(b.bullishVotes || 0) + Number(b.bearishVotes || 0);
        return (bComments + bVotes) - (aComments + aVotes);
      });
    }

    // Default For You algorithm: recency + engagement + social graph + content quality.
    const now = Date.now();
    const scored = ranked.map((post) => {
      const createdAtMs = normalizePostCreatedAtMs(post.createdAt) || now;
      const ageHours = Math.max(0, (now - createdAtMs) / (1000 * 60 * 60));
      const recencyScore = Math.max(0, (36 - ageHours) / 36) * 6;

      const voteScore = Number(post.bullishVotes || 0) + Number(post.bearishVotes || 0);
      const commentScore = Number(post.comments || commentsByPost[post.id]?.length || 0) * 1.5;
      const engagementScore = voteScore + commentScore;

      const authorUid = post.authorId || post.user?.uid;
      const socialScore = authorUid && followingIds.includes(authorUid) ? 3 : 0;

      const contentLength = String(post.content || "").trim().length;
      const qualityScore = Math.min(contentLength / 140, 1) * 1.5;

      const entropySource = String(post.id || post.content || "");
      const stableNoise = (entropySource.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 100) / 500;

      return {
        post,
        score: recencyScore + engagementScore + socialScore + qualityScore + stableNoise
      };
    });

    return scored.sort((a, b) => b.score - a.score).map((entry) => entry.post);
  }, [filteredPosts, feedTab, sort, commentsByPost, followingIds]);
  // Watchlist form state
  const [watchlistFormOpen, setWatchlistFormOpen] = useState(false);
  const [watchlistInput, setWatchlistInput] = useState("");
  const [watchlistSaving, setWatchlistSaving] = useState(false);
  const [paperTradeSubmitting, setPaperTradeSubmitting] = useState("");
  const [paperAccount, setPaperAccount] = useState(null);
  const [paperTrades, setPaperTrades] = useState([]);
  const [paperOrders, setPaperOrders] = useState([]);
  const [showAllPaperTrades, setShowAllPaperTrades] = useState(false);
  const [stockOrderType, setStockOrderType] = useState("market");
  const [stockLimitPrice, setStockLimitPrice] = useState("");
  const [stockShareQuantity, setStockShareQuantity] = useState("1");
  const [pnlChartRange, setPnlChartRange] = useState("day");
  const [pnlRangeMenuOpen, setPnlRangeMenuOpen] = useState(false);
  const [positionQuotes, setPositionQuotes] = useState({});
  const [watchlistQuotes, setWatchlistQuotes] = useState({});
  const [activeTickerChartRange, setActiveTickerChartRange] = useState("day");
  const [activeTickerRangeMenuOpen, setActiveTickerRangeMenuOpen] = useState(false);
  const [activeTickerQuote, setActiveTickerQuote] = useState(null);
  const [activeTickerCandles, setActiveTickerCandles] = useState([]);
  const [activeTickerChartLoading, setActiveTickerChartLoading] = useState(false);
  const [optionChainOpen, setOptionChainOpen] = useState(false);
  const [optionChainData, setOptionChainData] = useState(null);
  const [optionChainLoading, setOptionChainLoading] = useState(false);
  const [optionChainError, setOptionChainError] = useState("");
  const [optionContractQuantity, setOptionContractQuantity] = useState("1");
  const [selectedOptionExpiration, setSelectedOptionExpiration] = useState("");
  const [marketOpen, setMarketOpen] = useState(() => isMarketOpenNow());
  // Search dropdowns
  const [assetSearchInput, setAssetSearchInput] = useState("");
  const [assetSearchResults, setAssetSearchResults] = useState([]);
  const [assetSearchOpen, setAssetSearchOpen] = useState(false);
  const [assetSearchLoading, setAssetSearchLoading] = useState(false);
  const [globalSearchInput, setGlobalSearchInput] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const pendingOrderProcessingRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const syncMarketStatus = () => setMarketOpen(isMarketOpenNow());
    syncMarketStatus();
    const intervalId = setInterval(syncMarketStatus, 30000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.photoURL) {
      setProfilePhoto(user.photoURL);
      return;
    }

    const randomAvatar = getDeterministicDefaultAvatar(user.uid);
    setProfilePhoto(randomAvatar);

    if (assigningRandomAvatar) return;
    setAssigningRandomAvatar(true);

    const assignRandomAvatar = async () => {
      try {
        await updateProfile(auth.currentUser, { photoURL: randomAvatar });
        await setDoc(doc(db, "users", user.uid), {
          photoURL: randomAvatar
        }, { merge: true });
        setUser((prev) => (prev ? { ...prev, photoURL: randomAvatar } : prev));
      } catch (err) {
        // Non-blocking fallback; user can still manually choose an avatar.
      }
      setAssigningRandomAvatar(false);
    };

    assignRandomAvatar();
  }, [user?.uid, user?.photoURL]);

  useEffect(() => {
    if (!user?.uid) {
      setWatchlist([]);
      return;
    }

    const watchlistRef = collection(db, "users", user.uid, "watchlist");
    const unsubscribe = onSnapshot(
      watchlistRef,
      (snapshot) => {
        const items = snapshot.docs
          .map((watchlistDoc) => {
            const data = watchlistDoc.data() || {};
            const symbol = (data.symbol || watchlistDoc.id || "").toUpperCase();
            return {
              id: watchlistDoc.id,
              symbol,
              name: data.name || symbol
            };
          })
          .filter((item) => item.symbol)
          .sort((a, b) => a.symbol.localeCompare(b.symbol));
        setWatchlist(items);
      },
      () => {
        setWatchlist([]);
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const watchlistSymbols = watchlist.map((item) => String(item.symbol || "").toUpperCase()).filter(Boolean);
    const holdingSymbols = Object.entries(paperAccount?.positions || {})
      .filter(([, qty]) => Number(qty || 0) > 0)
      .map(([symbol]) => String(symbol || "").toUpperCase())
      .filter(Boolean);
    const selectableSymbols = [...new Set([...watchlistSymbols, ...holdingSymbols])];

    if (!selectableSymbols.length) {
      setActiveTicker("AAPL");
      return;
    }

    const normalizedActive = String(activeTicker || "").toUpperCase();
    if (!selectableSymbols.includes(normalizedActive)) {
      setActiveTicker(selectableSymbols[0]);
    }
  }, [watchlist, activeTicker, paperAccount?.positions]);

  const handleAddToSharedWatchlist = async (rawSymbol, rawName, assetType = "stocks") => {
    const symbol = (rawSymbol || "").trim().toUpperCase();
    if (!symbol || !user?.uid) return;

    if (watchlist.some((item) => item.symbol === symbol)) {
      setActiveTicker(symbol);
      return;
    }

    const normalizedType = ["stocks", "options", "crypto"].includes(assetType) ? assetType : "stocks";

    setWatchlistSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid, "watchlist", symbol),
        {
          symbol,
          name: (rawName || symbol).trim() || symbol,
          assetType: normalizedType,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      setActiveTicker(symbol);
    } catch (err) {
      // Keep non-blocking to preserve feed behavior.
    }
    setWatchlistSaving(false);
  };

  const handleSaveWatchlistInput = async () => {
    const symbol = watchlistInput.trim().toUpperCase();
    if (!symbol) return;
    await handleAddToSharedWatchlist(symbol, symbol);
    setWatchlistInput("");
    setWatchlistFormOpen(false);
  };

  const handleRemoveFromSharedWatchlist = async (symbol) => {
    if (!user?.uid || !symbol) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "watchlist", symbol));
    } catch (err) {
      // Keep non-blocking to preserve feed behavior.
    }
  };

  const handleExecuteSelectedTickerTrade = async (side) => {
    if (!user?.uid) return;

    const symbol = String(activeTicker || "").toUpperCase();
    if (!symbol) {
      window.alert("Select a ticker first.");
      return;
    }

    const marketPrice = Number(
      activeTickerQuote?.c ||
      positionQuotes[symbol] ||
      latestTradePriceBySymbol[symbol] ||
      0
    );
    if (!marketPrice || marketPrice <= 0) {
      window.alert("Live price is unavailable right now. Try again in a moment.");
      return;
    }

    const currentHeldQty = Math.max(0, Number(paperAccount?.positions?.[symbol] || 0));
    const quantity = Math.floor(Number(stockShareQuantity));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      window.alert("Enter a valid share quantity.");
      return;
    }

    if (side === "sell" && quantity > currentHeldQty) {
      window.alert(`You only hold ${currentHeldQty.toLocaleString()} shares of ${symbol}.`);
      return;
    }

    setPaperTradeSubmitting(`${side}-${stockOrderType}`);
    try {
      await placePaperOrder(symbol, quantity, marketPrice, side, {
        shareAsPost: false,
        orderType: stockOrderType,
        limitPrice: stockOrderType === "limit" ? Number(stockLimitPrice) : null
      });
    } catch (err) {
      window.alert(err?.message || `Paper ${side} failed.`);
    }
    setPaperTradeSubmitting("");
  };

  const handleOpenOptionChain = () => {
    if (!normalizedActiveTicker) return;
    setOptionChainOpen((prev) => !prev);
  };

  const handleExecuteOptionContractTrade = async (contract, side, optionType) => {
    if (!user?.uid) return;
    if (!marketOpen) {
      window.alert("Market is closed. Paper trades are only allowed during market hours.");
      return;
    }

    const contractSymbol = String(contract?.contractSymbol || "").toUpperCase();
    if (!contractSymbol) {
      window.alert("Option contract is unavailable right now.");
      return;
    }

    const bid = Number(contract?.bid || 0);
    const ask = Number(contract?.ask || 0);
    const lastPrice = Number(contract?.lastPrice || 0);
    const entryPrice = ask > 0 ? ask : (lastPrice > 0 ? lastPrice : bid);
    if (!entryPrice || entryPrice <= 0) {
      window.alert("Option price is unavailable right now.");
      return;
    }

    const heldContracts = Math.max(0, Number(paperAccount?.optionPositions?.[contractSymbol] || 0));
    const quantity = Math.floor(Number(optionContractQuantity));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      window.alert("Enter a valid contract quantity.");
      return;
    }

    if (side === "sell" && quantity > heldContracts) {
      window.alert(`You only hold ${heldContracts.toLocaleString()} contracts of ${contractSymbol}.`);
      return;
    }

    const submitKey = `${side}-option-${contractSymbol}`;
    setPaperTradeSubmitting(submitKey);
    try {
      await placePaperTrade(contractSymbol, quantity, entryPrice, side, {
        shareAsPost: false,
        assetType: "option",
        underlyingSymbol: normalizedActiveTicker,
        optionType,
        strike: Number(contract?.strike || 0),
        expiration: contract?.expiration || selectedOptionExpiration,
        contractMultiplier: 100
      });
    } catch (err) {
      window.alert(err?.message || `Paper ${side} failed.`);
    }
    setPaperTradeSubmitting("");
  };

  useEffect(() => {
    const queryText = assetSearchInput.trim();
    if (!queryText) {
      setAssetSearchResults([]);
      setAssetSearchOpen(false);
      return;
    }

    let active = true;
    const runSearch = async () => {
      setAssetSearchLoading(true);
      const lowered = queryText.toLowerCase();

      const optionMatches = defaultOptionAssets
        .filter((asset) =>
          asset.symbol.toLowerCase().includes(lowered) || asset.name.toLowerCase().includes(lowered)
        )
        .map((asset) => ({ ...asset, source: "local" }));

      const cryptoMatches = defaultCryptoAssets
        .filter((asset) =>
          asset.symbol.toLowerCase().includes(lowered) || asset.name.toLowerCase().includes(lowered)
        )
        .map((asset) => ({ ...asset, source: "local" }));

      let stockMatches = [];
      try {
        const res = await fetch(`/api/searchSymbol?query=${encodeURIComponent(queryText)}`);
        if (res.ok) {
          const data = await res.json();
          stockMatches = (data.result || []).slice(0, 8).map((item) => ({
            symbol: item.symbol,
            name: item.description || item.symbol,
            assetType: "stocks",
            source: "finnhub"
          }));
        }
      } catch (err) {
        // Keep search resilient if stock API fails.
      }

      if (!active) return;

      // Reclassify Finnhub results: crypto/option symbols override "stocks" label
      stockMatches = stockMatches.map((item) => ({
        ...item,
        assetType: inferAssetType(item.symbol)
      }));

      // Dedup by symbol only; local crypto/option entries take priority
      const merged = [...optionMatches, ...cryptoMatches, ...stockMatches];
      const deduped = [];
      const seen = new Set();
      for (const item of merged) {
        if (seen.has(item.symbol)) continue;
        seen.add(item.symbol);
        deduped.push(item);
      }

      setAssetSearchResults(deduped.slice(0, 12));
      setAssetSearchOpen(true);
      setAssetSearchLoading(false);
    };

    const timer = setTimeout(runSearch, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [assetSearchInput]);

  useEffect(() => {
    const queryText = globalSearchInput.trim();
    if (!queryText) {
      setGlobalSearchResults([]);
      setGlobalSearchOpen(false);
      return;
    }

    let active = true;
    const runSearch = async () => {
      setGlobalSearchLoading(true);

      const communityMatches = communitiesCache
        .filter((community) => {
          const name = String(community.name || "");
          return name.toLowerCase().includes(queryText.toLowerCase());
        })
        .slice(0, 6)
        .map((community) => ({
          type: "community",
          id: community.id,
          title: community.name,
          subtitle: `${community.members || 0} members`
        }));

      let userMatches = [];
      try {
        const [emailSnap, displayNameSnap] = await Promise.all([
          getDocs(query(collection(db, "users"), orderBy("email"), startAt(queryText), endAt(`${queryText}\uf8ff`), limit(6))),
          getDocs(query(collection(db, "users"), orderBy("displayName"), startAt(queryText), endAt(`${queryText}\uf8ff`), limit(6)))
        ]);

        const usersById = new Map();
        [...emailSnap.docs, ...displayNameSnap.docs].forEach((userDoc) => {
          usersById.set(userDoc.id, { id: userDoc.id, ...userDoc.data() });
        });

        userMatches = [...usersById.values()].slice(0, 6).map((entry) => ({
            type: "user",
            id: entry.id,
            title: entry.displayName || entry.username || entry.email || "User",
            subtitle: entry.email ? `@${String(entry.email).split("@")[0]}` : "Profile"
          }));
      } catch (err) {
        // Keep search resilient if user directory fetch fails.
      }

      if (!active) return;

      setGlobalSearchResults([...userMatches, ...communityMatches].slice(0, 12));
      setGlobalSearchOpen(true);
      setGlobalSearchLoading(false);
    };

    const timer = setTimeout(runSearch, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [globalSearchInput, communitiesCache]);

  const handleGlobalResultClick = (result) => {
    if (!result) return;
    if (result.type === "user") {
      router.push(`/profile/${result.id}`);
    } else if (result.type === "community") {
      router.push(`/communities/${result.id}`);
    }
    setGlobalSearchOpen(false);
    setGlobalSearchInput("");
  };

  const handleAssetResultClick = (result) => {
    if (!result?.symbol) return;
    setActiveTicker(result.symbol);
    setAssetSearchInput("");
    setAssetSearchOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (assetSearchRef.current && !assetSearchRef.current.contains(e.target)) {
        setAssetSearchOpen(false);
      }
      if (globalSearchRef.current && !globalSearchRef.current.contains(e.target)) {
        setGlobalSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setPaperAccount(null);
      setPaperTrades([]);
      setPaperOrders([]);
      setPositionQuotes({});
      return;
    }

    let accountUnsub = () => {};
    let tradesUnsub = () => {};
    let ordersUnsub = () => {};

    const startSubscriptions = async () => {
      try {
        await ensurePaperAccount();
      } catch (err) {
        // Do not block feed rendering if account bootstrap fails.
      }

      const accountRef = doc(db, "users", user.uid, "paperMeta", "account");
      accountUnsub = onSnapshot(accountRef, (snap) => {
        setPaperAccount(snap.exists() ? snap.data() : null);
      });

      const tradesQuery = query(
        collection(db, "users", user.uid, "paperTrades"),
        orderBy("createdAt", "desc")
      );
      tradesUnsub = onSnapshot(tradesQuery, (snapshot) => {
        setPaperTrades(snapshot.docs.map((tradeDoc) => ({ id: tradeDoc.id, ...tradeDoc.data() })));
      });

      const ordersQuery = query(
        collection(db, "users", user.uid, "paperOrders"),
        orderBy("createdAt", "desc")
      );
      ordersUnsub = onSnapshot(ordersQuery, (snapshot) => {
        setPaperOrders(snapshot.docs.map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() })));
      });
    };

    startSubscriptions();

    return () => {
      accountUnsub();
      tradesUnsub();
      ordersUnsub();
    };
  }, [user]);

  useEffect(() => {
    if (!user?.uid || !paperOrders.length) return;
    if (pendingOrderProcessingRef.current) return;
    const localNormalizedActiveTicker = String(activeTicker || "").toUpperCase();

    const latestTradePrices = {};
    for (const trade of paperTrades) {
      if (!trade?.symbol || latestTradePrices[trade.symbol]) continue;
      latestTradePrices[trade.symbol] = Number(trade.price || 0);
    }

    const symbolPrices = {
      ...watchlistQuotes,
      ...positionQuotes,
      ...latestTradePrices
    };
    if (activeTickerQuote?.c && localNormalizedActiveTicker) {
      symbolPrices[localNormalizedActiveTicker] = Number(activeTickerQuote.c || 0);
    }

    pendingOrderProcessingRef.current = true;
    const timer = setTimeout(async () => {
      try {
        await processPendingPaperOrders(symbolPrices);
      } finally {
        pendingOrderProcessingRef.current = false;
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [paperOrders, watchlistQuotes, positionQuotes, paperTrades, activeTickerQuote, activeTicker, user?.uid]);

  const latestTradePriceBySymbol = useMemo(() => {
    const map = {};
    for (const trade of paperTrades) {
      if (!trade?.symbol || map[trade.symbol]) continue;
      map[trade.symbol] = Number(trade.price || 0);
    }
    return map;
  }, [paperTrades]);

  useEffect(() => {
    const symbols = Object.keys(paperAccount?.positions || {}).filter(
      (symbol) => Number(paperAccount?.positions?.[symbol] || 0) > 0
    );

    if (!symbols.length) {
      setPositionQuotes({});
      return;
    }

    let active = true;
    const loadQuotes = async () => {
      const quoteEntries = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const res = await fetch(`/api/getQuote?symbol=${encodeURIComponent(symbol)}`);
            if (!res.ok) return [symbol, null];
            const data = await res.json();
            return [symbol, Number(data?.c || 0)];
          } catch (err) {
            return [symbol, null];
          }
        })
      );

      if (!active) return;
      setPositionQuotes(Object.fromEntries(quoteEntries));
    };

    loadQuotes();
    const intervalId = setInterval(loadQuotes, 60000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [paperAccount?.positions]);

  useEffect(() => {
    const symbols = watchlist.map((item) => item.symbol).filter(Boolean);
    if (!symbols.length) {
      setWatchlistQuotes({});
      return;
    }
    let active = true;
    const loadWatchlistQuotes = async () => {
      const entries = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const res = await fetch(`/api/getQuote?symbol=${encodeURIComponent(symbol)}`);
            if (!res.ok) return [symbol, null];
            const data = await res.json();
            return [symbol, data];
          } catch {
            return [symbol, null];
          }
        })
      );
      if (!active) return;
      setWatchlistQuotes(Object.fromEntries(entries.filter(([, v]) => v)));
    };
    loadWatchlistQuotes();
    const wqInterval = setInterval(loadWatchlistQuotes, 60000);
    return () => {
      active = false;
      clearInterval(wqInterval);
    };
  }, [watchlist]);

  useEffect(() => {
    const symbol = String(activeTicker || "").toUpperCase();
    if (!symbol) {
      setActiveTickerQuote(null);
      return;
    }

    setActiveTickerRangeMenuOpen(false);

    let active = true;

    const loadActiveTickerQuote = async () => {
      try {
        const res = await fetch(`/api/getQuote?symbol=${encodeURIComponent(symbol)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setActiveTickerQuote(data);
      } catch {
        // Keep non-blocking for feed resilience.
      }
    };

    loadActiveTickerQuote();
    const intervalId = setInterval(loadActiveTickerQuote, 60000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [activeTicker]);

  const activeTickerFirstTradeMs = useMemo(() => {
    const timestamps = paperTrades
      .filter((trade) => String(trade?.symbol || "").toUpperCase() === String(activeTicker || "").toUpperCase())
      .map((trade) => getTradeTimestampMs(trade))
      .filter(Boolean);
    return timestamps.length ? Math.min(...timestamps) : 0;
  }, [paperTrades, activeTicker]);

  useEffect(() => {
    const symbol = String(activeTicker || "").toUpperCase();
    if (!symbol) {
      setActiveTickerCandles([]);
      return;
    }

    let active = true;
    const request = getActiveTickerChartRequest(activeTickerChartRange, activeTickerFirstTradeMs);

    const loadCandles = async () => {
      setActiveTickerChartLoading(true);
      try {
        const res = await fetch(
          `/api/getCandles?symbol=${encodeURIComponent(symbol)}&resolution=${encodeURIComponent(request.resolution)}&from=${encodeURIComponent(request.from)}&to=${encodeURIComponent(request.to)}`
        );
        if (!res.ok) {
          if (active) setActiveTickerCandles([]);
          return;
        }
        const data = await res.json();
        if (!active) return;

        if (data?.s !== "ok" || !Array.isArray(data?.t) || !Array.isArray(data?.c)) {
          setActiveTickerCandles([]);
          return;
        }

        const candles = data.t.map((timestampSec, index) => ({
          ts: Number(timestampSec || 0) * 1000,
          close: Number(data.c?.[index] || 0),
          open: Number(data.o?.[index] || 0),
          high: Number(data.h?.[index] || 0),
          low: Number(data.l?.[index] || 0),
          volume: Number(data.v?.[index] || 0)
        })).filter((point) => point.ts && point.close > 0);

        setActiveTickerCandles(candles);
      } catch {
        if (active) setActiveTickerCandles([]);
      }
      if (active) setActiveTickerChartLoading(false);
    };

    loadCandles();
    const intervalId = setInterval(loadCandles, 60000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [activeTicker, activeTickerChartRange, activeTickerFirstTradeMs]);

  useEffect(() => {
    const symbol = String(activeTicker || "").toUpperCase();
    if (!symbol) {
      setOptionChainData(null);
      setOptionChainError("");
      setSelectedOptionExpiration("");
      return;
    }

    let active = true;
    const loadOptionChain = async () => {
      setOptionChainLoading(true);
      setOptionChainError("");
      try {
        const params = new URLSearchParams({ symbol });
        if (selectedOptionExpiration) params.set("date", selectedOptionExpiration);
        const res = await fetch(`/api/getOptionChain?${params.toString()}`);
        const data = await res.json();
        if (!active) return;

        if (!res.ok) {
          setOptionChainData(null);
          setOptionChainError(data?.error || "Failed to load option chain.");
          return;
        }

        setOptionChainData(data);
        if (!selectedOptionExpiration && Array.isArray(data?.expirationDates) && data.expirationDates.length) {
          setSelectedOptionExpiration(String(data.expirationDates[0]));
        }
      } catch {
        if (!active) return;
        setOptionChainData(null);
        setOptionChainError("Failed to load option chain.");
      } finally {
        if (active) setOptionChainLoading(false);
      }
    };

    loadOptionChain();
    return () => {
      active = false;
    };
  }, [activeTicker, selectedOptionExpiration]);

  const paperCash = Number(paperAccount?.cashBalance ?? STARTING_PAPER_CASH);
  const paperPositions = paperAccount?.positions || {};
  const paperOptionPositions = paperAccount?.optionPositions || {};
  const paperCostBasis = paperAccount?.positionCostBasis || {};
  const paperOptionCostBasis = paperAccount?.optionPositionCostBasis || {};
  const openPaperPositions = Object.entries(paperPositions).filter(([, qty]) => Number(qty || 0) > 0);
  const paperPositionCount = openPaperPositions.length;
  const paperPositionValue = Object.entries(paperPositions).reduce((acc, [symbol, qty]) => {
    const numericQty = Number(qty || 0);
    const quote = Number(positionQuotes[symbol]);
    const fallbackPrice = Number(latestTradePriceBySymbol[symbol] || 0);
    const averageCost = Number(paperCostBasis[symbol] || 0);
    const effectivePrice = Number.isFinite(quote) && quote > 0 ? quote : fallbackPrice || averageCost;
    return acc + (numericQty * effectivePrice);
  }, 0);
  const paperEquity = paperCash + paperPositionValue;
  const paperPnl = paperEquity - STARTING_PAPER_CASH;
  const paperHoldings = useMemo(() => {
    return Object.entries(paperPositions)
      .map(([symbol, qty]) => {
        const quantity = Number(qty || 0);
        if (!symbol || quantity <= 0) return null;

        const averageCost = Number(paperCostBasis[symbol] || 0);
        const quote = Number(positionQuotes[symbol]);
        const fallbackPrice = Number(latestTradePriceBySymbol[symbol] || 0);
        const currentPrice = Number.isFinite(quote) && quote > 0 ? quote : fallbackPrice || averageCost;
        const marketValue = quantity * currentPrice;
        const costValue = quantity * averageCost;
        const unrealizedPnl = marketValue - costValue;

        return {
          symbol,
          quantity,
          averageCost,
          currentPrice,
          marketValue,
          unrealizedPnl,
          unrealizedPnlPct: costValue > 0 ? (unrealizedPnl / costValue) * 100 : 0
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.marketValue - a.marketValue || a.symbol.localeCompare(b.symbol));
  }, [paperPositions, paperCostBasis, positionQuotes, latestTradePriceBySymbol]);

  const paperTradesChronological = useMemo(
    () => [...paperTrades].sort((a, b) => getTradeTimestampMs(a) - getTradeTimestampMs(b)),
    [paperTrades]
  );

  const paperEquityTimeline = useMemo(() => {
    let runningCash = STARTING_PAPER_CASH;
    const runningPositions = {};
    const runningAvgCost = {};
    const runningLastPrice = {};
    const runningContractMultiplier = {};
    const points = [];

    for (const trade of paperTradesChronological) {
      const symbol = String(trade?.symbol || "").toUpperCase();
      const side = String(trade?.side || "").toLowerCase();
      const quantity = Math.max(0, Number(trade?.quantity || 0));
      const price = Math.max(0, Number(trade?.price || 0));
      const multiplier = Math.max(1, Number(trade?.contractMultiplier || 1));
      const timestampMs = getTradeTimestampMs(trade);

      if (!symbol || !quantity || !price || !timestampMs) continue;

      const existingQty = Number(runningPositions[symbol] || 0);
      const existingAvgCost = Number(runningAvgCost[symbol] || 0);

      if (side === "buy") {
        runningCash -= quantity * price * multiplier;
        const nextQty = existingQty + quantity;
        runningPositions[symbol] = nextQty;
        runningAvgCost[symbol] = nextQty > 0
          ? ((existingQty * existingAvgCost) + (quantity * price)) / nextQty
          : price;
      } else if (side === "sell") {
        const soldQty = Math.min(quantity, existingQty);
        if (!soldQty) continue;
        runningCash += soldQty * price * multiplier;
        const nextQty = existingQty - soldQty;
        if (nextQty <= 0) {
          delete runningPositions[symbol];
          delete runningAvgCost[symbol];
          delete runningContractMultiplier[symbol];
        } else {
          runningPositions[symbol] = nextQty;
        }
      } else {
        continue;
      }

      runningLastPrice[symbol] = price;
      runningContractMultiplier[symbol] = multiplier;

      const markValue = Object.entries(runningPositions).reduce((acc, [rowSymbol, rowQty]) => {
        const markPrice = Number(runningLastPrice[rowSymbol] || runningAvgCost[rowSymbol] || 0);
        const rowMultiplier = Number(runningContractMultiplier[rowSymbol] || 1);
        return acc + (Number(rowQty || 0) * markPrice * rowMultiplier);
      }, 0);

      points.push({ ts: timestampMs, equity: runningCash + markValue });
    }

    const nowTs = Date.now();
    if (!points.length) {
      return [{ ts: nowTs, equity: paperEquity }];
    }

    const lastPoint = points[points.length - 1];
    if (Math.abs(lastPoint.equity - paperEquity) > 0.01 || nowTs - lastPoint.ts > 60000) {
      points.push({ ts: nowTs, equity: paperEquity });
    }

    return points;
  }, [paperTradesChronological, paperEquity]);

  const now = new Date();
  const periodStartMs = {
    day: getStartOfLocalDay(now).getTime(),
    week: getStartOfLocalWeek(now).getTime(),
    mtd: getStartOfLocalMonth(now).getTime(),
    ytd: getStartOfLocalYear(now).getTime(),
    ltd: 0
  };

  const getEquityAtTime = (targetMs) => {
    let baseline = STARTING_PAPER_CASH;
    for (const point of paperEquityTimeline) {
      if (point.ts <= targetMs) baseline = point.equity;
      else break;
    }
    return baseline;
  };

  const pnlByRange = {
    day: paperEquity - getEquityAtTime(periodStartMs.day),
    week: paperEquity - getEquityAtTime(periodStartMs.week),
    mtd: paperEquity - getEquityAtTime(periodStartMs.mtd),
    ytd: paperEquity - getEquityAtTime(periodStartMs.ytd),
    ltd: paperPnl
  };

  const baseEquityByRange = {
    day: getEquityAtTime(periodStartMs.day),
    week: getEquityAtTime(periodStartMs.week),
    mtd: getEquityAtTime(periodStartMs.mtd),
    ytd: getEquityAtTime(periodStartMs.ytd),
    ltd: STARTING_PAPER_CASH
  };

  const pnlPctByRange = {
    day: baseEquityByRange.day ? (pnlByRange.day / baseEquityByRange.day) * 100 : 0,
    week: baseEquityByRange.week ? (pnlByRange.week / baseEquityByRange.week) * 100 : 0,
    mtd: baseEquityByRange.mtd ? (pnlByRange.mtd / baseEquityByRange.mtd) * 100 : 0,
    ytd: baseEquityByRange.ytd ? (pnlByRange.ytd / baseEquityByRange.ytd) * 100 : 0,
    ltd: baseEquityByRange.ltd ? (pnlByRange.ltd / baseEquityByRange.ltd) * 100 : 0
  };

  const selectedRangePnl = Number(pnlByRange[pnlChartRange] || 0);
  const selectedRangePct = Number(pnlPctByRange[pnlChartRange] || 0);

  const selectedChartStart = pnlChartRange === "ltd"
    ? (paperEquityTimeline[0]?.ts || Date.now())
    : periodStartMs[pnlChartRange];

  const chartPoints = (() => {
    const filtered = paperEquityTimeline.filter((point) => point.ts >= selectedChartStart);
    if (filtered.length) return filtered;
    return [
      { ts: selectedChartStart, equity: getEquityAtTime(selectedChartStart) },
      { ts: Date.now(), equity: paperEquity }
    ];
  })();

  const chartMin = Math.min(...chartPoints.map((point) => point.equity));
  const chartMax = Math.max(...chartPoints.map((point) => point.equity));
  const chartRange = chartMax - chartMin || 1;
  const chartStartTs = chartPoints[0]?.ts || Date.now();
  const chartEndTs = chartPoints[chartPoints.length - 1]?.ts || chartStartTs + 1;
  const chartSpan = chartEndTs - chartStartTs || 1;

  const chartPath = chartPoints
    .map((point, index) => {
      const x = (index === 0 && chartPoints.length === 1)
        ? 0
        : ((point.ts - chartStartTs) / chartSpan) * 100;
      const y = 100 - (((point.equity - chartMin) / chartRange) * 100);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  const sixtyDaysAgoMs = Date.now() - (60 * 24 * 60 * 60 * 1000);
  const normalizedActiveTicker = String(activeTicker || "").toUpperCase();
  const activeTickerPrice = Number(
    activeTickerQuote?.c ||
    positionQuotes[normalizedActiveTicker] ||
    latestTradePriceBySymbol[normalizedActiveTicker] ||
    0
  );
  const activeTickerPrevClose = Number(activeTickerQuote?.pc || 0);
  const activeTickerChange = activeTickerPrice > 0 && activeTickerPrevClose > 0
    ? activeTickerPrice - activeTickerPrevClose
    : 0;
  const activeTickerChangePct = activeTickerPrice > 0 && activeTickerPrevClose > 0
    ? (activeTickerChange / activeTickerPrevClose) * 100
    : 0;
  const activeTickerChartPoints = activeTickerCandles.length
    ? activeTickerCandles.map((candle) => ({ ts: candle.ts, price: candle.close }))
    : (activeTickerPrice > 0 ? [{ ts: Date.now(), price: activeTickerPrice }] : []);
  const activeTickerChartMin = activeTickerChartPoints.length
    ? Math.min(...activeTickerChartPoints.map((point) => point.price))
    : 0;
  const activeTickerChartMax = activeTickerChartPoints.length
    ? Math.max(...activeTickerChartPoints.map((point) => point.price))
    : 0;
  const activeTickerPriceRange = (activeTickerChartMax - activeTickerChartMin) || 1;
  const activeTickerChartStartTs = activeTickerChartPoints[0]?.ts || Date.now();
  const activeTickerChartEndTs = activeTickerChartPoints[activeTickerChartPoints.length - 1]?.ts || activeTickerChartStartTs + 1;
  const activeTickerChartSpan = (activeTickerChartEndTs - activeTickerChartStartTs) || 1;
  const activeTickerChartPath = activeTickerChartPoints
    .map((point, index) => {
      const x = (index === 0 && activeTickerChartPoints.length === 1)
        ? 0
        : ((point.ts - activeTickerChartStartTs) / activeTickerChartSpan) * 100;
      const y = 100 - (((point.price - activeTickerChartMin) / activeTickerPriceRange) * 100);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const activeTickerChartStartLabel = formatActiveTickerAxisLabel(activeTickerChartStartTs, activeTickerChartRange);
  const activeTickerChartEndLabel = formatActiveTickerAxisLabel(activeTickerChartEndTs, activeTickerChartRange);
  const nearestCallContracts = selectNearestContracts(optionChainData?.calls || [], activeTickerPrice, 6);
  const nearestPutContracts = selectNearestContracts(optionChainData?.puts || [], activeTickerPrice, 6);
  const optionContractsBySymbol = useMemo(() => {
    const allContracts = [
      ...(optionChainData?.calls || []),
      ...(optionChainData?.puts || [])
    ];
    const entries = allContracts
      .filter((contract) => contract?.contractSymbol)
      .map((contract) => [String(contract.contractSymbol).toUpperCase(), contract]);
    return Object.fromEntries(entries);
  }, [optionChainData]);

  const latestOptionTradeMetaBySymbol = useMemo(() => {
    const map = {};
    for (const trade of paperTrades) {
      if (String(trade?.assetType || "stock") !== "option") continue;
      const symbol = String(trade?.symbol || "").toUpperCase();
      if (!symbol) continue;
      map[symbol] = trade;
    }
    return map;
  }, [paperTrades]);

  const openOptionContractsForActiveTicker = useMemo(() => {
    return Object.entries(paperOptionPositions)
      .map(([contractSymbol, rawQty]) => {
        const symbol = String(contractSymbol || "").toUpperCase();
        const quantity = Number(rawQty || 0);
        if (!symbol || quantity <= 0) return null;

        const meta = latestOptionTradeMetaBySymbol[symbol] || null;
        const inferredUnderlying = String(meta?.underlyingSymbol || "").toUpperCase();
        const matchesTicker = inferredUnderlying
          ? inferredUnderlying === normalizedActiveTicker
          : symbol.startsWith(normalizedActiveTicker);
        if (!matchesTicker) return null;

        const avgContractPrice = Number(paperOptionCostBasis[symbol] || 0);
        const multiplier = Math.max(1, Number(meta?.contractMultiplier || 100));
        const liveContract = optionContractsBySymbol[symbol] || null;
        const markPrice = Number(
          liveContract?.lastPrice ||
          liveContract?.bid ||
          liveContract?.ask ||
          avgContractPrice ||
          0
        );
        const costValue = quantity * avgContractPrice * multiplier;
        const marketValue = quantity * markPrice * multiplier;
        const unrealizedPnl = marketValue - costValue;
        const unrealizedPct = costValue > 0 ? (unrealizedPnl / costValue) * 100 : 0;

        return {
          symbol,
          quantity,
          avgContractPrice,
          multiplier,
          markPrice,
          costValue,
          marketValue,
          unrealizedPnl,
          unrealizedPct,
          optionType: String(meta?.optionType || "call").toUpperCase(),
          strike: Number(meta?.strike || liveContract?.strike || 0),
          expiration: meta?.expiration?.toDate?.() || (meta?.expiration ? new Date(meta.expiration) : null),
          hasLiveMark: Boolean(liveContract)
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.marketValue - a.marketValue || a.symbol.localeCompare(b.symbol));
  }, [paperOptionPositions, latestOptionTradeMetaBySymbol, normalizedActiveTicker, paperOptionCostBasis, optionContractsBySymbol]);
  const paperTradesWithin60Days = paperTrades.filter((trade) => {
    const tradeDate = trade.createdAt?.toDate?.();
    if (!tradeDate) return true;
    return tradeDate.getTime() >= sixtyDaysAgoMs;
  });
  const paperTradesForActiveTicker = paperTradesWithin60Days.filter((trade) => {
    const tradeSymbol = String(trade?.symbol || "").toUpperCase();
    const underlyingSymbol = String(trade?.underlyingSymbol || "").toUpperCase();
    return tradeSymbol === normalizedActiveTicker || underlyingSymbol === normalizedActiveTicker;
  });
  const hasMoreThanTenPaperTrades = paperTradesForActiveTicker.length > 10;
  const visiblePaperTrades = showAllPaperTrades
    ? paperTradesForActiveTicker
    : paperTradesForActiveTicker.slice(0, 10);

  const handleProfileImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileUploadFile(file);
    setProfilePhoto(URL.createObjectURL(file));
  };

  const handleSelectDefaultAvatar = (avatarUrl) => {
    setProfileUploadFile(null);
    setProfilePhoto(avatarUrl);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    try {
      let finalPhotoUrl = profilePhoto;
      if (profileUploadFile) {
        const storage = getStorage();
        const imgRef = storageRef(storage, `profile-images/${user.uid}-${Date.now()}-${profileUploadFile.name}`);
        await uploadBytes(imgRef, profileUploadFile);
        finalPhotoUrl = await getDownloadURL(imgRef);
      }
      await updateProfile(auth.currentUser, {
        photoURL: finalPhotoUrl
      });
      await setDoc(doc(db, "users", user.uid), {
        photoURL: finalPhotoUrl
      }, { merge: true });
      setUser((prev) => (prev ? { ...prev, photoURL: finalPhotoUrl } : prev));
      setProfileUploadFile(null);
      setProfileImagePickerOpen(false);
      setModal("");
    } catch (err) {
      // Keep non-blocking to preserve existing feed behavior.
    }
    setProfileSaving(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setModal("");
    } catch (err) {
      // Ignore logout UI errors.
    }
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-center px-4 py-16">
          <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] px-6 py-5 text-sm font-black text-slate-500 dark:text-slate-400">
            Loading feed...
          </div>
        </div>
      </div>
    );
  }

  return (
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
              <button
                id="ticker-add-btn"
                className="px-4 py-3 rounded-2xl bg-brogreen text-black dark:text-brogreen font-black text-xs disabled:opacity-60"
                aria-label="Add to watchlist"
                onClick={() => handleAddToSharedWatchlist(activeTicker, activeTicker)}
                disabled={!user || watchlistSaving}
              >
                Add Watchlist
              </button>
              <button id="ticker-paper-buy" className="px-4 py-3 rounded-2xl bg-green-600 text-white font-black text-xs" aria-label="Paper buy">Paper Buy</button>
              <button id="ticker-paper-sell" className="px-4 py-3 rounded-2xl bg-red-500 text-white font-black text-xs" aria-label="Paper sell">Paper Sell</button>
            </div>
            <div id="company-news" className="mt-6"></div>
            <div id="ticker-loading" className="hidden absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center z-10"><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-brogreen border-4"></div></div>
            <p className="text-[11px] text-slate-500 mt-4">Prototype market data. Connect Polygon, Finnhub, IEX Cloud, Twelve Data, or CoinGecko for live pricing.</p>
          </div>
        </div>

        {/* Post Modal */}
        <div id="post-modal" className="fixed inset-0 bg-black/70 items-center justify-center z-50 px-4" style={{ display: modal === "post" ? "flex" : "none" }}>
          <div className="panel rounded-3xl p-6 w-full max-w-2xl relative shadow-2xl max-h-[92vh] overflow-y-auto bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
            <div className="flex items-start justify-between gap-4 mb-6 pb-5 border-b border-slate-200 dark:border-white/10">
              <div className="min-w-0">
                <p className="text-xs font-black tracking-[0.28em] uppercase text-brogreen mb-2">Post</p>
                <h2 className="text-2xl font-black leading-tight text-slate-900 dark:text-slate-100">Create Post</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Write your post, choose where it belongs, and add any optional attachments.</p>
              </div>
              <button
                id="close-post-modal"
                className="shrink-0 w-10 h-10 rounded-full soft-card text-2xl leading-none text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition"
                aria-label="Close post modal"
                title="Close"
                tabIndex={0}
                onClick={handleClosePostModal}
              >
                ×
              </button>
            </div>
            <form id="post-form" className="space-y-5" onSubmit={handlePostSubmit}>
              <section className="space-y-3">
                <div>
                  <label htmlFor="post-content" className="block text-sm font-black text-slate-900 dark:text-slate-100 mb-2">Content</label>
                  <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 space-y-4">
                    <textarea
                      id="post-content"
                      maxLength={700}
                      placeholder="Post your trade thesis, interview intel, license question, rich-list take, or desk rumor..."
                      className="w-full bg-transparent outline-none min-h-[160px] font-semibold resize-y text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      value={postContent}
                      onChange={handlePostContent}
                    ></textarea>
                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 dark:border-white/10 pt-4">
                      {postCategoryOptions.map((category) => {
                        const isSelected = postCategories.includes(category);
                        const isDisabled = !isSelected && postCategories.length >= 3;
                        return (
                          <button
                            key={category}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => handlePostCategory(category)}
                            className={
                              "px-4 py-2 rounded-full border text-sm font-black transition " +
                              (isSelected
                                ? "bg-brogreen border-brogreen text-black shadow-lg shadow-lime-500/20"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-brogreen/60") +
                              (isDisabled ? " opacity-45 cursor-not-allowed" : "")
                            }
                            disabled={isDisabled}
                          >
                            {category}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                      <span>{postCategories.length}/3 categories selected</span>
                      <div>
                        <span id="char-count" className="font-black text-slate-800 dark:text-slate-100">{postCharCount}</span>/700 characters
                      </div>
                    </div>
                  </div>
                  {isNewsCategorySelected && (
                    <div className="mt-3 space-y-2">
                      <label className="block text-sm font-black text-slate-900 dark:text-slate-100">News Category</label>
                      <div id="post-news-category" className="flex flex-wrap gap-2">
                        {postNewsCategoryOptions.map((category) => {
                          const isSelected = postNewsCategory === category;
                          return (
                            <button
                              key={category}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => handlePostNewsCategory(category)}
                              className={
                                "px-4 py-2 rounded-full border text-sm font-black transition " +
                                (isSelected
                                  ? "bg-brogreen border-brogreen text-black shadow-lg shadow-lime-500/20"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-brogreen/60")
                              }
                            >
                              {category}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3 pt-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Attachments & Settings</h3>
                <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4 space-y-3">
                  <label className="inline-flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
                    <input
                      type="checkbox"
                      className="accent-lime-400"
                      checked={postHasPoll}
                      onChange={(e) => setPostHasPoll(e.target.checked)}
                    />
                    Add Poll
                  </label>
                  {postHasPoll ? (
                    <div className="space-y-2">
                      <input
                        className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100"
                        placeholder="Poll question"
                        value={postPollQuestion}
                        onChange={(e) => setPostPollQuestion(e.target.value)}
                        maxLength={180}
                      />
                      <input
                        className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100"
                        placeholder="Option 1"
                        value={postPollOptionA}
                        onChange={(e) => setPostPollOptionA(e.target.value)}
                        maxLength={80}
                      />
                      <input
                        className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100"
                        placeholder="Option 2"
                        value={postPollOptionB}
                        onChange={(e) => setPostPollOptionB(e.target.value)}
                        maxLength={80}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl soft-card font-black cursor-pointer text-slate-900 dark:text-slate-100">
                    <input id="allow-comments" type="checkbox" className="accent-lime-400" checked={allowComments} onChange={handleAllowComments} />
                    Allow comments
                  </label>
                </div>
              </section>

              <section className="space-y-4 pt-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Destination</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-black text-slate-900 dark:text-slate-100">Post To</label>
                    <div id="post-destination" className="space-y-2">
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-lime-400"
                          checked={postDestination === "timeline"}
                          onChange={() => handlePostDestination("timeline")}
                        />
                        <span className="text-sm font-black text-slate-900 dark:text-slate-100">My Timeline</span>
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-lime-400"
                          checked={postDestination === "community"}
                          onChange={() => handlePostDestination("community")}
                        />
                        <span className="text-sm font-black text-slate-900 dark:text-slate-100">Community</span>
                      </label>
                    </div>
                    {postDestination === "community" && (
                      <div ref={communityMenuRef} className="relative">
                        <button
                          type="button"
                          id="community-select"
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-900 dark:text-slate-100"
                          onClick={() => setCommunityMenuOpen((open) => !open)}
                          aria-haspopup="listbox"
                          aria-expanded={communityMenuOpen}
                        >
                          <span className="flex items-center gap-3 min-w-0">
                            {selectedJoinedCommunity ? (
                              <>
                                  <img
                                    src={selectedJoinedCommunity.avatar || getDeterministicDefaultAvatar(selectedJoinedCommunity.id || selectedJoinedCommunity.name)}
                                  alt={selectedJoinedCommunity.name}
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-white/10"
                                />
                                <span className="truncate">{selectedJoinedCommunity.name}</span>
                              </>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">Select Community</span>
                            )}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500">▾</span>
                        </button>
                        {communityMenuOpen && joinedCommunities.length > 0 && (
                          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                            <div role="listbox" aria-label="Select community" className="max-h-64 overflow-y-auto py-2">
                              {joinedCommunities.map((community) => {
                                const isSelected = postCommunityId === community.id;
                                return (
                                  <button
                                    key={community.id}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5"
                                    onClick={() => handleSelectPostCommunity(community)}
                                  >
                                    <span className="flex items-center gap-3 min-w-0">
                                        <img
                                          src={community.avatar || getDeterministicDefaultAvatar(community.id || community.name)}
                                        alt={community.name}
                                        className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-white/10"
                                      />
                                      <span className="truncate font-black text-slate-900 dark:text-slate-100">{community.name}</span>
                                    </span>
                                    <span className="w-5 flex justify-end" aria-hidden="true">
                                      {isSelected ? <span className="text-brogreen font-black">✓</span> : null}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {postDestination === "community" && joinedCommunities.length === 0 && (
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Join a community before posting there.</p>
                    )}
                  </div>
                </div>
              </section>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-200 dark:border-white/10">
                <div>
                  {postError && <div id="post-error" className="text-red-500 text-sm font-semibold">{postError}</div>}
                  {postSuccess && <div className="text-green-600 dark:text-green-400 text-sm font-semibold">{postSuccess}</div>}
                </div>
                <div className="flex items-center gap-3 justify-end">
                  <button
                    type="button"
                    className="px-6 py-3 rounded-2xl soft-card font-black text-slate-900 dark:text-slate-100"
                    onClick={handleClosePostModal}
                    disabled={postLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-2xl bg-brogreen text-black font-black shadow-lg shadow-lime-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={postLoading || !canPost}
                  >
                    {postLoading ? "Posting..." : "Post"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Profile Modal */}
        <div id="profile-modal" className="fixed inset-0 bg-black/70 items-center justify-center z-50 px-4" style={{ display: modal === "profile" ? "flex" : "none" }}>
          <div className="panel rounded-3xl p-6 w-full max-w-md relative shadow-2xl bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
            <button id="close-profile" className="absolute top-4 right-4 w-9 h-9 rounded-full soft-card text-2xl leading-none" aria-label="Close profile modal" title="Close" tabIndex={0} onClick={() => setModal("")}>×</button>
            <h2 className="text-2xl font-black mb-5">Your Profile</h2>
            <div className="flex flex-col items-center gap-4">
              <button id="profile-photo-picker-btn" type="button" className="relative group" onClick={() => setProfileImagePickerOpen((open) => !open)}>
                <img id="profile-photo" src={profilePhoto || "https://ui-avatars.com/api/?name=User&background=050816&color=B6FF22"} alt="Profile Photo" className="w-24 h-24 rounded-full object-cover border-4 border-brogreen bg-slate-200" />
                <span className="absolute inset-0 rounded-full bg-black/55 text-white text-xs font-black hidden group-hover:grid place-items-center">Change</span>
              </button>
              <div id="profile-username-display" className="font-black text-lg text-center">{user?.displayName || user?.email || "User"}</div>
              <div id="profile-image-picker" className={(profileImagePickerOpen ? "block" : "hidden") + " w-full rounded-3xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10"}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-black">Choose Profile Image</h3>
                    <p className="text-xs text-slate-500">Upload your own or pick a default avatar.</p>
                  </div>
                  <button id="close-profile-image-picker" type="button" className="w-8 h-8 rounded-full soft-card font-black" onClick={() => setProfileImagePickerOpen(false)}>×</button>
                </div>
                <label className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-brogreen text-black dark:text-brogreen font-black cursor-pointer">
                  Upload Image
                  <input type="file" id="profile-image-upload" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />
                </label>
                <div id="default-avatar-grid" className="grid grid-cols-3 gap-3">
                  {defaultAvatarOptions.map((avatarUrl) => (
                    <button
                      key={avatarUrl}
                      type="button"
                      onClick={() => handleSelectDefaultAvatar(avatarUrl)}
                      className={
                        "rounded-2xl border-2 p-0.5 transition " +
                        (profilePhoto === avatarUrl ? "border-brogreen" : "border-transparent hover:border-slate-300")
                      }
                      aria-label="Select default avatar"
                    >
                      <img src={avatarUrl} alt="Default avatar" className="w-full aspect-square rounded-xl object-cover" />
                    </button>
                  ))}
                </div>
              </div>
              <textarea id="profile-bio" className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 outline-none font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" rows={3} placeholder="Add a short finance-bro bio..." value={profileBio} onChange={(e) => setProfileBio(e.target.value)}></textarea>
              <button id="save-profile" className="w-full px-6 py-3 rounded-2xl bg-brogreen text-black dark:text-brogreen font-black" onClick={handleSaveProfile} disabled={profileSaving}>{profileSaving ? "Saving..." : "Save Profile"}</button>
              <button id="logout-btn" className="w-full px-4 py-3 rounded-2xl bg-red-600 text-white font-black" onClick={handleLogout}>Logout</button>
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
                <p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-500">Or pick a default avatar</p>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {defaultAvatarOptions.map((avatarUrl) => (
                    <button
                      key={avatarUrl}
                      type="button"
                      onClick={() => handleSelectCommunityDefaultAvatar(avatarUrl)}
                      className={
                        "rounded-xl border-2 p-0.5 " +
                        (communityImagePreview === avatarUrl ? "border-brogreen" : "border-transparent hover:border-slate-300")
                      }
                      aria-label="Select default avatar"
                      disabled={communityLoading}
                    >
                      <img src={avatarUrl} alt="Default avatar" className="h-10 w-10 rounded-lg object-cover" />
                    </button>
                  ))}
                </div>
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

        <div className="min-h-screen xl:grid xl:grid-cols-[300px_minmax(520px,760px)_380px] xl:justify-center bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
          {/* Left X-style Rail */}
          <aside className="hidden xl:block min-h-screen sticky top-0 border-r border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
            <div className="h-screen overflow-y-auto scrollbar-hide px-5 py-4 flex flex-col bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
              <Link href="/feed" className="flex items-center gap-3 mb-6" aria-label="Go to home feed">
                <img src="mainlogo.png" alt="BroLiquidity Logo" className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816]" />
                <div>
                  <h1 className="font-black text-xl leading-tight text-slate-900 dark:text-slate-100">BroLiquidity</h1>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Trades • Licenses • Jobs</p>
                </div>
              </Link>
              <nav className="space-y-2 text-xl font-bold text-slate-900 dark:text-slate-100" role="navigation" aria-label="Sidebar navigation">
                <Link href="/feed" legacyBehavior>
                  <a className="left-nav active-nav w-full rounded-2xl px-4 py-3 flex items-center gap-4 text-left bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-slate-100" aria-label="Home" title="Home" tabIndex={0}>
                    <span>Home</span>
                  </a>
                </Link>
                <Link href="/bookmarks" legacyBehavior>
                  <a className="left-nav w-full rounded-2xl px-4 py-3 flex items-center gap-4 text-left hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-slate-100" aria-label="Saved posts" title="Saved posts" tabIndex={0}>
                    <span>Saved posts</span>
                  </a>
                </Link>
                <Link href="/dm" legacyBehavior>
                  <a className="left-nav w-full rounded-2xl px-4 py-3 flex items-center gap-4 text-left hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-slate-100" aria-label="Direct Messages" title="Direct Messages" tabIndex={0}>
                    <span>Direct Messages</span>
                  </a>
                </Link>
                <Link href="/notifications" legacyBehavior>
                  <a className="left-nav w-full rounded-2xl px-4 py-3 flex items-center gap-4 text-left hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-slate-100" aria-label="Notifications" title="Notifications" tabIndex={0}>
                    <span>Notifications</span>
                  </a>
                </Link>
                <Link href="/explore" legacyBehavior>
                  <a className="left-nav w-full rounded-2xl px-4 py-3 flex items-center gap-4 text-left hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-slate-100" aria-label="Stock Explorer" title="Stock Explorer" tabIndex={0}>
                    <span>Stock Explorer</span>
                  </a>
                </Link>
              </nav>
              <div className="mt-6 space-y-4">
                <section className="panel rounded-3xl p-4 bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-black text-slate-900 dark:text-slate-100">Communities</h2>
                    <Link href="/communities/create" id="left-create-community" className="px-4 py-2 rounded-2xl bg-brogreen text-black dark:text-brogreen font-black text-base shadow hover:bg-lime-300 dark:hover:bg-lime-900 transition-all" aria-label="Create new community" title="Create new community" tabIndex={0}>+ New</Link>
                  </div>
                  <div id="left-communities" className="space-y-2">
                    {communitiesCache.map(c => (
                      <button
                        key={c.id}
                        className={
                          "w-full flex items-center gap-3 px-3 py-2 rounded-xl soft-card font-black cursor-pointer text-left" +
                          (selectedFilter === c.id ? " bg-brogreen/10 border border-brogreen" : " hover:bg-brogreen/10")
                        }
                        onClick={() => {
                          setSelectedFilter(c.id);
                          router.push(`/communities/${c.id}`);
                        }}
                        tabIndex={0}
                        aria-label={c.name}
                        title={c.name}
                      >
                        <img src={c.avatar} alt={c.name} className="w-8 h-8 rounded-full object-cover" onError={e => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(c.name) + '&background=050816&color=B6FF22'; }} />
                        <span className="flex-1 truncate text-slate-900 dark:text-slate-100">{c.name}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{c.members} members</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              <div className="mt-auto"></div>
            </div>
          </aside>

          {/* Mobile Header */}
          <header className="xl:hidden sticky top-0 z-40 border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#050816]/90 backdrop-blur-xl text-slate-900 dark:text-slate-100">
            <nav className="px-4 py-3 flex items-center justify-between gap-3">
              <button id="mobile-menu-btn" className="w-11 h-11 rounded-2xl soft-card grid place-items-center" aria-label="Open mobile menu" title="Open mobile menu">☰</button>
              <Link href="/feed" className="flex items-center gap-2" aria-label="Go to home feed">
                <img src="mainlogo.png" className="w-10 h-10 rounded-xl object-cover" alt="BroLiquidity" />
                <span className="font-black text-slate-900 dark:text-slate-100">BroLiquidity</span>
              </Link>
                  <button id="mobile-post-btn" className="px-4 py-2 rounded-2xl bg-brogreen text-black font-black" aria-label="Create a post" title="Create a post" onClick={() => setModal("post")}>Post</button>
            </nav>
          </header>

          {/* Center Feed */}
          <main className="min-h-screen border-r border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
            <div className="sticky top-0 z-30 bg-white/90 dark:bg-[#050816]/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/10">
              <div className="grid grid-cols-2 text-center font-black text-slate-900 dark:text-slate-100">
                <button
                  id="tab-for-you"
                  className={
                    "feed-tab py-4" + (feedTab === "for-you" ? " active-tab text-slate-900 dark:text-slate-100" : " text-slate-500 dark:text-slate-400")
                  }
                  onClick={() => setFeedTab("for-you")}
                >For you</button>
                <button
                  id="tab-following"
                  className={
                    "feed-tab py-4" + (feedTab === "following" ? " active-tab text-slate-900 dark:text-slate-100" : " text-slate-500 dark:text-slate-400")
                  }
                  onClick={() => setFeedTab("following")}
                >Following</button>
              </div>
            </div>
            <section className="border-b border-slate-200 dark:border-white/10 p-4">
              <div className="flex gap-3 text-slate-900 dark:text-slate-100">
                <img id="composer-profile-photo" src={profilePhoto || "https://ui-avatars.com/api/?name=BL&background=050816&color=B6FF22"} className="w-12 h-12 rounded-full object-cover" alt="Profile" />
                <div className="flex-1">
                  <button id="composer-open" className="w-full text-left text-xl text-slate-500 dark:text-slate-400 font-semibold py-2" onClick={() => setModal("post")}>What’s happening?</button>
                  {postSuccess && <div className="text-xs text-green-600 dark:text-green-400 font-bold mt-1">{postSuccess}</div>}
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-4 text-broblue text-lg"></div>
                    <button id="composer-post-btn" className="px-6 py-2 rounded-full bg-brogreen text-black font-black" onClick={() => setModal("post")}>Post</button>
                  </div>
                </div>
              </div>
            </section>
            <section>
              <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100">
                <div>
                  <h2 className="font-black text-lg text-slate-900 dark:text-slate-100">{feedTab === "following" ? "Following" : "For You"}</h2>
                  <p id="feed-context" className="text-xs text-slate-500 dark:text-slate-400">
                    {feedTab === "following"
                      ? "Posts from accounts you follow."
                      : selectedFilter === "home"
                        ? "Algorithm-ranked posts across your desks."
                        : (() => {
                            const comm = communitiesCache.find(c => c.id === selectedFilter);
                            return comm ? `${comm.name} desk feed.` : "Algorithm-ranked posts across your desks.";
                          })()
                    }
                  </p>
                  {activeTopic ? (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-full bg-brogreen/15 px-3 py-1 text-[11px] font-black text-brogreen">Topic Filter: {activeTopic}</span>
                      <button
                        type="button"
                        className="text-[11px] font-black text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        onClick={() => setActiveTopic("")}
                      >
                        Clear
                      </button>
                    </div>
                  ) : null}
                </div>
                <select
                  id="sort-posts"
                  className="px-3 py-2 rounded-full bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 text-sm font-bold outline-none text-slate-900 dark:text-slate-100"
                  value={sort}
                  onChange={e => setSort(e.target.value)}
                >
                    <option value="recommended">Recommended</option>
                    <option value="newest">Newest</option>
                  <option value="bullish">Most Uptrended</option>
                  <option value="bearish">Most Downtrended</option>
                  <option value="active">Most Active</option>
                </select>
              </div>
              <ul id="posts-list">
                {visiblePosts.map(post => {
                  const profileId = post.authorId || post.user?.uid;
                  const authorUid = post.authorId || post.user?.uid;
                  const comments = commentsByPost[post.id] || [];
                  const followedComment = comments
                    .slice()
                    .reverse()
                    .find((comment) => {
                      const commenterUid = comment.userId || comment.user?.uid;
                      if (commenterUid) return followingIds.includes(commenterUid);
                      const commenterName = comment.user?.name?.trim()?.toLowerCase();
                      if (!commenterName) return false;
                      return followingUsers.some((f) => f?.name?.trim()?.toLowerCase() === commenterName);
                    });
                  const showFollowingContext = feedTab === "following" && !followingIds.includes(authorUid) && Boolean(followedComment);
                  const postOwnerId = post.authorId || post.userId || post.user?.uid;
                  const canDeletePost = Boolean(user?.uid && postOwnerId === user.uid && typeof post.id !== "number");
                  return (
                  <li key={post.id} className="relative border-b border-slate-100 dark:border-white/10 px-4 py-6 flex gap-4 text-slate-900 dark:text-slate-100">
                    <div className="absolute right-3 top-3 flex items-center gap-2">
                      {canDeletePost && (
                        <button
                          className="text-lg font-black leading-none text-brogreen hover:opacity-80"
                          onClick={() => handleDeletePost(post)}
                          aria-label="Delete post"
                          title="Delete"
                        >
                          x
                        </button>
                      )}
                      <button
                        className="text-sm leading-none text-brogreen hover:opacity-80"
                        onClick={() => handleReportPost(post)}
                        aria-label="Flag post"
                        title="Flag"
                      >
                        🚩
                      </button>
                    </div>
                    {profileId ? (
                      <Link href={`/profile/${profileId}`} className="shrink-0">
                        {post.user && post.user.avatar ? (
                          <img src={post.user.avatar} alt={post.user.name || "User"} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">?</div>
                        )}
                      </Link>
                    ) : post.user && post.user.avatar ? (
                      <img src={post.user.avatar} alt={post.user.name || "User"} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">?</div>
                    )}
                    <div className="flex-1 min-w-0">
                      {showFollowingContext ? (
                        <div className="mb-1 text-xs font-black text-brogreen">
                          {(followedComment.user?.name || "A followed user")} commented on this post
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2 mb-1">
                        {profileId ? (
                          <Link href={`/profile/${profileId}`} className="font-black text-base truncate text-slate-900 dark:text-slate-100 hover:underline">
                            {post.user?.name || "User"}
                          </Link>
                        ) : (
                          <span className="font-black text-base truncate text-slate-900 dark:text-slate-100">{post.user?.name || "User"}</span>
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{post.user?.handle || "@user"}</span>
                        <span className="text-xs text-slate-400">· {post.time}</span>
                      </div>
                      <div className="mb-2 whitespace-pre-line text-slate-800 dark:text-slate-100">{post.content}</div>
                      {post.poll ? (
                        <div className="mb-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
                          <div className="text-sm font-black text-slate-900 dark:text-slate-100">{post.poll.question}</div>
                          <div className="mt-2 space-y-2">
                            {(post.poll.options || []).map((option) => (
                              <div key={option.id || option.label} className="rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                                <span>{option.label}</span>
                                <span className="ml-2 text-slate-500">({option.votes || 0} votes)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-6 text-slate-500 dark:text-slate-400 text-sm mt-2">
                        <button
                          className="flex items-center gap-1 comment-toggle"
                          data-id={post.id}
                          onClick={() =>
                            setExpandedComments(expandedComments.includes(post.id)
                              ? expandedComments.filter((id) => id !== post.id)
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
                      <div
                        id={`comments-${post.id}`}
                        className={
                          (expandedComments.includes(post.id) ? "block" : "hidden") +
                          " mt-4"
                        }
                      >
                        <div className="space-y-3 mb-3">
                          {(commentsByPost[post.id] || []).map((comment) => {
                            const replyKey = `${post.id}_${comment.id}`;
                            const replies = repliesByComment[replyKey] || [];
                            const isReplyOpen = activeReplyTarget === replyKey;
                            return (
                            <div key={comment.id} className="flex items-start gap-3">
                              {comment.user && comment.user.avatar ? (
                                <img src={comment.user.avatar} alt={comment.user.name || "User"} className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">?</div>
                              )}
                              <div className="flex-1">
                                <div className="font-black text-sm text-slate-900 dark:text-slate-100">{comment.user?.name || "User"}</div>
                                <div className="text-slate-700 dark:text-slate-200 text-sm">{comment.content}</div>
                                <div className="mt-1 flex items-center justify-between text-xs font-black">
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      className="text-brogreen hover:opacity-80"
                                      onClick={() => setActiveReplyTarget(isReplyOpen ? null : replyKey)}
                                    >
                                      Reply
                                    </button>
                                    <button
                                      type="button"
                                      className={
                                        "hover:opacity-80 " +
                                        ((Array.isArray(comment.likedBy) && user?.uid && comment.likedBy.includes(user.uid))
                                          ? "text-brogreen"
                                          : "text-slate-500 dark:text-slate-300")
                                      }
                                      onClick={() => handleToggleCommentLike(post, comment)}
                                    >
                                      Like {comment.likeCount || 0}
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    className="text-brogreen text-sm leading-none hover:opacity-80"
                                    onClick={() => handleReportComment(post, comment)}
                                    aria-label="Flag comment"
                                    title="Flag"
                                  >
                                    🚩
                                  </button>
                                </div>
                                {replies.length > 0 ? (
                                  <div className="mt-2 space-y-2">
                                    {replies.map((reply) => (
                                      <div key={reply.id} className="rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          {reply.user?.avatar ? (
                                            <img src={reply.user.avatar} alt={reply.user?.name || "User"} className="h-6 w-6 rounded-full object-cover" />
                                          ) : (
                                            <div className="h-6 w-6 rounded-full bg-slate-200" />
                                          )}
                                          <span className="text-xs font-black text-slate-900 dark:text-slate-100">{reply.user?.name || "User"}</span>
                                        </div>
                                        <div className="mt-1 text-xs text-slate-700 dark:text-slate-200">{reply.content}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                {isReplyOpen ? (
                                  <form
                                    className="mt-2 flex gap-2"
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      handleAddReply(post, comment, replyInputs[replyKey] || "");
                                    }}
                                  >
                                    <input
                                      className="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none text-sm text-slate-900 dark:text-slate-100"
                                      placeholder="Write a reply..."
                                      value={replyInputs[replyKey] || ""}
                                      onChange={(e) => setReplyInputs((prev) => ({ ...prev, [replyKey]: e.target.value }))}
                                    />
                                    <button type="submit" className="px-3 py-2 rounded-xl bg-brogreen text-black text-xs font-black">Reply</button>
                                  </form>
                                ) : null}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                        <form
                          className="flex gap-2 mt-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const val = (commentInputs[post.id] || "").trim();
                            handleAddComment(post, val);
                          }}
                        >
                          <input
                            className="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none text-sm text-slate-900 dark:text-slate-100"
                            placeholder="Add a comment..."
                            value={commentInputs[post.id] || ""}
                            onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                          />
                          <button
                            type="submit"
                            className="px-4 py-2 rounded-xl bg-brogreen text-black font-black text-sm"
                          >
                            Post
                          </button>
                        </form>
                      </div>
                    </div>
                  </li>
                )})}
              </ul>
              {loading && (
                <div id="loading" className="p-6 text-center text-slate-500 dark:text-slate-400 font-bold">Loading feed...</div>
              )}
            </section>
          </main>

          {/* Right Market Rail */}
          <aside className="hidden xl:block min-h-screen sticky top-0 bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
            <div className="h-screen overflow-y-auto scrollbar-hide px-5 py-4 space-y-4 bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
              <button id="right-profile-card" className="w-full flex items-center justify-between gap-3 p-3 rounded-3xl panel hover:bg-slate-50 dark:hover:bg-white/5 text-left bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100" aria-label="Open profile" title="Open profile" tabIndex={0} onClick={() => setModal("profile")}>
                <div className="flex items-center gap-3 min-w-0">
                  <img id="right-profile-photo" src={profilePhoto || "https://ui-avatars.com/api/?name=User&background=050816&color=B6FF22"} alt="Profile" className="w-12 h-12 rounded-full object-cover border-2 border-brogreen bg-slate-700" />
                  <div className="min-w-0">
                    <div id="right-profile-name" className="font-black truncate text-slate-900 dark:text-slate-100">{user?.displayName || "User"}</div>
                    <div id="right-profile-handle" className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email ? `@${user.email.split("@")[0]}` : "@bro"}</div>
                    <div className="flex gap-4 mt-1">
                      <Link href="/follow?tab=following" id="profile-following-link" className="cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300 hover:underline"><span id="profile-following-count">{followingIds.length}</span> Following</Link>
                      <Link href="/follow?tab=followers" id="profile-followers-link" className="cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300 hover:underline"><span id="profile-followers-count">{followersUsers.length}</span> Followers</Link>
                    </div>
                  </div>
                </div>
                <span className="text-slate-500 font-black">•••</span>
              </button>
              <div className="relative" ref={globalSearchRef}>
                <input
                  id="global-search"
                  className="w-full px-5 py-3 pl-11 rounded-full bg-slate-100 dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none text-sm font-semibold placeholder:text-slate-500 dark:placeholder:text-slate-400 text-slate-900 dark:text-slate-100"
                  placeholder="Search users or communities..."
                  aria-label="Global search"
                  title="Search users or communities"
                  tabIndex={0}
                  value={globalSearchInput}
                  onChange={(e) => setGlobalSearchInput(e.target.value)}
                  onFocus={() => {
                    if (globalSearchResults.length) setGlobalSearchOpen(true);
                  }}
                />
                <svg className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx={11} cy={11} r={8}></circle><path d="m21 21-4.3-4.3"></path></svg>
                <div id="global-search-results" className={`${globalSearchOpen ? "block" : "hidden"} absolute left-0 right-0 top-14 panel rounded-3xl p-2 z-[200] shadow-xl max-h-96 overflow-y-auto`}>
                  {globalSearchLoading ? (
                    <div className="px-3 py-2 text-xs font-black text-slate-500">Searching...</div>
                  ) : null}
                  {!globalSearchLoading && globalSearchInput.trim() && !globalSearchResults.length ? (
                    <div className="px-3 py-2 text-xs font-black text-slate-500">No users or communities found.</div>
                  ) : null}
                  {!globalSearchLoading ? globalSearchResults.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      type="button"
                      className="w-full rounded-2xl px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-white/10"
                      onClick={() => handleGlobalResultClick(result)}
                    >
                      <div className="text-sm font-black text-slate-900 dark:text-slate-100">{result.title}</div>
                      <div className="text-[11px] text-slate-500">{result.type === "user" ? "User" : "Community"} • {result.subtitle}</div>
                    </button>
                  )) : null}
                </div>
              </div>
                <section className="panel rounded-3xl p-4 bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
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
                  <div className="relative">
                    <div className={`text-right text-sm font-black ${selectedRangePct >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {selectedRangePct >= 0 ? "+" : "-"}{Math.abs(selectedRangePct).toFixed(2)}%
                    </div>
                    <button
                      type="button"
                      className="mt-1 rounded-xl border border-slate-200 dark:border-white/10 px-2 py-1 text-[10px] font-black text-slate-500"
                      onClick={() => setPnlRangeMenuOpen((open) => !open)}
                    >
                      {pnlRangeLabels[pnlChartRange]} ▾
                    </button>
                    {pnlRangeMenuOpen ? (
                      <div className="absolute right-0 top-[calc(100%+0.4rem)] z-20 w-24 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg p-1">
                        {pnlChartRanges.map((range) => (
                          <button
                            key={range}
                            type="button"
                            className={
                              "w-full rounded-lg px-2 py-1 text-left text-[10px] font-black " +
                              (range === pnlChartRange
                                ? "bg-brogreen/15 text-brogreen"
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10")
                            }
                            onClick={() => {
                              setPnlChartRange(range);
                              setPnlRangeMenuOpen(false);
                            }}
                          >
                            {pnlRangeLabels[range]}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="mb-4" ref={assetSearchRef}>
                  <div className="relative">
                    <input
                      id="asset-search"
                      className="w-full px-4 py-3 pl-10 rounded-2xl bg-slate-100 dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none text-sm font-bold placeholder:text-slate-500 dark:placeholder:text-slate-400 text-slate-900 dark:text-slate-100"
                      placeholder="Search stocks, options, or crypto..."
                      aria-label="Asset search"
                      title="Search stocks, options, or crypto"
                      tabIndex={0}
                      value={assetSearchInput}
                      onChange={(e) => setAssetSearchInput(e.target.value)}
                      onFocus={() => {
                        if (assetSearchResults.length) setAssetSearchOpen(true);
                      }}
                    />
                    <svg className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx={11} cy={11} r={8}></circle><path d="m21 21-4.3-4.3"></path></svg>
                  </div>
                  <div id="asset-search-results" className={`${assetSearchOpen ? "block" : "hidden"} mt-1 panel rounded-2xl p-2 max-h-72 overflow-y-auto shadow-xl`}>
                    {assetSearchLoading ? (
                      <div className="px-3 py-2 text-xs font-black text-slate-500">Searching assets...</div>
                    ) : null}
                    {!assetSearchLoading && assetSearchInput.trim() && !assetSearchResults.length ? (
                      <div className="px-3 py-2 text-xs font-black text-slate-500">No matching assets found.</div>
                    ) : null}
                    {!assetSearchLoading ? assetSearchResults.map((result) => (
                      <div key={`${result.assetType}-${result.symbol}`} className="flex items-center gap-2 rounded-2xl px-3 py-2 hover:bg-slate-100 dark:hover:bg-white/10">
                        <button
                          type="button"
                          className="flex-1 text-left"
                          onClick={() => handleAssetResultClick(result)}
                        >
                          <div className="text-sm font-black text-slate-900 dark:text-slate-100">{result.symbol}</div>
                          <div className="text-[11px] text-slate-500">{result.name} • {result.assetType}</div>
                        </button>
                        <button
                          type="button"
                          className="rounded-xl bg-brogreen px-2 py-1 text-[11px] font-black text-black disabled:opacity-60"
                          onClick={() => handleAddToSharedWatchlist(result.symbol, result.name, result.assetType)}
                          disabled={!user || watchlist.some((item) => item.symbol === result.symbol)}
                        >
                          {watchlist.some((item) => item.symbol === result.symbol) ? "Added" : "Add"}
                        </button>
                      </div>
                    )) : null}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className="soft-card rounded-2xl p-3"><div className="text-[10px] text-slate-500 font-black uppercase">Paper Cash</div><div id="paper-cash" className="font-black text-sm">${paperCash.toLocaleString()}</div></div>
                  <div className="soft-card rounded-2xl p-3"><div className="text-[10px] text-slate-500 font-black uppercase">P&L ({pnlRangeLabels[pnlChartRange]})</div><div id="paper-pnl" className={`font-black text-sm ${selectedRangePnl >= 0 ? "text-green-600" : "text-red-500"}`}>{selectedRangePnl >= 0 ? "+" : "-"}${Math.abs(selectedRangePnl).toLocaleString()}</div></div>
                  <div className="soft-card rounded-2xl p-3"><div className="text-[10px] text-slate-500 font-black uppercase">Positions</div><div id="paper-position-count" className="font-black text-sm">{paperPositionCount}</div></div>
                </div>
                <div className="mb-4 rounded-2xl border border-slate-200 dark:border-white/10 p-3 bg-white dark:bg-white/5">
                  <div className="h-28 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-2">
                    <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none" aria-label="Paper PnL chart">
                      <path d={chartPath} fill="none" stroke="currentColor" strokeWidth="2" className={selectedRangePnl >= 0 ? "text-green-600" : "text-red-500"} />
                    </svg>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-black text-slate-500">
                    <span>{new Date(selectedChartStart).toLocaleDateString()}</span>
                    <span>{new Date(chartEndTs).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Watchlist</h3>
                    </div>
                    {(() => {
                      return watchlist.length ? watchlist.map(item => (
                        <WatchlistRow key={item.symbol} item={item} activeTicker={activeTicker} setActiveTicker={setActiveTicker} onRemove={handleRemoveFromSharedWatchlist} quoteData={watchlistQuotes[item.symbol]} />
                      )) : <p className="text-[11px] text-slate-500">No watchlist items added yet.</p>;
                    })()}
                  </div>
                  <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">My Holdings</h3>
                      <span className="text-[10px] font-black text-slate-400">Refreshes every minute</span>
                    </div>
                    {paperHoldings.length ? (
                      <div className="space-y-2">
                        {paperHoldings.map((holding) => (
                          <div
                            key={holding.symbol}
                            className={
                              "rounded-xl soft-card px-3 py-2 cursor-pointer transition " +
                              (activeTicker === holding.symbol ? "border border-brogreen bg-brogreen/10" : "")
                            }
                            onClick={() => setActiveTicker(holding.symbol)}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-xs font-black uppercase text-slate-900 dark:text-slate-100">{holding.symbol}</div>
                                <div className="text-[10px] text-slate-500">
                                  {holding.quantity.toLocaleString()} shares • Avg ${holding.averageCost.toFixed(2)}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-black text-slate-900 dark:text-slate-100">
                                  ${holding.marketValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </div>
                                <div className={`text-[10px] font-black ${holding.unrealizedPnl >= 0 ? "text-green-600" : "text-red-500"}`}>
                                  {holding.unrealizedPnl >= 0 ? "+" : "-"}${Math.abs(holding.unrealizedPnl).toFixed(2)} ({holding.unrealizedPnlPct >= 0 ? "+" : "-"}{Math.abs(holding.unrealizedPnlPct).toFixed(2)}%)
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">No holdings yet. Paper buy a stock to start a position.</p>
                    )}
                  </div>
                  <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Live Chart ({normalizedActiveTicker || "-"})</h3>
                      <span className={`text-[10px] font-black ${activeTickerChange >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {activeTickerChange >= 0 ? "+" : "-"}{Math.abs(activeTickerChangePct).toFixed(2)}%
                      </span>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-3 bg-white dark:bg-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-black text-slate-500">{normalizedActiveTicker || "Ticker"}</div>
                        <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                          {activeTickerPrice > 0 ? `$${activeTickerPrice.toFixed(2)}` : "--"}
                        </div>
                      </div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Timeframe</span>
                        <div className="relative">
                          <button
                            type="button"
                            className="rounded-xl border border-slate-200 dark:border-white/10 px-2 py-1 text-[10px] font-black text-slate-600 dark:text-slate-300"
                            onClick={() => setActiveTickerRangeMenuOpen((open) => !open)}
                          >
                            {activeTickerChartRangeLabels[activeTickerChartRange]} ▾
                          </button>
                          {activeTickerRangeMenuOpen ? (
                            <div className="absolute right-0 top-[calc(100%+0.4rem)] z-20 w-24 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg p-1">
                              {activeTickerChartRanges.map((range) => (
                                <button
                                  key={range}
                                  type="button"
                                  className={
                                    "w-full rounded-lg px-2 py-1 text-left text-[10px] font-black " +
                                    (range === activeTickerChartRange
                                      ? "bg-brogreen/15 text-brogreen"
                                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10")
                                  }
                                  onClick={() => {
                                    setActiveTickerChartRange(range);
                                    setActiveTickerRangeMenuOpen(false);
                                  }}
                                >
                                  {activeTickerChartRangeLabels[range]}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="h-24 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-2">
                        {activeTickerChartLoading ? (
                          <div className="h-full flex items-center justify-center text-[11px] font-black text-slate-500">Loading chart...</div>
                        ) : activeTickerChartPath ? (
                          <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none" aria-label="Selected ticker live chart">
                            <path d={activeTickerChartPath} fill="none" stroke="currentColor" strokeWidth="2" className={activeTickerChange >= 0 ? "text-green-600" : "text-red-500"} />
                          </svg>
                        ) : (
                          <div className="h-full flex items-center justify-center text-[11px] font-black text-slate-500">Waiting for live quote data...</div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] font-black text-slate-500">
                        <span>{activeTickerChartStartLabel}</span>
                        <span>{activeTickerChartRange === "day" ? "Times shown in local time" : activeTickerChartEndLabel}</span>
                        {activeTickerChartRange !== "day" ? null : <span>{activeTickerChartEndLabel}</span>}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 items-center">
                        <select
                          value={stockOrderType}
                          onChange={(e) => setStockOrderType(e.target.value)}
                          className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-[11px] font-black text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900"
                        >
                          <option value="market">Market</option>
                          <option value="limit">Limit</option>
                        </select>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={stockShareQuantity}
                          onChange={(e) => setStockShareQuantity(e.target.value)}
                          placeholder="Shares"
                          className="w-24 rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-[11px] font-black text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900"
                        />
                        {stockOrderType === "limit" ? (
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={stockLimitPrice}
                            onChange={(e) => setStockLimitPrice(e.target.value)}
                            placeholder="Limit price"
                            className="w-32 rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-[11px] font-black text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900"
                          />
                        ) : null}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          className="rounded-xl bg-green-600 px-3 py-2 text-[11px] font-black text-white disabled:opacity-60"
                          onClick={() => handleExecuteSelectedTickerTrade("buy")}
                          disabled={paperTradeSubmitting === `buy-${stockOrderType}` || activeTickerPrice <= 0}
                        >
                          {paperTradeSubmitting === `buy-${stockOrderType}` ? "Buying..." : (stockOrderType === "limit" ? "Buy Limit" : "Buy More")}
                        </button>
                        <button
                          type="button"
                          className="rounded-xl bg-red-500 px-3 py-2 text-[11px] font-black text-white disabled:opacity-60"
                          onClick={() => handleExecuteSelectedTickerTrade("sell")}
                          disabled={paperTradeSubmitting === `sell-${stockOrderType}` || Number(paperAccount?.positions?.[normalizedActiveTicker] || 0) <= 0 || activeTickerPrice <= 0}
                        >
                          {paperTradeSubmitting === `sell-${stockOrderType}` ? "Selling..." : (stockOrderType === "limit" ? "Sell Limit" : "Sell")}
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-[11px] font-black text-slate-700 dark:text-slate-100"
                          onClick={handleOpenOptionChain}
                          disabled={!normalizedActiveTicker}
                        >
                          {optionChainOpen ? "Hide Chain" : "Option Chain"}
                        </button>
                      </div>
                      {optionChainOpen ? (
                        <div className="mt-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-3 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={optionContractQuantity}
                              onChange={(e) => setOptionContractQuantity(e.target.value)}
                              placeholder="Contracts"
                              className="w-28 rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 text-[11px] font-black text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900"
                              aria-label="Option contract quantity"
                            />
                            <div>
                              <div className="text-xs font-black text-slate-900 dark:text-slate-100">Option Chain</div>
                              <div className="text-[10px] text-slate-500">Showing contracts nearest to the current underlying price.</div>
                              <div className={`text-[10px] font-black mt-1 ${marketOpen ? "text-green-600" : "text-red-500"}`}>
                                Market status: {marketOpen ? "Open" : "Closed"}
                              </div>
                            </div>
                            <select
                              className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-[11px] font-black text-slate-900 dark:text-slate-100"
                              value={selectedOptionExpiration}
                              onChange={(e) => setSelectedOptionExpiration(e.target.value)}
                              disabled={optionChainLoading || !optionChainData?.expirationDates?.length}
                            >
                              {(optionChainData?.expirationDates || []).map((expiration) => (
                                <option key={expiration} value={String(expiration)}>
                                  {new Date(Number(expiration) * 1000).toLocaleDateString()}
                                </option>
                              ))}
                            </select>
                          </div>
                          {optionChainLoading ? (
                            <div className="text-[11px] font-black text-slate-500">Loading option chain...</div>
                          ) : null}
                          {!optionChainLoading && optionChainError ? (
                            <div className="text-[11px] font-black text-red-500">{optionChainError}</div>
                          ) : null}
                          {!optionChainLoading && !optionChainError ? (
                            <>
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 bg-white dark:bg-white/5">
                                  <div className="mb-2 text-xs font-black uppercase text-slate-500">Calls</div>
                                  <div className="space-y-2">
                                    {nearestCallContracts.length ? nearestCallContracts.map((contract) => (
                                      <div key={contract.contractSymbol} className="rounded-lg border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 p-2">
                                        <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] font-black text-slate-800 dark:text-slate-100">
                                          <span>Str ${Number(contract.strike || 0).toFixed(0)}</span>
                                          <span>Last ${Number(contract.lastPrice || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-300">
                                          <span>B/A ${Number(contract.bid || 0).toFixed(2)}/{Number(contract.ask || 0).toFixed(2)}</span>
                                          <span>Vol {Number(contract.volume || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="mt-2 grid grid-cols-1 gap-2">
                                          <button
                                            type="button"
                                            className="rounded-lg bg-green-600 px-2 py-1.5 text-[10px] font-black text-white disabled:opacity-60"
                                            onClick={() => handleExecuteOptionContractTrade(contract, "buy", "call")}
                                            disabled={!marketOpen || paperTradeSubmitting === `buy-option-${String(contract.contractSymbol || "").toUpperCase()}`}
                                          >
                                            {paperTradeSubmitting === `buy-option-${String(contract.contractSymbol || "").toUpperCase()}` ? "Buying..." : "Paper Buy"}
                                          </button>
                                        </div>
                                      </div>
                                    )) : <div className="text-[11px] font-black text-slate-500">No call contracts available.</div>}
                                  </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 bg-white dark:bg-white/5">
                                  <div className="mb-2 text-xs font-black uppercase text-slate-500">Puts</div>
                                  <div className="space-y-2">
                                    {nearestPutContracts.length ? nearestPutContracts.map((contract) => (
                                      <div key={contract.contractSymbol} className="rounded-lg border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 p-2">
                                        <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] font-black text-slate-800 dark:text-slate-100">
                                          <span>Str ${Number(contract.strike || 0).toFixed(0)}</span>
                                          <span>Last ${Number(contract.lastPrice || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-300">
                                          <span>B/A ${Number(contract.bid || 0).toFixed(2)}/{Number(contract.ask || 0).toFixed(2)}</span>
                                          <span>Vol {Number(contract.volume || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="mt-2 grid grid-cols-1 gap-2">
                                          <button
                                            type="button"
                                            className="rounded-lg bg-green-600 px-2 py-1.5 text-[10px] font-black text-white disabled:opacity-60"
                                            onClick={() => handleExecuteOptionContractTrade(contract, "buy", "put")}
                                            disabled={!marketOpen || paperTradeSubmitting === `buy-option-${String(contract.contractSymbol || "").toUpperCase()}`}
                                          >
                                            {paperTradeSubmitting === `buy-option-${String(contract.contractSymbol || "").toUpperCase()}` ? "Buying..." : "Paper Buy"}
                                          </button>
                                        </div>
                                      </div>
                                    )) : <div className="text-[11px] font-black text-slate-500">No put contracts available.</div>}
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 bg-white dark:bg-white/5">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="text-xs font-black uppercase text-slate-500">My Open Contracts</div>
                                  <div className="text-[10px] font-black text-slate-500">{openOptionContractsForActiveTicker.length} open</div>
                                </div>
                                {openOptionContractsForActiveTicker.length ? (
                                  <div className="space-y-2">
                                    {openOptionContractsForActiveTicker.map((position) => (
                                      <div key={position.symbol} className="rounded-lg border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 p-2">
                                        <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] font-black text-slate-800 dark:text-slate-100">
                                          <span>{position.optionType} ${position.strike.toFixed(2)}</span>
                                          <span>{position.quantity} ctr</span>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-300">
                                          <span>Avg ${position.avgContractPrice.toFixed(2)} x {position.multiplier}</span>
                                          <span>{position.hasLiveMark ? `Mark $${position.markPrice.toFixed(2)}` : "Mark unavailable"}</span>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                          <span>Value ${position.marketValue.toFixed(2)}</span>
                                          <span className={position.unrealizedPnl >= 0 ? "text-green-600" : "text-red-500"}>
                                            {position.unrealizedPnl >= 0 ? "+" : "-"}${Math.abs(position.unrealizedPnl).toFixed(2)} ({position.unrealizedPct >= 0 ? "+" : "-"}{Math.abs(position.unrealizedPct).toFixed(2)}%)
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[11px] font-black text-slate-500">No open contracts for {normalizedActiveTicker || "this ticker"}.</div>
                                )}
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Paper Trade History ({normalizedActiveTicker || "-"})</h3>
                      {hasMoreThanTenPaperTrades ? (
                        <button
                          id="paper-history-toggle"
                          className="text-[10px] font-black text-brogreen"
                          onClick={() => setShowAllPaperTrades((prev) => !prev)}
                        >
                          {showAllPaperTrades ? "Show less" : "Show all"}
                        </button>
                      ) : null}
                    </div>
                    <div id="paper-positions-list" className="space-y-2">
                      <div className="text-[11px] font-black text-slate-500">Showing up to 60 days of trade history for {normalizedActiveTicker || "the selected ticker"}.</div>
                      {visiblePaperTrades.length ? visiblePaperTrades.map((trade) => (
                        <div key={trade.id} className="flex items-center justify-between rounded-xl soft-card px-3 py-2">
                          <div>
                            <div className="text-xs font-black uppercase">{trade.symbol}</div>
                            <div className="text-[10px] text-slate-500">
                              {(trade.side || "trade").toUpperCase()} {trade.quantity} {trade.assetType === "option" ? "contracts" : "shares"} @ ${Number(trade.price || 0).toFixed(2)}
                            </div>
                            {trade.assetType === "option" ? (
                              <div className="text-[10px] text-slate-500">
                                {String(trade.optionType || "call").toUpperCase()} {String(trade.underlyingSymbol || normalizedActiveTicker || "")} ${Number(trade.strike || 0).toFixed(2)}
                              </div>
                            ) : null}
                            {trade.assetType === "option" ? (
                              <div className="text-[10px] text-slate-500">
                                Notional: ${Number(trade.notional || (Number(trade.quantity || 0) * Number(trade.price || 0) * Number(trade.contractMultiplier || 100))).toFixed(2)}
                              </div>
                            ) : null}
                            {(trade.assetType || "stock") === "option" && trade.contractMultiplier ? (
                              <div className="text-[10px] text-slate-500">Multiplier: {trade.contractMultiplier}x</div>
                            ) : null}
                            {(trade.side || "").toLowerCase() === "sell" ? (
                              <div className={`text-[10px] font-black ${Number(trade.realizedPnl || 0) >= 0 ? "text-green-600" : "text-red-500"}`}>
                                Trade PnL: {Number(trade.realizedPnl || 0) >= 0 ? "+" : "-"}${Math.abs(Number(trade.realizedPnl || 0)).toFixed(2)}
                              </div>
                            ) : null}
                          </div>
                          <div className="text-[10px] text-slate-500 text-right space-y-1">
                            <div>{trade.createdAt?.toDate?.().toLocaleString?.() || "-"}</div>
                            <button
                              type="button"
                              className="text-brogreen font-black disabled:opacity-60"
                              onClick={() => handleShareHistoricalTrade(trade)}
                              disabled={!user}
                            >
                              Share
                            </button>
                          </div>
                        </div>
                      )) : <div className="text-[11px] text-slate-500">No trades for {normalizedActiveTicker || "this ticker"} yet.</div>}
                    </div>
                  </div>
                </div>
              </section>
                <section className="panel rounded-3xl p-4 bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
                <h2 className="font-black text-xl mb-3 text-slate-900 dark:text-slate-100">Trending Topics</h2>
                <div id="right-trending" className="space-y-3">
                  {trendingTopics.length ? trendingTopics.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className={
                        "w-full flex items-center gap-2 px-3 py-2 rounded-xl soft-card font-black text-left transition " +
                        (activeTopic === t.topic ? "bg-brogreen/10 border border-brogreen" : "hover:bg-brogreen/10")
                      }
                      onClick={() => setActiveTopic((prev) => (prev === t.topic ? "" : t.topic))}
                    >
                      <span className="flex-1 truncate">{t.topic}</span>
                      <span className="text-xs text-slate-500">{t.posts} posts</span>
                    </button>
                  )) : (
                    <div className="px-3 py-2 rounded-xl soft-card text-xs font-black text-slate-500">
                      No live topics yet.
                    </div>
                  )}
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
                  <div key={c.id} className="flex items-center gap-2">
                    <button
                      className={
                        "flex items-center gap-3 px-3 py-2 rounded-xl soft-card font-black cursor-pointer flex-1 text-left" +
                        (selectedFilter === c.id ? " bg-brogreen/10 border border-brogreen" : " hover:bg-brogreen/10")
                      }
                      onClick={() => {
                        setSelectedFilter(c.id);
                        setMobileDrawerOpen(false);
                        router.push(`/communities/${c.id}`);
                      }}
                      tabIndex={0}
                      aria-label={c.name}
                      title={c.name}
                    >
                      <img src={c.avatar} alt={c.name} className="w-8 h-8 rounded-full object-cover" onError={e => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(c.name) + '&background=050816&color=B6FF22'; }} />
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-slate-500">{c.members} members</span>
                    </button>
                  </div>
                ))}
              </div>
            </section>
            {/* Mobile Trending Topics */}
            <section>
              <h2 className="font-black text-lg mb-2 mt-4">Trending Topics</h2>
              <div className="space-y-2">
                {trendingTopics.length ? trendingTopics.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={
                      "w-full flex items-center gap-2 px-3 py-2 rounded-xl soft-card font-black text-left transition " +
                      (activeTopic === t.topic ? "bg-brogreen/10 border border-brogreen" : "hover:bg-brogreen/10")
                    }
                    onClick={() => {
                      setActiveTopic((prev) => (prev === t.topic ? "" : t.topic));
                      setMobileDrawerOpen(false);
                    }}
                  >
                    <span className="flex-1 truncate">{t.topic}</span>
                    <span className="text-xs text-slate-500">{t.posts} posts</span>
                  </button>
                )) : (
                  <div className="px-3 py-2 rounded-xl soft-card text-xs font-black text-slate-500">
                    No live topics yet.
                  </div>
                )}
              </div>
            </section>
          </div>
        </aside>

        <button id="mobile-floating-post" className="xl:hidden fixed bottom-5 right-5 z-40 w-16 h-16 rounded-full bg-brogreen text-black font-black text-2xl shadow-2xl" aria-label="Create a post" title="Create a post" onClick={() => setModal("post")}>+</button>

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
    );
}

export default Feed;


