// useParams removed for Next.js migration

export default function Community() {
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

  // ...existing code for rendering the community page...
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
                    <li key={m} className="bg-slate-300 text-xs rounded px-2 py-1 text-slate-700">@{m}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <button type="button" className="text-xs bg-brogreen px-2 py-1 rounded font-bold" onClick={() => setEditingMods(true)}>Edit Moderators</button>
            )}
          </div>
        )}
      </div>
      {/* ...existing code for posts, rules, and other UI... */}
    </div>
  );
}
