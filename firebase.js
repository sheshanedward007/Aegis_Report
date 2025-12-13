const firebaseConfig = {
    apiKey: "AIzaSyBmxz5b598PlSbUyKbh4VwHvRpAxltqcFA",
    authDomain: "project-aegis-845e6.firebaseapp.com",
    projectId: "project-aegis-845e6",
    storageBucket: "project-aegis-845e6.appspot.com",
    messagingSenderId: "851940559314",
    appId: "1:851940559314:web:a2d93e9d366577855a200b"
};

firebase.initializeApp(firebaseConfig);
window.firestore = firebase.firestore();
window.storage = firebase.storage();
console.log('🔥 Firebase initialized:', window.firestore);