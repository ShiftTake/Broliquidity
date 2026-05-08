import { db, auth } from "./firebase";
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";

/**
 * Follow a user by uid.
 */
export async function followUser(targetUid) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const userRef = doc(db, "users", user.uid);
  await updateDoc(userRef, { following: arrayUnion(targetUid) });
}

/**
 * Unfollow a user by uid.
 */
export async function unfollowUser(targetUid) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const userRef = doc(db, "users", user.uid);
  await updateDoc(userRef, { following: arrayRemove(targetUid) });
}

/**
 * Get a user's following list.
 */
export async function getFollowing(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data().following || [] : [];
}
