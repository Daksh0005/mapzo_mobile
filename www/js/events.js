// ═══════════════════════════════════════════════════════════
// events.js — Event detail sheet + create event form
// ═══════════════════════════════════════════════════════════

// ── EVENT DETAIL SHEET ───────────────────────────────────
const EventSheet = (() => {

  let _currentEventId = null;
  let _commentSubscription = null;

  async function open(evId) {
    _currentEventId = evId;

    const sheet = document.getElementById('event-sheet');
    const panel = document.getElementById('es-panel');

    // Show loading state
    panel.innerHTML = `
      <div class="es-drag-handle"></div>
      <div class="es-loading">
        <div class="skeleton" style="height:260px;border-radius:20px;margin:16px;"></div>
        <div style="padding:0 16px">
          <div class="skeleton" style="height:28px;width:60%;margin-bottom:12px;border-radius:8px;"></div>
          <div class="skeleton" style="height:16px;width:80%;margin-bottom:8px;border-radius:6px;"></div>
          <div class="skeleton" style="height:16px;width:50%;border-radius:6px;"></div>
        </div>
      </div>`;

    sheet.classList.add('open');
    lockScroll();

    // Fetch full event data
    const ev = await SupabaseService.getEvent(evId);
    if (!ev) { close(); Toast.show('Failed to load event'); return; }

    _render(ev, panel);

    // Subscribe to live comments
    if (_commentSubscription) _commentSubscription.unsubscribe();
    _commentSubscription = SupabaseService.subscribeToComments(evId, (payload) => {
      _appendLiveComment(payload.new);
    });
  }

  function _render(ev, panel) {
    const meta    = getCatMeta(ev.category);
    const isSaved = AppState.savedEvents.has(ev.id);
    const dateStr = formatEventDate(ev.event_date, ev.start_time);
    const imgUrl  = ev.image_urls?.[0] || '';

    // Friends attending
    const attendees = ev.attending || [];
    const avatarStack = attendees.slice(0, 5).map(a =>
      `<div class="es-att-av">${avatarHtml(a.user, 36)}</div>`).join('');
    const moreCount = Math.max(0, ev.attending_count - 5);

    // Comments
    const commentHtml = (ev.comments || []).slice(0, 10).map(c => _commentHtml(c)).join('');

    // Related events (same category)
    const related = AppState.allEvents
      .filter(e => e.id !== ev.id && e.category === ev.category)
      .slice(0, 5);

    panel.innerHTML = `
      <div class="es-drag-handle"></div>

      <!-- HERO -->
      <div class="es-hero">
        ${imgUrl
          ? `<img class="es-hero-img" src="${imgUrl}" alt="${ev.title}">`
          : `<div class="es-hero-img" style="background:linear-gradient(160deg,${meta.color},#060608);display:flex;align-items:center;justify-content:center;font-size:6rem;opacity:.8;">${meta.emoji}</div>`
        }
        <div class="es-hero-overlay"></div>
        <span class="es-hero-cat ${meta.cls}">${meta.emoji} ${ev.category}</span>
        <button class="es-hero-share" onclick="EventSheet.share('${ev.id}')">↗</button>
        <div class="es-hero-actions">
          <button class="es-ha-btn ${isSaved ? 'saved' : ''}" id="sheet-save-${ev.id}"
            onclick="EventSheet.toggleSave('${ev.id}',this)">
            ${isSaved ? '✅ Saved' : '🔖 Save'}
          </button>
          <button class="es-ha-btn" onclick="EventSheet.addToCalendar('${ev.id}')">📅</button>
        </div>
      </div>

      <!-- CONTENT -->
      <div class="es-content">
        <h1 class="es-title">${ev.title}</h1>

        <!-- META GRID -->
        <div class="es-meta-grid">
          <div class="es-meta-card">📅<div class="es-mc-label">Date & Time</div><div class="es-mc-val">${dateStr}</div></div>
          <div class="es-meta-card">📍<div class="es-mc-label">Venue</div><div class="es-mc-val">${ev.venue_name || ev.address}</div></div>
          <div class="es-meta-card">🎟<div class="es-mc-label">Entry</div><div class="es-mc-val">${ev.price || 'Free'}</div></div>
          <div class="es-meta-card">👥<div class="es-mc-label">Going</div><div class="es-mc-val">${ev.attending_count || 0} people</div></div>
        </div>

        <!-- HOST -->
        <div class="es-host" onclick="ProfileController.openUserSheet('${ev.host?.id}')">
          <div class="es-host-av">${avatarHtml(ev.host, 48)}</div>
          <div class="es-host-info">
            <div class="es-host-label">Hosted by</div>
            <div class="es-host-name">${ev.host?.display_name || 'Host'}</div>
            ${ev.host?.is_host ? `<div class="es-host-cred">✓ Verified Host</div>` : ''}
          </div>
          <button class="es-host-follow ${AppState.followingUsers.has(ev.host?.id) ? 'following' : ''}"
            onclick="event.stopPropagation();EventSheet.toggleFollow('${ev.host?.id}',this)">
            ${AppState.followingUsers.has(ev.host?.id) ? '✓ Following' : 'Follow'}
          </button>
        </div>

        <!-- ATTENDEES -->
        <div class="es-section-title">Who's Going (${ev.attending_count || 0})</div>
        <div class="es-attendees">
          <div class="es-att-stack">${avatarStack}${moreCount > 0 ? `<div class="es-att-more">+${moreCount}</div>` : ''}</div>
          ${attendees.length > 0
            ? `<div class="es-att-text">${attendees.slice(0,2).map(a => a.user?.display_name || 'User').join(', ')} ${moreCount > 0 ? `and ${moreCount} others` : ''} going</div>`
            : `<div class="es-att-text">Be the first to RSVP!</div>`}
        </div>

        <!-- DESCRIPTION -->
        <div class="es-desc" id="es-desc-${ev.id}">
          ${ev.description || 'No description provided.'}
        </div>

        <!-- TAGS -->
        ${ev.tags?.length ? `<div class="es-tags">${ev.tags.map(t => `<span class="es-tag">${t}</span>`).join('')}</div>` : ''}

        <!-- MINI MAP -->
        <div class="es-map-mini" id="es-mini-map-${ev.id}">
          <div class="es-map-grid"></div>
          <div class="es-map-pin-center">📍</div>
          <div class="es-map-mini-label">📍 ${ev.venue_name || ev.address}</div>
          <button class="es-directions" onclick="EventSheet.openDirections(${ev.lat},${ev.lng})">Get Directions →</button>
        </div>

        <!-- COMMENTS -->
        <div class="es-section-title">Reviews & Comments</div>
        <div id="es-comments-${ev.id}">${commentHtml || '<div class="es-no-comments">No comments yet. Be the first!</div>'}</div>

        <!-- COMMENT INPUT -->
        <div class="es-comment-input">
          <input class="es-ci-field" id="es-ci-${ev.id}" placeholder="Add your take...">
          <div class="es-ci-rating" id="es-rating-${ev.id}">
            ${[1,2,3,4,5].map(n => `<span class="es-star" data-val="${n}" onclick="EventSheet.setRating('${ev.id}',${n})">☆</span>`).join('')}
          </div>
          <button class="es-ci-send" onclick="EventSheet.submitComment('${ev.id}')">→</button>
        </div>

        <!-- RELATED EVENTS -->
        ${related.length > 0 ? `
        <div class="es-section-title" style="margin-top:20px">Similar Events Nearby</div>
        <div class="es-related-strip">
          ${related.map(r => {
            const rm = getCatMeta(r.category);
            return `<div class="es-rel-card" onclick="EventSheet.open('${r.id}')">
              <div class="es-rel-img" style="background:${rm.color};display:flex;align-items:center;justify-content:center;font-size:2rem;">${rm.emoji}</div>
              <div class="es-rel-info">
                <div class="es-rel-title">${r.title}</div>
                <div class="es-rel-meta">${r.venue_name || ''} · ${r.attending_count || 0} going</div>
              </div>
            </div>`;
          }).join('')}
        </div>` : ''}

      </div><!-- /content -->

      <!-- STICKY FOOTER -->
      <div class="es-footer">
        <button class="es-footer-btn secondary" onclick="EventSheet.toggleAttending('${ev.id}',this)">
          ⭐ Interested
        </button>
        <button class="es-footer-btn primary" onclick="EventSheet.buyTicket('${ev.id}','${ev.price}')">
          ${!ev.price || ev.price === 'Free' ? '🎟 Register Free' : `🎟 Get Tickets · ${ev.price}`}
        </button>
      </div>
    `;

    // Initialize rating state
    _currentRating = null;
  }

  // ── COMMENT RENDERING ────────────────────────────────────
  function _commentHtml(c) {
    return `
      <div class="es-comment" id="comment-${c.id}">
        <div class="es-c-av">${avatarHtml(c.author, 32)}</div>
        <div class="es-c-body">
          <div class="es-c-name">${c.author?.display_name || 'User'} <span class="es-c-time">${relativeTime(c.created_at)}</span></div>
          ${c.rating ? `<div class="es-c-stars">${'★'.repeat(c.rating)}${'☆'.repeat(5-c.rating)}</div>` : ''}
          <div class="es-c-text">${c.text}</div>
          ${AppState.currentUser?.uid === c.user_id
            ? `<button class="es-c-delete" onclick="EventSheet.deleteComment('${c.id}','${c.event_id}')">Delete</button>`
            : ''}
        </div>
      </div>`;
  }

  function _appendLiveComment(comment) {
    const container = document.getElementById(`es-comments-${_currentEventId}`);
    if (!container) return;
    const noComment = container.querySelector('.es-no-comments');
    if (noComment) noComment.remove();
    container.insertAdjacentHTML('afterbegin', _commentHtml(comment));
  }

  // ── COMMENT ACTIONS ──────────────────────────────────────
  let _currentRating = null;

  function setRating(evId, val) {
    _currentRating = val;
    document.querySelectorAll(`#es-rating-${evId} .es-star`).forEach((s, i) => {
      s.textContent = i < val ? '★' : '☆';
      s.classList.toggle('active', i < val);
    });
  }

  async function submitComment(evId) {
    requireAuth(async () => {
      const input = document.getElementById(`es-ci-${evId}`);
      const text  = input?.value?.trim();
      if (!text) return Toast.show('Write something first!');

      const { success, comment, error } = await SupabaseService.addComment(evId, text, _currentRating);
      if (!success) return Toast.show(`Error: ${error}`);

      input.value = '';
      _currentRating = null;
      // Reset stars
      document.querySelectorAll(`#es-rating-${evId} .es-star`).forEach(s => s.textContent = '☆');
      Toast.show('💬 Comment posted!');
    });
  }

  async function deleteComment(commentId, evId) {
    const ok = await SupabaseService.deleteComment(commentId);
    if (ok) {
      document.getElementById(`comment-${commentId}`)?.remove();
      Toast.show('Comment deleted');
    }
  }

  // ── OTHER ACTIONS ────────────────────────────────────────
  async function toggleSave(evId, btn) {
    requireAuth(async () => {
      const { saved } = await SupabaseService.toggleSave(evId);
      AppState.savedEvents[saved ? 'add' : 'delete'](evId);
      btn.textContent = saved ? '✅ Saved' : '🔖 Save';
      btn.classList.toggle('saved', saved);
      Toast.show(saved ? '✅ Event saved!' : '🔖 Removed from saved');
    });
  }

  async function toggleAttending(evId, btn) {
    requireAuth(async () => {
      const { attending } = await SupabaseService.toggleAttending(evId);
      AppState.attendingEvents[attending ? 'add' : 'delete'](evId);
      btn.textContent = attending ? '✅ Going!' : '⭐ Interested';
      Toast.show(attending ? '✅ RSVP confirmed!' : 'Removed from going');
    });
  }

  async function toggleFollow(userId, btn) {
    requireAuth(async () => {
      const { following } = await SupabaseService.toggleFollow(userId);
      AppState.followingUsers[following ? 'add' : 'delete'](userId);
      btn.textContent = following ? '✓ Following' : 'Follow';
      btn.classList.toggle('following', following);
      Toast.show(following ? '✅ Following!' : 'Unfollowed');
    });
  }

  function share(evId) {
    const url = `${window.location.origin}${window.location.pathname}#event-${evId}`;
    if (navigator.share) {
      navigator.share({ title: 'Check this event on Mapzo!', url });
    } else {
      navigator.clipboard?.writeText(url);
      Toast.show('📤 Link copied!');
    }
  }

  function addToCalendar(evId) {
    // Could implement ICS generation here
    Toast.show('📅 Added to calendar!');
  }

  function openDirections(lat, lng) {
    window.open(`https://maps.google.com/?q=${lat},${lng}`, '_blank');
  }

  function buyTicket(evId, price) {
    requireAuth(() => {
      if (!price || price === 'Free') {
        toggleAttending(evId, document.querySelector('.es-footer-btn.secondary'));
      } else {
        Toast.show('🎟 Redirecting to payment... (integrate Razorpay here)');
        // PAYMENT PLUG: integrate Razorpay/Stripe here
        // window.open(`YOUR_PAYMENT_URL?event=${evId}`, '_blank');
      }
    });
  }

  function close() {
    document.getElementById('event-sheet')?.classList.remove('open');
    unlockScroll();
    if (_commentSubscription) {
      _commentSubscription.unsubscribe();
      _commentSubscription = null;
    }
    _currentEventId = null;
  }

  return {
    open, close, share, toggleSave, toggleAttending, toggleFollow,
    submitComment, deleteComment, setRating,
    addToCalendar, openDirections, buyTicket,
  };
})();
