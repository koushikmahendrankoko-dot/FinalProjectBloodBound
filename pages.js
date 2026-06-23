/* ═══════════════════════════════════════════════════════════════
   BLOODBOUND — pages.js
   Shared across ALL pages: navbar scroll, mobile drawer,
   animated background canvas, auth status injection
═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initMobileDrawer();
  initBackgroundCanvas();
  injectAuthNavLink();
});

/* ── NAVBAR SCROLL EFFECT ── */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}

/* ── MOBILE HAMBURGER DRAWER ── */
function initMobileDrawer() {
  const hamburger = document.getElementById('hamburger');
  const drawer = document.getElementById('mobile-drawer');
  if (!hamburger || !drawer) return;

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    drawer.classList.toggle('open');
  });

  // Close drawer when a link is clicked
  drawer.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      drawer.classList.remove('open');
    });
  });
}

/* ── ANIMATED BACKGROUND CANVAS ──
   Subtle floating embers / blood particles drifting upward.
   Used on all non-game pages. */
function initBackgroundCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let particles = [];
  let width, height;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const PARTICLE_COUNT = Math.min(60, Math.floor((window.innerWidth * window.innerHeight) / 18000));

  function createParticle() {
    return {
      x: Math.random() * width,
      y: height + Math.random() * 100,
      size: Math.random() * 2.5 + 0.5,
      speedY: Math.random() * 0.6 + 0.15,
      speedX: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.5 + 0.1,
      flicker: Math.random() * Math.PI * 2,
      flickerSpeed: Math.random() * 0.03 + 0.01,
      hue: Math.random() > 0.7 ? 'glow' : 'red'
    };
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = createParticle();
    p.y = Math.random() * height; // spread initial positions
    particles.push(p);
  }

  let lastTime = performance.now();

  function animate(now) {
    const dt = Math.min((now - lastTime) / 16.67, 3); // normalize to ~60fps
    lastTime = now;

    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      p.y -= p.speedY * dt;
      p.x += p.speedX * dt;
      p.flicker += p.flickerSpeed * dt;

      if (p.y < -10) {
        Object.assign(p, createParticle());
        p.y = height + 10;
      }

      const flickerOpacity = p.opacity * (0.6 + 0.4 * Math.sin(p.flicker));
      const color = p.hue === 'glow'
        ? `rgba(255, 96, 112, ${flickerOpacity})`
        : `rgba(180, 32, 48, ${flickerOpacity})`;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = p.size * 3;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

/* ── AUTH STATUS IN NAVBAR ──
   Adds a "Sign In" or "Account" link/dropdown to the nav,
   and shows the username if logged in. */
function injectAuthNavLink() {
  if (!window.BB) return; // storage.js not loaded on this page

  const navLinks = document.querySelector('.nav-links');
  const mobileDrawerList = document.querySelector('.mobile-drawer ul');
  if (!navLinks) return;

  const isLoggedIn = window.BB.isLoggedIn();
  const username = window.BB.getCurrentUser();

  // Determine relative path prefix (pages/ subfolder vs root)
  const inPagesDir = window.location.pathname.includes('/pages/');
  const prefix = inPagesDir ? '../' : '';

  const li = document.createElement('li');
  li.className = 'nav-auth-item';

  if (isLoggedIn) {
    li.innerHTML = `
      <div class="nav-account-dropdown" id="nav-account-dropdown">
        <button class="nav-account-btn" id="nav-account-btn">
          <span class="nav-account-avatar">${username.charAt(0).toUpperCase()}</span>
          <span class="nav-account-name">${escapeHtmlPages(username)}</span>
          <span class="nav-account-caret">▾</span>
        </button>
        <div class="nav-account-menu hidden" id="nav-account-menu">
          <a href="${prefix}game.html" class="nav-account-menu-item">▶ Continue Playing</a>
          <a href="${prefix}feedback.html" class="nav-account-menu-item">💬 Feedback</a>
          <button class="nav-account-menu-item danger" onclick="navLogout()">⎋ Sign Out</button>
        </div>
      </div>
    `;
  } else {
    li.innerHTML = `<a href="${prefix}auth.html" class="nav-signin-link">Sign In</a>`;
  }

  navLinks.appendChild(li);

  // Mobile drawer version
  if (mobileDrawerList) {
    const mobileLi = document.createElement('li');
    if (isLoggedIn) {
      mobileLi.innerHTML = `
        <a href="${prefix}feedback.html">👤 ${escapeHtmlPages(username)}</a>
      `;
      const logoutLi = document.createElement('li');
      logoutLi.innerHTML = `<a href="#" onclick="navLogout(); return false;" style="color:var(--blood-bright)">⎋ Sign Out</a>`;
      mobileDrawerList.appendChild(mobileLi);
      mobileDrawerList.appendChild(logoutLi);
    } else {
      mobileLi.innerHTML = `<a href="${prefix}auth.html">Sign In</a>`;
      mobileDrawerList.appendChild(mobileLi);
    }
  }

  // Dropdown toggle
  const accountBtn = document.getElementById('nav-account-btn');
  if (accountBtn) {
    accountBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('nav-account-menu').classList.toggle('hidden');
    });
    document.addEventListener('click', () => {
      const menu = document.getElementById('nav-account-menu');
      if (menu) menu.classList.add('hidden');
    });
  }

  injectNavAuthStyles();
}

