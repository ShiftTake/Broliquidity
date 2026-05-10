import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import PaperTradeHistory from "./PaperTradeHistory";
import PaperPortfolio from "./PaperPortfolio";

function UserProfile() {
  const [user, setUser] = useState(null);
  const [bio, setBio] = useState("");
  const [editing, setEditing] = useState(false);
  const [photoURL, setPhotoURL] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    const u = auth.currentUser;
    setUser(u);
    if (u) {
      const fetchProfile = async () => {
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          setBio(snap.data().bio || "");
          setPhotoURL(snap.data().photoURL || "");
        }
        setLoading(false);
      };
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setError("");
    try {
      await setDoc(doc(db, "users", user.uid), {
        bio,
        email: user.email,
        displayName: user.displayName || "",
        photoURL
      });
      setEditing(false);
    } catch (err) {
      setError("Failed to save profile.");
    }
  };

  const handlePhotoChange = async (e) => {
    if (!user) return;
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `profile-pictures/${user.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setPhotoURL(url);
    } catch (err) {
      setError("Failed to upload photo.");
    }
    setUploading(false);
  };

  if (loading) return <div className="text-slate-400 text-center mt-8">Loading profile...</div>;
  if (!user) return <div className="text-slate-400 text-center mt-8">Sign in to view your profile.</div>;

  return (
    <div className="glass max-w-md mx-auto mt-12 p-8 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Your Profile</h2>
      <div className="flex flex-col items-center mb-4">
        <div className="mb-2">
          <img
            src={photoURL || "/mainlogo.png"}
            alt="Profile"
            className="w-20 h-20 rounded-full object-cover border-2 border-[#b6ff22] bg-slate-800"
          />
        </div>
        {/* Share profile button */}
        <button
          className="mt-2 px-4 py-2 rounded-xl bg-slate-800 text-white text-xs hover:bg-slate-700"
          title="Copy profile link"
          onClick={() => {
            const url = `${window.location.origin}/profile/${user?.uid}`;
            navigator.clipboard.writeText(url);
            alert("Profile link copied!");
          }}
        >
          Share Profile
        </button>
      </div>
      <div className="mb-2 text-slate-300"><b>Email:</b> {user.email}</div>
      <div className="mb-2 text-slate-300"><b>Name:</b> {user.displayName || "-"}</div>
      <div className="mb-4">
        <b>Bio:</b>
        <div className="mt-1 text-slate-200">{bio || <span className="text-slate-500">No bio yet.</span>}</div>
      </div>
      {error && <div className="text-red-400 mb-2">{error}</div>}
      <button onClick={() => { setEditing(true); setShowEditModal(true); }} className="px-6 py-2 rounded-xl bg-[#b6ff22] text-black font-bold hover:scale-105 transition">Edit Profile</button>

      <Modal open={showEditModal} onClose={() => { setShowEditModal(false); setEditing(false); }}>
        <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
        <div className="flex flex-col items-center mb-4">
          <div className="mb-2">
            <img
              src={photoURL || "/mainlogo.png"}
              alt="Profile"
              className="w-20 h-20 rounded-full object-cover border-2 border-[#b6ff22] bg-slate-800"
            />
          </div>
          <label className="block text-xs text-slate-400 mb-2">
            {uploading ? "Uploading..." : "Change profile picture:"}
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="block mt-1 text-xs text-slate-200"
              disabled={uploading}
            />
          </label>
        </div>
        <div className="mb-4">
          <b>Bio:</b>
          <textarea
            className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={3}
          />
        </div>
        {error && <div className="text-red-400 mb-2">{error}</div>}
        <button onClick={async () => { await handleSave(); setShowEditModal(false); setEditing(false); }} className="px-6 py-2 rounded-xl bg-[#b6ff22] text-black font-bold hover:scale-105 transition mr-2">Save</button>
      </Modal>

      {/* Paper trading portfolio and history */}
      <div className="mt-8">
        <PaperPortfolio />
        <PaperTradeHistory />
      </div>
    </div>
  );
}

export default UserProfile;
