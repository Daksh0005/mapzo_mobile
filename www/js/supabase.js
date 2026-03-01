// ═══════════════════════════════════════════════════════════
// supabase.js — Supabase client + ALL database operations
// Loaded after: config.js
//
// SUPABASE TABLES REQUIRED (run this SQL in Supabase SQL editor):
/*
-- Users table
create table users (
  id            text primary key,          -- Firebase UID
  email         text unique not null,
  display_name  text,
  avatar_url    text,
  bio           text,
  instagram     text,
  location      text,
  interests     text[],
  is_host       boolean default false,     -- YOU flip this to true after verifying
  host_verified_at timestamptz,
  provider      text,
  follower_count int default 0,
  following_count int default 0,
  created_at    timestamptz default now()
);

-- Events table
create table events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  category      text not null,
  venue_name    text,
  address       text,
  lat           float8 not null,
  lng           float8 not null,
  event_date    date not null,
  start_time    time not null,
  end_time      time,
  price         text default 'Free',
  image_urls    text[],
  video_urls    text[],
  tags          text[],
  host_id       text references users(id),
  attending_count int default 0,
  like_count    int default 0,
  is_live       boolean default false,
  is_pinned     boolean default false,
  created_at    timestamptz default now()
);

-- Likes table
create table likes (
  user_id   text references users(id),
  event_id  uuid references events(id),
  created_at timestamptz default now(),
  primary key (user_id, event_id)
);

-- Saves (bookmarks)
create table saves (
  user_id   text references users(id),
  event_id  uuid references events(id),
  created_at timestamptz default now(),
  primary key (user_id, event_id)
);

-- RSVP / Attending
create table attending (
  user_id   text references users(id),
  event_id  uuid references events(id),
  created_at timestamptz default now(),
  primary key (user_id, event_id)
);

-- Comments
create table comments (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid references events(id) on delete cascade,
  user_id   text references users(id),
  text      text not null,
  rating    int check (rating between 1 and 5),
  created_at timestamptz default now()
);

-- Follows
create table follows (
  follower_id text references users(id),
  following_id text references users(id),
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

-- Notifications
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     text references users(id),
  type        text,   -- 'like','comment','follow','event_nearby','host_approved'
  message     text,
  event_id    uuid references events(id),
  actor_id    text references users(id),
  read        boolean default false,
  created_at  timestamptz default now()
);

-- Host verification requests
create table host_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     text references users(id),
  full_name   text,
  org         text,
  email       text,
  reason      text,
  status      text default 'pending',   -- 'pending','approved','rejected'
  created_at  timestamptz default now()
);

-- Row Level Security (run these too)
alter table users enable row level security;
alter table events enable row level security;
alter table likes enable row level security;
alter table saves enable row level security;
alter table attending enable row level security;
alter table comments enable row level security;
alter table follows enable row level security;
alter table notifications enable row level security;
alter table host_requests enable row level security;

-- Policies (allow all reads, restrict writes to owner)
create policy "Public read users" on users for select using (true);
create policy "Own write users" on users for insert with check (auth.uid()::text = id);
create policy "Own update users" on users for update using (auth.uid()::text = id);
create policy "Public read events" on events for select using (true);
create policy "Host insert events" on events for insert with check (auth.uid()::text = host_id);
create policy "Host update events" on events for update using (auth.uid()::text = host_id);
create policy "Public read comments" on comments for select using (true);
create policy "Auth insert comments" on comments for insert with check (auth.uid()::text = user_id);
create policy "Public read likes" on likes for select using (true);
create policy "Auth manage likes" on likes for all using (auth.uid()::text = user_id);
create policy "Auth manage saves" on saves for all using (auth.uid()::text = user_id);
create policy "Auth manage attending" on attending for all using (auth.uid()::text = user_id);
create policy "Public read follows" on follows for select using (true);
create policy "Auth manage follows" on follows for all using (auth.uid()::text = follower_id);
create policy "Own notifications" on notifications for select using (auth.uid()::text = user_id);
create policy "Auth host requests" on host_requests for insert with check (auth.uid()::text = user_id);
*/
// ═══════════════════════════════════════════════════════════

