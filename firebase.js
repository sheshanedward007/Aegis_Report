// Initialize Firebase IMMEDIATELY (no DOMContentLoaded wrapper)
const firebaseConfig = {
    apiKey: "AIzaSyBmxz5b598PlSbUyKbh4VwHvRpAxltqcFA",
    authDomain: "project-aegis-845e6.firebaseapp.com",
    projectId: "project-aegis-845e6",
    storageBucket: "project-aegis-845e6.appspot.com",
    messagingSenderId: "851940559314",
    appId: "1:851940559314:web:a2d93e9d366577855a200b"
};

firebase.initializeApp(firebaseConfig);
const firestore = firebase.firestore();

// Expose globally so app.js can use it
window.firestore = firestore;

console.log('🔥 Firebase initialized:', firestore);