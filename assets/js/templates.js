/* ==========================================================================
   TEARDOWN — card + poster templates
   --------------------------------------------------------------------------
   Shared by two callers, which is the whole point:

     * the browser (assets/js/site.js) for client-side rendering and filtering
     * the build (build.py -> node) to PRERENDER the same markup into the HTML

   Prerendering is what makes the listing pages indexable — a crawler that does
   not run JavaScript still sees every card, title, link and date. The browser
   then skips re-rendering anything the build already emitted.

   Keep these functions pure: no DOM, no globals beyond the args. That is what
   lets Node execute them at build time.
   ========================================================================== */
(function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function typeLabel(t) {
    return t === 'versus' ? 'Comparison' : t === 'guide' ? 'Guide' : 'Tutorial';
  }

  function fmtDate(iso) {
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    return months[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1];
  }

  function catOf(post, cats) {
    return (cats && cats[post.category]) || { color: '#8A877F', blob1: '#8A877F', blob2: '#5C5A55' };
  }

  /* ---- Avatar: photo layered over initials, degrades to the monogram ---- */
  function avatarHTML(author, base, cls) {
    var img = '';
    if (author.photo) {
      var jpg = esc((base || '') + author.photo);
      var webp = jpg.replace(/\.(jpe?g|png)$/i, '.webp');
      /* <picture> so modern browsers take the WebP (about 40% smaller) and
         everything else falls back to the original. */
      img = '<picture>' +
              '<source srcset="' + webp + '" type="image/webp">' +
              '<img src="' + jpg + '" alt="' + esc(author.name) +
              '" width="22" height="22" loading="lazy" decoding="async"' +
              ' onerror="this.parentElement.remove()">' +
            '</picture>';
    }
    return '<span class="' + (cls || 'avatar') + '">' + esc(author.initials) + img + '</span>';
  }

  /* ---- The poster generator: three art directions from metadata alone ---- */
  function posterHTML(post, cats, base) {
    // A hand-made cover wins over the generated art. Decorative: the card
    // title right below it carries the text.
    if (post.cover) {
      return '' +
        '<div class="poster poster--cover" style="--cover:url(\'' + esc((base || '') + post.cover) + '\')" aria-hidden="true">' +
          '<img src="' + esc((base || '') + post.cover) + '" width="1200" height="630" alt="" loading="lazy" decoding="async">' +
        '</div>';
    }

    var c = catOf(post, cats);
    var head = esc(post.posterH || post.title);
    var kind = esc(typeLabel(post.type));
    var label = esc(post.category);

    if (post.type === 'versus' && post.vs) {
      var a = post.vs.a, b = post.vs.b;
      return '' +
        '<div class="poster poster--vs" style="--vs-a:' + esc(a.color) + ';--vs-b:' + esc(b.color) + '" aria-hidden="true">' +
          '<div class="poster__split">' +
            '<div class="poster__half poster__half--a"></div>' +
            '<div class="poster__half poster__half--b"></div>' +
          '</div>' +
          '<div class="poster__mesh"></div>' +
          '<span class="poster__vs">VS</span>' +
          '<div class="poster__body">' +
            '<div class="poster__top">' +
              '<span class="poster__cat">' + label + '</span>' +
              '<span class="poster__type">' + kind + '</span>' +
            '</div>' +
            '<h3 class="poster__h">' + head + '</h3>' +
            '<div class="poster__chips">' +
              '<span class="poster__chip"><i>' + esc(a.initials) + '</i>' + esc(a.name) + '</span>' +
              '<span class="poster__chip"><i>' + esc(b.initials) + '</i>' + esc(b.name) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    var variant = post.type === 'guide' ? ' poster--guide' : '';
    return '' +
      '<div class="poster' + variant + '" style="--pa-1:' + esc(c.blob1) + ';--pa-2:' + esc(c.blob2) + '" aria-hidden="true">' +
        '<div class="poster__mesh"></div>' +
        (post.num ? '<span class="poster__num">' + esc(post.num) + '</span>' : '') +
        '<div class="poster__body">' +
          '<div class="poster__top">' +
            '<span class="poster__cat">' + label + '</span>' +
            '<span class="poster__type">' + kind + '</span>' +
          '</div>' +
          '<h3 class="poster__h">' + head + '</h3>' +
        '</div>' +
      '</div>';
  }

  /* ---- Cards. Semantic markup: real <article>, <time datetime>, rel=author.
         Crawlers and language models both read this without running JS. ---- */
  function cardHTML(post, cats, base) {
    base = base || '';
    var href = base + 'posts/' + post.slug + '.html';
    var title = post.draft
      ? esc(post.title)
      : '<a href="' + esc(href) + '">' + esc(post.title) + '</a>';

    return '' +
      '<article class="card reveal' + (post.draft ? ' card--soon' : '') + '" data-cat="' + esc(post.category) + '" data-type="' + esc(post.type) + '">' +
        '<div class="card__media">' +
          posterHTML(post, cats, base) +
          (post.draft ? '<span class="pill-soon">In the works</span>' : '') +
        '</div>' +
        '<div class="card__meta">' +
          '<span>' + esc(typeLabel(post.type)) + '</span><span class="dot"></span>' +
          '<span>' + esc(post.category) + '</span><span class="dot"></span>' +
          '<span>' + esc(post.mins) + ' min</span>' +
        '</div>' +
        '<h2 class="card__title">' + title + '</h2>' +
        '<p class="card__deck">' + esc(post.deck) + '</p>' +
        '<div class="card__foot">' +
          avatarHTML(post.author, base) +
          '<span class="card__meta"><span rel="author">' + esc(post.author.name) + '</span><span class="dot"></span>' +
          '<time datetime="' + esc(post.date) + '">' + esc(fmtDate(post.date)) + '</time></span>' +
        '</div>' +
      '</article>';
  }

  function featureHTML(post, cats, base) {
    base = base || '';
    var href = base + 'posts/' + post.slug + '.html';
    var c = catOf(post, cats);
    return '' +
      '<article class="feature reveal">' +
        '<div class="card__media">' + posterHTML(post, cats, base) + '</div>' +
        '<div class="feature__body">' +
          '<div class="card__meta">' +
            '<span class="badge" style="--c:' + esc(c.color) + '">' + esc(typeLabel(post.type)) + '</span>' +
            '<span>' + esc(post.category) + '</span><span class="dot"></span>' +
            '<span>' + esc(post.mins) + ' min read</span>' +
          '</div>' +
          '<h2><a href="' + esc(href) + '">' + esc(post.title) + '</a></h2>' +
          '<p>' + esc(post.deck) + '</p>' +
          '<div class="card__foot">' +
            avatarHTML(post.author, base) +
            '<span class="card__meta"><span rel="author">' + esc(post.author.name) + '</span><span class="dot"></span>' +
            '<time datetime="' + esc(post.date) + '">' + esc(fmtDate(post.date)) + '</time></span>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  /* ---- Category filter chips. Prerendered too: injecting these after
         first paint pushed the card grid down and cost 0.1 CLS. ---- */
  function chipsHTML(posts, cats) {
    var counts = {};
    posts.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });

    var html = '<button class="chip" data-f="all" aria-pressed="true">All' +
               '<span class="chip__n">' + posts.length + '</span></button>';

    Object.keys(cats).forEach(function (name) {
      if (!counts[name]) return;
      html += '<button class="chip" data-f="' + esc(name) + '" aria-pressed="false"' +
              ' style="--c:' + esc(cats[name].color) + '">' +
              '<span class="cdot"></span>' + esc(name) +
              '<span class="chip__n">' + counts[name] + '</span></button>';
    });
    return html;
  }

  /* ---- Type filter chips. These back the Comparisons / Tutorials nav links,
         which used to point at #anchors that did not exist on this page. ---- */
  function typeChipsHTML(posts) {
    var order = [['all', 'Everything'], ['versus', 'Comparisons'],
                 ['tutorial', 'Tutorials'], ['guide', 'Guides']];
    var counts = { all: posts.length };
    posts.forEach(function (p) { counts[p.type] = (counts[p.type] || 0) + 1; });

    return order.reduce(function (html, pair) {
      var key = pair[0];
      if (key !== 'all' && !counts[key]) return html;
      return html +
        '<button class="chip chip--type" data-t="' + key + '"' +
        ' aria-pressed="' + (key === 'all') + '">' + esc(pair[1]) +
        '<span class="chip__n">' + (counts[key] || 0) + '</span></button>';
    }, '');
  }

  /* ---- Footer link list. Generated because a hand-written one drifted:
         it kept pointing at a post that had been pulled back to draft. ---- */
  function linkListHTML(posts, limit, base) {
    base = base || '';
    return posts
      .filter(function (p) { return !p.draft; })
      .slice(0, limit || 3)
      .map(function (p) {
        return '<li><a href="' + esc(base + 'posts/' + p.slug + '.html') + '">' +
               esc(p.posterH || p.title) + '</a></li>';
      })
      .join('');
  }

  root.TD_TEMPLATES = {
    esc: esc, typeLabel: typeLabel, fmtDate: fmtDate,
    avatarHTML: avatarHTML, posterHTML: posterHTML,
    cardHTML: cardHTML, featureHTML: featureHTML, chipsHTML: chipsHTML, typeChipsHTML: typeChipsHTML, linkListHTML: linkListHTML
  };
})(typeof window !== 'undefined' ? window : globalThis);
