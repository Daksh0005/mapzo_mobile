// ═══════════════════════════════════════════════════════════
// feed.js — Vertical snap-scroll feed + horizontal slides
// ═══════════════════════════════════════════════════════════

const FeedController = (() => {

  let _initialized = false;
  let _page        = 0;
  let _loading     = false;
  let _allLoaded   = false;
  let _observer    = null; // IntersectionObserver for infinite scroll

  // ── INIT ─────────────────────────────────────────────────
  async function init() {
    if (_initialized) return;
    _initialized = true;

    const container = document.getElementById('pane-feed');
    if (!container) return;

    // Load first page
    await _loadPage();

    // IntersectionObserver on last card → load next page
    _observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !_loading && !_allLoaded) {
        _loadPage();
      }
    }, { threshold: 0.3 });

    _observeLastCard();
    console.log('[Feed] Initialized ✓');
  }

  // ── LOAD PAGE ────────────────────────────────────────────
  async function _loadPage() {
    if (_loading) return;
    _loading = true;

    // Show skeleton on first load
    if (_page === 0) _showSkeletons();

    const events = await SupabaseService.getEvents({
      limit:  CONFIG.app.feedPageSize,
      offset: _page * CONFIG.app.feedPageSize,
    });

    // Clear skeletons on first page
    if (_page === 0) {
      const container = document.getElementById('pane-feed');
      container.innerHTML = '';
    }

    if (events.length === 0) {
      _allLoaded = true;
      _loading   = false;
      if (_page === 0) _showEmpty();
      return;
    }

    events.forEach(ev => _renderCard(ev));
    _page++;
    _loading = false;
    _observeLastCard();
  }

  // ── RENDER SINGLE CARD ───────────────────────────────────
  function _renderCard(ev) {
    const container = document.getElementById('pane-feed');
    if (!container) return;

    const meta = getCatMeta(ev.category);
    const isLiked    = AppState.likedEvents.has(ev.id);
    const isSaved    = AppState.savedEvents.has(ev.id);
    const dateStr    = formatEventDate(ev.event_date, ev.start_time);
    const imgUrl     = ev.image_urls?.[0] || '';

    const card = document.createElement('div');
    card.className = 'feed-card';
    card.id = `fc-${ev.id}`;

    card.innerHTML = `
      <!-- HORIZONTAL SLIDE STRIP -->
      <div class="fc-strip" id="strip-${ev.id}" onscroll="FeedController.onStripScroll(this,'${ev.id}')">

        <!-- SLIDE 1: Cover -->
        <div class="fc-slide" data-slide="cover">
          ${imgUrl
            ? `<img class="fc-bg-img" src="${imgUrl}" alt="${ev.title}" loading="lazy">`
            : `<div class="fc-bg-grad" style="background:linear-gradient(160deg,${meta.color} 0%,#060608 100%)">
                 <div class="fc-bg-emoji">${meta.emoji}</div>
               </div>`
          }
          <div class="fc-slide-overlay"></div>
          <div class="fc-slide-tag">Cover</div>
        </div>

        <!-- SLIDE 2: Photos grid -->
        <div class="fc-slide" data-slide="photos">
          <div class="fc-photo-grid">
            ${_buildPhotoGrid(ev, meta)}
          </div>
          <div class="fc-slide-overlay"></div>
          <div class="fc-slide-tag">Photos</div>
        </div>

        <!-- SLIDE 3: Reviews -->
        <div class="fc-slide slide-list" data-slide="reviews">
          <div class="fc-slide-scroll-inner">
            <div class="fc-slide-inner-title">Reviews</div>
            ${_buildReviewsInline(ev)}
          </div>
          <div class="fc-slide-tag">Reviews</div>
        </div>

        <!-- SLIDE 4: Hot Takes -->
        <div class="fc-slide slide-list" data-slide="opinions">
          <div class="fc-slide-scroll-inner">
            <div class="fc-slide-inner-title">Hot Takes 🔥</div>
            ${_buildOpinionsInline(ev)}
          </div>
          <div class="fc-slide-tag">Opinions</div>
        </div>
      </div>

      <!-- SLIDE DOTS -->
      <div class="fc-dots" id="dots-${ev.id}">
        <div class="fc-dot active"></div>
        <div class="fc-dot"></div>
        <div class="fc-dot"></div>
        <div class="fc-dot"></div>
      </div>

      <!-- ACTION RAIL (right side) -->
      <div class="fc-rail">
        <button class="fc-rail-btn ${isLiked ? 'liked' : ''}" id="like-btn-${ev.id}"
          onclick="FeedController.toggleLike('${ev.id}',this)">
          ${isLiked ? '❤️' : '🤍'}
          <span class="fc-rail-label" id="like-count-${ev.id}">${ev.like_count || 0}</span>
        </button>
        <button class="fc-rail-btn" onclick="EventSheet.open('${ev.id}')">
          💬<span class="fc-rail-label">${ev.comments?.[0]?.count || 0}</span>
        </button>
        <button class="fc-rail-btn ${isSaved ? 'saved' : ''}" id="save-btn-${ev.id}"
          onclick="FeedController.toggleSave('${ev.id}',this)">
          ${isSaved ? '🔖' : '🔖'}<span class="fc-rail-label">${isSaved ? 'Saved' : 'Save'}</span>
        </button>
        <button class="fc-rail-btn" onclick="FeedController.shareEvent('${ev.id}')">
          ↗<span class="fc-rail-label">Share</span>
        </button>
        <button class="fc-rail-btn" onclick="Router.navigate('map');Toast.show('📍 Viewing on map')">
          🗺<span class="fc-rail-label">Map</span>
        </button>
      </div>

      <!-- BOTTOM INFO OVERLAY -->
      <div class="fc-info">
        <!-- Host row -->
        <div class="fc-host-row">
          <div class="fc-host-av">${avatarHtml(ev.host, 32)}</div>
          <span class="fc-host-name">${ev.host?.display_name || 'Host'}</span>
          <button class="fc-follow-btn ${AppState.followingUsers.has(ev.host?.id) ? 'following' : ''}"
            id="follow-btn-${ev.host?.id}"
            onclick="FeedController.toggleFollow('${ev.host?.id}',this)">
            ${AppState.followingUsers.has(ev.host?.id) ? '✓ Following' : '+ Follow'}
          </button>
        </div>

        <!-- Category badge -->
        <div class="fc-cat ${meta.cls}">${meta.emoji} ${ev.category}</div>

        <!-- Title -->
        <div class="fc-title">${ev.title}</div>

        <!-- Meta row -->
        <div class="fc-meta">
          <span>📅 ${dateStr}</span>
          <span>🎟 ${ev.price || 'Free'}</span>
        </div>

        <!-- Tags -->
        ${ev.tags?.length ? `<div class="fc-tags">${ev.tags.slice(0,3).map(t => `<span class="fc-tag">${t}</span>`).join('')}</div>` : ''}
      </div>

      <!-- CTA BUTTONS -->
      <div class="fc-cta">
        <button class="fc-cta-main" onclick="EventSheet.open('${ev.id}')">View Event →</button>
        <button class="fc-cta-map" onclick="Router.navigate('map')">📍 See on Map</button>
      </div>
    `;

    container.appendChild(card);
  }

  // ── SLIDE CONTENT BUILDERS ───────────────────────────────

  function _buildPhotoGrid(ev, meta) {
    const imgs = ev.image_urls || [];
    if (imgs.length >= 3) {
      return `
        <div class="pg-main"><img src="${imgs[0]}" loading="lazy"></div>
        <div class="pg-side">
          <div class="pg-sm"><img src="${imgs[1]}" loading="lazy"></div>
          <div class="pg-sm"><img src="${imgs[2]}" loading="lazy"></div>
        </div>`;
    }
    if (imgs.length === 1) {
      return `<div class="pg-main" style="grid-column:span 2"><img src="${imgs[0]}" loading="lazy"></div>`;
    }
    // No images — placeholder with emoji
    return `
      <div class="pg-placeholder" style="background:${meta.color}">
        <div class="pg-emoji">${meta.emoji}</div>
        <div class="pg-no-photos">No photos yet</div>
      </div>`;
  }

  function _buildReviewsInline(ev) {
    // Reviews come from comments with ratings
    // BACKEND PLUG: In production, fetch comments for this event
    // For now render from ev.comments if included in query
    const comments = ev.comments || [];
    if (!comments.length) {
      return `<div class="fc-slide-empty">No reviews yet. Be the first! 👆</div>`;
    }
    return comments.slice(0, 3).map(c => `
      <div class="fc-review-card">
        <div class="fc-rv-header">
          <div class="fc-rv-av">${avatarHtml(c.author, 28)}</div>
          <div class="fc-rv-name">${c.author?.display_name || 'User'}</div>
          ${c.rating ? `<div class="fc-rv-stars">${'★'.repeat(c.rating)}${'☆'.repeat(5-c.rating)}</div>` : ''}
        </div>
        <div class="fc-rv-text">"${c.text}"</div>
      </div>`).join('');
  }

  function _buildOpinionsInline(ev) {
    // Same source as reviews — unrated comments = opinions
    return `<div class="fc-slide-empty">Be the first to share your take 🔥</div>`;
  }

  // ── STRIP SCROLL HANDLER ─────────────────────────────────
  function onStripScroll(strip, evId) {
    const idx = Math.round(strip.scrollLeft / strip.clientWidth);
    const dots = document.querySelectorAll(`#dots-${evId} .fc-dot`);
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  // ── INTERACTIONS ─────────────────────────────────────────

  async function toggleLike(evId, btn) {
    requireAuth(async () => {
      const wasLiked = AppState.likedEvents.has(evId);
      // Optimistic UI
      if (wasLiked) {
        btn.classList.remove('liked');
        btn.childNodes[0].textContent = '🤍';
        AppState.likedEvents.delete(evId);
        const countEl = document.getElementById(`like-count-${evId}`);
        if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
      } else {
        btn.classList.add('liked');
        btn.childNodes[0].textContent = '❤️';
        AppState.likedEvents.add(evId);
        const countEl = document.getElementById(`like-count-${evId}`);
        if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1;
        // Pulse animation
        btn.style.transform = 'scale(1.4)';
        setTimeout(() => btn.style.transform = '', 200);
      }
      // Actual API call
      await SupabaseService.toggleLike(evId);
    });
  }

  async function toggleSave(evId, btn) {
    requireAuth(async () => {
      const { saved } = await SupabaseService.toggleSave(evId);
      if (saved) {
        AppState.savedEvents.add(evId);
        btn.classList.add('saved');
        Toast.show('✅ Event saved!');
      } else {
        AppState.savedEvents.delete(evId);
        btn.classList.remove('saved');
        Toast.show('🔖 Removed from saved');
      }
    });
  }

  async function toggleFollow(userId, btn) {
    if (!userId || userId === 'undefined') return;
    requireAuth(async () => {
      const { following } = await SupabaseService.toggleFollow(userId);
      if (following) {
        AppState.followingUsers.add(userId);
        btn.textContent = '✓ Following';
        btn.classList.add('following');
        Toast.show('✅ Following!');
      } else {
        AppState.followingUsers.delete(userId);
        btn.textContent = '+ Follow';
        btn.classList.remove('following');
      }
    });
  }

  function shareEvent(evId) {
    const url = `${window.location.origin}${window.location.pathname}#event-${evId}`;
    if (navigator.share) {
      navigator.share({ title: 'Check this event on Mapzo!', url });
    } else {
      navigator.clipboard?.writeText(url);
      Toast.show('📤 Link copied!');
    }
  }

  // ── INFINITE SCROLL ──────────────────────────────────────
  function _observeLastCard() {
    if (!_observer) return;
    const cards = document.querySelectorAll('#pane-feed .feed-card');
    if (cards.length > 0) {
      _observer.disconnect();
      _observer.observe(cards[cards.length - 1]);
    }
  }

  // ── SKELETON ─────────────────────────────────────────────
  function _showSkeletons() {
    const container = document.getElementById('pane-feed');
    container.innerHTML = '';
    for (let i = 0; i < 2; i++) {
      const sk = document.createElement('div');
      sk.className = 'feed-card feed-skeleton';
      sk.innerHTML = `<div class="skeleton" style="width:100%;height:100%;"></div>`;
      container.appendChild(sk);
    }
  }

  function _showEmpty() {
    const container = document.getElementById('pane-feed');
    container.innerHTML = `
      <div class="feed-empty">
        <div class="feed-empty-emoji">🌍</div>
        <div class="feed-empty-title">No events yet</div>
        <div class="feed-empty-sub">Be the first to host something epic in your city</div>
        <button class="feed-empty-btn" onclick="requireAuth(()=>HostController.openCreateSheet())">Host an Event</button>
      </div>`;
  }

  return { init, onStripScroll, toggleLike, toggleSave, toggleFollow, shareEvent };
})();
