
import { useEffect, useState } from "react";

// Community page
const renderCommunityPage = () => {
  if (!selectedCommunity) return null;

  const communityPosts = posts.filter(
    p => p.community === selectedCommunity.id
  );

  return (
    <div className="max-w-2xl mx-auto w-full p-4">
      <button
        onClick={() => setActiveView("feed")}
        className="mb-6 font-black text-brogreen"
      >
        ← Back
      </button>

      <div className="mb-8">
        <div className="text-3xl font-black mb-2">
          c/{selectedCommunity.name}
        </div>

        <div className="text-slate-500">
          {selectedCommunity.description}
        </div>
      </div>

      {communityPosts.length ? (
        communityPosts.map(renderPostCard)
      ) : (
        <div className="text-slate-500 text-center py-20">
          No posts in this community yet.
        </div>
      )}
    </div>
  );
};

// Profile page
const renderProfilePage = () => {
  if (!selectedProfile) return null;

  const userPosts = posts.filter(
    p => p.author === selectedProfile.name
  );

  return (
    <div className="max-w-2xl mx-auto w-full p-4">
      <button
        onClick={() => setActiveView("feed")}
        className="mb-6 font-black text-brogreen"
      >
        ← Back
      </button>

      <div className="text-center mb-10">
        <img
          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
            selectedProfile.avatar
          )}&background=050816&color=B6FF22`}
          className="w-28 h-28 rounded-full mx-auto mb-4"
          alt=""
        />

        <div className="text-3xl font-black mb-1">
          @{selectedProfile.name}
        </div>

        <div className="text-slate-500">
          {selectedProfile.role}
        </div>
      </div>

      <div>
        <div className="font-black mb-4 text-xl">Posts</div>

        {userPosts.length ? (
          userPosts.map(renderPostCard)
        ) : (
          <div className="text-slate-500 text-center py-10">
            No posts yet.
          </div>
        )}
      </div>
    </div>
  );
};

// Main content switcher
const renderMainContent = () => {
  switch (activeView) {
    case "explore":
      return renderExplore();

    case "community":
      return renderCommunityPage();

    case "profile":
      return renderProfilePage();

    default:
      return renderFeed();
  }
};

// Replace your existing <main> section with:
<main className="flex-1 min-h-screen">
  {renderMainContent()}
</main>

// Additional imports
import {
  doc,
  updateDoc,
  increment
} from "firebase/firestore";

// Additional state
const [broLLMOpen, setBroLLMOpen] = useState(false);
const [broMessages, setBroMessages] = useState([]);
const [broInput, setBroInput] = useState("");
const [broLoading, setBroLoading] = useState(false);

const [dmOpen, setDMOpen] = useState(false);
const [selectedDMUser, setSelectedDMUser] = useState(null);
const [dmInput, setDMInput] = useState("");
const [dmMessages, setDMMessages] = useState({});

const [watchlist, setWatchlist] = useState(() => {
  return JSON.parse(localStorage.getItem("watchlist") || "[]");
});

const [paperPositions, setPaperPositions] = useState(() => {
  return JSON.parse(localStorage.getItem("paperPositions") || "[]");
});

const [assetQuery, setAssetQuery] = useState("");
const [assetResults, setAssetResults] = useState([]);
const [loadingAssets, setLoadingAssets] = useState(false);

// Persist local state
useEffect(() => {
  localStorage.setItem("watchlist", JSON.stringify(watchlist));
}, [watchlist]);

useEffect(() => {
  localStorage.setItem(
    "paperPositions",
    JSON.stringify(paperPositions)
  );
}, [paperPositions]);

// Bro LLM submit
const submitBroPrompt = async e => {
  e.preventDefault();

  if (!broInput.trim()) return;

  const prompt = broInput;

  setBroMessages(prev => [
    ...prev,
    {
      role: "user",
      content: prompt
    }
  ]);

  setBroInput("");
  setBroLoading(true);

  try {
    const res = await fetch(
      "https://us-central1-broliquidity.cloudfunctions.net/broLLM",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt
        })
      }
    );

    const data = await res.json();

    setBroMessages(prev => [
      ...prev,
      {
        role: "assistant",
        content:
          data.answer ||
          data.error ||
          "No response returned."
      }
    ]);
  } catch (err) {
    setBroMessages(prev => [
      ...prev,
      {
        role: "assistant",
        content: err.message
      }
    ]);
  }

  setBroLoading(false);
};

// DM submit
const sendDM = e => {
  e.preventDefault();

  if (!selectedDMUser || !dmInput.trim()) return;

  const existing = dmMessages[selectedDMUser.name] || [];

  setDMMessages(prev => ({
    ...prev,
    [selectedDMUser.name]: [
      ...existing,
      {
        sender: currentUser?.displayName || "You",
        content: dmInput,
        createdAt: Date.now()
      }
    ]
  }));

  setDMInput("");
};

// Asset search
useEffect(() => {
  if (!assetQuery.trim()) {
    setAssetResults([]);
    return;
  }

  const timeout = setTimeout(async () => {
    setLoadingAssets(true);

    try {
      const res = await fetch(
        `https://us-central1-broliquidity.cloudfunctions.net/searchSymbol?query=${encodeURIComponent(
          assetQuery
        )}`
      );

      const data = await res.json();

      setAssetResults((data.result || []).slice(0, 8));
    } catch (err) {
      console.error(err);
    }

    setLoadingAssets(false);
  }, 400);

  return () => clearTimeout(timeout);
}, [assetQuery]);

// Watchlist actions
const addToWatchlist = ticker => {
  if (watchlist.includes(ticker)) return;

  setWatchlist(prev => [...prev, ticker]);
};

const removeFromWatchlist = ticker => {
  setWatchlist(prev => prev.filter(t => t !== ticker));
};

// Paper trading
const executePaperTrade = (ticker, side) => {
  const qty = 10;
  const fakePrice = Math.floor(Math.random() * 500) + 20;

  setPaperPositions(prev => [
    ...prev,
    {
      id: crypto.randomUUID(),
      ticker,
      side,
      qty,
      price: fakePrice,
      createdAt: Date.now()
    }
  ]);
};

const clearPaperPositions = () => {
  setPaperPositions([]);
};

// Voting
const votePost = async (postId, type) => {
  try {
    const ref = doc(db, "posts", postId);

    await updateDoc(ref, {
      [type]: increment(1)
    });
  } catch (err) {
    console.error(err);
  }
};

// Save/bookmark system
const getSavedPosts = () => {
  return JSON.parse(localStorage.getItem("savedPosts") || "[]");
};

const savePost = id => {
  const existing = getSavedPosts();

  if (existing.includes(id)) return;

  localStorage.setItem(
    "savedPosts",
    JSON.stringify([...existing, id])
  );
};

// Enhanced post card
const renderEnhancedPostCard = post => {
  const saved = getSavedPosts().includes(post.id);

  return (
    <div
      key={post.id}
      className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 mb-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
              post.author || "B"
            )}&background=050816&color=B6FF22`}
            className="w-12 h-12 rounded-full"
            alt=""
          />

          <div>
            <div className="font-black">@{post.author}</div>
            <div className="text-xs text-slate-500">
              {post.category} • {post.label}
            </div>
          </div>
        </div>

        <button
          onClick={() => savePost(post.id)}
          className={`text-sm font-black ${
            saved ? "text-brogreen" : "text-slate-500"
          }`}
        >
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      <div className="whitespace-pre-wrap leading-relaxed mb-4">
        {post.content}
      </div>

      {post.imageUrl && (
        <img
          src={post.imageUrl}
          className="w-full rounded-2xl mb-4 max-h-[500px] object-cover"
          alt=""
        />
      )}

      <div className="flex items-center justify-between text-sm">
        <button
          onClick={() => votePost(post.id, "bullish")}
          className="font-black hover:text-green-500"
        >
          Bullish ({post.bullish || 0})
        </button>

        <button
          onClick={() => votePost(post.id, "bearish")}
          className="font-black hover:text-red-500"
        >
          Bearish ({post.bearish || 0})
        </button>

        <button className="font-black hover:text-blue-500">
          Comments ({post.comments || 0})
        </button>
      </div>
    </div>
  );
};