const SupabaseService = (() => {

  let _client = null;

  // ── INIT ─────────────────────────────────────────────────
  function init() {
    if (typeof supabase === 'undefined') {
      console.error('[Supabase] SDK not loaded. Check <script> in index.html');
      return;
    }
    _client = supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
    window.db = _client; // expose for debugging
    console.log('[Supabase] Initialized ✓');
  }

  function client() { return _client; }

  // ═══════════════════════════════
  // USERS
  // ═══════════════════════════════

  async function upsertUser(userData) {
    const { error } = await _client
      .from('users')
      .upsert(userData, { onConflict: 'id' });
    if (error) console.error('[Supabase] upsertUser:', error.message);
  }

  async function getUser(userId) {
    const { data, error } = await _client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data;
  }

  async function updateUser(userId, updates) {
    const { data, error } = await _client
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) { console.error('[Supabase] updateUser:', error.message); return null; }
    return data;
  }

  // ═══════════════════════════════
  // EVENTS
  // ═══════════════════════════════

  // Fetch events — supports filters
  // filters: { category, lat, lng, radius_km, search, limit, offset, trending }
  async function getEvents(filters = {}) {
    let query = _client
      .from('events')
      .select(`
        *,
        host:users!host_id(id, display_name, avatar_url, is_host),
        likes(count),
        attending(count),
        comments(count)
      `)
      .order('created_at', { ascending: false });

    if (filters.category)  query = query.eq('category', filters.category);
    if (filters.search)    query = query.ilike('title', `%${filters.search}%`);
    if (filters.is_live)   query = query.eq('is_live', true);
    if (filters.limit)     query = query.limit(filters.limit);
    else                   query = query.limit(CONFIG.app.feedPageSize);
    if (filters.offset)    query = query.range(filters.offset, filters.offset + (filters.limit || CONFIG.app.feedPageSize) - 1);

    const { data, error } = await query;
    if (error) { console.error('[Supabase] getEvents:', error.message); return []; }
    return data || [];
  }

  // Get single event with full detail
  async function getEvent(eventId) {
    const { data, error } = await _client
      .from('events')
      .select(`
        *,
        host:users!host_id(id, display_name, avatar_url, is_host, bio),
        comments(*, author:users!user_id(id, display_name, avatar_url)),
        likes(count),
        attending(*, user:users!user_id(id, display_name, avatar_url))
      `)
      .eq('id', eventId)
      .single();
    if (error) { console.error('[Supabase] getEvent:', error.message); return null; }
    return data;
  }

  // Create event — only hosts can do this (enforced by RLS)
  async function createEvent(eventData) {
    const { data, error } = await _client
      .from('events')
      .insert({ ...eventData, host_id: window.currentUser.uid })
      .select()
      .single();
    if (error) { console.error('[Supabase] createEvent:', error.message); return { success: false, error: error.message }; }
    return { success: true, event: data };
  }

  async function deleteEvent(eventId) {
    const { error } = await _client
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('host_id', window.currentUser.uid); // RLS double-check
    return !error;
  }

  // ═══════════════════════════════
  // LIKES
  // ═══════════════════════════════

  async function toggleLike(eventId) {
    if (!window.currentUser) return { success: false, error: 'Not logged in' };
    const uid = window.currentUser.uid;

    // Check if already liked
    const { data: existing } = await _client
      .from('likes')
      .select('user_id')
      .eq('user_id', uid)
      .eq('event_id', eventId)
      .single();

    if (existing) {
      // Unlike
      await _client.from('likes').delete().eq('user_id', uid).eq('event_id', eventId);
      await _client.rpc('decrement_like_count', { event_id: eventId }); // Supabase RPC function
      return { liked: false };
    } else {
      // Like
      await _client.from('likes').insert({ user_id: uid, event_id: eventId });
      await _client.rpc('increment_like_count', { event_id: eventId });
      // Create notification for event host
      await _createNotification(eventId, 'like');
      return { liked: true };
    }
  }

  async function getUserLikes(userId) {
    const { data } = await _client.from('likes').select('event_id').eq('user_id', userId);
    return new Set((data || []).map(r => r.event_id));
  }

  // ═══════════════════════════════
  // SAVES (BOOKMARKS)
  // ═══════════════════════════════

  async function toggleSave(eventId) {
    if (!window.currentUser) return { success: false, error: 'Not logged in' };
    const uid = window.currentUser.uid;

    const { data: existing } = await _client
      .from('saves')
      .select('user_id')
      .eq('user_id', uid)
      .eq('event_id', eventId)
      .single();

    if (existing) {
      await _client.from('saves').delete().eq('user_id', uid).eq('event_id', eventId);
      return { saved: false };
    } else {
      await _client.from('saves').insert({ user_id: uid, event_id: eventId });
      return { saved: true };
    }
  }

  async function getUserSaves(userId) {
    const { data } = await _client.from('saves').select('event_id').eq('user_id', userId);
    return new Set((data || []).map(r => r.event_id));
  }

  // ═══════════════════════════════
  // ATTENDING / RSVP
  // ═══════════════════════════════

  async function toggleAttending(eventId) {
    if (!window.currentUser) return { success: false, error: 'Not logged in' };
    const uid = window.currentUser.uid;

    const { data: existing } = await _client
      .from('attending')
      .select('user_id')
      .eq('user_id', uid)
      .eq('event_id', eventId)
      .single();

    if (existing) {
      await _client.from('attending').delete().eq('user_id', uid).eq('event_id', eventId);
      await _client.rpc('decrement_attending_count', { event_id: eventId });
      return { attending: false };
    } else {
      await _client.from('attending').insert({ user_id: uid, event_id: eventId });
      await _client.rpc('increment_attending_count', { event_id: eventId });
      await _createNotification(eventId, 'attending');
      return { attending: true };
    }
  }

  // ═══════════════════════════════
  // COMMENTS
  // ═══════════════════════════════

  async function getComments(eventId) {
    const { data, error } = await _client
      .from('comments')
      .select('*, author:users!user_id(id, display_name, avatar_url)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  }

  async function addComment(eventId, text, rating = null) {
    if (!window.currentUser) return { success: false, error: 'Not logged in' };
    const { data, error } = await _client
      .from('comments')
      .insert({
        event_id: eventId,
        user_id:  window.currentUser.uid,
        text,
        rating,
      })
      .select('*, author:users!user_id(id, display_name, avatar_url)')
      .single();
    if (error) return { success: false, error: error.message };
    await _createNotification(eventId, 'comment');
    return { success: true, comment: data };
  }

  async function deleteComment(commentId) {
    const { error } = await _client
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', window.currentUser.uid);
    return !error;
  }

  // ═══════════════════════════════
  // FOLLOWS
  // ═══════════════════════════════

  async function toggleFollow(targetUserId) {
    if (!window.currentUser) return { success: false, error: 'Not logged in' };
    const uid = window.currentUser.uid;
    if (uid === targetUserId) return { success: false, error: 'Cannot follow yourself' };

    const { data: existing } = await _client
      .from('follows')
      .select('follower_id')
      .eq('follower_id', uid)
      .eq('following_id', targetUserId)
      .single();

    if (existing) {
      await _client.from('follows').delete().eq('follower_id', uid).eq('following_id', targetUserId);
      // Decrement counts
      await _client.rpc('decrement_follower_count', { target_id: targetUserId });
      await _client.rpc('decrement_following_count', { target_id: uid });
      return { following: false };
    } else {
      await _client.from('follows').insert({ follower_id: uid, following_id: targetUserId });
      await _client.rpc('increment_follower_count', { target_id: targetUserId });
      await _client.rpc('increment_following_count', { target_id: uid });
      // Notify the followed user
      await _client.from('notifications').insert({
        user_id:  targetUserId,
        actor_id: uid,
        type:     'follow',
        message:  `${window.currentUser.displayName || 'Someone'} started following you`,
      });
      return { following: true };
    }
  }

  async function getFollowing(userId) {
    const { data } = await _client.from('follows').select('following_id').eq('follower_id', userId);
    return new Set((data || []).map(r => r.following_id));
  }

  async function getFollowers(userId) {
    const { data } = await _client
      .from('follows')
      .select('follower_id, user:users!follower_id(id, display_name, avatar_url)')
      .eq('following_id', userId);
    return data || [];
  }

  // Friends attending an event (people you follow who are attending)
  async function getFriendsAttending(eventId) {
    if (!window.currentUser) return [];
    const following = await getFollowing(window.currentUser.uid);
    if (following.size === 0) return [];

    const { data } = await _client
      .from('attending')
      .select('user:users!user_id(id, display_name, avatar_url)')
      .eq('event_id', eventId)
      .in('user_id', [...following]);
    return (data || []).map(r => r.user);
  }

  // ═══════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════

  async function getNotifications(userId) {
    const { data } = await _client
      .from('notifications')
      .select('*, actor:users!actor_id(display_name, avatar_url), event:events!event_id(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    return data || [];
  }

  async function markNotificationsRead(userId) {
    await _client.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  }

  async function getUnreadCount(userId) {
    const { count } = await _client
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    return count || 0;
  }

  // ═══════════════════════════════
  // HOST REQUESTS
  // ═══════════════════════════════

  async function submitHostRequest(data) {
    if (!window.currentUser) return { success: false, error: 'Not logged in' };
    const { error } = await _client.from('host_requests').insert({
      user_id:   window.currentUser.uid,
      full_name: data.fullName,
      org:       data.org,
      email:     data.email,
      reason:    data.reason,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  // YOU CALL THIS from Supabase dashboard or a simple admin endpoint
  // to approve a host: just run UPDATE users SET is_host=true WHERE id='<uid>'

  // ═══════════════════════════════
  // REALTIME SUBSCRIPTIONS
  // ═══════════════════════════════

  // Subscribe to new events (for live map updates)
  function subscribeToEvents(callback) {
    return _client
      .channel('events-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, callback)
      .subscribe();
  }

  // Subscribe to comments on a specific event (for live chat)
  function subscribeToComments(eventId, callback) {
    return _client
      .channel(`comments-${eventId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'comments',
        filter: `event_id=eq.${eventId}`
      }, callback)
      .subscribe();
  }

  // Subscribe to user's notifications
  function subscribeToNotifications(userId, callback) {
    return _client
      .channel(`notifs-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe();
  }

  // ═══════════════════════════════
  // ACTIVITY FEED (social tab)
  // ═══════════════════════════════

  async function getActivityFeed(userId) {
    // Get events from people you follow
    const following = await getFollowing(userId);
    if (following.size === 0) return [];

    const { data } = await _client
      .from('attending')
      .select('*, user:users!user_id(id, display_name, avatar_url), event:events!event_id(id, title, category, image_urls, event_date, venue_name)')
      .in('user_id', [...following])
      .order('created_at', { ascending: false })
      .limit(20);
    return data || [];
  }

  // ═══════════════════════════════
  // INTERNAL HELPERS
  // ═══════════════════════════════

  async function _createNotification(eventId, type) {
    if (!window.currentUser) return;
    // Get event host
    const { data: ev } = await _client
      .from('events')
      .select('host_id, title')
      .eq('id', eventId)
      .single();
    if (!ev || ev.host_id === window.currentUser.uid) return; // Don't notify yourself

    const messages = {
      like:      `${window.currentUser.displayName || 'Someone'} liked your event "${ev.title}"`,
      comment:   `${window.currentUser.displayName || 'Someone'} commented on "${ev.title}"`,
      attending: `${window.currentUser.displayName || 'Someone'} is attending "${ev.title}"`,
    };

    await _client.from('notifications').insert({
      user_id:  ev.host_id,
      actor_id: window.currentUser.uid,
      event_id: eventId,
      type,
      message:  messages[type],
    });
  }

  // ═══════════════════════════════
  // STORAGE (images/videos)
  // ═══════════════════════════════

  // SUPABASE STORAGE BUCKET: create bucket named 'event-media' in Supabase Storage dashboard
  async function uploadEventMedia(file, eventId) {
    const ext = file.name.split('.').pop();
    const path = `events/${eventId}/${Date.now()}.${ext}`;
    const { data, error } = await _client.storage
      .from('event-media')
      .upload(path, file, { upsert: false });
    if (error) return null;
    const { data: urlData } = _client.storage.from('event-media').getPublicUrl(path);
    return urlData.publicUrl;
  }

  async function uploadAvatar(file, userId) {
    const ext = file.name.split('.').pop();
    const path = `avatars/${userId}.${ext}`;
    const { error } = await _client.storage
      .from('event-media')
      .upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = _client.storage.from('event-media').getPublicUrl(path);
    return data.publicUrl;
  }

  return {
    init, client,
    upsertUser, getUser, updateUser,
    getEvents, getEvent, createEvent, deleteEvent,
    toggleLike, getUserLikes,
    toggleSave, getUserSaves,
    toggleAttending, getFriendsAttending,
    getComments, addComment, deleteComment,
    toggleFollow, getFollowing, getFollowers,
    getNotifications, markNotificationsRead, getUnreadCount,
    subscribeToEvents, subscribeToComments, subscribeToNotifications,
    submitHostRequest,
    getActivityFeed,
    uploadEventMedia, uploadAvatar,
  };
})();
