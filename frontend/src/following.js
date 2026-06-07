import { db, auth } from "./firebase";
import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  writeBatch
} from "firebase/firestore";

/**
 * Follow a user by uid.
 */
export async function followUser(targetUid) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  if (!targetUid) throw new Error("Missing target user");
  if (targetUid === user.uid) throw new Error("Cannot follow yourself");

  const meRef = doc(db, "users", user.uid);
  const targetRef = doc(db, "users", targetUid);
  const followRef = doc(db, "follows", `${user.uid}_${targetUid}`);

  const batch = writeBatch(db);
  batch.set(followRef, {
    followerId: user.uid,
    followingId: targetUid,
    createdAt: serverTimestamp()
  }, { merge: true });
  batch.set(meRef, { following: arrayUnion(targetUid) }, { merge: true });
  batch.set(targetRef, { followers: arrayUnion(user.uid) }, { merge: true });
  await batch.commit();
}

/**
 * Unfollow a user by uid.
 */
export async function unfollowUser(targetUid) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  if (!targetUid) throw new Error("Missing target user");
  if (targetUid === user.uid) throw new Error("Cannot unfollow yourself");

  const meRef = doc(db, "users", user.uid);
  const targetRef = doc(db, "users", targetUid);
  const followRef = doc(db, "follows", `${user.uid}_${targetUid}`);

  const batch = writeBatch(db);
  batch.delete(followRef);
  batch.set(meRef, { following: arrayRemove(targetUid) }, { merge: true });
  batch.set(targetRef, { followers: arrayRemove(user.uid) }, { merge: true });
  await batch.commit();
}

/**
 * Get a user's following list.
 */
export async function getFollowing(uid) {
  const followsQ = query(collection(db, "follows"), where("followerId", "==", uid));
  const followsSnap = await getDocs(followsQ);
  if (!followsSnap.empty) {
    return followsSnap.docs.map((d) => d.data().followingId).filter(Boolean);
  }

  // Backward compatibility for older data that only used users.following.
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data().following || [] : [];
}

/**
 * Get user IDs that follow the specified user.
 */
export async function getFollowers(uid) {
  const followsQ = query(collection(db, "follows"), where("followingId", "==", uid));
  const followsSnap = await getDocs(followsQ);
  return followsSnap.docs.map((d) => d.data().followerId).filter(Boolean);
}
