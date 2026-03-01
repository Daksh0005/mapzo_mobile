// ═══════════════════════════════════════════════════════════
// map.js — Google Maps controller
// Depends on: Google Maps JS API (loaded in index.html callback)
// ═══════════════════════════════════════════════════════════

const MapController = (() => {

  let _map          = null;
  let _markers      = new Map();  // eventId → google.maps.Marker
  let _userMarker   = null;
  let _infoCard     = null;       // currently open preview card event
  let _heatLayer    = null;
  let _initialized  = false;
  let _activeFilter = 'all';

  // ── INIT ─────────────────────────────────────────────────
  async function init() {
    if (_initialized) return;
    if (typeof google === 'undefined') {
      console.warn('[Map] Google Maps not loaded yet — will retry');
      return;
    }

    const mapEl = document.getElementById('mapCanvas');
    if (!mapEl) return;

    _map = new google.maps.Map(mapEl, {
      center:             { lat: CONFIG.app.defaultLat, lng: CONFIG.app.defaultLng },
      zoom:               CONFIG.app.defaultZoom,
      disableDefaultUI:   true,    // we build our own controls
      gestureHandling:    'greedy', // one-finger pan on mobile
      clickableIcons:     false,
      mapId:              'mapzo-dark', // needed for AdvancedMarker (optional)
      styles: [
        { elementType: 'geometry',           stylers: [{ color: '#0d1117' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1117' }] },
        { elementType: 'labels.text.fill',   stylers: [{ color: '#556070' }] },
        { featureType: 'road',               elementType: 'geometry',           stylers: [{ color: '#1a2030' }] },
        { featureType: 'road',               elementType: 'geometry.stroke',    stylers: [{ color: '#0a0f18' }] },
        { featureType: 'road',               elementType: 'labels.text.fill',   stylers: [{ color: '#445060' }] },
        { featureType: 'road.highway',       elementType: 'geometry',           stylers: [{ color: '#1e2d40' }] },
        { featureType: 'water',              elementType: 'geometry',           stylers: [{ color: '#060a12' }] },
        { featureType: 'water',              elementType: 'labels.text.fill',   stylers: [{ color: '#2a4060' }] },
        { featureType: 'poi',                elementType: 'geometry',           stylers: [{ color: '#0e1520' }] },
        { featureType: 'poi.park',           elementType: 'geometry',           stylers: [{ color: '#0a180e' }] },
        { featureType: 'transit',            elementType: 'geometry',           stylers: [{ color: '#0e1520' }] },
        { featureType: 'administrative',     elementType: 'geometry.stroke',    stylers: [{ color: '#1db954', lightness: -80 }] },
      ],
    });

    AppState.mapInstance = _map;

    // Wire up zoom buttons (our custom ones)
    document.getElementById('map-zoom-in')?.addEventListener('click',  () => _map.setZoom(_map.getZoom() + 1));
    document.getElementById('map-zoom-out')?.addEventListener('click', () => _map.setZoom(_map.getZoom() - 1));
    document.getElementById('map-recenter')?.addEventListener('click', _recenterToUser);
    document.getElementById('map-friends')?.addEventListener('click',  () => Toast.show('👥 Friend locations coming soon'));

    // Filter chips
    document.querySelectorAll('.mf-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.mf-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        _activeFilter = chip.dataset.filter || 'all';
        _applyFilter();
      });
    });

    // Dismiss preview on map click
    _map.addListener('click', closePreview);

    _initialized = true;

    // Get user location then load events
    _getUserLocation();

    console.log('[Map] Initialized ✓');
  }

  // ── USER LOCATION ────────────────────────────────────────
  function _getUserLocation() {
    if (!navigator.geolocation) {
      _loadEvents();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        _map.setCenter(latlng);
        _map.setZoom(15);
        _placeUserMarker(latlng);
        _loadEvents();
      },
      () => {
        // Permission denied — load events at default location
        _loadEvents();
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function _recenterToUser() {
    if (!navigator.geolocation) return Toast.show('Location not available');
    navigator.geolocation.getCurrentPosition((pos) => {
      const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      _map.panTo(ll);
      _map.setZoom(15);
      _placeUserMarker(ll);
    });
  }

  function _placeUserMarker(latlng) {
    if (_userMarker) _userMarker.setMap(null);
    _userMarker = new google.maps.Marker({
      position: latlng,
      map:      _map,
      icon: {
        path:          google.maps.SymbolPath.CIRCLE,
        scale:         10,
        fillColor:     '#1db954',
        fillOpacity:   1,
        strokeColor:   '#fff',
        strokeWeight:  3,
      },
      title:  'You are here',
      zIndex: 9999,
    });
    // Pulse animation ring
    new google.maps.Circle({
      map:           _map,
      center:        latlng,
      radius:        300,
      fillColor:     '#1db954',
      fillOpacity:   0.07,
      strokeColor:   '#1db954',
      strokeOpacity: 0.4,
      strokeWeight:  1,
    });
  }

  // ── LOAD & RENDER EVENTS ─────────────────────────────────
  async function _loadEvents() {
    const events = await SupabaseService.getEvents({ limit: 50 });
    AppState.allEvents = events;
    _renderPins(events);
  }

  function _renderPins(events) {
    // Clear existing
    _markers.forEach(m => m.setMap(null));
    _markers.clear();

    events.forEach(ev => addPin(ev));

    // Heatmap data
    _renderHeatmap(events);
  }

  // ── ADD SINGLE PIN ───────────────────────────────────────
  function addPin(ev) {
    if (!ev.lat || !ev.lng || !_map) return;

    const meta = getCatMeta(ev.category);

    // Custom emoji marker div
    const markerEl = document.createElement('div');
    markerEl.className = `map-pin cat-${ev.category?.toLowerCase()}`;
    markerEl.innerHTML = `
      <div class="pin-inner">
        <span class="pin-emoji">${meta.emoji}</span>
        ${ev.attending_count > 0 ? `<span class="pin-count">${ev.attending_count > 99 ? '99+' : ev.attending_count}</span>` : ''}
      </div>
      <div class="pin-triangle"></div>`;

    const marker = new google.maps.Marker({
      position: { lat: Number(ev.lat), lng: Number(ev.lng) },
      map:      _map,
      // For custom HTML markers you'd use AdvancedMarkerElement (Maps v3.55+)
      // Fallback: use standard marker with custom icon
      icon: {
        url:    _pinSvg(meta.accent, meta.emoji),
        scaledSize: new google.maps.Size(48, 56),
        anchor:     new google.maps.Point(24, 56),
      },
      title:  ev.title,
      zIndex: ev.is_pinned ? 100 : 10,
    });

    marker.addListener('click', () => openPreview(ev));
    _markers.set(ev.id, marker);
  }

  // SVG pin (inline so no external image needed)
  function _pinSvg(color, emoji) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56">
      <ellipse cx="24" cy="52" rx="8" ry="3" fill="rgba(0,0,0,0.3)"/>
      <circle cx="24" cy="22" r="20" fill="${color}" fill-opacity="0.9" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
      <text x="24" y="29" text-anchor="middle" font-size="16">${emoji}</text>
      <polygon points="18,38 30,38 24,52" fill="${color}" fill-opacity="0.9"/>
    </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  // ── HEATMAP ──────────────────────────────────────────────
  function _renderHeatmap(events) {
    if (!google.maps.visualization) return; // visualization library not loaded

    const points = events
      .filter(ev => ev.attending_count > 0)
      .map(ev => ({
        location: new google.maps.LatLng(Number(ev.lat), Number(ev.lng)),
        weight:   Math.min(ev.attending_count, 100),
      }));

    if (_heatLayer) _heatLayer.setMap(null);
    _heatLayer = new google.maps.visualization.HeatmapLayer({
      data:    points,
      map:     _map,
      radius:  60,
      opacity: 0.5,
      gradient: ['rgba(0,0,0,0)', 'rgba(29,185,84,0.2)', 'rgba(29,185,84,0.5)', 'rgba(29,185,84,0.8)'],
    });
  }

  // ── PREVIEW CARD ─────────────────────────────────────────
  function openPreview(ev) {
    _infoCard = ev;
    const meta = getCatMeta(ev.category);

    document.getElementById('mp-cat').textContent   = `${meta.emoji} ${ev.category}`;
    document.getElementById('mp-title').textContent = ev.title;
    document.getElementById('mp-meta').textContent  =
      `📍 ${ev.venue_name || ev.address || 'Location set'} · ${formatEventDate(ev.event_date, ev.start_time)} · ${ev.attending_count || 0} going`;

    const mpImg = document.getElementById('mp-emoji');
    if (mpImg) mpImg.textContent = meta.emoji;

    document.getElementById('map-preview')?.classList.add('show');

    // Bounce the pin
    const marker = _markers.get(ev.id);
    if (marker) {
      marker.setAnimation(google.maps.Animation.BOUNCE);
      setTimeout(() => marker.setAnimation(null), 1500);
    }
    // Pan to event
    _map.panTo({ lat: Number(ev.lat), lng: Number(ev.lng) });
  }

  function closePreview() {
    _infoCard = null;
    document.getElementById('map-preview')?.classList.remove('show');
  }

  function openCurrentPreviewEvent() {
    if (_infoCard) EventSheet.open(_infoCard.id);
  }

  // ── FILTER ───────────────────────────────────────────────
  function _applyFilter() {
    _markers.forEach((marker, evId) => {
      const ev = AppState.allEvents.find(e => e.id === evId);
      if (!ev) return;
      const show = _activeFilter === 'all' || ev.category?.toLowerCase() === _activeFilter;
      marker.setVisible(show);
    });
  }

  // ── BOUNCE PIN ON CARD HOVER ─────────────────────────────
  function highlightPin(evId) {
    const marker = _markers.get(evId);
    if (marker) {
      marker.setAnimation(google.maps.Animation.BOUNCE);
      marker.setZIndex(9999);
    }
  }

  function unhighlightPin(evId) {
    const marker = _markers.get(evId);
    if (marker) {
      marker.setAnimation(null);
      marker.setZIndex(10);
    }
  }

  return {
    init, addPin, openPreview, closePreview,
    openCurrentPreviewEvent, highlightPin, unhighlightPin,
  };
})();

// Google Maps calls this when API is ready
// Set as callback in the <script> src URL: &callback=onGoogleMapsReady
window.onGoogleMapsReady = function () {
  console.log('[Maps] API Ready');
  // If map pane is currently visible, init now
  if (AppState.currentView === 'map') {
    MapController.init();
  }
};
