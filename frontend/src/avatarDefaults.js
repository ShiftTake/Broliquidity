import { doc, getDoc, setDoc } from "firebase/firestore";

export const defaultAvatarOptions = Array.from(
  { length: 15 },
  (_, i) => `/defaults/default${i + 1}.png`
);

export const getRandomDefaultAvatar = () => {
  const idx = Math.floor(Math.random() * defaultAvatarOptions.length);
  return defaultAvatarOptions[idx];
};

export const getDeterministicDefaultAvatar = (seed) => {
  const normalized = String(seed || "user");
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % defaultAvatarOptions.length;
  return defaultAvatarOptions[idx] || defaultAvatarOptions[0];
};

export const getAvatarUrl = (userLike, fallbackSeed = "user") => {
  if (userLike?.photoURL) return userLike.photoURL;
  const seed =
    userLike?.uid ||
    userLike?.id ||
    userLike?.email ||
    userLike?.displayName ||
    fallbackSeed;
  return getDeterministicDefaultAvatar(seed);
};

export const ensureUserHasAvatar = async (db, uid) => {
  if (!uid) {
    return {
      uid: "unknown",
      photoURL: getRandomDefaultAvatar()
    };
  }

  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const randomAvatar = getRandomDefaultAvatar();
    await setDoc(userRef, { photoURL: randomAvatar }, { merge: true });
    return { uid, photoURL: randomAvatar };
  }

  const userData = userSnap.data() || {};
  if (userData.photoURL) {
    return { uid, ...userData };
  }

  const randomAvatar = getRandomDefaultAvatar();
  await setDoc(userRef, { photoURL: randomAvatar }, { merge: true });
  return { uid, ...userData, photoURL: randomAvatar };
};