/*
 * Bounty Legends — front-end auth layer.
 *
 * BACKEND: set `window.BL_CONFIG = { apiBase: 'https://api.example.com' }` before this
 * script loads and the forms will call the endpoints below (JSON, cookies included):
 *
 *   POST /auth/signup           { gamerTag, platform, email, password, birthdate, country, marketing }
 *                               -> 201 { user: { gamerTag, platform, email } }
 *   POST /auth/login            { email, password }
 *                               -> 200 { user: { gamerTag, platform, email } }
 *   POST /auth/forgot-password  { email }
 *                               -> 204 (always, whether or not the account exists)
 *   POST /auth/logout           -> 204
 *
 * Errors: any non-2xx response with { message } shows that message to the user.
 * Age and region eligibility MUST be re-checked on the server.
 *
 * With no apiBase, a localStorage mock is used. DEMO ONLY: it is not secure and
 * nothing leaves the browser.
 */
(function () {
  'use strict';

  const CONFIG = Object.assign({ apiBase: null }, window.BL_CONFIG || {});
  const SESSION_KEY = 'bl_session';
  const USERS_KEY = 'bl_mock_users';

  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked */ } },
    remove(key) { try { localStorage.removeItem(key); } catch (e) { /* storage blocked */ } }
  };

  /* ---------- session ---------- */
  const getSession = () => store.get(SESSION_KEY);
  const setSession = (user) => store.set(SESSION_KEY, { gamerTag: user.gamerTag, platform: user.platform, email: user.email });

  /* ---------- real backend ---------- */
  async function request(path, body) {
    const res = await fetch(CONFIG.apiBase + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) throw new Error((data && data.message) || 'Something went wrong. Please try again.');
    return data;
  }

  const remoteApi = {
    signup: (payload) => request('/auth/signup', payload),
    login: (payload) => request('/auth/login', payload),
    forgot: (payload) => request('/auth/forgot-password', payload),
    logout: () => request('/auth/logout')
  };

  /* ---------- local mock (demo only) ---------- */
  async function hash(salt, password) {
    const text = salt + ':' + password;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381; // non-crypto fallback for insecure contexts
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return String(h);
  }

  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const mockUsers = () => store.get(USERS_KEY) || {};

  const mockApi = {
    async signup(p) {
      await wait(500);
      const users = mockUsers();
      const email = p.email.trim().toLowerCase();
      if (users[email]) throw new Error('An account with that email already exists. Try logging in.');
      const tag = p.gamerTag.trim().toLowerCase();
      if (Object.values(users).some(u => u.gamerTag.toLowerCase() === tag)) throw new Error('That gamertag is already taken.');
      const salt = Math.random().toString(36).slice(2);
      users[email] = { gamerTag: p.gamerTag.trim(), platform: p.platform, email, salt, hash: await hash(salt, p.password) };
      store.set(USERS_KEY, users);
      return { user: users[email] };
    },
    async login(p) {
      await wait(400);
      const user = mockUsers()[p.email.trim().toLowerCase()];
      if (!user || user.hash !== await hash(user.salt, p.password)) throw new Error('Incorrect email or password.');
      return { user };
    },
    async forgot() { await wait(500); return null; },
    async logout() { return null; }
  };

  const api = CONFIG.apiBase ? remoteApi : mockApi;

  async function logout() {
    try { await api.logout(); } catch (e) { /* clear locally regardless */ }
    store.remove(SESSION_KEY);
  }

  function ageFrom(isoDate) {
    const dob = new Date(isoDate + 'T12:00:00');
    if (isNaN(dob)) return 0;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
    return age;
  }

  window.BL = { config: CONFIG, getSession, logout, isMock: !CONFIG.apiBase };

  /* ---------- dialog wiring (only on pages that include the auth dialog) ---------- */
  const dialog = document.getElementById('auth-dialog');
  if (!dialog) return;

  const VIEWS = {
    signup: { eyebrow: 'Join the community', title: 'YOUR LEGEND<br>STARTS HERE.' },
    login: { eyebrow: 'Welcome back', title: 'LOG IN TO<br>YOUR LEGEND.' },
    forgot: { eyebrow: 'Account recovery', title: 'RESET YOUR<br>PASSWORD.' }
  };
  const eyebrow = document.getElementById('auth-eyebrow');
  const title = document.getElementById('auth-title');
  const tabs = dialog.querySelectorAll('[data-tab]');

  function showView(name) {
    Object.keys(VIEWS).forEach(v => { document.getElementById(v + '-form').hidden = v !== name; });
    eyebrow.textContent = VIEWS[name].eyebrow;
    title.innerHTML = VIEWS[name].title;
    tabs.forEach(t => { const on = t.dataset.tab === name; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
    dialog.querySelector('.auth-tabs').hidden = name === 'forgot';
    dialog.querySelectorAll('.form-status').forEach(s => { s.textContent = ''; s.className = 'form-status'; });
  }

  function open(view) {
    showView(view);
    if (!dialog.open) dialog.showModal();
  }

  document.querySelectorAll('[data-signup]').forEach(b => b.addEventListener('click', () => open('signup')));
  document.querySelectorAll('[data-login]').forEach(b => b.addEventListener('click', () => open('login')));
  dialog.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  tabs.forEach(t => t.addEventListener('click', () => showView(t.dataset.tab)));
  document.getElementById('close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  if (location.hash === '#login') open('login');
  else if (location.hash === '#signup') open('signup');

  function bind(formId, handler) {
    const form = document.getElementById(formId);
    const status = form.querySelector('.form-status');
    const submit = form.querySelector('[type=submit]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const say = (msg, kind) => { status.textContent = msg; status.className = 'form-status ' + (kind || ''); };
      const data = Object.fromEntries(new FormData(form).entries());
      submit.disabled = true;
      say('Working…');
      try { await handler(data, say, form); }
      catch (err) { say(err.message || 'Something went wrong.', 'error'); }
      finally { submit.disabled = false; }
    });
  }

  const goToDashboard = (res) => { setSession(res.user); window.location.href = 'dashboard.html'; };

  bind('signup-form', async (d, say) => {
    if (ageFrom(d.birthdate) < 18) throw new Error('Bounty Legends is for players aged 18+ at launch. Nothing was submitted.');
    d.marketing = d.marketing === 'on';
    goToDashboard(await api.signup(d));
  });

  bind('login-form', async (d) => { goToDashboard(await api.login(d)); });

  bind('forgot-form', async (d, say) => {
    await api.forgot({ email: d.email });
    say('If an account exists for that email, a reset link is on its way.', 'ok');
  });
})();
