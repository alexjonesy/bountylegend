/* Bounty Legends — motion layer. Does nothing if the visitor prefers reduced motion. */
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const root = document.documentElement;
  root.classList.add('fx');

  /* drifting background glow */
  const bg = document.createElement('div');
  bg.className = 'fx-bg';
  bg.setAttribute('aria-hidden', 'true');
  document.body.prepend(bg);

  /* scroll reveal, staggered among siblings */
  const SELECTOR = '.launch-highlight,.step,.section-head,.lower-cta,.card,.tile,.road,.section-heading,.notice,nav.toc,.ticker,.community';
  const items = Array.from(document.querySelectorAll(SELECTOR)).filter(el => !el.parentElement.closest('.rv'));
  const seen = new Map();
  items.forEach(el => {
    const n = seen.get(el.parentElement) || 0;
    seen.set(el.parentElement, n + 1);
    el.classList.add('rv');
    el.style.setProperty('--d', Math.min(n * 0.09, 0.45) + 's');
  });

  const reveal = (el) => {
    el.classList.add('in');
    setTimeout(() => el.classList.add('settled'), 1100); // lets hover effects respond instantly afterwards
    const stat = el.querySelector && el.querySelector('.launch-highlight.featured strong');
    if (stat) countUp(stat);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(el => io.observe(el));
  } else {
    items.forEach(reveal);
  }

  /* count-up for "£500"-style figures */
  function countUp(el) {
    if (el.dataset.counted) return;
    const m = /^(\D*)(\d+)(\D*)$/.exec(el.dataset.final || el.textContent.trim());
    if (!m) return;
    el.dataset.counted = '1';
    const [, pre, num, post] = m, end = +num, start = performance.now(), dur = 1300;
    (function frame(t) {
      const p = Math.min(1, (t - start) / dur), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + Math.round(end * eased) + post;
      if (p < 1) requestAnimationFrame(frame);
    })(start);
  }
  const featured = document.querySelector('.launch-highlight.featured strong');
  if (featured) { const m = /^(\D*)\d+(\D*)$/.exec(featured.textContent.trim()); if (m) { featured.dataset.final = featured.textContent.trim(); featured.textContent = m[1] + '0' + m[2]; } }

  /* cursor spotlight on cards */
  if (window.matchMedia('(hover:hover)').matches) {
    document.querySelectorAll('.step,.launch-highlight,.card,.tile,.road').forEach(el => {
      el.classList.add('fx-spot');
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* digits "tick" when the countdown changes */
  ['days', 'hours', 'minutes', 'seconds'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    let prev = el.textContent;
    new MutationObserver(() => {
      if (el.textContent === prev) return; // the page rewrites every digit each second; only animate real changes
      prev = el.textContent;
      el.classList.remove('tick');
      void el.offsetWidth;
      el.classList.add('tick');
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });

  /* hero: light glare + rising embers */
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const glare = document.createElement('div');
  glare.className = 'hero-glare';
  glare.setAttribute('aria-hidden', 'true');
  hero.appendChild(glare);

  const canvas = document.createElement('canvas');
  canvas.className = 'fx-embers';
  canvas.setAttribute('aria-hidden', 'true');
  hero.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const sprite = (rgb) => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d'), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(' + rgb + ',.9)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    return c;
  };
  const sprites = [sprite('255,60,160'), sprite('255,60,160'), sprite('255,199,106')];

  let w = 0, h = 0, dpr = 1, parts = [], running = false, last = 0, visible = true;
  const rand = (a, b) => a + Math.random() * (b - a);

  function spawn(p, initial) {
    p.x = rand(0, w);
    p.y = initial ? rand(0, h) : h + rand(4, 30);
    p.size = rand(6, 20);
    p.vy = rand(14, 38);
    p.amp = rand(6, 22);
    p.phase = rand(0, Math.PI * 2);
    p.speed = rand(0.4, 1.1);
    p.alpha = rand(0.35, 0.9);
    p.img = sprites[(Math.random() * sprites.length) | 0];
    p.t = 0;
    return p;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = hero.clientWidth;
    h = hero.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(14, Math.min(46, Math.round(w / 34)));
    while (parts.length < count) parts.push(spawn({}, true));
    parts.length = count;
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.t += dt;
      p.y -= p.vy * dt;
      if (p.y < -30) spawn(p, false);
      const x = p.x + Math.sin(p.t * p.speed + p.phase) * p.amp;
      const edge = Math.min(1, (p.y / h) * 1.8, ((h - p.y) / h) * 6 + 0.2);
      ctx.globalAlpha = Math.max(0, p.alpha * edge);
      ctx.drawImage(p.img, x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    requestAnimationFrame(frame);
  }

  function setRunning(on) {
    if (on && !running && visible && !document.hidden) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    else if (!on) running = false;
  }

  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => setRunning(!document.hidden));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; setRunning(visible); }).observe(hero);
  }
  setRunning(true);
})();
