/* ============================================================
   Photography Portfolio — main.js
   Horizontal paged navigation on desktop and tablet; a vertical
   roll on phones. No dependencies.

   Every phone-side behaviour is gated behind isRoll(). The else
   branch of each gate is the original desktop code, unchanged —
   so reverting the phone direction is deleting the roll CSS block
   and unwiring this one predicate.
   ============================================================ */

(function () {
  'use strict';

  const track    = document.getElementById('track');
  const dotsWrap = document.getElementById('section-dots');
  const chrome   = document.getElementById('chrome');
  const bar      = document.getElementById('progress-bar');
  const rollNav  = document.querySelector('.roll-nav');
  const pages    = Array.from(track.querySelectorAll('.page'));

  // Must match the breakpoint on the roll block in styles.css. 700px,
  // not 899px: a tablet keeps the horizontal track, and the smallest
  // tablet starts around 744px while phones top out near 480px.
  const rollMQ = window.matchMedia('(max-width: 700px)');
  function isRoll() { return rollMQ.matches; }

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
    if (isRoll()) {
      pages[current].scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    track.scrollTo({ left: current * track.clientWidth, behavior: 'smooth' });
  }

  // ── Reflect scroll position in dots, label and progress bar ──
  function syncChrome() {
    if (isRoll()) { syncRoll(); return; }

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

  // track.scrollLeft and track.clientWidth are both meaningless once the
  // track is display:block with height auto, so the roll reads the
  // document scroller instead and lights the nav rail by position.
  function syncRoll() {
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    if (bar) bar.style.transform = 'scaleX(' + (window.scrollY / max) + ')';

    if (!rollNav) return;

    // The last section whose top has passed 40% of the viewport is the
    // one actually being read.
    let activeId = pages[0].id;
    pages.forEach(function (p) {
      if (p.getBoundingClientRect().top <= window.innerHeight * 0.4) activeId = p.id;
    });
    Array.from(rollNav.querySelectorAll('a')).forEach(function (a) {
      a.toggleAttribute('data-current', a.getAttribute('href') === '#' + activeId);
    });
  }

  track.addEventListener('scroll', function () {
    if (isRoll()) return;
    window.requestAnimationFrame(syncChrome);
  }, { passive: true });

  let lastY = 0;
  window.addEventListener('scroll', function () {
    if (!isRoll()) return;
    window.requestAnimationFrame(syncChrome);

    // Keep the rail off a photograph while it is being looked at:
    // hide going down the roll, bring it back on any upward intent.
    if (rollNav) {
      const y = window.scrollY;
      if (y > lastY + 8 && y > 200)  rollNav.classList.add('is-hidden');
      else if (y < lastY - 8)        rollNav.classList.remove('is-hidden');
      lastY = y;
    }
  }, { passive: true });

  // ── Wheel → horizontal paging ────────────────────────────────
  // A vertical wheel gesture is the natural input here, so translate it
  // into one discrete page step and lock until the smooth scroll settles.
  let locked = false;

  track.addEventListener('wheel', function (e) {
    // In the roll the document scrolls natively. Left live, this handler's
    // preventDefault would freeze the page on any touch-laptop or on a
    // phone in desktop mode.
    if (isRoll()) return;

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
    if (isRoll()) return;                       // the document pages itself
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
  // browser skips them on first paint. The observer fires as soon as any
  // pixel of a panel enters the scroll window and swaps them in.
  //
  // root has to follow the mode. Left as `track` in the roll it breaks
  // silently rather than loudly: the track no longer clips, so its root
  // rect becomes the whole document, every panel reads as intersecting on
  // load, and every deferred image fetches at once.
  let preloader = null;
  let revealer  = null;

  function buildObservers() {
    if (preloader) preloader.disconnect();
    if (revealer)  revealer.disconnect();

    const root = isRoll() ? null : track;

    preloader = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.querySelectorAll('img[data-src]').forEach(function (img) {
          // The five stacked plates are display:none in the roll. An img
          // with src set downloads whether or not it is displayed, so
          // skipping them here is what keeps ~5 MB per series off a phone.
          if (isRoll() && img.classList.contains('plate')) return;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        });
        preloader.unobserve(entry.target);
      });
    }, { root: root, threshold: 0 });

    revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { root: root, threshold: 0.25 });

    pages.forEach(function (p) {
      preloader.observe(p);
      revealer.observe(p);
    });
  }

  // ── Roll frames: thumb → medium ──────────────────────────────
  // The thumbs are 260px and would be mush displayed full width; the
  // originals are ~700 KB each and fifteen stacked is 10 MB. The medium
  // tier is ~115 KB. No loading="lazy" anywhere in this file — it never
  // fires for a horizontally scrolled panel — so this is an explicit
  // observer with two screens of lead. The thumb stays painted until the
  // medium decodes, so a fast scroller never lands on a black box.
  let frameLoader = null;

  function buildFrameLoader() {
    if (frameLoader) { frameLoader.disconnect(); frameLoader = null; }
    if (!isRoll()) return;

    frameLoader = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        frameLoader.unobserve(img);

        const thumbSrc = img.getAttribute('src') || '';
        if (thumbSrc.indexOf('/thumbs/') === -1) return;   // already swapped

        img.onerror = function () {
          img.onerror = null;
          img.src = thumbSrc;                              // medium missing
        };
        img.src = thumbSrc.replace('/thumbs/', '/medium/');
      });
    }, { root: null, rootMargin: '150% 0px' });

    document.querySelectorAll('.sheet-frame img').forEach(function (img) {
      frameLoader.observe(img);
    });
  }

  // Reserve each frame's real box from the already-loaded thumb, so a
  // 2:3 vertical does not have to wait for its medium to stop being a
  // 3:2 hole. Desktop wants uniform 3:2 frames, so the inline value is
  // cleared when the roll is not in play.
  function stampRatios() {
    document.querySelectorAll('.sheet-frame').forEach(function (frame) {
      if (!isRoll()) { frame.style.aspectRatio = ''; return; }
      const img = frame.querySelector('img');
      if (!img) return;
      const apply = function () {
        if (!img.naturalWidth) return;
        frame.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
      };
      if (img.complete) apply();
      else img.addEventListener('load', apply, { once: true });
    });
  }

  // ── Keep the current panel aligned across resizes ────────────
  let resizeTimer;
  window.addEventListener('resize', function () {
    if (isRoll()) return;      // re-scrolling a block-level track is a no-op
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

  // images/<series>/<file>.jpg → images/<series>/medium/<file>.jpg
  function mediumOf(src) {
    return src.replace(/\/([^/]+\.jpg)$/i, '/medium/$1');
  }

  let lbGroup = [];
  let lbIndex = 0;
  let lbLastFocus = null;

  function lbIsOpen() { return lightbox.classList.contains('is-open'); }

  function lbShow(i) {
    if (!lbGroup.length) return;
    lbIndex = (i + lbGroup.length) % lbGroup.length;   // wraps both ways
    const d = lbGroup[lbIndex].dataset;

    // A phone was pulling the 2200px original — roughly 1 MB a frame.
    // Fall back to it if a medium file is ever missing.
    if (isRoll()) {
      lbImg.onerror = function () { lbImg.onerror = null; lbImg.src = d.src; };
      lbImg.src = mediumOf(d.src);
    } else {
      lbImg.onerror = null;
      lbImg.src = d.src;
    }

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

  // ── Tap versus flick ─────────────────────────────────────────
  // In the roll every frame is a tap target the height of the screen, so
  // without this a scroll gesture that starts on a photograph is read as
  // a tap and throws the lightbox open mid-flick. pointerup lands before
  // click, so the flag is always current by the time a handler reads it.
  let downX = 0, downY = 0, dragged = false;
  document.addEventListener('pointerdown', function (e) {
    downX = e.clientX; downY = e.clientY; dragged = false;
  }, true);
  document.addEventListener('pointerup', function (e) {
    dragged = Math.abs(e.clientX - downX) > 8 || Math.abs(e.clientY - downY) > 8;
  }, true);
  function wasFlick() { return isRoll() && dragged; }

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
    const openers = Array.from(sheets.querySelectorAll('.sheet--open .sheet-frame'));

    // Running number across both rows, 01–15, drawn in the gutter beneath
    // each frame by CSS. The two source rows have to read as one roll.
    tabs.concat(openers).forEach(function (btn, n) {
      btn.dataset.n = pad(n + 1);
    });

    function showPlate(i) {
      plates.forEach(function (p, n) { p.toggleAttribute('data-active', n === i); });
      tabs.forEach(function (f, n) {
        f.toggleAttribute('data-active', n === i);
        f.setAttribute('aria-selected', String(n === i));
      });
      titleEl.textContent = tabs[i].dataset.title;
      metaEl.textContent  = tabs[i].dataset.meta;
    }

    // In the roll the lightbox sequence is all fifteen frames of the
    // series, not just the ten in the archive row. Row 1's buttons carry
    // no full-size source — that lives on the paired plate — so the group
    // is assembled as plain objects. lbShow only ever reads .dataset, so
    // these stand in for elements with no DOM mutation at all.
    function rollGroup() {
      const highlights = tabs.map(function (btn, i) {
        const plate = plates[i];
        return {
          dataset: {
            src:   plate ? (plate.dataset.src || plate.getAttribute('src')) : '',
            title: btn.dataset.title,
            meta:  btn.dataset.meta,
            alt:   plate ? plate.alt : ''
          }
        };
      });
      return highlights.concat(openers);
    }

    tabs.forEach(function (frame, i) {
      // Hover previews on a pointer; click and focus cover touch and keyboard.
      frame.addEventListener('mouseenter', function () { if (!isRoll()) showPlate(i); });
      frame.addEventListener('focus',      function () { if (!isRoll()) showPlate(i); });
      frame.addEventListener('click',      function () {
        if (!isRoll()) { showPlate(i); return; }
        if (wasFlick()) return;
        lbOpen(rollGroup(), i);
      });
    });

    openers.forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        if (wasFlick()) return;
        if (isRoll()) { lbOpen(rollGroup(), tabs.length + i); return; }
        lbOpen(openers, i);
      });
    });

    // The divider doubles as the way into the archive at tablet width,
    // where the row it labels is hidden. It is display:none in the roll,
    // which has all fifteen frames in the flow instead.
    const divider = sheets.querySelector('.sheet-div');
    if (divider && openers.length) {
      divider.setAttribute('role', 'button');
      divider.setAttribute('tabindex', '0');
      divider.setAttribute('aria-label', 'View the archive full size');
      divider.addEventListener('click', function () { lbOpen(openers, 0); });
      divider.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        lbOpen(openers, 0);
      });
    }
  });

  lightbox.querySelector('.lb-close').addEventListener('click', lbClose);
  lightbox.querySelector('.lb-prev').addEventListener('click', function () { lbShow(lbIndex - 1); });
  lightbox.querySelector('.lb-next').addEventListener('click', function () { lbShow(lbIndex + 1); });

  // Click the backdrop (but not the picture) to dismiss.
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) lbClose();
  });

  // Capture phase, so this runs before the panel-paging handler above.
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

  // Nothing behind an open lightbox may move — the track on desktop, the
  // document in the roll.
  lightbox.addEventListener('wheel', function (e) { e.preventDefault(); }, { passive: false });

  // ── Lightbox swipe ───────────────────────────────────────────
  // The one place the horizontal gesture survives on a phone.
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
    // Mouse only. On a touchscreen this fires on long-press, so it was
    // popping a desktop menu offering "Refresh" over a photograph and
    // stealing the OS image menu.
    if (!window.matchMedia('(pointer: fine)').matches) return;
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

  // ── Restore position after refresh ───────────────────────────
  // beforeunload fires for the browser's own refresh and for the custom
  // menu's Refresh item alike. The roll stores a scroll offset; the
  // horizontal track stores a panel index.
  (function restore() {
    const savedScroll = sessionStorage.getItem('sc-scroll');
    const savedPanel  = sessionStorage.getItem('sc-panel');
    sessionStorage.removeItem('sc-scroll');
    sessionStorage.removeItem('sc-panel');

    if (isRoll()) {
      if (savedScroll !== null) window.scrollTo(0, parseInt(savedScroll, 10) || 0);
      return;
    }
    if (savedPanel === null) return;
    const i = parseInt(savedPanel, 10);
    if (i > 0 && i < pages.length) {
      current = i;
      track.scrollTo({ left: i * track.clientWidth, behavior: 'auto' });
    }
  })();

  window.addEventListener('beforeunload', function () {
    if (isRoll()) {
      if (window.scrollY > 0) sessionStorage.setItem('sc-scroll', window.scrollY);
      return;
    }
    if (current > 0) sessionStorage.setItem('sc-panel', current);
  });

  // ── Mode ─────────────────────────────────────────────────────
  // Rebuilt rather than reloaded, so rotating a phone across the
  // breakpoint does not throw the visitor back to the top.
  function applyMode() {
    buildObservers();
    buildFrameLoader();
    stampRatios();
    syncChrome();
  }

  rollMQ.addEventListener('change', applyMode);

  // ── Initial state ────────────────────────────────────────────
  dots[0].toggleAttribute('data-active', true);
  applyMode();

})();
