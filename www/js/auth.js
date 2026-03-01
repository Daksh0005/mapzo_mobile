// ═══════════════════════════════════════════════════════════
// auth.js — Auth modal UI (login / signup / logout)
// ═══════════════════════════════════════════════════════════

const AuthUI = (() => {

  let _mode = 'login'; // 'login' | 'signup'

  function openModal(mode = 'login') {
    _mode = mode;
    _render();
    document.getElementById('auth-modal')?.classList.add('open');
    lockScroll();
  }

  function closeModal() {
    document.getElementById('auth-modal')?.classList.remove('open');
    unlockScroll();
  }

  function _render() {
    const body = document.getElementById('auth-modal-body');
    if (!body) return;

    if (_mode === 'login') {
      body.innerHTML = `
        <div class="auth-logo">mapzo</div>
        <h2 class="auth-title">Welcome back</h2>
        <p class="auth-sub">Your city is alive. Are you in it?</p>

        <!-- Google -->
        <button class="auth-google-btn" onclick="AuthUI.handleGoogleSignIn()">
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
          Continue with Google
        </button>

        <div class="auth-divider"><span>or</span></div>

        <div class="auth-field">
          <label>Email</label>
          <input type="email" id="auth-email" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="auth-field">
          <label>Password</label>
          <input type="password" id="auth-pass" placeholder="••••••••" autocomplete="current-password">
          <div id="auth-error" class="auth-error hidden"></div>
        </div>

        <button class="auth-submit-btn" onclick="AuthUI.handleEmailSignIn()">Sign In</button>
        <div class="auth-switch">Don't have an account? <span onclick="AuthUI.openModal('signup')">Sign up</span></div>
      `;
    } else {
      body.innerHTML = `
        <div class="auth-logo">mapzo</div>
        <h2 class="auth-title">Join Mapzo</h2>
        <p class="auth-sub">Connect with real events, real people</p>

        <button class="auth-google-btn" onclick="AuthUI.handleGoogleSignIn()">
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
          Sign up with Google
        </button>

        <div class="auth-divider"><span>or</span></div>

        <div class="auth-field">
          <label>Name</label>
          <input type="text" id="auth-name" placeholder="Your name" autocomplete="name">
        </div>
        <div class="auth-field">
          <label>Email</label>
          <input type="email" id="auth-email" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="auth-field">
          <label>Password</label>
          <input type="password" id="auth-pass" placeholder="Min. 6 characters" autocomplete="new-password">
          <div id="auth-error" class="auth-error hidden"></div>
        </div>

        <button class="auth-submit-btn" onclick="AuthUI.handleEmailSignUp()">Create Account</button>
        <div class="auth-switch">Already have an account? <span onclick="AuthUI.openModal('login')">Sign in</span></div>
      `;
    }
  }

  // ── HANDLERS ─────────────────────────────────────────────

  async function handleGoogleSignIn() {
    const btn = document.querySelector('.auth-google-btn');
    if (btn) { btn.textContent = 'Signing in...'; btn.disabled = true; }

    const { success, error } = await FirebaseService.signInWithGoogle();
    if (success) {
      closeModal();
      Toast.show('👋 Welcome to Mapzo!');
    } else {
      _showError(error);
      if (btn) { btn.textContent = 'Continue with Google'; btn.disabled = false; }
    }
  }

  async function handleEmailSignIn() {
    const email = document.getElementById('auth-email')?.value?.trim();
    const pass  = document.getElementById('auth-pass')?.value;
    if (!email || !pass) return _showError('Please fill all fields');

    const btn = document.querySelector('.auth-submit-btn');
    btn.textContent = 'Signing in...'; btn.disabled = true;

    const { success, error } = await FirebaseService.signInWithEmail(email, pass);
    if (success) {
      closeModal();
      Toast.show('👋 Welcome back!');
    } else {
      _showError(error);
      btn.textContent = 'Sign In'; btn.disabled = false;
    }
  }

  async function handleEmailSignUp() {
    const name  = document.getElementById('auth-name')?.value?.trim();
    const email = document.getElementById('auth-email')?.value?.trim();
    const pass  = document.getElementById('auth-pass')?.value;
    if (!name || !email || !pass) return _showError('Please fill all fields');
    if (pass.length < 6) return _showError('Password must be at least 6 characters');

    const btn = document.querySelector('.auth-submit-btn');
    btn.textContent = 'Creating account...'; btn.disabled = true;

    const { success, error } = await FirebaseService.signUpWithEmail(email, pass, name);
    if (success) {
      closeModal();
      Toast.show('🎉 Account created! Welcome to Mapzo!');
    } else {
      _showError(error);
      btn.textContent = 'Create Account'; btn.disabled = false;
    }
  }

  async function handleSignOut() {
    await FirebaseService.signOut();
    Toast.show('Signed out. See you soon!');
    Router.navigate('map');
  }

  // ── AUTH STATE UI UPDATE ──────────────────────────────────
  function setLoggedIn(user, profile) {
    // Update any login/logout buttons
    document.querySelectorAll('.auth-login-btn').forEach(b => b.style.display = 'none');
    document.querySelectorAll('.auth-logout-btn').forEach(b => b.style.display = 'flex');
    document.querySelectorAll('.auth-user-name').forEach(el => {
      el.textContent = profile?.display_name || user.displayName || 'You';
    });
    document.querySelectorAll('.auth-user-av').forEach(el => {
      el.innerHTML = avatarHtml(profile || { display_name: user.displayName, avatar_url: user.photoURL }, 32);
    });
  }

  function setLoggedOut() {
    document.querySelectorAll('.auth-login-btn').forEach(b => b.style.display = 'flex');
    document.querySelectorAll('.auth-logout-btn').forEach(b => b.style.display = 'none');
  }

  function _showError(msg) {
    const el = document.getElementById('auth-error');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  return {
    openModal, closeModal,
    handleGoogleSignIn, handleEmailSignIn, handleEmailSignUp,
    handleSignOut, setLoggedIn, setLoggedOut,
  };
})();
