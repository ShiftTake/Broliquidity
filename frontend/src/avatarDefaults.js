import { doc, getDoc, setDoc } from "firebase/firestore";

export const defaultAvatarOptions = Array.from(
  { length: 15 },
  (_, i) => `/defaults/default${i + 1}.png`
);

export const getRandomDefaultAvatar = () => {
  const idx = Math.floor(Math.random() * defaultAvatarOptions.length);
  return defaultAvatarOptions[idx];
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