// Bro LLM modal
const renderBroLLMModal = () => {
  if (!broLLMOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#050816] border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="text-2xl font-black">Bro LLM</div>

          <button onClick={() => setBroLLMOpen(false)}>
            Close
          </button>
        </div>

        <div className="h-[500px] overflow-y-auto p-5 space-y-4">
          {broMessages.map((msg, i) => (
            <div
              key={i}
              className={`rounded-2xl p-4 ${
                msg.role === "user"
                  ? "bg-brogreen text-black"
                  : "bg-slate-100 dark:bg-white/10"
              }`}
            >
              {msg.content}
            </div>
          ))}

          {broLoading && (
            <div className="text-slate-500 animate-pulse">
              Thinking...
            </div>
          )}
        </div>

        <form
          onSubmit={submitBroPrompt}
          className="p-5 border-t border-white/10 flex gap-3"
        >
          <input
            value={broInput}
            onChange={e => setBroInput(e.target.value)}
            placeholder="Ask Bro anything..."
            className="flex-1 px-5 py-4 rounded-2xl bg-slate-100 dark:bg-white/10 outline-none"
          />

          <button className="px-6 rounded-2xl bg-brogreen text-black font-black">
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

// DMs modal
const renderDMModal = () => {
  if (!dmOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[700px] rounded-3xl overflow-hidden bg-white dark:bg-[#050816] border border-white/10 grid grid-cols-[300px_1fr]">
        <div className="border-r border-white/10 overflow-y-auto">
          <div className="p-5 text-2xl font-black border-b border-white/10">
            Messages
          </div>

          {following.map(user => (
            <button
              key={user.name}
              onClick={() => setSelectedDMUser(user)}
              className="w-full p-4 flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                  user.avatar
                )}&background=050816&color=B6FF22`}
                className="w-12 h-12 rounded-full"
                alt=""
              />

              <div className="text-left">
                <div className="font-black">@{user.name}</div>
                <div className="text-xs text-slate-500">
                  {user.role}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-col">
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <div className="font-black text-xl">
              {selectedDMUser
                ? `@${selectedDMUser.name}`
                : "Select a conversation"}
            </div>

            <button onClick={() => setDMOpen(false)}>
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {(dmMessages[selectedDMUser?.name] || []).map((msg, i) => (
              <div
                key={i}
                className="rounded-2xl p-4 bg-slate-100 dark:bg-white/10"
              >
                <div className="font-black mb-1">
                  {msg.sender}
                </div>

                <div>{msg.content}</div>
              </div>
            ))}
          </div>

          {selectedDMUser && (
            <form
              onSubmit={sendDM}
              className="p-5 border-t border-white/10 flex gap-3"
            >
              <input
                value={dmInput}
                onChange={e => setDMInput(e.target.value)}
                placeholder="Type a message"
                className="flex-1 px-5 py-4 rounded-2xl bg-slate-100 dark:bg-white/10 outline-none"
              />

              <button className="px-6 rounded-2xl bg-brogreen text-black font-black">
                Send
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// Watchlist panel
const renderWatchlist = () => {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="font-black text-xl">Watchlist</div>
      </div>

      <input
        value={assetQuery}
        onChange={e => setAssetQuery(e.target.value)}
        placeholder="Search ticker"
        className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/10 outline-none mb-4"
      />

      {!!assetResults.length && (
        <div className="space-y-2 mb-5">
          {assetResults.map(asset => (
            <div
              key={asset.symbol}
              className="flex items-center justify-between rounded-2xl p-3 bg-slate-100 dark:bg-white/10"
            >
              <div>
                <div className="font-black">${asset.symbol}</div>
                <div className="text-xs text-slate-500">
                  {asset.description}
                </div>
              </div>

              <button
                onClick={() => addToWatchlist(asset.symbol)}
                className="px-4 py-2 rounded-xl bg-brogreen text-black font-black"
              >
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {watchlist.map(ticker => (
          <div
            key={ticker}
            className="rounded-2xl p-4 bg-slate-100 dark:bg-white/10"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-black text-lg">${ticker}</div>

              <button
                onClick={() => removeFromWatchlist(ticker)}
                className="text-red-500 text-sm"
              >
                Remove
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => executePaperTrade(ticker, "buy")}
                className="flex-1 py-2 rounded-xl bg-green-500/20 text-green-500 font-black"
              >
                Paper Buy
              </button>

              <button
                onClick={() => executePaperTrade(ticker, "sell")}
                className="flex-1 py-2 rounded-xl bg-red-500/20 text-red-500 font-black"
              >
                Paper Sell
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Additional imports
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

// Additional state
const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
const [postModalOpen, setPostModalOpen] = useState(false);
const [createCommunityOpen, setCreateCommunityOpen] = useState(false);
const [profileModalOpen, setProfileModalOpen] = useState(false);

const [postContent, setPostContent] = useState("");
const [postImage, setPostImage] = useState(null);
const [postPreview, setPostPreview] = useState("");
const [postSubject, setPostSubject] = useState("");
const [postLabel, setPostLabel] = useState("");
const [postDestination, setPostDestination] = useState("feed");
const [selectedCommunityID, setSelectedCommunityID] = useState("");

const [profileBio, setProfileBio] = useState("");
const [communityName, setCommunityName] = useState("");
const [communityDescription, setCommunityDescription] = useState("");

// Labels map
const labelOptions = {
  Stocks: ["Earnings", "DD", "News", "Swing Trade"],
  Options: ["YOLO", "Flow", "IV", "Gamma"],
  Crypto: ["Altcoins", "BTC", "ETH", "DeFi"]
};

// Handle image preview
const handlePostImage = e => {
  const file = e.target.files[0];

  if (!file) return;

  setPostImage(file);
  setPostPreview(URL.createObjectURL(file));
};

// Submit post
const submitPost = async e => {
  e.preventDefault();

  if (!currentUser) return;

  if (!postContent.trim() && !postImage) return;

  let imageUrl = "";

  try {
    if (postImage) {
      const imageRef = ref(
        storage,
        `post_images/${currentUser.uid}_${Date.now()}_${postImage.name}`
      );

      await uploadBytes(imageRef, postImage);

      imageUrl = await getDownloadURL(imageRef);
    }

    await addDoc(collection(db, "posts"), {
      content: postContent,
      imageUrl,
      category: postSubject,
      label: postLabel,
      destination: postDestination,
      community: selectedCommunityID,
      author:
        currentUser.displayName ||
        currentUser.email?.split("@")[0] ||
        "bro",
      authorId: currentUser.uid,
      bullish: 0,
      bearish: 0,
      comments: 0,
      createdAt: serverTimestamp()
    });

    setPostContent("");
    setPostImage(null);
    setPostPreview("");
    setPostSubject("");
    setPostLabel("");
    setSelectedCommunityID("");
    setPostModalOpen(false);
  } catch (err) {
    console.error(err);
  }
};

// Create community
const createCommunity = async () => {
  if (!communityName.trim() || !currentUser) return;

  try {
    await addDoc(collection(db, "communities"), {
      name: communityName,
      description: communityDescription,
      creator: currentUser.uid,
      moderators: [currentUser.uid],
      members: [currentUser.uid],
      createdAt: serverTimestamp()
    });

    setCommunityName("");
    setCommunityDescription("");
    setCreateCommunityOpen(false);

    loadCommunities();
  } catch (err) {
    console.error(err);
  }
};

// Save profile
const saveProfile = async () => {
  if (!currentUser) return;

  try {
    await setDoc(
      doc(db, "profiles", currentUser.uid),
      {
        bio: profileBio
      },
      { merge: true }
    );

    setProfileModalOpen(false);
  } catch (err) {
    console.error(err);
  }
};

// Mobile drawer
const renderMobileDrawer = () => {
  return (
    <>
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-[320px] z-50 bg-white dark:bg-[#050816] border-r border-slate-200 dark:border-white/10 transition-transform duration-300 lg:hidden ${
          mobileDrawerOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="text-2xl font-black">BroLiquidity</div>

          <button onClick={() => setMobileDrawerOpen(false)}>
            Close
          </button>
        </div>

        <div className="p-4 overflow-y-auto h-full space-y-6">
          <div>
            <div className="text-xs font-black text-slate-500 mb-3">
              COMMUNITIES
            </div>

            <div className="space-y-2">
              {communities.map(comm => (
                <button
                  key={comm.id}
                  onClick={() => {
                    setSelectedCommunity(comm);
                    setActiveView("community");
                    setMobileDrawerOpen(false);
                  }}
                  className="w-full text-left rounded-2xl p-4 bg-slate-100 dark:bg-white/5"
                >
                  <div className="font-black">
                    c/{comm.name}
                  </div>

                  <div className="text-xs text-slate-500">
                    {comm.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-black text-slate-500 mb-3">
              FOLLOWING
            </div>

            <div className="space-y-2">
              {following.map(user => (
                <button
                  key={user.name}
                  onClick={() => {
                    setSelectedProfile(user);
                    setActiveView("profile");
                    setMobileDrawerOpen(false);
                  }}
                  className="w-full flex items-center gap-3 rounded-2xl p-3 bg-slate-100 dark:bg-white/5"
                >
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                      user.avatar
                    )}&background=050816&color=B6FF22`}
                    className="w-10 h-10 rounded-full"
                    alt=""
                  />

                  <div className="text-left">
                    <div className="font-black">
                      @{user.name}
                    </div>

                    <div className="text-xs text-slate-500">
                      {user.role}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

// Composer modal
const renderComposerModal = () => {
  if (!postModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#050816] border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="text-2xl font-black">
            Create Post
          </div>

          <button onClick={() => setPostModalOpen(false)}>
            Close
          </button>
        </div>

        <form onSubmit={submitPost} className="p-5 space-y-5">
          <textarea
            value={postContent}
            onChange={e => setPostContent(e.target.value)}
            placeholder="Share your trade idea..."
            className="w-full min-h-[180px] rounded-2xl bg-slate-100 dark:bg-white/10 p-5 outline-none resize-none"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              value={postSubject}
              onChange={e => {
                setPostSubject(e.target.value);
                setPostLabel("");
              }}
              className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/10 outline-none"
            >
              <option value="">Select Subject</option>
              <option value="Stocks">Stocks</option>
              <option value="Options">Options</option>
              <option value="Crypto">Crypto</option>
            </select>

            <select
              value={postLabel}
              onChange={e => setPostLabel(e.target.value)}
              className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/10 outline-none"
            >
              <option value="">Select Label</option>

              {(labelOptions[postSubject] || []).map(label => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <select
            value={postDestination}
            onChange={e => setPostDestination(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/10 outline-none"
          >
            <option value="feed">Main Feed</option>
            <option value="community">Community</option>
          </select>

          {postDestination === "community" && (
            <select
              value={selectedCommunityID}
              onChange={e => setSelectedCommunityID(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/10 outline-none"
            >
              <option value="">Select Community</option>

              {communities.map(comm => (
                <option key={comm.id} value={comm.id}>
                  {comm.name}
                </option>
              ))}
            </select>
          )}

          <div>
            <input
              type="file"
              accept="image/*"
              onChange={handlePostImage}
            />
          </div>

          {postPreview && (
            <img
              src={postPreview}
              className="w-full rounded-2xl max-h-[400px] object-cover"
              alt="preview"
            />
          )}

          <button className="w-full py-4 rounded-2xl bg-brogreen text-black font-black text-lg">
            Post
          </button>
        </form>
      </div>
    </div>
  );
};

// Profile modal
const renderProfileModal = () => {
  if (!profileModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-[#050816] border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="text-2xl font-black">
            Edit Profile
          </div>

          <button onClick={() => setProfileModalOpen(false)}>
            Close
          </button>
        </div>

        <div className="p-5 space-y-5">
          <textarea
            value={profileBio}
            onChange={e => setProfileBio(e.target.value)}
            placeholder="Your bio"
            className="w-full min-h-[150px] rounded-2xl bg-slate-100 dark:bg-white/10 p-5 outline-none resize-none"
          />

          <button
            onClick={saveProfile}
            className="w-full py-4 rounded-2xl bg-brogreen text-black font-black"
          >
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
};

// Community creation modal
const renderCreateCommunityModal = () => {
  if (!createCommunityOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-[#050816] border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="text-2xl font-black">
            Create Community
          </div>

          <button onClick={() => setCreateCommunityOpen(false)}>
            Close
          </button>
        </div>

        <div className="p-5 space-y-5">
          <input
            value={communityName}
            onChange={e => setCommunityName(e.target.value)}
            placeholder="Community name"
            className="w-full px-5 py-4 rounded-2xl bg-slate-100 dark:bg-white/10 outline-none"
          />

          <textarea
            value={communityDescription}
            onChange={e => setCommunityDescription(e.target.value)}
            placeholder="Description"
            className="w-full min-h-[150px] rounded-2xl bg-slate-100 dark:bg-white/10 p-5 outline-none resize-none"
          />

          <button
            onClick={createCommunity}
            className="w-full py-4 rounded-2xl bg-brogreen text-black font-black"
          >
            Create Community
          </button>
        </div>
      </div>
    </div>
  );
};

// Final layout structure
return (
  <div className="min-h-screen bg-[#f8fafc] dark:bg-[#050816] text-slate-900 dark:text-white flex">
    {/* Mobile drawer */}
    {renderMobileDrawer()}

    {/* Left sidebar */}
    <aside className="hidden lg:flex w-[300px] border-r border-slate-200 dark:border-white/10 flex-col p-6 sticky top-0 h-screen">
      <div className="text-3xl font-black mb-8">
        BroLiquidity
      </div>

      <nav className="space-y-2 mb-8">
        <button
          onClick={() => setActiveView("feed")}
          className="w-full text-left px-5 py-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 font-black"
        >
          Home
        </button>

        <button
          onClick={() => setActiveView("explore")}
          className="w-full text-left px-5 py-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 font-black"
        >
          Explore
        </button>

        <button
          onClick={() => setBroLLMOpen(true)}
          className="w-full text-left px-5 py-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 font-black"
        >
          Bro LLM
        </button>

        <button
          onClick={() => setDMOpen(true)}
          className="w-full text-left px-5 py-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 font-black"
        >
          Messages
        </button>
      </nav>

      <button
        onClick={() => setPostModalOpen(true)}
        className="w-full py-4 rounded-2xl bg-brogreen text-black font-black text-lg mb-6"
      >
        Post
      </button>

      <button
        onClick={() => setCreateCommunityOpen(true)}
        className="w-full py-4 rounded-2xl bg-blue-500 text-white font-black mb-6"
      >
        Create Community
      </button>

      <div className="mt-auto">
        <button
          onClick={() => setProfileModalOpen(true)}
          className="w-full rounded-2xl p-4 bg-slate-100 dark:bg-white/5 flex items-center gap-3"
        >
          <img
            src={profilePhoto}
            className="w-12 h-12 rounded-full"
            alt=""
          />

          <div className="text-left">
            <div className="font-black">
              {currentUser?.displayName || "User"}
            </div>

            <div className="text-xs text-slate-500">
              @{currentUser?.email?.split("@")[0]}
            </div>
          </div>
        </button>
      </div>
    </aside>

    {/* Main feed */}
    <main className="flex-1 min-h-screen">
      {renderMainContent()}
    </main>

    {/* Right rail */}
    <aside className="hidden xl:block w-[380px] border-l border-slate-200 dark:border-white/10 p-6 sticky top-0 h-screen overflow-y-auto">
      {renderWatchlist()}
    </aside>

    {/* Floating mobile buttons */}
    <button
      onClick={() => setMobileDrawerOpen(true)}
      className="lg:hidden fixed top-5 left-5 z-40 w-14 h-14 rounded-full bg-brogreen text-black font-black"
    >
      ☰
    </button>

    <button
      onClick={() => setPostModalOpen(true)}
      className="lg:hidden fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-brogreen text-black text-3xl font-black shadow-2xl"
    >
      +
    </button>

    {/* Modals */}
    {renderComposerModal()}
    {renderProfileModal()}
    {renderCreateCommunityModal()}
    {renderBroLLMModal()}
    {renderDMModal()}
  </div>
);



