/* ============================================================
   Photography Portfolio — main.js
   Horizontal paged navigation. No dependencies.
   ============================================================ */

(function () {
  'use strict';

  const track    = document.getElementById('track');
  const dotsWrap = document.getElementById('section-dots');
  const chrome   = document.getElementById('chrome');
  const bar      = document.getElementById('progress-bar');
  const pages    = Array.from(track.querySelectorAll('.page'));

  let current = 0;

  // ── Dot navigation ───────────────────────────────────────────
  pages.forEach(function (page, i) {
    const name = page.dataset.label || page.id;
    const dot = document.createElement('button');
    dot.className = 'dot';
    dot.type = 'button';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', name);
    dot.dataset.label = name;   // shown on hover via CSS
    dot.addEventListener('click', function () { goTo(i); });
    dotsWrap.appendChild(dot);
  });

  const dots = Array.from(dotsWrap.children);

  function goTo(i) {
    current = Math.max(0, Math.min(pages.length - 1, i));
    track.scrollTo({ left: current * track.clientWidth, behavior: 'smooth' });
  }

  // ── Reflect scroll position in dots, label and progress bar ──
  function syncChrome() {
    const w = track.clientWidth;
    const i = Math.round(track.scrollLeft / w);
    const max = Math.max(1, track.scrollWidth - w);

    if (bar) bar.style.transform = 'scaleX(' + (track.scrollLeft / max) + ')';

    if (i !== current) {
      current = i;
      dots.forEach(function (d, n) { d.toggleAttribute('data-active', n === i); });
      chrome.classList.toggle('at-end', i === pages.length - 1);
    }
  }

  track.addEventListener('scroll', function () {
    window.requestAnimationFrame(syncChrome);
  }, { passive: true });

  // ── Wheel → horizontal paging ────────────────────────────────
  // A vertical wheel gesture is the natural input here, so translate it
  // into one discrete page step and lock until the smooth scroll settles.
  let locked = false;

  track.addEventListener('wheel', function (e) {
    // Trackpads send horizontal deltas already — let those scroll natively.
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

    e.preventDefault();
    if (locked) return;

    const dir = e.deltaY > 0 ? 1 : -1;
    const next = current + dir;
    if (next < 0 || next > pages.length - 1) return;

    locked = true;
    goTo(next);
    setTimeout(function () { locked = false; }, 620);
  }, { passive: false });

  // ── Keyboard ─────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.target.matches('input, textarea')) return;

    const map = {
      ArrowRight: current + 1, ArrowDown: current + 1, PageDown: current + 1,
      ArrowLeft:  current - 1, ArrowUp:   current - 1, PageUp:   current - 1,
      Home: 0, End: pages.length - 1,
    };

    if (!(e.key in map)) return;
    e.preventDefault();
    goTo(map[e.key]);
  });

  // ── Logo returns to the first panel ──────────────────────────
  document.getElementById('logo-link').addEventListener('click', function (e) {
    e.preventDefault();
    goTo(0);
  });

  // ── Deferred image loading ───────────────────────────────────
  // Plates in off-screen panels carry data-src instead of src so the
  // browser skips them on first paint. This observer fires as soon as any
  // pixel of a panel enters the scroll window — well before the snap
  // settles — and swaps them in. threshold: 0 fires earlier than the
  // is-visible observer below, so images are already loading before the
  // panel animates in.
  const preloader = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.querySelectorAll('img[data-src]').forEach(function (img) {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
      preloader.unobserve(entry.target);
    });
  }, { root: track, threshold: 0 });

  pages.forEach(function (p) { preloader.observe(p); });

  // ── Reveal panels as they come into view ─────────────────────
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) entry.target.classList.add('is-visible');
    });
  }, { root: track, threshold: 0.25 });

  pages.forEach(function (p) { observer.observe(p); });

  // ── Keep the current panel aligned across resizes ────────────
  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      track.scrollTo({ left: current * track.clientWidth, behavior: 'auto' });
    }, 120);
  });

  // ── Lightbox ─────────────────────────────────────────────────
  // One dialog, reused by every panel. The sequence it navigates is
  // handed in when it opens, so a series only ever pages through its
  // own archive row — never into the next series' photographs.
  const lightbox = document.getElementById('lightbox');
  const lbImg    = document.getElementById('lb-img');
  const lbTitle  = document.getElementById('lb-title');
  const lbMeta   = document.getElementById('lb-meta');
  const lbCount  = document.getElementById('lb-count');

  // Zero-padded, to match the 01–05 numerals on the contact sheet.
  function pad(n) { return String(n).padStart(2, '0'); }

  let lbGroup = [];
  let lbIndex = 0;
  let lbLastFocus = null;

  function lbIsOpen() { return lightbox.classList.contains('is-open'); }

  function lbShow(i) {
    if (!lbGroup.length) return;
    lbIndex = (i + lbGroup.length) % lbGroup.length;   // wraps both ways
    const d = lbGroup[lbIndex].dataset;
    lbImg.src = d.src;
    lbImg.alt = d.alt || '';
    lbTitle.textContent = d.title;
    lbMeta.textContent  = d.meta;
    lbCount.textContent = pad(lbIndex + 1) + ' / ' + pad(lbGroup.length);
  }

  function lbOpen(group, i) {
    lbGroup = group;
    lbLastFocus = document.activeElement;
    lbShow(i);
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    lightbox.querySelector('.lb-close').focus();
  }

  function lbClose() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    if (lbLastFocus) lbLastFocus.focus();
  }

  // ── Contact sheets ───────────────────────────────────────────
  // Every photo panel wires itself. All lookups are scoped to the panel
  // that owns the sheet: a document-wide query would attach only to the
  // first panel and pool every panel's frames into one lightbox run.
  document.querySelectorAll('.sheets').forEach(function (sheets) {
    const panel   = sheets.closest('.page');
    const plates  = Array.from(panel.querySelectorAll('.plate'));
    const titleEl = panel.querySelector('[data-exif-title]');
    const metaEl  = panel.querySelector('[data-exif-meta]');
    const tabs    = Array.from(sheets.querySelectorAll('[role="tablist"] .sheet-frame'));

    function showPlate(i) {
      plates.forEach(function (p, n) { p.toggleAttribute('data-active', n === i); });
      tabs.forEach(function (f, n) {
        f.toggleAttribute('data-active', n === i);
        f.setAttribute('aria-selected', String(n === i));
      });
      titleEl.textContent = tabs[i].dataset.title;
      metaEl.textContent  = tabs[i].dataset.meta;
    }

    tabs.forEach(function (frame, i) {
      // Hover previews on a pointer; click and focus cover touch and keyboard.
      frame.addEventListener('mouseenter', function () { showPlate(i); });
      frame.addEventListener('focus',      function () { showPlate(i); });
      frame.addEventListener('click',      function () { showPlate(i); });
    });

    // This panel's archive row is its own lightbox sequence.
    const openers = Array.from(sheets.querySelectorAll('.sheet--open .sheet-frame'));
    openers.forEach(function (btn, i) {
      btn.addEventListener('click', function () { lbOpen(openers, i); });
    });
  });

  lightbox.querySelector('.lb-close').addEventListener('click', lbClose);
  lightbox.querySelector('.lb-prev').addEventListener('click', function () { lbShow(lbIndex - 1); });
  lightbox.querySelector('.lb-next').addEventListener('click', function () { lbShow(lbIndex + 1); });

  // Click the backdrop (but not the picture) to dismiss.
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) lbClose();
  });

  // Capture phase, so this runs before the panel-paging handler below.
  document.addEventListener('keydown', function (e) {
    if (!lbIsOpen()) return;

    if      (e.key === 'Escape')      lbClose();
    else if (e.key === 'ArrowLeft')   lbShow(lbIndex - 1);
    else if (e.key === 'ArrowRight')  lbShow(lbIndex + 1);
    // Swallow all other paging keys so the track cannot move behind the
    // open dialog — ArrowDown/Up, PageDown/Up, Home, End all page the
    // track without this guard. Tab falls through for accessibility.
    else if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].indexOf(e.key) === -1) return;

    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);

  // The wheel must not page the track behind an open lightbox.
  lightbox.addEventListener('wheel', function (e) { e.preventDefault(); }, { passive: false });

  // ── Lightbox swipe (mobile) ──────────────────────────────
  var lbTouchX = null;
  lightbox.addEventListener('touchstart', function (e) {
    lbTouchX = e.touches[0].clientX;
  }, { passive: true });
  lightbox.addEventListener('touchend', function (e) {
    if (lbTouchX === null) return;
    var dx = e.changedTouches[0].clientX - lbTouchX;
    lbTouchX = null;
    if (Math.abs(dx) < 40) return;
    lbShow(dx < 0 ? lbIndex + 1 : lbIndex - 1);
  }, { passive: true });

  // ── Custom right-click menu ──────────────────────────────────
  const menu = document.getElementById('ctx-menu');
  const EMAIL = 's.cvjeticanin94@gmail.com';

  function openMenu(x, y) {
    // Show first so the box has dimensions to measure, then clamp inside
    // the viewport so it never opens off the edge near a corner.
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');

    const r = menu.getBoundingClientRect();
    const pad = 8;
    const left = Math.min(x, window.innerWidth  - r.width  - pad);
    const top  = Math.min(y, window.innerHeight - r.height - pad);

    menu.style.left = Math.max(pad, left) + 'px';
    menu.style.top  = Math.max(pad, top) + 'px';
  }

  function closeMenu() {
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
  }

  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    openMenu(e.clientX, e.clientY);
  });

  menu.addEventListener('click', function (e) {
    const item = e.target.closest('.ctx-item');
    if (!item) return;

    switch (item.dataset.action) {
      case 'refresh':
        window.location.reload();
        break;
      case 'start':
        goTo(0);
        break;
      case 'copy-email':
        navigator.clipboard.writeText(EMAIL).then(function () {
          const label = item.firstChild;
          const original = label.textContent;
          label.textContent = 'Copied ';
          setTimeout(function () { label.textContent = original; }, 1200);
        });
        break;
    }
    if (item.dataset.action !== 'copy-email') closeMenu();
  });

  // Dismiss on outside click, Escape, scroll or resize.
  document.addEventListener('mousedown', function (e) {
    if (!menu.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });
  track.addEventListener('scroll', closeMenu, { passive: true });
  window.addEventListener('blur', closeMenu);

  // ── Initial state ────────────────────────────────────────────
  dots[0].toggleAttribute('data-active', true);
  syncChrome();

})();
