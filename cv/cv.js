(function () {
  'use strict';

  var hero   = document.getElementById('hero');
  var heroBg = document.querySelector('.hero-bg');
  var nav    = document.getElementById('cv-nav');

  /* ── Nav reveal + parallax on scroll ──────────────────────── */
  var ticking = false;

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }

  function update() {
    var y = window.scrollY;

    /* Parallax — desktop only, while hero is still in view */
    if (heroBg && window.innerWidth > 768 && hero && y < hero.offsetHeight) {
      heroBg.style.transform = 'translateY(' + (y * 0.32) + 'px)';
    }

    /* Sticky nav: show after scrolling 45% of hero height */
    var threshold = hero ? hero.offsetHeight * 0.45 : 400;
    if (y > threshold) {
      nav.classList.add('is-visible');
      nav.removeAttribute('aria-hidden');
    } else {
      nav.classList.remove('is-visible');
      nav.setAttribute('aria-hidden', 'true');
    }

    ticking = false;
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); /* sync nav + parallax with restored scroll position on load */

  /* ── Flip cards + flip rows ────────────────────────────────── */
  var cards = document.querySelectorAll('.flip-card, .flip-row');

  cards.forEach(function (card) {
    function flip() { card.classList.toggle('is-flipped'); }

    card.addEventListener('click', function (e) {
      /* Links inside a card (company website) should not trigger the flip */
      if (e.target.closest('a')) return;
      flip();
    });

    /* Keyboard: Space or Enter triggers flip */
    card.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        flip();
      }
    });
  });

  /* ── Introduction: GSAP line reveal → three.js dust ────────── */
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var particleState = { started: false, visible: true, renderer: null };

  function startParticles() {
    if (reducedMotion || particleState.started || !window.THREE) return;
    var canvas = document.getElementById('intro-particles');
    var section = document.getElementById('summary');
    if (!canvas || !section) return;
    particleState.started = true;

    var w = section.offsetWidth;
    var h = section.offsetHeight;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    particleState.renderer = renderer;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(55, w / h, 1, 1000);
    camera.position.z = 300;

    /* Soft round sprite drawn on a small canvas */
    var spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = spriteCanvas.height = 64;
    var ctx = spriteCanvas.getContext('2d');
    var grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,230,205,1)');
    grad.addColorStop(0.35, 'rgba(230,190,150,0.55)');
    grad.addColorStop(1, 'rgba(196,133,90,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    var sprite = new THREE.CanvasTexture(spriteCanvas);

    var COUNT = window.innerWidth < 700 ? 45 : 110;
    var spreadX = 480;
    var spreadY = 200;
    var positions = new Float32Array(COUNT * 3);
    var drift = [];
    for (var i = 0; i < COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * spreadX * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * spreadY * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 240;
      drift.push({
        vy: 0.06 + Math.random() * 0.14,
        sway: 0.3 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2
      });
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    var material = new THREE.PointsMaterial({
      size: 7,
      map: sprite,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    scene.add(new THREE.Points(geometry, material));

    var t = 0;
    function tick() {
      requestAnimationFrame(tick);
      if (!particleState.visible) return;
      t += 0.008;
      var pos = geometry.attributes.position.array;
      for (var i = 0; i < COUNT; i++) {
        pos[i * 3 + 1] += drift[i].vy;
        pos[i * 3] += Math.sin(t + drift[i].phase) * drift[i].sway * 0.06;
        if (pos[i * 3 + 1] > spreadY) pos[i * 3 + 1] = -spreadY;
      }
      geometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    }
    tick();

    /* Fade the canvas in */
    if (window.gsap) {
      gsap.to(canvas, { opacity: 0.6, duration: 2.2, ease: 'power2.inOut' });
    } else {
      canvas.style.transition = 'opacity 2.2s ease';
      canvas.style.opacity = '0.6';
    }

    /* Pause rendering when the section leaves the viewport */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        particleState.visible = entries[0].isIntersecting;
      }, { threshold: 0 }).observe(section);
    }

    window.addEventListener('resize', function () {
      var nw = section.offsetWidth;
      var nh = section.offsetHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
  }

  if (window.gsap && window.ScrollTrigger && !reducedMotion) {
    gsap.registerPlugin(ScrollTrigger);

    /* Hide up front — .from() inside a timeline doesn't apply its start
       state until the trigger fires, which flashes content on refresh */
    gsap.set('.intro-heading', { autoAlpha: 0, y: 26 });
    gsap.set('.intro-line-inner', { yPercent: 115 });

    gsap.timeline({
      scrollTrigger: {
        trigger: '#summary',
        start: 'top 72%',
        once: true
      },
      onComplete: startParticles
    })
      .to('.intro-heading', {
        autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out'
      })
      .to('.intro-line-inner', {
        yPercent: 0, duration: 0.85, ease: 'power3.out', stagger: 0.16
      }, '-=0.35');
  } else if (!reducedMotion) {
    /* GSAP failed to load — still show the dust once scrolled into view */
    if ('IntersectionObserver' in window) {
      var introObs = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          startParticles();
          introObs.disconnect();
        }
      }, { threshold: 0.3 });
      var summaryEl = document.getElementById('summary');
      if (summaryEl) introObs.observe(summaryEl);
    }
  }

  /* ── Work Experience: unfold entrance + cursor tilt ────────── */
  var rows = document.querySelectorAll('.flip-row');

  if (window.gsap && window.ScrollTrigger && !reducedMotion && rows.length) {
    /* GSAP owns the entrance — release these rows from the CSS reveal */
    rows.forEach(function (row) { row.classList.remove('reveal'); });

    /* Each jobs group unfolds when it scrolls into view */
    document.querySelectorAll('.jobs').forEach(function (group) {
      var groupRows = group.querySelectorAll('.flip-row');
      gsap.from(groupRows, {
        scrollTrigger: {
          trigger: group,
          start: 'top 75%',
          once: true
        },
        rotationX: -55,
        transformPerspective: 1200,
        transformOrigin: 'center top',
        y: 46,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.18,
        clearProps: 'all',
        onComplete: function () {
          /* Entrance finished — tilt may now take over these rows */
          groupRows.forEach(function (r) { r.dataset.entered = '1'; });
        }
      });
    });

    /* Cursor tilt — desktop pointers only, never during the entrance */
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      rows.forEach(function (row) {
        var toRx = gsap.quickTo(row, 'rotationX', { duration: 0.45, ease: 'power2.out' });
        var toRy = gsap.quickTo(row, 'rotationY', { duration: 0.45, ease: 'power2.out' });

        row.addEventListener('mouseenter', function () {
          if (!row.dataset.entered) return;
          gsap.set(row, { transformPerspective: 900 });
        });
        row.addEventListener('mousemove', function (e) {
          if (!row.dataset.entered) return;
          var r = row.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - 0.5;
          var py = (e.clientY - r.top) / r.height - 0.5;
          toRy(px * 6);
          toRx(py * -5);
        });
        row.addEventListener('mouseleave', function () {
          if (!row.dataset.entered) return;
          toRx(0);
          toRy(0);
        });
      });
    }
  }

  /* ── Panels: staggered rise + icon stroke-draw ─────────────── */
  var panelGrids = document.querySelectorAll('.skills-grid, .comp-grid, .edu-grid');

  if (window.gsap && window.ScrollTrigger && !reducedMotion && panelGrids.length) {
    panelGrids.forEach(function (grid) {
      var panels = grid.querySelectorAll('.skill-panel, .comp-panel, .edu-panel');
      if (!panels.length) return;

      /* GSAP owns the entrance — release these panels from the CSS reveal */
      panels.forEach(function (panel) { panel.classList.remove('reveal'); });

      /* Hide icon strokes so they can draw themselves in */
      panels.forEach(function (panel) {
        panel.querySelectorAll('svg *').forEach(function (shape) {
          try {
            var len = shape.getTotalLength();
            shape.style.strokeDasharray = len;
            shape.style.strokeDashoffset = len;
          } catch (err) { /* not a geometry element — skip */ }
        });
      });

      /* Hide up front so panels never flash visible before their entrance */
      gsap.set(panels, { autoAlpha: 0, y: 28 });

      ScrollTrigger.create({
        trigger: grid,
        start: 'top 80%',
        once: true,
        onEnter: function () {
          panels.forEach(function (panel, i) {
            var delay = i * 0.09;

            gsap.to(panel, {
              autoAlpha: 1,
              y: 0,
              duration: 0.65,
              ease: 'power3.out',
              delay: delay,
              clearProps: 'all'
            });

            var shapes = panel.querySelectorAll('svg *');
            gsap.to(shapes, {
              strokeDashoffset: 0,
              duration: 0.9,
              ease: 'power2.inOut',
              delay: delay + 0.25,
              stagger: 0.08,
              onComplete: function () {
                shapes.forEach(function (shape) {
                  shape.style.strokeDasharray = '';
                  shape.style.strokeDashoffset = '';
                });
              }
            });
          });
        }
      });
    });
  }

  /* ── Reveal on scroll (IntersectionObserver) ───────────────── */
  var revealEls = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    /* Fallback for older browsers */
    revealEls.forEach(function (el) { el.classList.add('in-view'); });
  }

}());
