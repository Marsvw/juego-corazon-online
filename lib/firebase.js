// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, connectDatabaseEmulator } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAPMtHCCufL8xv8gqmyXbimkrN38xVa2-U",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "mars-12e0a.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mars-12e0a",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "mars-12e0a.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "595830273564",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:595830273564:web:658503d428dde34a8c11d9",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-XGZSLX2XX9",
  // Database URL is critical for connection - add explicit URL
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://mars-12e0a-default-rtdb.firebaseio.com"
};

let app;
let db;
let connectionRef;
let isConnected = false;
let connectionListeners = [];

// Initialize Firebase with error handling
try {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);

  // Set up connection state monitoring
  if (typeof window !== 'undefined') {
    connectionRef = ref(db, '.info/connected');
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
  // Create a fallback that will show connection errors
  app = null;
  db = null;
}

// Connection state listener
export function onConnectionChange(callback) {
  if (!connectionRef || !db) {
    callback(false);
    return () => {};
  }

  connectionListeners.push(callback);

  const unsubscribe = onValue(connectionRef, (snapshot) => {
    isConnected = snapshot.val() === true;
    connectionListeners.forEach(listener => listener(isConnected));
  }, (error) => {
    console.error('Connection monitoring error:', error);
    isConnected = false;
    connectionListeners.forEach(listener => listener(false));
  });

  return () => {
    connectionListeners = connectionListeners.filter(l => l !== callback);
    unsubscribe();
  };
}

// Get current connection state
export function getConnectionState() {
  return isConnected;
}

// Helper for operations with retry logic (for VPN/unstable connections)
export async function withRetry(operation, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries}):`, error.message);

      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Check if Firebase is properly initialized
export function isFirebaseReady() {
  return app !== null && db !== null;
}

export { db };
