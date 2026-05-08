import { db, auth } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Place a paper trade (buy/sell) for the current user.
 * @param {string} symbol - Stock symbol
 * @param {number} quantity - Number of shares
 * @param {number} price - Price per share
 * @param {string} side - "buy" or "sell"
 * @returns {Promise}
 */
export async function placePaperTrade(symbol, quantity, price, side) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const trade = {
    uid: user.uid,
    symbol,
    quantity,
    price,
    side,
    createdAt: serverTimestamp(),
  };
  return addDoc(collection(db, `users/${user.uid}/paperTrades`), trade);
}
