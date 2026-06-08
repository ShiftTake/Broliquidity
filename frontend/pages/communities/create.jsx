import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from "firebase/storage";
import { auth, db } from "../../src/firebase";
import { defaultAvatarOptions, getRandomDefaultAvatar } from "../../src/avatarDefaults";

export default function CreateCommunityPage() {
  const router = useRouter();
  const [viewer, setViewer] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [selectedDefaultAvatar, setSelectedDefaultAvatar] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((nextUser) => {
      setViewer(nextUser || null);
    });
    return () => unsubscribe();
  }, []);

  const canSubmit = useMemo(() => {
    return Boolean(viewer?.uid && name.trim() && !saving);
  }, [viewer?.uid, name, saving]);

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0] || null;
    setAvatarFile(file);
    setSelectedDefaultAvatar("");
    setAvatarPreview(file ? URL.createObjectURL(file) : "");
  };

  const handleDefaultAvatarSelect = (avatarUrl) => {
    setAvatarFile(null);
    setSelectedDefaultAvatar(avatarUrl);
    setAvatarPreview(avatarUrl);
  };

  const handleBannerChange = (event) => {
    const file = event.target.files?.[0] || null;
    setBannerFile(file);
    setBannerPreview(file ? URL.createObjectURL(file) : "");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!viewer?.uid) {
      setError("You must be signed in to create a community.");
      return;
    }

    if (!name.trim()) {
      setError("Community name is required.");
      return;
    }

    setSaving(true);

    try {
      const storage = getStorage();
      let avatarUrl = selectedDefaultAvatar || getRandomDefaultAvatar();
      let bannerUrl = "";

      if (avatarFile) {
        const avatarRef = storageRef(storage, `community-avatars/${viewer.uid}-${Date.now()}-${avatarFile.name}`);
        await uploadBytes(avatarRef, avatarFile);
        avatarUrl = await getDownloadURL(avatarRef);
      }

      if (bannerFile) {
        const bannerRef = storageRef(storage, `community-banners/${viewer.uid}-${Date.now()}-${bannerFile.name}`);
        await uploadBytes(bannerRef, bannerFile);
        bannerUrl = await getDownloadURL(bannerRef);
      }

      const communityRef = await addDoc(collection(db, "communities"), {
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        avatar: avatarUrl,
        banner: bannerUrl,
        members: 1,
        createdBy: viewer.uid,
        roleAssignments: {
          ownerId: viewer.uid,
          assistantIds: [],
          moderatorIds: []
        },
        rules: [
          "Be respectful to members.",
          "No spam, scams, or market manipulation."
        ],
        liveChatEnabled: true,
        pinnedAsset: null,
        pinnedPostId: null,
        pinnedPostPreview: null,
        createdAt: serverTimestamp()
      });

      await setDoc(doc(db, "memberships", `${viewer.uid}_${communityRef.id}`), {
        userId: viewer.uid,
        communityId: communityRef.id,
        joinedAt: Date.now()
      }, { merge: true });

      router.push(`/communities/${communityRef.id}`);
    } catch {
      setError("Failed to create community. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl gap-6 px-4 py-6 lg:px-6">
        <aside className="hidden xl:block w-72 shrink-0">
          <div className="sticky top-6 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-brogreen">Create Community</p>
              <h1 className="mt-2 text-2xl font-black">Launch Your Desk</h1>
              <p className="mt-2 text-sm text-slate-500">Set identity, add context, and publish a community page in one flow.</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Quick Links</h2>
              <div className="mt-4 space-y-2">
                <Link href="/communities" className="block rounded-2xl border border-slate-200 px-4 py-3 font-black hover:bg-slate-50">Community Directory</Link>
                <Link href="/feed" className="block rounded-2xl border border-slate-200 px-4 py-3 font-black hover:bg-slate-50">Main Feed</Link>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <Link href="/communities" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-black hover:bg-slate-50">←</Link>
                <div>
                  <h2 className="text-xl font-black">Create Community</h2>
                  <p className="text-xs text-slate-500">Built with the same white feed-style visual system.</p>
                </div>
              </div>
            </div>

            {!viewer ? (
              <div className="space-y-5 p-5">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-brogreen">Sign In Required</p>
                  <h3 className="mt-2 text-xl font-black">Create your desk after you log in</h3>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">
                    Signing in unlocks the full creation flow, including avatar selection, banner upload, ownership setup, and the instant redirect to your new community feed.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href="/login" className="rounded-2xl bg-brogreen px-5 py-3 text-sm font-black text-black">
                      Sign In to Continue
                    </Link>
                    <Link href="/register" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black hover:bg-slate-50">
                      Create Account
                    </Link>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Identity</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">Name your desk and choose an avatar that matches the tone.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Context</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">Add a short description, category, and optional banner so members know what to expect.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Launch</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">Publish instantly and land in the new community feed as the owner.</p>
                  </div>
                </div>
              </div>
            ) : (
            <form className="space-y-4 p-5" onSubmit={handleSubmit}>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Community Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex: Macro Momentum"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Description</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="What this desk is about..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Category Optional</label>
                <input
                  type="text"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Ex: Equities, Crypto, Options"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Avatar</label>
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar preview" className="mt-3 h-20 w-20 rounded-full border border-slate-200 object-cover" />
                  ) : null}
                  <p className="mt-3 text-xs font-black uppercase tracking-wide text-slate-500">Or pick a default avatar</p>
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {defaultAvatarOptions.map((avatarUrl) => (
                      <button
                        key={avatarUrl}
                        type="button"
                        onClick={() => handleDefaultAvatarSelect(avatarUrl)}
                        className={"rounded-xl border-2 p-0.5 " + (avatarPreview === avatarUrl ? "border-brogreen" : "border-transparent hover:border-slate-300")}
                        aria-label="Select default avatar"
                      >
                        <img src={avatarUrl} alt="Default avatar" className="h-10 w-10 rounded-lg object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-500">Banner Optional</label>
                  <input type="file" accept="image/*" onChange={handleBannerChange} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  {bannerPreview ? (
                    <img src={bannerPreview} alt="Banner preview" className="mt-3 h-20 w-full rounded-2xl border border-slate-200 object-cover" />
                  ) : null}
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-600">{error}</div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="rounded-2xl bg-brogreen px-5 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canSubmit}
                >
                  {saving ? "Creating..." : "Create Community"}
                </button>
                <Link href="/communities" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black hover:bg-slate-50">Cancel</Link>
              </div>
            </form>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
