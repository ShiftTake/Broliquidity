import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { auth, db } from "../../src/firebase";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc as firestoreDoc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { ensureUserHasAvatar, getRandomDefaultAvatar } from "../../src/avatarDefaults";

export default function CommunityPage() {
  const router = useRouter();
  const { communityId } = router.query;

  const [viewer, setViewer] = useState(null);
  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberCount, setMemberCount] = useState(0);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);

  const [pinType, setPinType] = useState("ticker");
  const [pinSymbol, setPinSymbol] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinnedQuote, setPinnedQuote] = useState(null);
  const [pinnedQuoteLoading, setPinnedQuoteLoading] = useState(false);

  const [composeText, setComposeText] = useState("");
  const [composeBusy, setComposeBusy] = useState(false);
  const [rulesBusy, setRulesBusy] = useState(false);
  const [newRule, setNewRule] = useState("");
  const [roleBusyUid, setRoleBusyUid] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editBanner, setEditBanner] = useState("");

  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  const pinnedAsset = community?.pinnedAsset || null;
  const pinnedPost = community?.pinnedPostPreview || null;
  const roleAssignments = community?.roleAssignments || {};
  const ownerId = roleAssignments.ownerId || community?.createdBy || "";
  const assistantIds = Array.isArray(roleAssignments.assistantIds) ? roleAssignments.assistantIds : [];
  const moderatorIds = Array.isArray(roleAssignments.moderatorIds) ? roleAssignments.moderatorIds : [];
  const rules = Array.isArray(community?.rules) ? community.rules : [];

  const viewerRole = useMemo(() => {
    if (!viewer?.uid) return "guest";
    if (viewer.uid === ownerId) return "owner";
    if (assistantIds.includes(viewer.uid)) return "assistant";
    if (moderatorIds.includes(viewer.uid)) return "moderator";
    return isMember ? "member" : "guest";
  }, [assistantIds, isMember, moderatorIds, ownerId, viewer?.uid]);

  const canModerate = viewerRole === "owner" || viewerRole === "assistant" || viewerRole === "moderator";
  const canManageAssistants = viewerRole === "owner";
  const canManageModerators = viewerRole === "owner" || viewerRole === "assistant";
  const canParticipate = viewerRole !== "guest";

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((nextUser) => {
      setViewer(nextUser || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!communityId) return;

    const loadCommunity = async () => {
      setLoading(true);
      setAccessDenied(false);

      try {
        const communityRef = firestoreDoc(db, "communities", communityId);
        const communitySnap = await getDoc(communityRef);

        if (!communitySnap.exists()) {
          setCommunity(null);
          setPosts([]);
          setMembers([]);
          setMemberCount(0);
          setIsMember(false);
          setLoading(false);
          return;
        }

        const communityData = { id: communitySnap.id, ...communitySnap.data() };
        setCommunity(communityData);

        const [membershipsResult, communityIdPostsResult, communityNamePostsResult] = await Promise.allSettled([
          getDocs(query(collection(db, "memberships"), where("communityId", "==", communityId))),
          getDocs(query(collection(db, "posts"), where("communityId", "==", communityId))),
          getDocs(query(collection(db, "posts"), where("community", "==", communityData.name || "")))
        ]);

        const membershipsSnap = membershipsResult.status === "fulfilled" ? membershipsResult.value : null;
        const communityIdPostsSnap = communityIdPostsResult.status === "fulfilled" ? communityIdPostsResult.value : null;
        const communityNamePostsSnap = communityNamePostsResult.status === "fulfilled" ? communityNamePostsResult.value : null;

        if (membershipsResult.status === "rejected" || communityIdPostsResult.status === "rejected" || communityNamePostsResult.status === "rejected") {
          const denial = [membershipsResult, communityIdPostsResult, communityNamePostsResult].some((result) => result.status === "rejected" && result.reason?.code === "permission-denied");
          if (denial) setAccessDenied(true);
        }

        const membershipRows = membershipsSnap ? membershipsSnap.docs.map((membershipDoc) => membershipDoc.data()) : [];
        setMemberCount((membershipsSnap?.size || 0) || communityData.members || 0);
        setIsMember(Boolean(viewer?.uid && membershipRows.some((membership) => membership.userId === viewer.uid)));

        const loadedRoles = communityData.roleAssignments || {};
        const loadedOwnerId = loadedRoles.ownerId || communityData.createdBy || "";
        const loadedAssistantIds = Array.isArray(loadedRoles.assistantIds) ? loadedRoles.assistantIds : [];
        const loadedModeratorIds = Array.isArray(loadedRoles.moderatorIds) ? loadedRoles.moderatorIds : [];

        const memberProfiles = await Promise.all(
          membershipRows.map(async (membership) => {
            try {
              const ensured = await ensureUserHasAvatar(db, membership.userId);
              let role = "member";
              if (membership.userId === loadedOwnerId) role = "owner";
              else if (loadedAssistantIds.includes(membership.userId)) role = "assistant";
              else if (loadedModeratorIds.includes(membership.userId)) role = "moderator";
              return {
                uid: membership.userId,
                name: ensured.displayName || ensured.username || ensured.email || "User",
                photoURL: ensured.photoURL || getRandomDefaultAvatar(),
                email: ensured.email || "",
                role
              };
            } catch {
              return {
                uid: membership.userId,
                name: "User",
                photoURL: getRandomDefaultAvatar(),
                email: "",
                role: "member"
              };
            }
          })
        );
        setMembers(memberProfiles);

        const byId = new Map();
        [
          ...(communityIdPostsSnap ? communityIdPostsSnap.docs : []),
          ...(communityNamePostsSnap ? communityNamePostsSnap.docs : [])
        ].forEach((postDoc) => {
          byId.set(postDoc.id, { id: postDoc.id, ...postDoc.data() });
        });

        const normalizedPosts = await Promise.all(
          [...byId.values()].map(async (post) => {
            const authorUid = post.authorId || post.user?.uid;
            if (!authorUid) return post;

            try {
              const ensured = await ensureUserHasAvatar(db, authorUid);
              const resolvedAvatar =
                (auth.currentUser?.uid === authorUid ? auth.currentUser?.photoURL : null) ||
                ensured.photoURL ||
                post.user?.avatar ||
                getRandomDefaultAvatar();

              return {
                ...post,
                authorId: authorUid,
                user: {
                  ...(post.user || {}),
                  uid: authorUid,
                  name: post.user?.name || ensured.displayName || ensured.username || ensured.email || "User",
                  avatar: resolvedAvatar,
                  handle: post.user?.handle || (ensured.email ? `@${ensured.email.split("@")[0]}` : "@user")
                }
              };
            } catch {
              return {
                ...post,
                authorId: authorUid,
                user: {
                  ...(post.user || {}),
                  uid: authorUid,
                  name: post.user?.name || "User",
                  avatar: post.user?.avatar || getRandomDefaultAvatar(),
                  handle: post.user?.handle || "@user"
                }
              };
            }
          })
        );

        normalizedPosts.sort((a, b) => {
          const aMs = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : ((a.createdAt?.seconds || 0) * 1000);
          const bMs = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : ((b.createdAt?.seconds || 0) * 1000);
          return bMs - aMs;
        });

        setPosts(normalizedPosts);
      } catch (error) {
        if (error?.code === "permission-denied") {
          setAccessDenied(true);
        }
        setCommunity(null);
        setPosts([]);
        setMembers([]);
        setMemberCount(0);
        setIsMember(false);
      }

      setLoading(false);
    };

    loadCommunity();
  }, [communityId, viewer?.uid]);

  const memberLabel = useMemo(() => {
    if (memberCount === 1) return "1 member";
    return `${memberCount} members`;
  }, [memberCount]);

  useEffect(() => {
    if (!community) return;
    setEditName(community.name || "");
    setEditDescription(community.description || "");
    setEditAvatar(community.avatar || "");
    setEditBanner(community.banner || "");
  }, [community]);

  useEffect(() => {
    const symbol = String(pinnedAsset?.symbol || "").trim().toUpperCase();
    if (!symbol) {
      setPinnedQuote(null);
      setPinnedQuoteLoading(false);
      return;
    }

    let active = true;
    const loadQuote = async () => {
      setPinnedQuoteLoading(true);
      try {
        const response = await fetch(`/api/getQuote?symbol=${encodeURIComponent(symbol)}`);
        if (!response.ok) throw new Error("quote request failed");
        const data = await response.json();
        if (active) {
          setPinnedQuote(data || null);
        }
      } catch {
        if (active) setPinnedQuote(null);
      }
      if (active) setPinnedQuoteLoading(false);
    };

    loadQuote();
    const intervalId = setInterval(loadQuote, 60000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [pinnedAsset?.symbol]);

  useEffect(() => {
    if (!communityId || !community || community?.liveChatEnabled === false) {
      setChatMessages([]);
      return;
    }

    const chatQuery = query(
      collection(db, "communities", communityId, "liveChat"),
      orderBy("createdAt", "desc"),
      limit(80)
    );

    const unsubscribe = onSnapshot(chatQuery, (snapshot) => {
      const rows = snapshot.docs
        .map((chatDoc) => ({ id: chatDoc.id, ...chatDoc.data() }))
        .reverse();
      setChatMessages(rows);
    });

    return () => unsubscribe();
  }, [community?.liveChatEnabled, communityId]);

  const handleJoin = async () => {
    if (!viewer?.uid || !communityId || joinBusy) return;
    setJoinBusy(true);

    try {
      await setDoc(firestoreDoc(db, "memberships", `${viewer.uid}_${communityId}`), {
        userId: viewer.uid,
        communityId,
        joinedAt: Date.now()
      }, { merge: true });

      await updateDoc(firestoreDoc(db, "communities", communityId), {
        members: increment(1)
      });

      const ensured = await ensureUserHasAvatar(db, viewer.uid);
      setIsMember(true);
      setMemberCount((prev) => prev + 1);
      setMembers((prev) => {
        if (prev.some((member) => member.uid === viewer.uid)) return prev;
        return [
          {
            uid: viewer.uid,
            name: ensured.displayName || ensured.username || ensured.email || "User",
            photoURL: ensured.photoURL || getRandomDefaultAvatar(),
            email: ensured.email || "",
            role: "member"
          },
          ...prev
        ];
      });
    } catch {
      // Keep page interactive if membership update fails.
    }

    setJoinBusy(false);
  };

  const handleLeave = async () => {
    if (!viewer?.uid || !communityId || joinBusy) return;
    if (viewer.uid === ownerId) return;
    setJoinBusy(true);

    try {
      await deleteDoc(firestoreDoc(db, "memberships", `${viewer.uid}_${communityId}`));
      await updateDoc(firestoreDoc(db, "communities", communityId), {
        members: increment(-1),
        "roleAssignments.assistantIds": arrayRemove(viewer.uid),
        "roleAssignments.moderatorIds": arrayRemove(viewer.uid)
      });

      setIsMember(false);
      setMemberCount((prev) => Math.max(prev - 1, 0));
      setMembers((prev) => prev.filter((member) => member.uid !== viewer.uid));
    } catch {
      // Keep page interactive if membership update fails.
    }

    setJoinBusy(false);
  };

  const handlePinAsset = async () => {
    if (!viewer?.uid || !communityId || !canModerate || !pinSymbol.trim() || pinBusy) return;
    setPinBusy(true);

    try {
      await updateDoc(firestoreDoc(db, "communities", communityId), {
        pinnedAsset: {
          type: pinType,
          symbol: pinSymbol.trim().toUpperCase(),
          pinnedBy: viewer.uid,
          pinnedAt: serverTimestamp()
        }
      });
      setCommunity((prev) => ({
        ...(prev || {}),
        pinnedAsset: {
          type: pinType,
          symbol: pinSymbol.trim().toUpperCase(),
          pinnedBy: viewer.uid
        }
      }));
      setPinSymbol("");
    } catch {
      // Keep page interactive if pin fails.
    }

    setPinBusy(false);
  };

  const handlePinPost = async (post) => {
    if (!viewer?.uid || !communityId || !canModerate || !post?.id || pinBusy) return;
    setPinBusy(true);

    try {
      await updateDoc(firestoreDoc(db, "communities", communityId), {
        pinnedPostId: post.id,
        pinnedPostPreview: {
          id: post.id,
          content: post.content || "",
          authorName: post.user?.name || "User",
          authorAvatar: post.user?.avatar || getRandomDefaultAvatar(),
          pinnedBy: viewer.uid,
          pinnedAt: serverTimestamp()
        }
      });

      setCommunity((prev) => ({
        ...(prev || {}),
        pinnedPostId: post.id,
        pinnedPostPreview: {
          id: post.id,
          content: post.content || "",
          authorName: post.user?.name || "User",
          authorAvatar: post.user?.avatar || getRandomDefaultAvatar(),
          pinnedBy: viewer.uid
        }
      }));
    } catch {
      // Keep page interactive if pin fails.
    }

    setPinBusy(false);
  };

  const handleClearPins = async () => {
    if (!viewer?.uid || !communityId || !canModerate || pinBusy) return;
    setPinBusy(true);

    try {
      await updateDoc(firestoreDoc(db, "communities", communityId), {
        pinnedAsset: null,
        pinnedPostId: null,
        pinnedPostPreview: null
      });

      setCommunity((prev) => ({
        ...(prev || {}),
        pinnedAsset: null,
        pinnedPostId: null,
        pinnedPostPreview: null
      }));
    } catch {
      // Keep page interactive if clear fails.
    }

    setPinBusy(false);
  };

  const handleCompose = async (e) => {
    e.preventDefault();
    if (!viewer?.uid || !community || !canParticipate || !composeText.trim() || composeBusy) return;
    setComposeBusy(true);

    try {
      const ensured = await ensureUserHasAvatar(db, viewer.uid);
      const newPostRef = await addDoc(collection(db, "posts"), {
        content: composeText.trim(),
        authorId: viewer.uid,
        community: community.name || "",
        communityId,
        user: {
          uid: viewer.uid,
          name: ensured.displayName || ensured.username || ensured.email || "User",
          avatar: ensured.photoURL || getRandomDefaultAvatar(),
          handle: ensured.email ? `@${ensured.email.split("@")[0]}` : "@user"
        },
        createdAt: serverTimestamp(),
        bullishVotes: 0,
        bearishVotes: 0,
        comments: 0
      });

      const optimistic = {
        id: newPostRef.id,
        content: composeText.trim(),
        authorId: viewer.uid,
        community: community.name || "",
        communityId,
        user: {
          uid: viewer.uid,
          name: ensured.displayName || ensured.username || ensured.email || "User",
          avatar: ensured.photoURL || getRandomDefaultAvatar(),
          handle: ensured.email ? `@${ensured.email.split("@")[0]}` : "@user"
        },
        time: "just now",
        bullishVotes: 0,
        bearishVotes: 0
      };

      setPosts((prev) => [optimistic, ...prev]);
      setComposeText("");
    } catch {
      // Non-blocking — user can retry.
    }

    setComposeBusy(false);
  };

  const handleDeletePost = async (post) => {
    if (!post?.id || typeof post.id === "number") return;
    const postOwnerId = post.authorId || post.userId || post.user?.uid;
    const canDeleteAsOwner = Boolean(viewer?.uid && postOwnerId === viewer.uid);
    if (!viewer?.uid || (!canDeleteAsOwner && !canModerate)) return;
    if (!window.confirm("Delete this post permanently?")) return;

    try {
      await deleteDoc(firestoreDoc(db, "posts", post.id));
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch {
      // Non-blocking — keep feed visible.
    }
  };

  const buildNextRoleAssignments = (targetUid, nextRole) => {
    const nextAssistantIds = assistantIds.filter((uid) => uid !== targetUid);
    const nextModeratorIds = moderatorIds.filter((uid) => uid !== targetUid);

    if (nextRole === "assistant") nextAssistantIds.push(targetUid);
    if (nextRole === "moderator") nextModeratorIds.push(targetUid);

    return {
      ownerId,
      assistantIds: [...new Set(nextAssistantIds)],
      moderatorIds: [...new Set(nextModeratorIds)]
    };
  };

  const handleAssignRole = async (member, nextRole) => {
    const targetUid = member?.uid;
    if (!viewer?.uid || !communityId || !targetUid || targetUid === ownerId) return;
    if (nextRole === "assistant" && !canManageAssistants) return;
    if (nextRole === "moderator" && !canManageModerators) return;
    if (nextRole === "member" && !(canManageAssistants || canManageModerators)) return;

    setRoleBusyUid(targetUid);
    try {
      const nextAssignments = buildNextRoleAssignments(targetUid, nextRole);
      await updateDoc(firestoreDoc(db, "communities", communityId), {
        roleAssignments: nextAssignments
      });

      setCommunity((prev) => ({
        ...(prev || {}),
        roleAssignments: nextAssignments
      }));
      setMembers((prev) =>
        prev.map((row) => (row.uid === targetUid ? { ...row, role: nextRole } : row))
      );
    } catch {
      // Non-blocking moderation update.
    }
    setRoleBusyUid("");
  };

  const handleRemoveMember = async (member) => {
    const targetUid = member?.uid;
    if (!viewer?.uid || !communityId || !targetUid || !canModerate) return;
    if (targetUid === ownerId) return;
    if (!window.confirm("Remove this member from the community?")) return;

    setRoleBusyUid(targetUid);
    try {
      await deleteDoc(firestoreDoc(db, "memberships", `${targetUid}_${communityId}`));
      await updateDoc(firestoreDoc(db, "communities", communityId), {
        members: increment(-1),
        "roleAssignments.assistantIds": arrayRemove(targetUid),
        "roleAssignments.moderatorIds": arrayRemove(targetUid)
      });

      setMembers((prev) => prev.filter((row) => row.uid !== targetUid));
      setMemberCount((prev) => Math.max(0, prev - 1));
      if (targetUid === viewer.uid) setIsMember(false);
    } catch {
      // Keep page interactive if remove fails.
    }
    setRoleBusyUid("");
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!viewer?.uid || !communityId || !canModerate || !newRule.trim() || rulesBusy) return;

    setRulesBusy(true);
    const ruleText = newRule.trim();
    try {
      await updateDoc(firestoreDoc(db, "communities", communityId), {
        rules: arrayUnion(ruleText)
      });
      setCommunity((prev) => ({
        ...(prev || {}),
        rules: [...(Array.isArray(prev?.rules) ? prev.rules : []), ruleText]
      }));
      setNewRule("");
    } catch {
      // Keep page interactive if rule create fails.
    }
    setRulesBusy(false);
  };

  const handleDeleteRule = async (ruleText) => {
    if (!viewer?.uid || !communityId || !canModerate || !ruleText || rulesBusy) return;
    setRulesBusy(true);
    try {
      await updateDoc(firestoreDoc(db, "communities", communityId), {
        rules: arrayRemove(ruleText)
      });
      setCommunity((prev) => ({
        ...(prev || {}),
        rules: (Array.isArray(prev?.rules) ? prev.rules : []).filter((rule) => rule !== ruleText)
      }));
    } catch {
      // Keep page interactive if rule delete fails.
    }
    setRulesBusy(false);
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!viewer?.uid || !communityId || !canParticipate || !chatText.trim() || chatBusy) return;
    setChatBusy(true);

    try {
      const ensured = await ensureUserHasAvatar(db, viewer.uid);
      await addDoc(collection(db, "communities", communityId, "liveChat"), {
        text: chatText.trim(),
        userId: viewer.uid,
        user: {
          uid: viewer.uid,
          name: ensured.displayName || ensured.username || ensured.email || "User",
          avatar: ensured.photoURL || getRandomDefaultAvatar(),
          handle: ensured.email ? `@${ensured.email.split("@")[0]}` : "@user"
        },
        createdAt: serverTimestamp()
      });
      setChatText("");
    } catch {
      // Keep chat resilient.
    }

    setChatBusy(false);
  };

  const handleDeleteChatMessage = async (message) => {
    const messageOwner = message?.userId || message?.user?.uid;
    const canDelete = canModerate || (viewer?.uid && viewer.uid === messageOwner);
    if (!communityId || !message?.id || !canDelete) return;

    try {
      await deleteDoc(firestoreDoc(db, "communities", communityId, "liveChat", message.id));
    } catch {
      // Non-blocking moderation action.
    }
  };

  const handleVote = async (post, voteType) => {
    if (!viewer?.uid || !canParticipate || !post?.id || typeof post.id === "number") return;

    try {
      const postRef = firestoreDoc(db, "posts", post.id);
      const voteRef = firestoreDoc(db, "votes", `${viewer.uid}_${post.id}`);
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
        if (previousVote === voteType) return;

        let bullishVotes = postSnap.data()?.bullishVotes || 0;
        let bearishVotes = postSnap.data()?.bearishVotes || 0;

        if (previousVote === "bullish") bullishVotes = Math.max(0, bullishVotes - 1);
        if (previousVote === "bearish") bearishVotes = Math.max(0, bearishVotes - 1);

        if (voteType === "bullish") bullishVotes += 1;
        if (voteType === "bearish") bearishVotes += 1;

        transaction.update(postRef, {
          bullishVotes,
          bearishVotes
        });
        transaction.set(voteRef, {
          userId: viewer.uid,
          postId: post.id,
          voteType,
          updatedAt: serverTimestamp()
        }, { merge: true });

        nextBullish = bullishVotes;
        nextBearish = bearishVotes;
        changed = true;
      });

      if (!changed) return;

      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, bullishVotes: nextBullish, bearishVotes: nextBearish } : p
        )
      );
    } catch {
      // Non-blocking.
    }
  };

  const pinnedPrice = Number(pinnedQuote?.c || 0);
  const pinnedPrevClose = Number(pinnedQuote?.pc || 0);
  const pinnedChange = pinnedPrice > 0 && pinnedPrevClose > 0 ? pinnedPrice - pinnedPrevClose : 0;
  const pinnedChangePct = pinnedPrice > 0 && pinnedPrevClose > 0 ? (pinnedChange / pinnedPrevClose) * 100 : 0;

  const handleSaveCommunitySettings = async (e) => {
    e.preventDefault();
    if (!viewer?.uid || viewerRole !== "owner" || !communityId || settingsBusy) return;

    setSettingsBusy(true);
    try {
      const payload = {
        name: editName.trim() || community.name || "",
        description: editDescription.trim(),
        avatar: editAvatar.trim(),
        banner: editBanner.trim(),
        updatedAt: serverTimestamp()
      };

      await updateDoc(firestoreDoc(db, "communities", communityId), payload);
      setCommunity((prev) => ({ ...(prev || {}), ...payload }));
      setSettingsOpen(false);
    } catch {
      // Non-blocking; owner can retry.
    }
    setSettingsBusy(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-white dark:bg-[#050816] px-6 py-10 text-center font-black text-slate-500 dark:text-slate-400">Loading community...</div>;
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#050816] px-6 py-10 text-center font-black text-slate-500 dark:text-slate-400">
        {accessDenied ? "You do not have permission to view this community." : "Community not found."}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#050816] text-slate-900 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-[1400px] gap-5 px-4 py-6 lg:px-6">
        <aside className="hidden xl:block w-64 shrink-0">
          <div className="sticky top-6 space-y-4">
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-brogreen">Community</p>
              <h1 className="mt-2 text-2xl font-black">{community.name || `c/${community.id}`}</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{community.description || "A focused desk for market takes and conviction posts."}</p>
              <div className="mt-4 text-xs font-black text-slate-500 dark:text-slate-400">{memberLabel}</div>
            </div>
            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick Links</h2>
              <div className="mt-4 space-y-2">
                <Link href="/feed" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 font-black hover:bg-slate-50 dark:hover:bg-white/5">Main Feed</Link>
                <Link href="/communities" className="block rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-3 font-black hover:bg-slate-50 dark:hover:bg-white/5">All Communities</Link>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <section className="panel overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] shadow-sm">
            <div className="border-b border-slate-200 dark:border-white/10 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Link href="/communities" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xl font-black hover:bg-slate-50 dark:hover:bg-white/5">←</Link>
                  <img
                    src={community.avatar || getRandomDefaultAvatar()}
                    alt={community.name || "Community"}
                    className="h-12 w-12 rounded-full border border-slate-200 dark:border-white/10 object-cover"
                  />
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-black">{community.name || `c/${community.id}`}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{memberLabel}</p>
                  </div>
                </div>
                {viewer ? (
                  canParticipate ? (
                    viewerRole === "owner" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-black hover:bg-slate-50 dark:hover:bg-white/5"
                          onClick={() => setSettingsOpen((open) => !open)}
                        >
                          {settingsOpen ? "Close Settings" : "Edit Community"}
                        </button>
                        <a href="#members-and-roles" className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-2 text-sm font-black hover:bg-slate-50 dark:hover:bg-white/5">Manage Members</a>
                        <a href="#community-rules" className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-2 text-sm font-black hover:bg-slate-50 dark:hover:bg-white/5">Moderation</a>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-black hover:bg-slate-50 dark:hover:bg-white/5"
                        onClick={handleLeave}
                        disabled={joinBusy}
                      >
                        {joinBusy ? "Saving..." : "Leave Community"}
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      className="rounded-2xl bg-brogreen px-4 py-2 text-sm font-black text-black dark:text-brogreen"
                      onClick={handleJoin}
                      disabled={joinBusy}
                    >
                      {joinBusy ? "Joining..." : "Join Community"}
                    </button>
                  )
                ) : (
                  <Link href="/login" className="rounded-2xl border border-slate-200 dark:border-white/10 px-4 py-2 text-sm font-black">Sign in to Join</Link>
                )}
              </div>
              {viewerRole === "owner" && settingsOpen ? (
                <form onSubmit={handleSaveCommunitySettings} className="mt-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Owner Settings</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input
                      className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-black"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Community name"
                    />
                    <input
                      className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                      value={editAvatar}
                      onChange={(e) => setEditAvatar(e.target.value)}
                      placeholder="Avatar URL"
                    />
                    <textarea
                      className="md:col-span-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                      rows={2}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Community description"
                    />
                    <input
                      className="md:col-span-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                      value={editBanner}
                      onChange={(e) => setEditBanner(e.target.value)}
                      placeholder="Banner URL"
                    />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="submit"
                      className="rounded-xl bg-brogreen px-4 py-2 text-sm font-black text-black disabled:opacity-50"
                      disabled={settingsBusy || !editName.trim()}
                    >
                      {settingsBusy ? "Saving..." : "Save Settings"}
                    </button>
                  </div>
                </form>
              ) : null}
            </div>

            <div className="border-b border-slate-200 dark:border-white/10 p-5">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Pinned</h3>
              {accessDenied ? (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Some data is restricted by community permissions. You can still browse available sections.</p>
              ) : null}
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-4">
                  <div className="text-xs font-black text-slate-500 dark:text-slate-400">Pinned Stock</div>
                  {pinnedAsset ? (
                    <div className="mt-2">
                      <div className="text-base font-black">{pinnedAsset.type === "crypto" ? "Crypto" : "Ticker"}: {pinnedAsset.symbol}</div>
                      {pinnedQuoteLoading ? (
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Loading live price...</div>
                      ) : pinnedPrice > 0 ? (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-lg font-black">${pinnedPrice.toFixed(2)}</span>
                          <span className={`text-xs font-black ${pinnedChange >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {pinnedChange >= 0 ? "+" : ""}{pinnedChange.toFixed(2)} ({pinnedChange >= 0 ? "+" : ""}{pinnedChangePct.toFixed(2)}%)
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Price unavailable.</div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">No stock pinned yet.</div>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-4">
                  <div className="text-xs font-black text-slate-500 dark:text-slate-400">Pinned Post</div>
                  {pinnedPost ? (
                    <div className="mt-2 flex items-start gap-3">
                      <img src={pinnedPost.authorAvatar || getRandomDefaultAvatar()} alt={pinnedPost.authorName || "User"} className="h-9 w-9 rounded-full border border-slate-200 dark:border-white/10 object-cover" />
                      <div className="min-w-0">
                        <div className="text-sm font-black truncate">{pinnedPost.authorName || "User"}</div>
                        <div className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">{pinnedPost.content || "Pinned post"}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">No pinned post yet.</div>
                  )}
                </div>
              </div>

              {viewer && canModerate ? (
                <div className="mt-4 rounded-2xl border border-slate-200 dark:border-white/10 p-4">
                  <div className="grid gap-3 md:grid-cols-[130px_minmax(0,1fr)_auto]">
                    <select
                      className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-black"
                      value={pinType}
                      onChange={(e) => setPinType(e.target.value)}
                    >
                      <option value="ticker">Ticker</option>
                      <option value="crypto">Crypto</option>
                    </select>
                    <input
                      className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-black uppercase"
                      value={pinSymbol}
                      onChange={(e) => setPinSymbol(e.target.value)}
                      placeholder={pinType === "crypto" ? "BTC" : "AAPL"}
                    />
                    <button
                      type="button"
                      className="rounded-xl bg-brogreen px-4 py-2 text-sm font-black text-black dark:text-brogreen"
                      onClick={handlePinAsset}
                      disabled={pinBusy || !pinSymbol.trim()}
                    >
                      {pinBusy ? "Saving..." : "Pin Stock"}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="mt-3 text-xs font-black text-red-500 hover:text-red-600 disabled:opacity-50"
                    onClick={handleClearPins}
                    disabled={pinBusy}
                  >
                    Clear All Pins
                  </button>
                </div>
              ) : null}
            </div>

            <div className="border-b border-slate-200 dark:border-white/10 px-5 py-4">
              <h3 className="text-lg font-black">Community Feed</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Posts in this community follow the same card rhythm as your main feed.</p>
            </div>

            {viewer && canParticipate ? (
              <form onSubmit={handleCompose} className="border-b border-slate-200 dark:border-white/10 p-5">
                <div className="flex gap-3">
                  <img
                    src={viewer.photoURL || getRandomDefaultAvatar()}
                    alt="You"
                    className="h-10 w-10 shrink-0 rounded-full border border-slate-200 dark:border-white/10 object-cover"
                  />
                  <div className="flex-1">
                    <textarea
                      className="w-full resize-none rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brogreen/40"
                      placeholder={`Post to ${community.name || "this community"}...`}
                      rows={2}
                      value={composeText}
                      onChange={(e) => setComposeText(e.target.value)}
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="submit"
                        className="rounded-2xl bg-brogreen px-5 py-2 text-sm font-black text-black disabled:opacity-50"
                        disabled={composeBusy || !composeText.trim()}
                      >
                        {composeBusy ? "Posting..." : "Post"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            ) : viewer && !canParticipate ? (
              <div className="border-b border-slate-200 dark:border-white/10 px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
                Join this community to post and vote.
              </div>
            ) : null}

            {posts.length === 0 ? (
              <div className="border-b border-slate-200 dark:border-white/10 px-5 py-4 text-sm text-slate-500 dark:text-slate-400">No posts yet. Create one from the feed and target this community.</div>
            ) : null}

            <div className="border-b border-slate-200 dark:border-white/10 p-5">
              <h3 className="text-lg font-black">Community Live Chat</h3>
              {community.liveChatEnabled === false ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Live chat is disabled in this community.</p>
              ) : (
                <>
                  <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-3">
                    {chatMessages.length === 0 ? (
                      <div className="text-sm text-slate-500 dark:text-slate-400">No chat messages yet.</div>
                    ) : (
                      <ul className="space-y-2">
                        {chatMessages.map((message) => {
                          const messageOwner = message.userId || message.user?.uid;
                          const canDeleteMessage = canModerate || (viewer?.uid && viewer.uid === messageOwner);
                          return (
                            <li key={message.id} className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 p-2">
                              <img
                                src={message.user?.avatar || getRandomDefaultAvatar()}
                                alt={message.user?.name || "User"}
                                className="h-8 w-8 rounded-full border border-slate-200 dark:border-white/10 object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-black">{message.user?.name || "User"}</span>
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{message.user?.handle || "@user"}</span>
                                </div>
                                <div className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{message.text || ""}</div>
                              </div>
                              {canDeleteMessage ? (
                                <button
                                  type="button"
                                  className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-black text-red-500 hover:bg-red-50 dark:border-red-400/30 dark:hover:bg-red-500/10"
                                  onClick={() => handleDeleteChatMessage(message)}
                                >
                                  Delete
                                </button>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {viewer && canParticipate ? (
                    <form onSubmit={handleSendChat} className="mt-3 flex gap-2">
                      <input
                        type="text"
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                        value={chatText}
                        onChange={(e) => setChatText(e.target.value)}
                        placeholder="Message the community..."
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-brogreen px-4 py-2 text-sm font-black text-black disabled:opacity-50"
                        disabled={chatBusy || !chatText.trim()}
                      >
                        {chatBusy ? "Sending..." : "Send"}
                      </button>
                    </form>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Join this community to chat live.</p>
                  )}
                </>
              )}
            </div>

            {posts.length > 0 ? (
              <ul>
                {posts.map((post) => {
                  const canPinPost = Boolean(viewer?.uid && canModerate);
                  const postOwnerId = post.authorId || post.userId || post.user?.uid;
                  const canDelete = Boolean(viewer?.uid && (canModerate || postOwnerId === viewer.uid) && typeof post.id !== "number");
                  const profileId = post.authorId || post.user?.uid;
                  const bullish = post.bullishVotes || 0;
                  const bearish = post.bearishVotes || 0;
                  const totalVotes = bullish + bearish;
                  const bullishPct = totalVotes > 0 ? Math.round(100 * bullish / totalVotes) : null;
                  return (
                    <li key={post.id} className="relative border-b border-slate-100 dark:border-white/10 px-5 py-6 last:border-b-0">
                      {canDelete ? (
                        <button
                          type="button"
                          className="absolute right-4 top-4 text-lg font-black leading-none text-brogreen hover:opacity-80"
                          onClick={() => handleDeletePost(post)}
                          aria-label="Delete post"
                          title="Delete"
                        >
                          x
                        </button>
                      ) : null}
                      <div className="flex gap-4">
                        {profileId ? (
                          <Link href={`/profile/${profileId}`} className="shrink-0">
                            <img
                              src={post.user?.avatar || getRandomDefaultAvatar()}
                              alt={post.user?.name || "User"}
                              className="h-12 w-12 rounded-full border border-slate-200 dark:border-white/10 object-cover"
                            />
                          </Link>
                        ) : (
                          <img
                            src={post.user?.avatar || getRandomDefaultAvatar()}
                            alt={post.user?.name || "User"}
                            className="h-12 w-12 shrink-0 rounded-full border border-slate-200 dark:border-white/10 object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            {profileId ? (
                              <Link href={`/profile/${profileId}`} className="truncate text-base font-black hover:underline">
                                {post.user?.name || "User"}
                              </Link>
                            ) : (
                              <span className="truncate text-base font-black">{post.user?.name || "User"}</span>
                            )}
                            <span className="truncate text-xs text-slate-500 dark:text-slate-400">{post.user?.handle || "@user"}</span>
                            <span className="text-xs text-slate-400">· {post.time || "recent"}</span>
                          </div>
                          <div className="mb-3 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{post.content || ""}</div>
                          {post.image ? (
                            <div className="mb-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
                              <img src={post.image} alt="Post attachment" className="w-full object-cover" />
                            </div>
                          ) : null}
                          {/* Vote row */}
                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                            <button
                              type="button"
                              className="flex items-center gap-1 hover:text-green-500"
                              onClick={() => handleVote(post, "bullish")}
                              disabled={!viewer || !canParticipate}
                              aria-label="Bullish"
                            >
                              <span>📈</span><span>{bullish}</span>
                            </button>
                            <button
                              type="button"
                              className="flex items-center gap-1 hover:text-red-500"
                              onClick={() => handleVote(post, "bearish")}
                              disabled={!viewer || !canParticipate}
                              aria-label="Bearish"
                            >
                              <span>📉</span><span>{bearish}</span>
                            </button>
                            {totalVotes > 0 ? (
                              <div className="flex items-center gap-1">
                                <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                                  <div className="h-2 bg-brogreen" style={{ width: `${bullishPct}%` }} />
                                </div>
                                <span className="text-xs font-bold text-brogreen">{bullishPct}% Bullish</span>
                              </div>
                            ) : null}
                          </div>
                          {/* Tags + actions */}
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400">
                            {Array.isArray(post.categories) && post.categories.length > 0 ? (
                              post.categories.map((category) => (
                                <span key={category} className="rounded-full bg-slate-100 dark:bg-white/5 px-3 py-1">{category}</span>
                              ))
                            ) : post.category ? (
                              <span className="rounded-full bg-slate-100 dark:bg-white/5 px-3 py-1">{post.category}</span>
                            ) : null}
                            {canPinPost ? (
                              <button
                                type="button"
                                className="rounded-full border border-brogreen/50 px-3 py-1 text-brogreen hover:bg-brogreen/10"
                                onClick={() => handlePinPost(post)}
                                disabled={pinBusy}
                              >
                                {pinBusy ? "Saving..." : "📌 Pin"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        </main>

        <aside className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-6 space-y-4">
            {pinnedAsset ? (
              <div className="panel rounded-3xl border border-brogreen/40 bg-white dark:bg-[#050816] p-5 shadow-sm">
                <div className="text-xs font-black uppercase tracking-widest text-brogreen">Pinned {pinnedAsset.type === "crypto" ? "Crypto" : "Ticker"}</div>
                <div className="mt-2 text-2xl font-black">{pinnedAsset.symbol}</div>
                {pinnedPrice > 0 ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-lg font-black">${pinnedPrice.toFixed(2)}</span>
                    <span className={`text-xs font-black ${pinnedChange >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {pinnedChange >= 0 ? "+" : ""}{pinnedChangePct.toFixed(2)}%
                    </span>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Live price unavailable.</p>
                )}
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Only one stock can be pinned at a time in this community.</p>
              </div>
            ) : null}

            <div id="members-and-roles" className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-lg font-black">Members and Roles</h2>
              {members.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No visible members yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {members.map((member) => {
                    const isOwner = member.uid === ownerId;
                    const isBusy = roleBusyUid === member.uid;
                    const roleLabel = isOwner ? "owner" : member.role || "member";

                    return (
                      <li key={member.uid} className="rounded-2xl border border-slate-200 dark:border-white/10 p-2">
                        <div className="flex items-center gap-3">
                          <img src={member.photoURL} alt={member.name} className="h-9 w-9 rounded-full border border-slate-200 dark:border-white/10 object-cover" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-black">{member.name}</div>
                            <div className="text-[11px] font-black uppercase tracking-wide text-brogreen">{roleLabel}</div>
                          </div>
                        </div>
                        {canModerate && !isOwner ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {canManageAssistants ? (
                              <button
                                type="button"
                                className="rounded-lg border border-slate-200 dark:border-white/10 px-2 py-1 text-[10px] font-black"
                                onClick={() => handleAssignRole(member, "assistant")}
                                disabled={isBusy}
                              >
                                Assistant
                              </button>
                            ) : null}
                            {canManageModerators ? (
                              <button
                                type="button"
                                className="rounded-lg border border-slate-200 dark:border-white/10 px-2 py-1 text-[10px] font-black"
                                onClick={() => handleAssignRole(member, "moderator")}
                                disabled={isBusy}
                              >
                                Moderator
                              </button>
                            ) : null}
                            {(canManageAssistants || canManageModerators) ? (
                              <button
                                type="button"
                                className="rounded-lg border border-slate-200 dark:border-white/10 px-2 py-1 text-[10px] font-black"
                                onClick={() => handleAssignRole(member, "member")}
                                disabled={isBusy}
                              >
                                Member
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-black text-red-500"
                              onClick={() => handleRemoveMember(member)}
                              disabled={isBusy}
                            >
                              Remove
                            </button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div id="community-rules" className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-lg font-black">Community Rules</h2>
              {rules.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No rules yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {rules.map((ruleText) => (
                    <li key={ruleText} className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-white/10 p-2">
                      <span className="mt-0.5 text-xs font-black text-brogreen">•</span>
                      <span className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">{ruleText}</span>
                      {canModerate ? (
                        <button
                          type="button"
                          className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-black text-red-500"
                          onClick={() => handleDeleteRule(ruleText)}
                          disabled={rulesBusy}
                        >
                          Delete
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {canModerate ? (
                <form onSubmit={handleAddRule} className="mt-3 flex gap-2">
                  <input
                    type="text"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                    value={newRule}
                    onChange={(e) => setNewRule(e.target.value)}
                    placeholder="Add a rule"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-brogreen px-3 py-2 text-xs font-black text-black disabled:opacity-50"
                    disabled={rulesBusy || !newRule.trim()}
                  >
                    Add
                  </button>
                </form>
              ) : null}
            </div>

            <div className="panel rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050816] p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Desk Guide</h2>
              <ol className="mt-3 space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brogreen text-xs font-black text-black">1</span>
                  <span className="text-slate-700 dark:text-slate-300"><strong className="text-slate-900 dark:text-slate-100">Join</strong> this community with the button above.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brogreen text-xs font-black text-black">2</span>
                  <span className="text-slate-700 dark:text-slate-300"><strong className="text-slate-900 dark:text-slate-100">Post</strong> directly from the compose box — your posts land in this feed.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brogreen text-xs font-black text-black">3</span>
                  <span className="text-slate-700 dark:text-slate-300"><strong className="text-slate-900 dark:text-slate-100">Pin a ticker or crypto</strong> using the pinned section so every member sees the same asset.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brogreen text-xs font-black text-black">4</span>
                  <span className="text-slate-700 dark:text-slate-300"><strong className="text-slate-900 dark:text-slate-100">Pin a post</strong> using the 📌 button on any post card to highlight a key take.</span>
                </li>
              </ol>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
