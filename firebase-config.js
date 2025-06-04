// Firebase configuration and initialization
// This file is shared between public and admin pages

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, get, child, push, remove, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBHaT9gQRq1e58VjX798LnkxqLtjF9W9DA", // KEEP YOUR KEY SECRET
  authDomain: "santicbarber.firebaseapp.com",
  databaseURL: "https://santicbarber-default-rtdb.firebaseio.com",
  projectId: "santicbarber",
  storageBucket: "santicbarber.firebasestorage.app",
  messagingSenderId: "52314683922",
  appId: "1:52314683922:web:b61e2332935a731ed6b6cb",
  measurementId: "G-W9ZEM88PZ7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
getAnalytics(app); // analytics instance isn't used directly, but initialization is kept

const auth = getAuth(app);
const database = getDatabase(app);

// Expose Firebase services globally
window.firebaseServices = {
  auth,
  database,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  ref,
  set,
  get,
  child,
  push,
  remove,
  update,
  serverTimestamp
};
