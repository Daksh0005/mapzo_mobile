// ═══════════════════════════════════════════════════════════
// firebase.js — Firebase initialization + Auth helpers
// Loaded after: config.js
// ═══════════════════════════════════════════════════════════

// Firebase is loaded via CDN scripts in index.html (compat version)
// This file wraps it cleanly so nothing else touches firebase directly

const FirebaseService = (() => {

  let _app  = null;
  let _auth = null;
  let _authStateListeners = [];

  // ── INIT ─────────────────────────────────────────────────
  function init() {
    if (typeof firebase === 'undefined') {
      console.error('[Firebase] SDK not loaded. Check <script> tags in index.html');
      return;
    }
    if (!firebase.apps.length) {
      _app = firebase.initializeApp(CONFIG.firebase);
    } else {
      _app = firebase.apps[0];
    }
    _auth = firebase.auth();

    // Expose globally for legacy code compatibility
    window.auth = _auth;

    // Central auth state handler — notifies all listeners
    _auth.onAuthStateChanged(async (user) => {
      window.currentUser = user || null;
      // If user just signed in, sync profile to Supabase
      if (user) {
        await _syncUserToSupabase(user);
      }
      _authStateListeners.forEach(fn => fn(user));
    });

    console.log('[Firebase] Initialized ✓');
  }

  // ── AUTH STATE SUBSCRIPTION ──────────────────────────────
  // Usage: FirebaseService.onAuthChange(user => { ... })
  function onAuthChange(fn) {
    _authStateListeners.push(fn);
    // Call immediately with current state if auth already initialized
    if (_auth && window.currentUser !== undefined) {
      fn(window.currentUser);
    }
  }

  // ── GOOGLE SIGN IN ───────────────────────────────────────
  async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    try {
      const result = await _auth.signInWithPopup(provider);
      return { success: true, user: result.user };
    } catch (err) {
      console.error('[Firebase] Google sign-in error:', err.code);
      return { success: false, error: _friendlyError(err.code) };
    }
  }

  // ── EMAIL SIGN UP ────────────────────────────────────────
  async function signUpWithEmail(email, password, displayName) {
    try {
      const result = await _auth.createUserWithEmailAndPassword(email, password);
      // Set display name immediately
      await result.user.updateProfile({ displayName });
      return { success: true, user: result.user };
    } catch (err) {
      return { success: false, error: _friendlyError(err.code) };
    }
  }

  // ── EMAIL SIGN IN ────────────────────────────────────────
  async function signInWithEmail(email, password) {
    try {
      const result = await _auth.signInWithEmailAndPassword(email, password);
      return { success: true, user: result.user };
    } catch (err) {
      return { success: false, error: _friendlyError(err.code) };
    }
  }

  // ── SIGN OUT ─────────────────────────────────────────────
  async function signOut() {
    try {
      await _auth.signOut();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ── GET TOKEN ────────────────────────────────────────────
  // Use this to get Bearer token for your Express backend
  async function getIdToken() {
    if (!_auth.currentUser) return null;
    return await _auth.currentUser.getIdToken();
  }

  // ── SYNC USER TO SUPABASE ────────────────────────────────
  // Creates/updates user row in Supabase `users` table on every login
  async function _syncUserToSupabase(user) {
    // BACKEND PLUG: supabase.js → SupabaseService.upsertUser()
    if (typeof SupabaseService !== 'undefined') {
      await SupabaseService.upsertUser({
        id:           user.uid,
        email:        user.email,
        display_name: user.displayName || user.email.split('@')[0],
        avatar_url:   user.photoURL || null,
        provider:     user.providerData[0]?.providerId || 'email',
      });
    }
  }

  // ── ERROR MESSAGES ───────────────────────────────────────
  function _friendlyError(code) {
    const map = {
      'auth/email-already-in-use':    'That email is already registered.',
      'auth/invalid-email':           'Please enter a valid email.',
      'auth/weak-password':           'Password must be at least 6 characters.',
      'auth/wrong-password':          'Incorrect password.',
      'auth/user-not-found':          'No account found with that email.',
      'auth/popup-closed-by-user':    'Sign-in popup was closed.',
      'auth/network-request-failed':  'Network error. Check your connection.',
    };
    return map[code] || 'Something went wrong. Try again.';
  }

  return { init, onAuthChange, signInWithGoogle, signUpWithEmail, signInWithEmail, signOut, getIdToken };
})();
