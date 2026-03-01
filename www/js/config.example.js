// ═══════════════════════════════════════════════════════════
// config.js — ALL KEYS & URLS LIVE HERE. FILL THESE IN.
// Never commit this file to GitHub — add to .gitignore
// ═══════════════════════════════════════════════════════════

const CONFIG = {

  // ── FIREBASE ──────────────────────────────────────────────
  // Get from: Firebase Console → Project Settings → Your Apps
  firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID",
    // FCM Web Push Key — Firebase Console → Project Settings → Cloud Messaging → Web Push Certificates
    vapidKey: "YOUR_VAPID_KEY",
  },

  // ── SUPABASE ──────────────────────────────────────────────
  // Get from: Supabase Dashboard → Settings → API
  supabase: {
    url: "https://YOUR_PROJECT.supabase.co",
    anonKey: "YOUR_SUPABASE_ANON_KEY",
  },

  // ── GOOGLE MAPS ───────────────────────────────────────────
  // Get from: console.cloud.google.com → APIs → Maps JS API
  // Enable: Maps JavaScript API, Places API, Geocoding API
  googleMaps: {
    apiKey: "YOUR_GOOGLE_MAPS_API_KEY",
  },

  // ── EMAILJS ───────────────────────────────────────────────
  // Get from: emailjs.com → Account → API Keys
  // Create a template with variables: host_name, host_email, host_org, host_reason, user_id
  emailjs: {
    serviceId: "YOUR_EMAILJS_SERVICE_ID",
    templateId: "YOUR_EMAILJS_TEMPLATE_ID",
    publicKey: "YOUR_EMAILJS_PUBLIC_KEY",
    ownerEmail: "your@email.com",
  },

  // ── APP SETTINGS ──────────────────────────────────────────
  app: {
    name: "Mapzo",
    defaultLat: 22.3200,   // Default map center (IIT KGP)
    defaultLng: 87.3150,
    defaultZoom: 14,
    feedPageSize: 10,        // Events per feed page load
    maxUploadSizeMB: 10,
  },
};

// Lock it so nothing accidentally overwrites
Object.freeze(CONFIG);
