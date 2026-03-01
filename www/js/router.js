// ═══════════════════════════════════════════════════════════
// router.js — Hash-based SPA routing
// Routes: #map, #feed, #list, #explore, #social, #profile
// ═══════════════════════════════════════════════════════════

const Router = (() => {

  const DISCOVER_VIEWS = new Set(['map', 'feed', 'list']);

  const ROUTE_CONFIG = {
    map:     { tab: 'discover', view: 'map',     init: () => MapController?.init()   },
    feed:    { tab: 'discover', view: 'feed',    init: () => FeedController?.init()  },
    list:    { tab: 'discover', view: 'list',    init: () => ListController?.init()  },
    explore: { tab: 'explore',  view: null,      init: () => ExploreController?.init() },
    social:  { tab: 'social',   view: null,      init: () => SocialController?.init()  },
    profile: { tab: 'profile',  view: null,      init: () => ProfileController?.init() },
  };

  let _initialized = {};

  function init() {
    window.addEventListener('hashchange', _handleRoute);
    // Set default route
    if (!window.location.hash || window.location.hash === '#') {
      window.location.hash = '#map';
    } else {
      _handleRoute();
    }
  }

  function navigate(route) {
    window.location.hash = `#${route}`;
  }

  function _handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'map';
    const config = ROUTE_CONFIG[hash];
    if (!config) { navigate('map'); return; }

    // Update visible content pane
    document.querySelectorAll('.view-pane').forEach(p => p.classList.add('hidden'));
    const pane = document.getElementById(`pane-${hash}`);
    if (pane) pane.classList.remove('hidden');

    // Show/hide discover view switcher
    const switcher = document.getElementById('view-switcher');
    if (switcher) switcher.style.display = DISCOVER_VIEWS.has(hash) ? 'flex' : 'none';

    // Update tab bar active state
    TabBar.setActive(config.tab);

    // Update view switcher pills (for discover tab)
    if (DISCOVER_VIEWS.has(hash)) {
      document.querySelectorAll('.view-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.view === hash);
      });
      AppState.currentView = hash;
    }

    AppState.currentTab = config.tab;

    // Call init only once per route (lazy init)
    if (!_initialized[hash] && config.init) {
      config.init();
      _initialized[hash] = true;
    }

    // Scroll to top
    if (pane) pane.scrollTop = 0;
  }

  // Force re-init (e.g. after login)
  function refresh(route) {
    _initialized[route] = false;
    if (window.location.hash === `#${route}`) {
      _handleRoute();
    }
  }

  return { init, navigate, refresh };
})();

// ── TAB BAR ──────────────────────────────────────────────
const TabBar = (() => {

  function init() {
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === 'host') {
          requireAuth(() => HostController.openCreateSheet());
        } else {
          Router.navigate(tab === 'discover' ? AppState.currentView : tab);
        }
      });
    });
  }

  function setActive(tab) {
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab ||
        (btn.dataset.tab === 'discover' && ['map','feed','list'].includes(tab)));
    });
  }

  return { init, setActive };
})();
