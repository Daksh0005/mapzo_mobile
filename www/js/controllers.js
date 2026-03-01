// ═══════════════════════════════════════════════════════════
// profile.js — Profile page + user sheet
// ═══════════════════════════════════════════════════════════

const ProfileController = (() => {

  async function init() {
    if (!AppState.currentUser) {
      document.getElementById('pane-profile').innerHTML = `
        <div class="pv-logged-out">
          <div style="font-size:3rem;margin-bottom:16px;">👤</div>
          <h2>Sign in to see your profile</h2>
          <p style="color:var(--t2);margin-bottom:20px;">Track events, follow friends, build your identity</p>
          <button class="auth-submit-btn" style="max-width:200px" onclick="AuthUI.openModal('login')">Sign In</button>
        </div>`;
      return;
    }

    const profile = AppState.userProfile;
    const pane    = document.getElementById('pane-profile');
    if (!pane) return;

    // Fetch their events and saved events
    const [myEvents, saves] = await Promise.all([
      SupabaseService.getEvents({ host_id: AppState.currentUser.uid } ), // add host_id filter to supabase.js if needed
      SupabaseService.getUserSaves(AppState.currentUser.uid),
    ]);

    pane.innerHTML = `
      <!-- HEATMAP HERO -->
      <div class="pv-hero">
        <div class="pv-heatmap"></div>
        <div class="pv-hero-label">Activity Heatmap</div>
      </div>

      <!-- IDENTITY -->
      <div class="pv-identity">
        <div class="pv-av-wrap">${avatarHtml(profile, 80)}</div>
        <div class="pv-name">${profile?.display_name || AppState.currentUser.displayName || 'You'}</div>
        <div class="pv-handle">@${(profile?.display_name || 'user').toLowerCase().replace(/\s+/g,'')}</div>
        ${profile?.bio ? `<div class="pv-bio">${profile.bio}</div>` : '<div class="pv-bio" style="color:var(--t3)">No bio yet — add one in settings</div>'}
        ${profile?.interests?.length ? `
          <div class="pv-interests">
            ${profile.interests.map(i => `<span class="pv-interest">${i}</span>`).join('')}
          </div>` : ''}
      </div>

      <!-- STATS -->
      <div style="padding:0 16px">
        <div class="pv-stats">
          <div class="pv-stat"><div class="pv-stat-num">${myEvents.length}</div><div class="pv-stat-label">Events</div></div>
          <div class="pv-stat"><div class="pv-stat-num">${profile?.follower_count || 0}</div><div class="pv-stat-label">Followers</div></div>
          <div class="pv-stat"><div class="pv-stat-num">${profile?.following_count || 0}</div><div class="pv-stat-label">Following</div></div>
          <div class="pv-stat"><div class="pv-stat-num">${saves.size}</div><div class="pv-stat-label">Saved</div></div>
        </div>
      </div>

      <!-- ACTIONS -->
      <div class="pv-actions">
        <button class="pv-action-btn primary" onclick="ProfileController.openEditSheet()">Edit Profile</button>
        <button class="pv-action-btn secondary" onclick="ProfileController.shareProfile()">Share</button>
        ${!profile?.is_host
          ? `<button class="pv-action-btn secondary" onclick="HostController.openCreateSheet()">Become Host</button>`
          : `<button class="pv-action-btn secondary" style="border-color:var(--g);color:var(--g)">✓ Verified Host</button>`}
      </div>

      <!-- HOSTED EVENTS -->
      ${myEvents.length > 0 ? `
      <div class="pv-section">
        <div class="pv-section-title">My Events <span onclick="">See all</span></div>
        <div class="pv-events-strip">
          ${myEvents.slice(0,5).map(ev => {
            const m = getCatMeta(ev.category);
            return `<div class="pv-event-card" onclick="EventSheet.open('${ev.id}')">
              <div class="pve-img" style="background:${m.color};display:flex;align-items:center;justify-content:center;font-size:2rem;">${m.emoji}</div>
              <div class="pve-info">
                <div class="pve-title">${ev.title}</div>
                <div class="pve-meta">${ev.attending_count || 0} going</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      <!-- NOTIFICATIONS PREVIEW -->
      <div class="pv-section">
        <div class="pv-section-title">Notifications</div>
        <div id="pv-notif-list"><div style="color:var(--t3);font-size:.85rem;">Loading...</div></div>
      </div>

      <!-- ACCOUNT LINKS -->
      <div class="pv-section">
        <div class="pv-menu-item" onclick="ProfileController.openEditSheet()">✏️ Edit Profile</div>
        <div class="pv-menu-item" onclick="Router.navigate('explore')">🌍 Explore Events</div>
        <div class="pv-menu-item" onclick="AuthUI.handleSignOut()">🚪 Sign Out</div>
      </div>
    `;

    // Load notifications
    _loadNotifications();
  }

  async function _loadNotifications() {
    const notifs = await SupabaseService.getNotifications(AppState.currentUser.uid);
    const el = document.getElementById('pv-notif-list');
    if (!el) return;

    await SupabaseService.markNotificationsRead(AppState.currentUser.uid);
    AppState.unreadNotifs = 0;
    NotificationBadge.update(0);

    if (!notifs.length) { el.innerHTML = '<div style="color:var(--t3);font-size:.85rem;">No notifications yet</div>'; return; }

    el.innerHTML = notifs.slice(0, 5).map(n => `
      <div class="pv-notif ${n.read ? '' : 'unread'}">
        <div class="pv-notif-av">${avatarHtml(n.actor, 32)}</div>
        <div class="pv-notif-body">
          <div class="pv-notif-text">${n.message}</div>
          <div class="pv-notif-time">${relativeTime(n.created_at)}</div>
        </div>
      </div>`).join('');
  }

  // Open another user's profile as bottom sheet
  async function openUserSheet(userId) {
    if (!userId || userId === 'undefined') return;
    const user = await SupabaseService.getUser(userId);
    if (!user) return;

    const sheet = document.getElementById('host-sheet');
    const panel = document.getElementById('host-panel');
    const isFollowing = AppState.followingUsers.has(userId);

    panel.innerHTML = `
      <div class="es-drag-handle"></div>
      <div class="hs-content">
        <div style="text-align:center;padding:20px 0">
          ${avatarHtml(user, 72)}
          <div class="pv-name" style="margin-top:12px">${user.display_name}</div>
          ${user.bio ? `<div class="pv-bio">${user.bio}</div>` : ''}
          ${user.is_host ? `<div style="color:var(--g);font-size:.8rem;margin-top:4px">✓ Verified Host</div>` : ''}
        </div>
        <div class="pv-stats" style="margin:0 0 16px">
          <div class="pv-stat"><div class="pv-stat-num">${user.follower_count || 0}</div><div class="pv-stat-label">Followers</div></div>
          <div class="pv-stat"><div class="pv-stat-num">${user.following_count || 0}</div><div class="pv-stat-label">Following</div></div>
        </div>
        <button class="auth-submit-btn ${isFollowing ? 'following' : ''}" id="user-follow-${userId}"
          onclick="ProfileController.toggleFollowUser('${userId}',this)">
          ${isFollowing ? '✓ Following' : '+ Follow'}
        </button>
      </div>`;

    sheet.classList.add('open');
    lockScroll();
  }

  async function toggleFollowUser(userId, btn) {
    requireAuth(async () => {
      const { following } = await SupabaseService.toggleFollow(userId);
      AppState.followingUsers[following ? 'add' : 'delete'](userId);
      btn.textContent = following ? '✓ Following' : '+ Follow';
      btn.classList.toggle('following', following);
      Toast.show(following ? '✅ Following!' : 'Unfollowed');
    });
  }

  function openEditSheet() {
    const profile = AppState.userProfile;
    const sheet = document.getElementById('host-sheet');
    const panel = document.getElementById('host-panel');

    panel.innerHTML = `
      <div class="es-drag-handle"></div>
      <div class="hs-content">
        <h2 class="hs-title">Edit Profile</h2>
        <div class="auth-field">
          <label>Display Name</label>
          <input type="text" id="ep-name" value="${profile?.display_name || ''}">
        </div>
        <div class="auth-field">
          <label>Bio</label>
          <textarea id="ep-bio" rows="3" style="width:100%;resize:vertical">${profile?.bio || ''}</textarea>
        </div>
        <div class="auth-field">
          <label>Instagram handle</label>
          <input type="text" id="ep-insta" placeholder="@yourhandle" value="${profile?.instagram || ''}">
        </div>
        <div class="auth-field">
          <label>Interests (comma separated)</label>
          <input type="text" id="ep-interests" placeholder="Music, Tech, Food" value="${(profile?.interests || []).join(', ')}">
        </div>
        <div class="auth-field">
          <label>Profile Photo</label>
          <input type="file" id="ep-avatar" accept="image/*">
        </div>
        <button class="auth-submit-btn" onclick="ProfileController.saveProfile()">Save Changes</button>
      </div>`;

    sheet.classList.add('open');
    lockScroll();
  }

  async function saveProfile() {
    const name      = document.getElementById('ep-name')?.value?.trim();
    const bio       = document.getElementById('ep-bio')?.value?.trim();
    const instagram = document.getElementById('ep-insta')?.value?.trim();
    const interests = (document.getElementById('ep-interests')?.value || '').split(',').map(i => i.trim()).filter(Boolean);
    const avatarFile = document.getElementById('ep-avatar')?.files?.[0];

    let avatarUrl = AppState.userProfile?.avatar_url;
    if (avatarFile) {
      avatarUrl = await SupabaseService.uploadAvatar(avatarFile, AppState.currentUser.uid);
    }

    const updated = await SupabaseService.updateUser(AppState.currentUser.uid, {
      display_name: name,
      bio,
      instagram,
      interests,
      avatar_url: avatarUrl,
    });

    if (updated) {
      AppState.userProfile = updated;
      document.getElementById('host-sheet')?.classList.remove('open');
      unlockScroll();
      Toast.show('✅ Profile updated!');
      Router.refresh('profile');
    } else {
      Toast.show('Failed to save. Try again.');
    }
  }

  function shareProfile() {
    const url = window.location.href;
    if (navigator.share) navigator.share({ title: 'Mapzo Profile', url });
    else { navigator.clipboard?.writeText(url); Toast.show('📤 Profile link copied!'); }
  }

  return { init, openUserSheet, toggleFollowUser, openEditSheet, saveProfile, shareProfile };
})();

// ═══════════════════════════════════════════════════════════
// list.js — List view
// ═══════════════════════════════════════════════════════════

const ListController = (() => {
  let _initialized = false;

  async function init() {
    if (_initialized) return;
    _initialized = true;
    _render(AppState.allEvents.length ? AppState.allEvents : await SupabaseService.getEvents({ limit: 30 }));
  }

  function _render(events) {
    const container = document.getElementById('list-cards');
    if (!container) return;
    container.innerHTML = '';

    events.forEach(ev => {
      const meta = getCatMeta(ev.category);
      const div = document.createElement('div');
      div.className = 'lc';
      div.onclick = () => EventSheet.open(ev.id);
      div.innerHTML = `
        <div class="lc-img-wrap">
          <div class="lc-img" style="background:linear-gradient(160deg,${meta.color},#111);display:flex;align-items:center;justify-content:center;font-size:4rem;opacity:.8;">${meta.emoji}</div>
          <div class="lc-img-overlay"></div>
          <span class="lc-cat-badge ${meta.cls}">${meta.emoji} ${ev.category}</span>
          <span class="lc-dist">📍 ${ev.venue_name || ev.address || '?'}</span>
          ${ev.is_live ? '<span class="lc-live">● LIVE NOW</span>' : ''}
        </div>
        <div class="lc-body">
          <div class="lc-title">${ev.title}</div>
          <div class="lc-meta">
            <span>📅 ${formatEventDate(ev.event_date, ev.start_time)}</span>
            <span>🎟 ${ev.price || 'Free'}</span>
            <span>👥 ${ev.attending_count || 0} going</span>
          </div>
          ${ev.tags?.length ? `<div class="lc-tags">${ev.tags.slice(0,3).map(t => `<span class="lc-tag">${t}</span>`).join('')}</div>` : ''}
          <div class="lc-actions">
            <button class="lc-action-btn" onclick="event.stopPropagation();requireAuth(()=>SupabaseService.toggleSave('${ev.id}'));Toast.show('✅ Saved!')">🔖 Save</button>
            <button class="lc-action-btn primary" onclick="event.stopPropagation();EventSheet.open('${ev.id}')">Open →</button>
          </div>
        </div>`;
      container.appendChild(div);
    });
  }

  return { init };
})();

// ═══════════════════════════════════════════════════════════
// explore.js — Explore tab
// ═══════════════════════════════════════════════════════════

const ExploreController = (() => {
  let _initialized = false;

  async function init() {
    if (_initialized) return;
    _initialized = true;

    const events = AppState.allEvents.length ? AppState.allEvents : await SupabaseService.getEvents({ limit: 30 });

    // Trending strip
    const tStrip = document.getElementById('ex-trending-strip');
    if (tStrip) {
      events.slice(0, 6).forEach((ev, i) => {
        const m = getCatMeta(ev.category);
        const card = document.createElement('div');
        card.className = 'ex-trend-card';
        card.onclick = () => EventSheet.open(ev.id);
        card.innerHTML = `
          <div class="ex-trend-img" style="background:linear-gradient(160deg,${m.color},#111)">
            <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2.5rem;opacity:.8;">${m.emoji}</div>
            <div class="ex-trend-rank">#${i+1}</div>
          </div>
          <div class="ex-trend-info">
            <div class="ex-trend-title">${ev.title}</div>
            <div class="ex-trend-meta">${ev.attending_count || 0} going</div>
          </div>`;
        tStrip.appendChild(card);
      });
    }

    // Category grid
    const grid = document.getElementById('ex-cat-grid');
    if (grid) {
      Object.entries(CATEGORY_META).forEach(([name, m]) => {
        const tile = document.createElement('div');
        tile.className = 'ex-cat-tile';
        tile.onclick = () => {
          Router.navigate('list');
          // TODO: filter list by category
          Toast.show(`${m.emoji} Browsing ${name}`);
        };
        tile.innerHTML = `<div class="ex-cat-bg" style="background:linear-gradient(160deg,${m.color},#111)">
          <div class="ex-cat-icon">${m.emoji}</div>
          <div class="ex-cat-name">${name}</div>
        </div>`;
        grid.appendChild(tile);
      });
    }
  }

  return { init };
})();

// ═══════════════════════════════════════════════════════════
// social.js — Social tab (activity feed, who's out)
// ═══════════════════════════════════════════════════════════

const SocialController = (() => {
  let _initialized = false;

  async function init() {
    if (_initialized) return;
    _initialized = true;

    if (!AppState.currentUser) {
      document.getElementById('pane-social').innerHTML = `
        <div class="pv-logged-out">
          <div style="font-size:3rem">👥</div>
          <h2 style="margin:12px 0 8px">See what friends are up to</h2>
          <p style="color:var(--t2);margin-bottom:20px">Follow people to see their activity</p>
          <button class="auth-submit-btn" style="max-width:200px" onclick="AuthUI.openModal('login')">Sign In</button>
        </div>`;
      return;
    }

    const [activity] = await Promise.all([
      SupabaseService.getActivityFeed(AppState.currentUser.uid),
    ]);

    const feed = document.getElementById('sv-activity-feed');
    if (feed) {
      if (!activity.length) {
        feed.innerHTML = `<div style="color:var(--t3);font-size:.85rem;padding:20px 14px">
          Follow people to see their activity here. Try exploring events and following hosts!</div>`;
      } else {
        feed.innerHTML = activity.map(a => `
          <div class="sv-activity-item">
            <div class="sv-ai-av">${avatarHtml(a.user, 38)}</div>
            <div class="sv-ai-body">
              <div class="sv-ai-text"><strong>${a.user?.display_name || 'Someone'}</strong> is attending</div>
              <div class="sv-ai-time">${relativeTime(a.created_at)}</div>
              <div class="sv-ai-event" onclick="EventSheet.open('${a.event?.id}')">
                <div class="sv-ai-event-img" style="background:${getCatMeta(a.event?.category).color};display:flex;align-items:center;justify-content:center;font-size:1.2rem;">${getCatMeta(a.event?.category).emoji}</div>
                <div>
                  <div class="sv-ai-event-title">${a.event?.title}</div>
                  <div class="sv-ai-event-meta">${formatEventDate(a.event?.event_date, '00:00')} · ${a.event?.venue_name || ''}</div>
                </div>
              </div>
            </div>
          </div>`).join('');
      }
    }
  }

  return { init };
})();

// ═══════════════════════════════════════════════════════════
// notifications.js — Firebase Cloud Messaging (Push)
// ═══════════════════════════════════════════════════════════

const PushNotifications = (() => {

  async function init() {
    if (!AppState.currentUser) return;
    if (typeof firebase === 'undefined' || !firebase.messaging) return;

    try {
      const messaging = firebase.messaging();

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      // Get FCM token
      const token = await messaging.getToken({ vapidKey: CONFIG.firebase.vapidKey });
      if (!token) return;

      // Save token to Supabase so your backend can send pushes
      // BACKEND PLUG: add fcm_token column to users table
      await SupabaseService.client()
        .from('users')
        .update({ fcm_token: token })
        .eq('id', AppState.currentUser.uid);

      console.log('[FCM] Token saved ✓');

      // Handle foreground messages
      messaging.onMessage((payload) => {
        Toast.show(`🔔 ${payload.notification?.title || 'New notification'}`);
      });

    } catch (err) {
      console.warn('[FCM] Push setup failed:', err.message);
    }
  }

  // SENDING NOTIFICATIONS (from your backend or Supabase Edge Function):
  /*
    POST https://fcm.googleapis.com/fcm/send
    Authorization: key=YOUR_SERVER_KEY
    {
      "to": "<fcm_token>",
      "notification": { "title": "New event near you!", "body": "HackKGP 2025 is happening 0.1km away" },
      "data": { "event_id": "..." }
    }

    Or use Firebase Admin SDK in your Express backend:
    admin.messaging().send({ token, notification: { title, body } })
  */

  return { init };
})();
