import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { db, auth } from "../firebase";
import Comments from "../Comments";
import { doc, setDoc, deleteDoc, collection, onSnapshot, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";

  const { communityId } = useParams();
  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memberCount, setMemberCount] = useState(0);
  const [members, setMembers] = useState([]);
  const [joined, setJoined] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postCategory, setPostCategory] = useState("stocks");
  const [postError, setPostError] = useState("");
  const user = auth.currentUser;
  // Editable rules and moderators
  const [rules, setRules] = useState([
    "Be respectful and civil.",
    "No spam or self-promotion.",
    "Stay on topic.",
    "Follow all platform guidelines."
  ]);
  const [moderators, setModerators] = useState([]);
  const [editingRules, setEditingRules] = useState(false);
  const [editingMods, setEditingMods] = useState(false);
  const [rulesInput, setRulesInput] = useState("");
  const [modInput, setModInput] = useState("");

  // Fetch community info, posts, and membership
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      // Fetch community info
      const cDoc = await db.collection("communities").doc(communityId).get();
      if (cDoc.exists) {
        const cData = { id: cDoc.id, ...cDoc.data() };
        setCommunity(cData);
        setRules(Array.isArray(cData.rules) ? cData.rules : [
          "Be respectful and civil.",
          "No spam or self-promotion.",
          "Stay on topic.",
          "Follow all platform guidelines."
        ]);
        setModerators(Array.isArray(cData.moderators) && cData.moderators.length > 0 ? cData.moderators : [cData.createdBy].filter(Boolean));
      } else {
        setCommunity(null);
      }
      // Fetch posts for this community
      const postsSnap = await db.collection("posts").where("communityId", "==", communityId).orderBy("createdAt", "desc").get();
      setPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      // Fetch members
      const memSnap = await getDocs(query(collection(db, "memberships"), where("communityId", "==", communityId)));
      setMemberCount(memSnap.size);
      const memberIds = memSnap.docs.map(d => d.data().userId);
      // Try to fetch usernames for each member
      const memberProfiles = await Promise.all(
        memberIds.map(async uid => {
          try {
            const userDoc = await db.collection("users").doc(uid).get();
            if (userDoc.exists) {
              const d = userDoc.data();
              return { uid, username: d.displayName || d.username || d.email || uid };
            }
          } catch {}
          return { uid, username: uid };
        })
      );
      setMembers(memberProfiles);
      // Check if user is joined
      if (user) {
        const joinedSnap = await getDocs(query(collection(db, "memberships"), where("userId", "==", user.uid), where("communityId", "==", communityId)));
        setJoined(!joinedSnap.empty);
      } else {
        setJoined(false);
      }
      setLoading(false);
    }
    fetchData();
  }, [communityId, user]);

  // Save rules to Firestore
  const saveRules = async () => {
    await setDoc(doc(db, "communities", communityId), { ...community, rules }, { merge: true });
    setEditingRules(false);
  };
  // Save moderators to Firestore
  const saveModerators = async () => {
    await setDoc(doc(db, "communities", communityId), { ...community, moderators }, { merge: true });
    setEditingMods(false);
  };

  // Join/leave handlers
  const handleJoin = async () => {
    if (!user) return alert("Sign in to join communities.");
    const ref = doc(db, "memberships", `${user.uid}_${communityId}`);
    await setDoc(ref, { userId: user.uid, communityId, joinedAt: Date.now() });
    setJoined(true);
    setMemberCount(c => c + 1);
  };
  const handleLeave = async () => {
    if (!user) return;
    const ref = doc(db, "memberships", `${user.uid}_${communityId}`);
    await deleteDoc(ref);
    setJoined(false);
    setMemberCount(c => Math.max(0, c - 1));
  };

  // Post to community
  const handlePost = async (e) => {
    e.preventDefault();
    setPostError("");
    if (!user) {
      setPostError("You must be signed in to post.");
      return;
    }
    if (!joined) {
      setPostError("Join the community to post.");
      return;
    }
    if (!postContent.trim()) {
      setPostError("Post content cannot be empty.");
      return;
    }
    try {
      await addDoc(collection(db, "posts"), {
        content: postContent,
        category: postCategory,
        communityId,
        createdAt: new Date(),
        author: user.email || user.displayName || "anon",
        authorId: user.uid,
        bullish: 0,
        bearish: 0
      });
      setPostContent("");
      setPostCategory("stocks");
      // Refresh posts
      const postsSnap = await db.collection("posts").where("communityId", "==", communityId).orderBy("createdAt", "desc").get();
      setPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      setPostError("Failed to post. Try again.");
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!community) return <div className="p-8 text-center">Community not found.</div>;

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h2 className="text-3xl font-black mb-2">c/{community.name}</h2>
      <div className="text-slate-500 mb-2">{community.description}</div>
      {/* Moderators */}
      <div className="mb-2">
        <span className="text-xs text-slate-500 font-bold">Moderators:</span>
        <ul className="flex flex-wrap gap-2 mt-1">
          {moderators.length === 0 ? (
            <li className="text-xs text-slate-400">No moderators yet.</li>
          ) : moderators.map(m => (
            <li key={m} className="bg-slate-300 text-xs rounded px-2 py-1 text-slate-700">@{m}</li>
          ))}
        </ul>
        {/* Edit moderators if creator */}
        {user && community && user.uid === community.createdBy && (
          <div className="mt-2">
            {editingMods ? (
              <div>
                <input
                  type="text"
                  value={modInput}
                  onChange={e => setModInput(e.target.value)}
                  placeholder="Add moderator by user ID"
                  className="px-2 py-1 rounded border border-slate-400 text-xs mr-2"
                />
                <button type="button" className="text-xs bg-brogreen px-2 py-1 rounded font-bold mr-2" onClick={() => {
                  if (modInput && !moderators.includes(modInput)) setModerators([...moderators, modInput]);
                  setModInput("");
                }}>Add</button>
                <button type="button" className="text-xs bg-slate-300 px-2 py-1 rounded font-bold mr-2" onClick={saveModerators}>Save</button>
                <button type="button" className="text-xs bg-red-300 px-2 py-1 rounded font-bold" onClick={() => setEditingMods(false)}>Cancel</button>
                <ul className="flex flex-wrap gap-2 mt-2">
                  {moderators.map(m => (
                    <li key={m} className="bg-slate-200 text-xs rounded px-2 py-1 text-slate-700 flex items-center gap-1">
                      @{m}
                      <button type="button" className="text-red-500 ml-1" onClick={() => setModerators(moderators.filter(x => x !== m))}>×</button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <button className="text-xs underline ml-2" onClick={() => setEditingMods(true)}>Edit Moderators</button>
            )}
          </div>
        )}
      </div>
      {/* Rules */}
      <div className="mb-6">
        <span className="text-xs text-slate-500 font-bold">Rules:</span>
        <ul className="list-disc ml-6 mt-1 text-xs text-slate-700">
          {rules.map((rule, i) => (
            <li key={i}>{rule}</li>
          ))}
        </ul>
        {/* Edit rules if creator */}
        {user && community && user.uid === community.createdBy && (
          <div className="mt-2">
            {editingRules ? (
              <div>
                <textarea
                  value={rulesInput}
                  onChange={e => setRulesInput(e.target.value)}
                  rows={4}
                  className="w-full px-2 py-1 rounded border border-slate-400 text-xs mb-2"
                  placeholder="One rule per line"
                />
                <button type="button" className="text-xs bg-brogreen px-2 py-1 rounded font-bold mr-2" onClick={() => {
                  setRules(rulesInput.split("\n").map(r => r.trim()).filter(Boolean));
                  saveRules();
                }}>Save</button>
                <button type="button" className="text-xs bg-red-300 px-2 py-1 rounded font-bold" onClick={() => setEditingRules(false)}>Cancel</button>
              </div>
            ) : (
              <button className="text-xs underline ml-2" onClick={() => {
                setRulesInput(rules.join("\n"));
                setEditingRules(true);
              }}>Edit Rules</button>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 mb-2">
        <span className="text-sm text-slate-600">{memberCount} member{memberCount === 1 ? "" : "s"}</span>
        {joined ? (
          <button onClick={handleLeave} className="px-4 py-2 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600">Leave</button>
        ) : (
          <button onClick={handleJoin} className="px-4 py-2 rounded-lg bg-[#b6ff22] text-black font-bold hover:scale-105">Join</button>
        )}
      </div>
      {/* Member list */}
      <div className="mb-6">
        <span className="text-xs text-slate-500 font-bold">Members:</span>
        <ul className="flex flex-wrap gap-2 mt-1">
          {members.map(m => (
            <li key={m.uid} className="bg-slate-200 text-xs rounded px-2 py-1 text-slate-700">@{m.username}</li>
          ))}
        </ul>
      </div>
      {/* Post form for joined members */}
      {joined && (
        <form onSubmit={handlePost} className="glass p-6 rounded-2xl mb-8">
          <h3 className="text-xl font-bold mb-4">Post to c/{community.name}</h3>
          <div className="flex flex-col md:flex-row gap-3 mb-3">
            <select
              value={postCategory}
              onChange={e => setPostCategory(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
            >
              <option value="stocks">Stocks</option>
              <option value="options">Options</option>
              <option value="crypto">Crypto</option>
              <option value="jobs">Jobs</option>
              <option value="careers">Careers</option>
              <option value="other">Other</option>
            </select>
          </div>
          <textarea
            value={postContent}
            onChange={e => setPostContent(e.target.value)}
            placeholder={`What's on your mind in c/${community.name}?`}
            className="w-full mb-3 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
            rows={3}
          />
          {postError && <div className="text-red-400 mb-2">{postError}</div>}
          <button type="submit" className="px-6 py-2 rounded-xl bg-[#b6ff22] text-black font-bold hover:scale-105 transition">
            Post
          </button>
        </form>
      )}
      <h3 className="text-xl font-bold mb-4">Posts</h3>
      {posts.length === 0 ? (
        <div className="text-slate-400">No posts yet.</div>
      ) : (
        <ul className="space-y-4">
          {posts.map(post => (
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
                  <div className="text-xs text-slate-400">{post.category?.toUpperCase()}</div>
                  <div className="text-xs text-slate-500">{post.createdAt ? new Date(post.createdAt).toLocaleString() : ""}</div>
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
