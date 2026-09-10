/* ==========================================================================
   TEARDOWN — site engine
   --------------------------------------------------------------------------
   No framework, no build step. This file does five things:
     1. Generates every poster thumbnail from post metadata (assets/js/data.js)
     2. Renders card grids and the homepage hero from the same data
     3. Powers the category filters and the Cmd-K command palette
     4. Handles theme, reading progress, TOC scrollspy and reveal-on-scroll
     5. Wires up copy buttons on code and prompt blocks
   ========================================================================== */
(function () {
  'use strict';

  var POSTS = (window.TD && window.TD.POSTS) || [];
  var CATS  = (window.TD && window.TD.CATEGORIES) || {};

  /* Pages inside /posts need to reach back up one level for links. */
  var BASE = /\/posts\//.test(location.pathname) ? '../' : '';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function cat(post) {
    return CATS[post.category] || { color: '#8A877F', blob1: '#8A877F', blob2: '#5C5A55' };
  }

  function typeLabel(t) { return window.TD_TEMPLATES.typeLabel(t); }

  /* Templates live in assets/js/templates.js so the build can prerender the
     exact same markup with Node. See the header of that file. */
  var T = window.TD_TEMPLATES;

  function posterHTML(post)  { return T.posterHTML(post, CATS); }
  function cardHTML(post)    { return T.cardHTML(post, CATS, BASE); }
  function featureHTML(post) { return T.featureHTML(post, CATS, BASE); }

  var byDate = function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; };

  function sorted() { return POSTS.slice().sort(byDate); }

  /* ------------------------------------------------------------------
     3. MOUNT GRIDS
     <div data-grid data-type="versus" data-limit="3" data-skip-featured>
     ------------------------------------------------------------------ */
  function mountGrids() {
    $$('[data-grid]').forEach(function (el) {
      /* The build already wrote these cards into the HTML for crawlers.
         Re-rendering would only throw away identical markup. */
      if (el.hasAttribute('data-prerendered')) return;

      var list = sorted();
      var type = el.getAttribute('data-type');
      var exclude = el.getAttribute('data-exclude');
      var limit = parseInt(el.getAttribute('data-limit'), 10);

      if (type) list = list.filter(function (p) { return p.type === type; });
      if (exclude) list = list.filter(function (p) { return p.slug !== exclude; });
      if (el.hasAttribute('data-skip-featured')) list = list.filter(function (p) { return !p.featured; });
      if (!isNaN(limit)) list = list.slice(0, limit);

      el.innerHTML = list.map(cardHTML).join('');
      el.setAttribute('data-count', list.length);
    });

    var hero = $('[data-feature]');
    if (hero && !hero.hasAttribute('data-prerendered')) {
      var live = sorted().filter(function (p) { return !p.draft; });
      var f = live.filter(function (p) { return p.featured; })[0] || live[0];
      if (f) hero.innerHTML = featureHTML(f);
    }
  }

  /* ------------------------------------------------------------------
     4. FILTERS
     ------------------------------------------------------------------ */
  function mountFilters() {
    var grid = $('[data-grid][data-filterable]');
    if (!grid) return;

    var catBar = $('[data-filters]');
    var typeBar = $('[data-type-filters]');

    /* The build prerenders both chip rows. Re-rendering would replace
       identical markup and cost a layout shift. */
    if (catBar && !catBar.hasAttribute('data-prerendered')) {
      catBar.innerHTML = T.chipsHTML(POSTS, CATS);
    }
    if (typeBar && !typeBar.hasAttribute('data-prerendered')) {
      typeBar.innerHTML = T.typeChipsHTML(POSTS);
    }

    /* Two independent dimensions, both reflected in the URL so a filtered
       view is shareable and the back button works. The Versus / Tutorials
       nav links are just ?type= deep links into this. */
    var q = new URLSearchParams(location.search);
    var state = { type: q.get('type') || 'all', cat: q.get('cat') || 'all' };

    function syncChips() {
      if (typeBar) {
        $$('.chip', typeBar).forEach(function (c) {
          c.setAttribute('aria-pressed', String(c.getAttribute('data-t') === state.type));
        });
      }
      if (catBar) {
        $$('.chip', catBar).forEach(function (c) {
          c.setAttribute('aria-pressed', String(c.getAttribute('data-f') === state.cat));
        });
      }
    }

    function urlFor(st) {
      var p = new URLSearchParams();
      if (st.type !== 'all') p.set('type', st.type);
      if (st.cat !== 'all') p.set('cat', st.cat);
      var qs = p.toString();
      return location.pathname + (qs ? '?' + qs : '');
    }

    function writeUrl() {
      /* pushState, not replaceState: a filter change is a place the reader
         can be, so Back has to undo it. replaceState overwrote the current
         entry and made the browser's back button skip past the whole
         filtering session. */
      var url = urlFor(state);
      if (url !== location.pathname + location.search) {
        history.pushState({ td: state }, '', url);
      }
    }

    function apply(updateUrl) {
      var shown = 0;
      var total = 0;
      $$('.card', grid).forEach(function (card) {
        total++;
        var ok = (state.type === 'all' || card.getAttribute('data-type') === state.type) &&
                 (state.cat === 'all' || card.getAttribute('data-cat') === state.cat);
        card.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });

      var empty = $('[data-empty]');
      if (empty) empty.style.display = shown ? 'none' : '';

      var count = $('[data-lib-count]');
      if (count) {
        count.textContent = shown === total
          ? total + ' posts'
          : 'Showing ' + shown + ' of ' + total;
      }

      syncChips();
      /* Clear the pre-paint guard: the grid now matches the URL. */
      document.documentElement.classList.remove('pre-filter');
      if (updateUrl) writeUrl();
    }

    /* Back and forward re-read the URL and re-apply, so history works. */
    window.addEventListener('popstate', function () {
      var q2 = new URLSearchParams(location.search);
      state.type = q2.get('type') || 'all';
      state.cat = q2.get('cat') || 'all';
      apply(false);
    });

    if (typeBar) {
      typeBar.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        state.type = chip.getAttribute('data-t');
        apply(true);
      });
    }

    if (catBar) {
      catBar.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        state.cat = chip.getAttribute('data-f');
        apply(true);
      });
    }

    apply(false);
  }

  /* ------------------------------------------------------------------
     5. COMMAND PALETTE (Cmd/Ctrl + K)
     ------------------------------------------------------------------ */
  function mountPalette() {
    var pal = $('#palette');
    if (!pal) return;

    var input = $('.pal__input', pal);
    var list  = $('.pal__list', pal);
    var box   = $('.pal__box', pal);
    var idx = 0;
    var results = [];
    var lastFocus = null;

    /* Proper combobox wiring. The input owns the listbox and announces the
       highlighted option through aria-activedescendant, which is how a screen
       reader follows arrow keys inside a dialog like this. */
    list.id = list.id || 'pal-list';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', list.id);
    input.setAttribute('aria-autocomplete', 'list');

    function score(p, q) {
      var hay = (p.title + ' ' + p.deck + ' ' + p.category + ' ' +
                 typeLabel(p.type) + ' ' + (p.tags || []).join(' ')).toLowerCase();
      return hay.indexOf(q) > -1;
    }

    function render() {
      if (!results.length) {
        /* An empty listbox with a plain message inside is invalid ARIA —
           role="listbox" must own options. Drop the role while empty. */
        list.removeAttribute('role');
        list.innerHTML = '<div class="pal__empty">Nothing matches that. ' +
          'Try "hooks", "comparison" or "mcp".</div>';
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        return;
      }

      list.setAttribute('role', 'listbox');
      input.setAttribute('aria-expanded', 'true');

      list.innerHTML = results.map(function (p, i) {
        var c = cat(p);
        var href = BASE + 'posts/' + p.slug + '.html';
        var tag = p.draft ? 'span' : 'a';
        var attrs = p.draft ? '' : ' href="' + esc(href) + '"';
        return '<' + tag + attrs + ' class="pal__item" role="option" id="pal-opt-' + i + '"' +
          ' aria-selected="' + (i === idx) + '" data-i="' + i + '">' +
          '<span class="pal__swatch" style="--c:' + esc(c.color) + '"></span>' +
          '<span><span class="pal__t">' + esc(p.title) + '</span><br>' +
          '<span class="pal__s">' + esc(typeLabel(p.type)) + ' &middot; ' + esc(p.category) +
          (p.draft ? ' &middot; In the works' : '') + '</span></span>' +
        '</' + tag + '>';
      }).join('');

      input.setAttribute('aria-activedescendant', 'pal-opt-' + idx);
    }

    function search(q) {
      q = q.trim().toLowerCase();
      results = q ? sorted().filter(function (p) { return score(p, q); }) : sorted();
      idx = 0;
      render();
    }

    function open() {
      if (pal.classList.contains('is-open')) return;
      lastFocus = document.activeElement;      // so Escape can hand it back
      pal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      input.value = '';
      search('');
      input.focus();
    }

    function close() {
      if (!pal.classList.contains('is-open')) return;
      pal.classList.remove('is-open');
      document.body.style.overflow = '';
      input.setAttribute('aria-expanded', 'false');
      /* Returning focus to whatever opened the dialog is the part everyone
         forgets. Without it a keyboard user is dumped at the top of the
         document and has to tab back to where they were. */
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
      lastFocus = null;
    }

    /* Keep Tab inside the dialog while it is open. */
    var FOCUSABLE = 'a[href], button, input, [tabindex]:not([tabindex="-1"])';
    function trap(e) {
      if (e.key !== 'Tab') return;
      var items = $$(FOCUSABLE, box).filter(function (el) {
        return el.offsetParent !== null || el === document.activeElement;
      });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }

    $$('[data-open-palette]').forEach(function (b) { b.addEventListener('click', open); });
    $('.pal__scrim', pal).addEventListener('click', close);
    input.addEventListener('input', function () { search(input.value); });

    document.addEventListener('keydown', function (e) {
      var mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        pal.classList.contains('is-open') ? close() : open();
        return;
      }
      if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        e.preventDefault(); open(); return;
      }
      if (!pal.classList.contains('is-open')) return;

      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') { trap(e); }
      else if (e.key === 'ArrowDown') {
        e.preventDefault(); idx = Math.min(idx + 1, results.length - 1); render(); scrollSel();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); idx = Math.max(idx - 1, 0); render(); scrollSel();
      } else if (e.key === 'Enter') {
        var sel = results[idx];
        if (sel && !sel.draft) { location.href = BASE + 'posts/' + sel.slug + '.html'; }
      }
    });

    function scrollSel() {
      var el = $('[aria-selected="true"]', list);
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }
  }

  /* ------------------------------------------------------------------
     5b. MOBILE NAV
     ------------------------------------------------------------------ */
  function mountNav() {
    var toggle = $('[data-nav-toggle]');
    var nav = $('#site-nav');
    if (!toggle || !nav) return;

    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });

    /* Tapping anywhere outside closes it, which is what people expect from a
       menu that overlays the page. */
    document.addEventListener('click', function (e) {
      if (toggle.getAttribute('aria-expanded') !== 'true') return;
      if (!nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });

    /* Reset when the viewport grows past the breakpoint, or the panel state
       lingers invisibly and the toggle lies about being expanded. */
    var mq = window.matchMedia('(min-width: 721px)');
    var onChange = function (e) { if (e.matches) setOpen(false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* ------------------------------------------------------------------
     6. THEME
     ------------------------------------------------------------------ */
  function mountTheme() {
    var root = document.documentElement;
    $$('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('td-theme', next); } catch (err) {}
      });
    });
  }

  /* ------------------------------------------------------------------
     7. ARTICLE CHROME — progress bar, TOC build + scrollspy
     ------------------------------------------------------------------ */
  function mountArticle() {
    var prose = $('.prose');
    var bar = $('.progress');

    if (bar && prose) {
      var onScroll = function () {
        var top = prose.offsetTop;
        var h = prose.offsetHeight - window.innerHeight;
        var pct = h > 0 ? ((window.scrollY - top) / h) * 100 : 0;
        bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    var toc = $('[data-toc]');
    if (!toc || !prose) return;

    var heads = $$('h2[id]', prose);
    if (!heads.length) { toc.closest('.toc').style.display = 'none'; return; }

    toc.innerHTML = heads.map(function (h) {
      var text = h.getAttribute('data-toc-label');
      if (!text) {
        /* Drop the ".n" kicker ("Round 01") so the TOC shows the title only. */
        var clone = h.cloneNode(true);
        var kicker = clone.querySelector('.n');
        if (kicker) kicker.remove();
        text = clone.textContent;
      }
      return '<li><a href="#' + esc(h.id) + '">' + esc(text.trim()) + '</a></li>';
    }).join('');

    var links = $$('a', toc);
    var spy = function () {
      var y = window.scrollY + 120;
      var active = heads[0];
      heads.forEach(function (h) { if (h.offsetTop <= y) active = h; });
      links.forEach(function (a) {
        a.classList.toggle('is-active', a.getAttribute('href') === '#' + active.id);
      });
    };
    window.addEventListener('scroll', spy, { passive: true });
    spy();
  }

  /* ------------------------------------------------------------------
     8. COPY BUTTONS
     ------------------------------------------------------------------ */
  function mountCopy() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.code__copy');
      if (!btn) return;

      var box = btn.closest('.code, .prompt');
      var src = box ? (box.querySelector('code') || box.querySelector('p')) : null;
      if (!src) return;

      var text = src.innerText;
      var done = function () {
        var old = btn.textContent;
        btn.textContent = 'Copied';
        btn.classList.add('ok');
        setTimeout(function () { btn.textContent = old; btn.classList.remove('ok'); }, 1600);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else { fallback(); }

      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:absolute;left:-9999px';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (err) {}
        document.body.removeChild(ta);
      }
    });
  }

  /* ------------------------------------------------------------------
     9. SCORECARD BARS — animate on first view
     ------------------------------------------------------------------ */
  function mountScores() {
    $$('.score__bar').forEach(function (bar) {
      $$('span', bar).forEach(function (s) {
        s.setAttribute('data-w', s.style.width || '50%');
        s.style.width = '0%';
      });
    });
  }

  /* ------------------------------------------------------------------
     10. REVEAL ON SCROLL
     ------------------------------------------------------------------ */
  function mountReveal() {
    var items = $$('.reveal');
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach(function (el) { el.classList.add('in'); });
      $$('.score__bar span').forEach(function (s) { s.style.width = s.getAttribute('data-w') || s.style.width; });
      return;
    }

    /* Failsafe: content visibility must never depend on an observer firing.
       If callbacks are delayed or dropped (tab loaded in the background, an
       odd browser state), reveal everything anyway. The animation is a nicety;
       being able to read the page is not. */
    var failsafe = setTimeout(function () {
      items.forEach(function (el) { el.classList.add('in'); });
    }, 2500);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        clearTimeout(failsafe);
        var el = en.target;
        var sibs = Array.prototype.slice.call(el.parentNode.children).indexOf(el);
        el.style.transitionDelay = Math.min(sibs, 5) * 55 + 'ms';
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });

    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        $$('span', en.target).forEach(function (s, i) {
          setTimeout(function () { s.style.width = s.getAttribute('data-w'); }, i * 90);
        });
        so.unobserve(en.target);
      });
    }, { threshold: .4 });
    $$('.score__bar').forEach(function (b) { so.observe(b); });
  }

  /* ------------------------------------------------------------------
     11. ODDS AND ENDS
     ------------------------------------------------------------------ */
  function mountMisc() {
    /* If a filtered URL is opened on a page with no filterable grid, nothing
       else would ever clear the pre-paint guard. */
    document.documentElement.classList.remove('pre-filter');

    $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

    var pop = $('[data-popular]');
    if (pop && !pop.hasAttribute('data-prerendered')) {
      pop.innerHTML = T.linkListHTML(sorted(), 3, BASE);
    }

    /* Static pages mark their portrait slots with [data-author-pic]; fill them
       from the AUTHOR record so the photo path is never hard-coded in HTML. */
    var A = (window.TD && window.TD.AUTHOR) || null;
    if (A && A.photo) {
      $$('[data-author-pic]').forEach(function (el) {
        if (el.querySelector('img')) return;
        var jpg = BASE + A.photo;
        var pic = document.createElement('picture');
        var source = document.createElement('source');
        source.srcset = jpg.replace(/\.(jpe?g|png)$/i, '.webp');
        source.type = 'image/webp';
        var img = document.createElement('img');
        img.src = jpg;
        img.alt = A.name;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.onerror = function () { pic.remove(); };
        pic.appendChild(source);
        pic.appendChild(img);
        el.appendChild(pic);
      });
    }
    $$('[data-author-name]').forEach(function (el) { if (A) el.textContent = A.name; });

    $$('form[data-signup]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        form.innerHTML = '<p class="form__ok">You are on the list. First teardown lands in your inbox on Tuesday.</p>';
      });
    });

    /* Mark the current page in the nav without hand-editing each file.
       Versus and Tutorials are ?type= deep links into the library, so the
       query string is part of the match, not just the filename. */
    var here = location.pathname.split('/').pop() || 'index.html';
    var nowType = new URLSearchParams(location.search).get('type') || '';

    $$('.nav a').forEach(function (a) {
      var href = a.getAttribute('href');
      var file = href.split('/').pop().split('?')[0].split('#')[0];
      var linkType = (href.split('?')[1] || '').replace(/^type=/, '').split('&')[0];
      if (file === here && linkType === nowType) {
        a.setAttribute('aria-current', 'page');
      } else {
        a.removeAttribute('aria-current');
      }
    });
  }

  function init() {
    mountGrids();
    mountFilters();
    mountPalette();
    mountNav();
    mountTheme();
    mountArticle();
    mountCopy();
    mountScores();
    mountReveal();
    mountMisc();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
