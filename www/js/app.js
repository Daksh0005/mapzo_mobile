// ═══════════════════════════════════════════════════════════
// app.js — Bootstrap, global state, initialization sequence
// This is the first JS file that runs after the services are ready
// ═══════════════════════════════════════════════════════════

// ── GLOBAL APP STATE ─────────────────────────────────────
window.AppState = {
  currentUser:    null,
  userProfile:    null,   // Supabase user row
  likedEvents:    new Set(),
  savedEvents:    new Set(),
  attendingEvents:new Set(),
  followingUsers: new Set(),
  currentView:    'map',  // map | feed | list
  currentTab:     'discover', // discover | explore | social | profile
  allEvents:      [],     // cached event list
  mapInstance:    null,   // Google Maps instance
  unreadNotifs:   0,
};

// ── INIT SEQUENCE ────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Starting Mapzo...');

  // 1. Init backend services
  SupabaseService.init();
  FirebaseService.init();

  // 2. Init EmailJS for host verification emails
  if (typeof emailjs !== 'undefined') {
    emailjs.init(CONFIG.emailjs.publicKey);
  }

  // 3. Auth state — drives everything
  FirebaseService.onAuthChange(async (user) => {
    AppState.currentUser = user;

    if (user) {
      // Load user's Supabase profile
      AppState.userProfile = await SupabaseService.getUser(user.uid);

      // Load user's interaction state
      const [likes, saves, following] = await Promise.all([
        SupabaseService.getUserLikes(user.uid),
        SupabaseService.getUserSaves(user.uid),
        SupabaseService.getFollowing(user.uid),
      ]);
      AppState.likedEvents     = likes;
      AppState.savedEvents     = saves;
      AppState.followingUsers  = following;

      // Unread notification count
      AppState.unreadNotifs = await SupabaseService.getUnreadCount(user.uid);
      NotificationBadge.update(AppState.unreadNotifs);

      // Subscribe to realtime notifications
      SupabaseService.subscribeToNotifications(user.uid, (payload) => {
        AppState.unreadNotifs++;
        NotificationBadge.update(AppState.unreadNotifs);
        Toast.show(`🔔 ${payload.new.message}`);
      });

      // Update auth UI
      AuthUI.setLoggedIn(user, AppState.userProfile);
    } else {
      // Reset state
      AppState.userProfile     = null;
      AppState.likedEvents     = new Set();
      AppState.savedEvents     = new Set();
      AppState.followingUsers  = new Set();
      AppState.unreadNotifs    = 0;
      AuthUI.setLoggedOut();
    }
  });

  // 4. Init router (handles URL hash navigation)
  Router.init();

  // 5. Init tab bar
  TabBar.init();

  // 6. Subscribe to realtime new events (for live map pins)
  SupabaseService.subscribeToEvents((payload) => {
    if (MapController && payload.new) {
      MapController.addPin(payload.new);
    }
  });

  // 7. Register service worker (PWA + offline)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('[SW] Registered'))
      .catch(e => console.warn('[SW] Failed:', e));
  }

  console.log('[App] Boot complete ✓');
});

// ── TOAST ────────────────────────────────────────────────
const Toast = (() => {
  let _timer;
  const _el = () => document.getElementById('toast');

  function show(msg, duration = 2500) {
    const el = _el();
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(_timer);
    _timer = setTimeout(() => el.classList.remove('show'), duration);
  }

  return { show };
})();

// ── NOTIFICATION BADGE ───────────────────────────────────
const NotificationBadge = (() => {
  function update(count) {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    badge.textContent = count > 9 ? '9+' : count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
  return { update };
})();

// ── REQUIRE AUTH GUARD ───────────────────────────────────
// Call this before any action that needs a logged-in user
function requireAuth(action) {
  if (AppState.currentUser) {
    action();
  } else {
    AuthUI.openModal('login');
    Toast.show('Please sign in to continue');
  }
}

// ── BODY SCROLL LOCK ────────────────────────────────────
function lockScroll()   { document.body.style.overflow = 'hidden'; }
function unlockScroll() { document.body.style.overflow = '';       }

// ── RELATIVE TIME ────────────────────────────────────────
function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── FORMAT DATE ──────────────────────────────────────────
function formatEventDate(dateStr, timeStr) {
  const d = new Date(`${dateStr}T${timeStr}`);
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  const isToday    = d.toDateString() === today.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (isToday)    return `Tonight · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`;
}

// ── AVATAR FALLBACK ──────────────────────────────────────
function avatarHtml(user, size = 36) {
  if (user?.avatar_url) {
    return `<img src="${user.avatar_url}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;" onerror="this.replaceWith(initials('${user.display_name}',${size}))">`;
  }
  return initialsEl(user?.display_name || '?', size);
}

function initialsEl(name, size) {
  const div = document.createElement('div');
  div.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:var(--g-dim);border:1px solid var(--g);color:var(--g);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${size*0.4}px;flex-shrink:0;`;
  div.textContent = (name || '?').charAt(0).toUpperCase();
  return div.outerHTML;
}

// ── CATEGORY METADATA ────────────────────────────────────
const CATEGORY_META = {
  Music:    { emoji: '🎵', color: '#2d1050', accent: '#c070ff', cls: 'cat-music' },
  Party:    { emoji: '🎉', color: '#3a1800', accent: '#ff7040', cls: 'cat-party' },
  Tech:     { emoji: '💻', color: '#001e3a', accent: '#40d0ff', cls: 'cat-tech'  },
  Food:     { emoji: '🍕', color: '#1a2e00', accent: '#90e040', cls: 'cat-food'  },
  Sports:   { emoji: '⚽', color: '#3a0000', accent: '#ff5050', cls: 'cat-sports' },
  Cultural: { emoji: '🎭', color: '#2e2800', accent: '#ffd040', cls: 'cat-cultural' },
  Nightlife:{ emoji: '🌙', color: '#1a0030', accent: '#ff40b0', cls: 'cat-nightlife' },
  Markets:  { emoji: '🛍', color: '#2a1a00', accent: '#ffaa40', cls: 'cat-markets' },
  Wellness: { emoji: '🧘', color: '#002a1a', accent: '#40ffaa', cls: 'cat-wellness' },
};

function getCatMeta(category) {
  return CATEGORY_META[category] || { emoji: '📍', color: '#1a1a1a', accent: '#888', cls: '' };
}
