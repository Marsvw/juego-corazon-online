// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAPMtHCCufL8xv8gqmyXbimkrN38xVa2-U",
  authDomain: "mars-12e0a.firebaseapp.com",
  projectId: "mars-12e0a",
  storageBucket: "mars-12e0a.appspot.com",
  messagingSenderId: "595830273564",
  appId: "1:595830273564:web:658503d428dde34a8c11d9",
  measurementId: "G-XGZSLX2XX9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
