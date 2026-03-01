// ═══════════════════════════════════════════════════════════
// host.js — Host verification + Create Event form
// Depends on: EmailJS (loaded in index.html), Supabase, Firebase
// ═══════════════════════════════════════════════════════════

const HostController = (() => {

  let _uploadMap    = null;
  let _selectedLat  = null;
  let _selectedLng  = null;
  let _selectedFiles = [];
  let _uploadedUrls  = [];

  // ── OPEN CREATE SHEET ────────────────────────────────────
  function openCreateSheet() {
    const profile = AppState.userProfile;

    // If not a verified host → show verification flow instead
    if (!profile?.is_host) {
      _openVerifySheet();
      return;
    }

    _openCreateForm();
  }

  // ── HOST VERIFICATION SHEET ──────────────────────────────
  function _openVerifySheet() {
    const sheet = document.getElementById('host-sheet');
    const panel = document.getElementById('host-panel');

    panel.innerHTML = `
      <div class="es-drag-handle"></div>
      <div class="hs-content">
        <div class="hs-icon">🎪</div>
        <h2 class="hs-title">Become a Host</h2>
        <p class="hs-sub">Fill in your details. We'll review and email you within 24 hours.</p>

        <div class="auth-field">
          <label>Full Name</label>
          <input type="text" id="hv-name" placeholder="Daksh Arora" value="${AppState.userProfile?.display_name || ''}">
        </div>
        <div class="auth-field">
          <label>Organization / Startup / College</label>
          <input type="text" id="hv-org" placeholder="Mapzo / IIT KGP / Independent">
        </div>
        <div class="auth-field">
          <label>Contact Email</label>
          <input type="email" id="hv-email" placeholder="you@email.com" value="${AppState.currentUser?.email || ''}">
        </div>
        <div class="auth-field">
          <label>Why do you want to host on Mapzo?</label>
          <textarea id="hv-reason" rows="4" placeholder="I organize college fests, underground gigs, tech meetups..." style="width:100%;resize:vertical;"></textarea>
        </div>

        <div id="hv-error" class="auth-error hidden"></div>
        <div id="hv-success" class="auth-success hidden">
          ✅ Request submitted! We'll email you within 24 hours.
        </div>

        <button class="auth-submit-btn" onclick="HostController.submitVerification()">Submit Request</button>
        <p style="font-size:.72rem;color:var(--t3);text-align:center;margin-top:12px;">
          Already verified? Contact us at ${CONFIG.emailjs.ownerEmail}
        </p>
      </div>`;

    sheet.classList.add('open');
    lockScroll();
  }

  async function submitVerification() {
    const name   = document.getElementById('hv-name')?.value?.trim();
    const org    = document.getElementById('hv-org')?.value?.trim();
    const email  = document.getElementById('hv-email')?.value?.trim();
    const reason = document.getElementById('hv-reason')?.value?.trim();

    if (!name || !org || !email || !reason) {
      document.getElementById('hv-error').textContent = 'Please fill all fields';
      document.getElementById('hv-error').classList.remove('hidden');
      return;
    }

    const btn = document.querySelector('#host-panel .auth-submit-btn');
    btn.textContent = 'Submitting...'; btn.disabled = true;

    // 1. Save request to Supabase
    const { success, error } = await SupabaseService.submitHostRequest({ fullName: name, org, email, reason });
    if (!success) {
      document.getElementById('hv-error').textContent = error;
      document.getElementById('hv-error').classList.remove('hidden');
      btn.textContent = 'Submit Request'; btn.disabled = false;
      return;
    }

    // 2. Send email to YOU via EmailJS
    // EMAILJS PLUG: Create a template at emailjs.com with these variables
    // Template variables: {{host_name}}, {{host_email}}, {{host_org}}, {{host_reason}}, {{user_id}}, {{approve_url}}
    if (typeof emailjs !== 'undefined') {
      await emailjs.send(CONFIG.emailjs.serviceId, CONFIG.emailjs.templateId, {
        host_name:   name,
        host_email:  email,
        host_org:    org,
        host_reason: reason,
        user_id:     AppState.currentUser.uid,
        // Direct approve URL — clicking this in your email runs the approval
        // You'll need a simple endpoint or just do it manually in Supabase
        approve_url: `${CONFIG.supabase.url}/functions/v1/approve-host?user_id=${AppState.currentUser.uid}&secret=mapzo_approve_daksh_2026`,
      });
    }

    document.getElementById('hv-error').classList.add('hidden');
    document.getElementById('hv-success').classList.remove('hidden');
    btn.textContent = 'Request Sent!'; btn.disabled = true;

    // Also send confirmation to applicant
    if (typeof emailjs !== 'undefined') {
      await emailjs.send(CONFIG.emailjs.serviceId, 'host_confirm_template', {
        to_email: email,
        to_name:  name,
      }).catch(() => {}); // Don't fail if confirmation fails
    }
  }

  // ── CREATE EVENT FORM ────────────────────────────────────
  function _openCreateForm() {
    const sheet = document.getElementById('host-sheet');
    const panel = document.getElementById('host-panel');

    panel.innerHTML = `
      <div class="es-drag-handle"></div>
      <div class="hs-content">
        <h2 class="hs-title">Create Event</h2>

        <!-- Media Upload -->
        <div class="hc-media-zone" onclick="document.getElementById('hc-file-input').click()">
          <div id="hc-preview-area">
            <div class="hc-media-placeholder">
              <div style="font-size:2rem">📸</div>
              <div>Upload photos / videos</div>
              <div style="font-size:.72rem;color:var(--t3)">Tap to add up to 5 files</div>
            </div>
          </div>
          <input type="file" id="hc-file-input" accept="image/*,video/*" multiple style="display:none"
            onchange="HostController.handleFileSelect(this.files)">
        </div>

        <!-- Title -->
        <div class="auth-field">
          <label>Event Title *</label>
          <input type="text" id="hc-title" placeholder="Give your event a catchy name...">
        </div>

        <!-- Category -->
        <div class="auth-field">
          <label>Category *</label>
          <select id="hc-category">
            <option value="" disabled selected>Select category...</option>
            <option value="Music">🎵 Music</option>
            <option value="Party">🎉 Party</option>
            <option value="Tech">💻 Tech</option>
            <option value="Food">🍕 Food</option>
            <option value="Sports">⚽ Sports</option>
            <option value="Cultural">🎭 Cultural</option>
            <option value="Nightlife">🌙 Nightlife</option>
            <option value="Markets">🛍 Markets</option>
            <option value="Wellness">🧘 Wellness</option>
          </select>
        </div>

        <!-- Date / Time Row -->
        <div class="hc-row-3">
          <div class="auth-field">
            <label>Date *</label>
            <input type="date" id="hc-date" min="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="auth-field">
            <label>Start *</label>
            <input type="time" id="hc-start">
          </div>
          <div class="auth-field">
            <label>End</label>
            <input type="time" id="hc-end">
          </div>
        </div>

        <!-- Location -->
        <div class="auth-field">
          <label>Venue / Address *</label>
          <input type="text" id="hc-venue" placeholder="Search venue or address...">
        </div>

        <!-- Location mini map -->
        <div id="hc-map" style="height:180px;border-radius:16px;overflow:hidden;margin-bottom:14px;background:var(--s2);border:1px solid var(--border);">
          <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--t3);font-size:.85rem;">
            Loading map...
          </div>
        </div>
        <div id="hc-latlng" style="font-size:.72rem;color:var(--t3);margin-bottom:14px;">
          Tap on map to set precise location
        </div>

        <!-- Price -->
        <div class="hc-row-2">
          <div class="auth-field">
            <label>Entry Price</label>
            <input type="text" id="hc-price" placeholder="Free / ₹499">
          </div>
          <div class="auth-field">
            <label>Max Attendees</label>
            <input type="number" id="hc-maxcap" placeholder="No limit" min="1">
          </div>
        </div>

        <!-- Description -->
        <div class="auth-field">
          <label>Description</label>
          <textarea id="hc-desc" rows="4" placeholder="Tell people what to expect..." style="width:100%;resize:vertical;"></textarea>
        </div>

        <!-- Tags -->
        <div class="auth-field">
          <label>Tags (comma separated)</label>
          <input type="text" id="hc-tags" placeholder="#music, #underground, #delhi">
        </div>

        <div id="hc-error" class="auth-error hidden"></div>

        <button class="auth-submit-btn" onclick="HostController.submitEvent()">🚀 Publish Event</button>
      </div>`;

    sheet.classList.add('open');
    lockScroll();

    // Init upload map after DOM is ready
    setTimeout(() => _initUploadMap(), 300);
  }

  function _initUploadMap() {
    if (typeof google === 'undefined') return;

    const mapEl = document.getElementById('hc-map');
    if (!mapEl) return;

    const center = AppState.mapInstance?.getCenter() || { lat: CONFIG.app.defaultLat, lng: CONFIG.app.defaultLng };

    _uploadMap = new google.maps.Map(mapEl, {
      center,
      zoom: 14,
      disableDefaultUI: true,
      gestureHandling:  'greedy',
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#556070' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2030' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060a12' }] },
      ],
    });

    let marker = null;

    _uploadMap.addListener('click', (e) => {
      _selectedLat = e.latLng.lat();
      _selectedLng = e.latLng.lng();

      document.getElementById('hc-latlng').textContent =
        `📍 ${_selectedLat.toFixed(5)}, ${_selectedLng.toFixed(5)} — looks good!`;

      if (marker) marker.setMap(null);
      marker = new google.maps.Marker({
        position: e.latLng,
        map: _uploadMap,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
              <circle cx="16" cy="16" r="14" fill="#1db954" stroke="#fff" stroke-width="2"/>
              <text x="16" y="22" text-anchor="middle" font-size="14">📍</text>
              <polygon points="10,26 22,26 16,38" fill="#1db954"/>
            </svg>`),
          scaledSize: new google.maps.Size(32, 40),
          anchor:     new google.maps.Point(16, 40),
        },
      });

      // Reverse geocode to fill address field
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: e.latLng }, (results) => {
        if (results?.[0]) {
          const addr = results[0].formatted_address;
          const venueInput = document.getElementById('hc-venue');
          if (venueInput && !venueInput.value) venueInput.value = addr;
        }
      });
    });

    // Autocomplete for venue search
    const venueInput = document.getElementById('hc-venue');
    if (venueInput && google.maps.places) {
      const ac = new google.maps.places.Autocomplete(venueInput);
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (place.geometry) {
          _selectedLat = place.geometry.location.lat();
          _selectedLng = place.geometry.location.lng();
          _uploadMap.setCenter(place.geometry.location);
          _uploadMap.setZoom(16);
          document.getElementById('hc-latlng').textContent = `📍 Location set!`;
        }
      });
    }
  }

  // ── FILE UPLOAD ──────────────────────────────────────────
  function handleFileSelect(files) {
    _selectedFiles = Array.from(files).slice(0, 5);
    const preview = document.getElementById('hc-preview-area');
    if (!preview) return;

    if (_selectedFiles.length === 0) return;

    preview.innerHTML = _selectedFiles.map((f, i) => `
      <div class="hc-file-preview">
        ${f.type.startsWith('image/')
          ? `<img src="${URL.createObjectURL(f)}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;">`
          : `<div style="width:60px;height:60px;border-radius:8px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">🎬</div>`}
        <div style="font-size:.65rem;color:var(--t2);margin-top:4px;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.name}</div>
      </div>`).join('');

    preview.style.display = 'flex';
    preview.style.gap = '8px';
    preview.style.padding = '8px';
    preview.style.overflowX = 'auto';
  }

  // ── SUBMIT EVENT ─────────────────────────────────────────
  async function submitEvent() {
    // Validate
    const title    = document.getElementById('hc-title')?.value?.trim();
    const category = document.getElementById('hc-category')?.value;
    const date     = document.getElementById('hc-date')?.value;
    const start    = document.getElementById('hc-start')?.value;
    const venue    = document.getElementById('hc-venue')?.value?.trim();

    if (!title)    return _formError('Event title is required');
    if (!category) return _formError('Please select a category');
    if (!date)     return _formError('Please set the event date');
    if (!start)    return _formError('Please set the start time');
    if (!venue)    return _formError('Please set the venue / address');
    if (!_selectedLat || !_selectedLng) return _formError('Please tap the map to set the exact location');

    const btn = document.querySelector('#host-panel .auth-submit-btn');
    btn.textContent = 'Uploading media...'; btn.disabled = true;

    // Upload files to Supabase storage
    _uploadedUrls = [];
    const tempEventId = crypto.randomUUID(); // temp ID for storage path
    for (const file of _selectedFiles) {
      const url = await SupabaseService.uploadEventMedia(file, tempEventId);
      if (url) _uploadedUrls.push(url);
    }

    btn.textContent = 'Publishing...';

    // Parse tags
    const tagsRaw = document.getElementById('hc-tags')?.value || '';
    const tags = tagsRaw.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean).map(t => `#${t}`);

    const eventData = {
      title,
      category,
      event_date:  date,
      start_time:  start,
      end_time:    document.getElementById('hc-end')?.value || null,
      venue_name:  venue,
      address:     venue,
      lat:         _selectedLat,
      lng:         _selectedLng,
      price:       document.getElementById('hc-price')?.value?.trim() || 'Free',
      description: document.getElementById('hc-desc')?.value?.trim() || '',
      tags,
      image_urls:  _uploadedUrls.filter(u => !u.includes('.mp4') && !u.includes('.mov')),
      video_urls:  _uploadedUrls.filter(u => u.includes('.mp4') || u.includes('.mov')),
      host_id:     AppState.currentUser.uid,
    };

    const { success, event, error } = await SupabaseService.createEvent(eventData);

    if (!success) {
      _formError(`Failed to publish: ${error}`);
      btn.textContent = '🚀 Publish Event'; btn.disabled = false;
      return;
    }

    closeSheet();
    Toast.show('🎉 Event published! It\'s live on the map.');

    // Add to local events cache and map
    AppState.allEvents.unshift(event);
    MapController.addPin(event);

    // Reset state
    _selectedFiles = [];
    _uploadedUrls  = [];
    _selectedLat   = null;
    _selectedLng   = null;
  }

  function _formError(msg) {
    const el = document.getElementById('hc-error');
    if (!el) return Toast.show(msg);
    el.textContent = msg;
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function closeSheet() {
    document.getElementById('host-sheet')?.classList.remove('open');
    unlockScroll();
  }

  return { openCreateSheet, submitVerification, handleFileSelect, submitEvent, closeSheet };
})();
