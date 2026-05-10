// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDd5tPj3G8Emnga-svWIASzojete6vogH0",
  authDomain: "broliquidity.firebaseapp.com",
  projectId: "broliquidity",
  storageBucket: "broliquidity.appspot.com",
  messagingSenderId: "786880915771",
  appId: "1:786880915771:web:fe103176ffde52eff06f1e",
  measurementId: "G-SBMVSQ34L6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}
export { analytics };