function navLogout() {
  window.BB.logout();
  window.location.reload();
}

function escapeHtmlPages(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* Inject minimal styles for the account dropdown (keeps nav CSS files untouched) */
function injectNavAuthStyles() {
  if (document.getElementById('nav-auth-styles')) return;
  const style = document.createElement('style');
  style.id = 'nav-auth-styles';
  style.textContent = `
    .nav-auth-item { display: flex; align-items: center; margin-left: 4px; }
    .nav-signin-link {
      font-family: var(--font-heading);
      font-size: clamp(.65rem, .85vw, .85rem);
      font-weight: 600;
      letter-spacing: .08em;
      color: var(--blood-bright);
      border: 1px solid var(--blood-muted);
      border-radius: var(--radius-sm);
      padding: 6px 14px;
      transition: all var(--t-fast);
      white-space: nowrap;
    }
    .nav-signin-link:hover {
      background: rgba(181,32,48,.15);
      border-color: var(--blood-core);
      color: var(--blood-vivid);
    }
    .nav-account-dropdown { position: relative; }
    .nav-account-btn {
      display: flex; align-items: center; gap: 8px;
      background: var(--blood-raised);
      border: 1px solid var(--blood-border);
      border-radius: 100px;
      padding: 5px 12px 5px 5px;
      cursor: pointer;
      transition: border-color var(--t-fast);
    }
    .nav-account-btn:hover { border-color: var(--blood-core); }
    .nav-account-avatar {
      width: 24px; height: 24px;
      background: var(--blood-core);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-heading);
      font-size: .7rem; font-weight: 700;
      color: white;
      flex-shrink: 0;
    }
    .nav-account-name {
      font-family: var(--font-heading);
      font-size: clamp(.65rem, .82vw, .8rem);
      color: var(--text-secondary);
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nav-account-caret { font-size: .6rem; color: var(--text-muted); }
    .nav-account-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      background: var(--blood-surface);
      border: 1px solid var(--blood-border);
      border-radius: var(--radius-md);
      min-width: 180px;
      box-shadow: var(--shadow-card);
      overflow: hidden;
      z-index: 1001;
      display: flex;
      flex-direction: column;
    }
    .nav-account-menu-item {
      display: block;
      padding: 10px 16px;
      font-family: var(--font-heading);
      font-size: .8rem;
      letter-spacing: .04em;
      color: var(--text-secondary);
      text-align: left;
      width: 100%;
      transition: background var(--t-fast), color var(--t-fast);
      background: none; border: none; cursor: pointer;
    }
    .nav-account-menu-item:hover { background: var(--blood-raised); color: var(--text-primary); }
    .nav-account-menu-item.danger { color: var(--blood-bright); }
    .nav-account-menu-item.danger:hover { background: rgba(181,32,48,.15); }
    @media (max-width: 900px) { .nav-auth-item { display: none; } }
  `;
  document.head.appendChild(style);
}

/* ── TOAST NOTIFICATION HELPER (shared) ── */
function showPageToast(message, duration = 3000) {
  let container = document.getElementById('global-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'global-toast-container';
    container.style.position = 'fixed';
    container.style.bottom = '24px';
    container.style.right = '24px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}