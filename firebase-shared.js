/* =====================================================================
   firebase-shared.js — Conexión a Firebase (proyecto del club).
   Estos datos son PÚBLICOS por diseño y es seguro que estén acá:
   la seguridad la dan las reglas de Firestore + tu login.
   ===================================================================== */
window.FB_SDK = "https://www.gstatic.com/firebasejs/10.14.1";

window.FB_CONFIG = {
  apiKey: "AIzaSyAJewj6ek96U5bvLDcOkEmknb1PfobVjhU",
  authDomain: "streamcec-1950.firebaseapp.com",
  projectId: "streamcec-1950",
  storageBucket: "streamcec-1950.firebasestorage.app",
  messagingSenderId: "449685256104",
  appId: "1:449685256104:web:3215c806b82dde09fa8f9d"
};

/* Carga los módulos de Firebase que hagan falta y devuelve las piezas.
   withAuth = true también inicializa Authentication (para el panel). */
window.fbLoad = async function (withAuth) {
  const { initializeApp } = await import(window.FB_SDK + "/firebase-app.js");
  const fs = await import(window.FB_SDK + "/firebase-firestore.js");
  const app = initializeApp(window.FB_CONFIG);
  const db = fs.getFirestore(app);
  let auth = null, authMod = null;
  if (withAuth) {
    authMod = await import(window.FB_SDK + "/firebase-auth.js");
    auth = authMod.getAuth(app);
  }
  return { app, db, fs, auth, authMod };
};
