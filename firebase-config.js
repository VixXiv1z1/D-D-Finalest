/**
 * firebase-config.js
 * -----------------------------------------------------------------------
 * Fill this in with your own Firebase project's config (Project settings
 * → General → "Your apps" → SDK setup and configuration → Config) and
 * enable Cloud Firestore (Build → Firestore Database → Create database)
 * in the Firebase console before loading the app.
 *
 * For local prototyping you can leave Firestore in "test mode" security
 * rules. Before sharing this app with real users, lock the rules down —
 * at minimum, require auth and scope reads/writes to rooms the caller
 * belongs to.
 * -----------------------------------------------------------------------
 */

const firebaseConfig = {
  apiKey: "AIzaSyCPUctaUizOVW2Vhpi992sQ2hgXrExhtxo",
  authDomain: "d-d-project.firebaseapp.com",
  projectId: "d-d-project",
  storageBucket: "d-d-project.firebasestorage.app",
  messagingSenderId: "910979359849",
  appId: "1:910979359849:web:ba0cc64df137575c1aeef8",
  measurementId: "G-GRT1XSGH74",
};

firebase.initializeApp(firebaseConfig);

// Shared Firestore handle used by db.js and sync.js.
const firestoreDB = firebase.firestore();
