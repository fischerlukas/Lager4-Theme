/* ============================================================================
   Google Reviews Live
   ----------------------------------------------------------------------------
   Lädt die Google Maps JavaScript API (libraries=places) clientseitig und
   holt Bewertungen über die Places API (New) direkt im Browser. Kein
   serverseitiger Sync nötig.

   Das Widget ist vollständig in `gl4`-Namespaces gekapselt und kann mehrfach
   auf einer Seite laufen (jede Section-Einheit liest ihre eigene Konfiguration
   aus einem <script type="application/json" data-gl4-config>).

   Konfigurationsfelder (aus der Section bzw. dem Demo-Config):
     api_key, place_id, locale, max_reviews, variant,
     badge_label, badge_show_score, panel_title, reviews_word,
     cta_label, v2_cta_label, v4_cta_label, foot_label,
     v2_title, v3_title, v5_title, business_name,
     write_url, all_url,
     loading_label, error_label, retry_label, hint_label,
     close_label, dismiss_label,
     delay, dismissible, remember_days, hide_on_mobile,
     dist_5 … dist_1 (optionale Sternverteilung für Variante 3),
     fallback_reviews (optionaler JSON-String, dient als Notlösung)
   ========================================================================== */
(function () {
  'use strict';

  var MOBILE = 749;

  var STAR =
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z"/></svg>';

  var LOGO =
    '<svg class="gl4-logo" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
    '<path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 2-1.6 5-4.5 7l-.1.3 6.5 5 .5.1c4.2-3.8 6.6-9.5 6.6-15.7z"/>' +
    '<path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-.3.1-6.7 5.2-.1.3C7.9 41 15.4 46 24 46z"/>' +
    '<path fill="#FBBC05" d="M11.5 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3.1.7-4.4v-.4l-6.9-5.3-.2.1C2.9 17 2 20.4 2 24s.9 7 2.4 10l7.1-5.6z"/>' +
    '<path fill="#EA4335" d="M24 10.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.3 29.9 2 24 2 15.4 2 7.9 7 4.4 14l7.1 5.6c1.8-5.3 6.7-9.1 12.5-9.1z"/></svg>';

  var ARROW =
    '<svg width="21" height="9" viewBox="0 0 21 9" fill="none" aria-hidden="true" focusable="false">' +
    '<path d="M20.354 4.854a.5.5 0 0 0 0-.708L17.172.964a.5.5 0 1 0-.707.708L19.293 4.5l-2.828 2.828a.5.5 0 1 0 .707.708l3.182-3.182ZM0 5h20V4H0v1Z"/></svg>';

  var AVATAR_COLORS = ['#4285F4', '#7B1FA2', '#C62828', '#00796B', '#455A64', '#E65100', '#2E7D32', '#00695C', '#AD1457', '#283593'];

  /* ------------------------------------------------------------ Hilfsfunktionen */

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* 4.8 → "4,8" – deutsches Komma, ohne die Liquid-Rundungs-Falle */
  function formatScore(n) {
    var v = Number(n);
    if (!isFinite(v)) return '–';
    return String(Math.round(v * 10) / 10).replace('.', ',');
  }

  function avatarColor(name) {
    var sum = 0;
    for (var i = 0; i < name.length; i++) sum = (sum * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[sum % AVATAR_COLORS.length];
  }

  /* Robuste Sterne: Jede der 5 Sterne wird einzeln gerendert. Der letzte
     (teil-)gefüllte Stern wird per --gl4-star-fill innerhalb seiner eigenen
     Stern-Box abgeschnitten – kein Überlappen, keine Container-Prozentrechnung. */
  function starsHTML(rating, cls) {
    var v = Math.max(0, Math.min(5, Number(rating) || 0));
    var full = Math.floor(v);
    var frac = Math.round((v - full) * 100);
    var stars = '';
    for (var i = 0; i < 5; i++) {
      if (i < full) {
        stars += '<span class="gl4-star"><span class="gl4-star__fill">' + STAR + '</span></span>';
      } else if (i === full && frac > 0) {
        stars += '<span class="gl4-star gl4-star--part" style="--gl4-star-fill:' + frac + '%">' +
          '<span class="gl4-star__base">' + STAR + '</span>' +
          '<span class="gl4-star__fill">' + STAR + '</span></span>';
      } else {
        stars += '<span class="gl4-star"><span class="gl4-star__base">' + STAR + '</span></span>';
      }
    }
    return '<span class="gl4-stars ' + (cls || '') + '" role="img" aria-label="' +
      escapeHtml(formatScore(rating)) + ' von 5 Sternen">' + stars + '</span>';
  }

  function avatarHTML(name, small) {
    return (
      '<span class="gl4-avatar' + (small ? ' gl4-avatar--sm' : '') + '" style="background:' + avatarColor(name) + '" aria-hidden="true">' +
      escapeHtml(String(name).charAt(0).toUpperCase()) +
      '</span>'
    );
  }

  function ctaHTML(label, href, cls) {
    return (
      '<a class="gl4-cta ' + (cls || '') + '" href="' + escapeHtml(href) + '" target="_blank" rel="noopener nofollow">' +
      '<span class="gl4-cta__icon" aria-hidden="true">' + ARROW + '</span>' +
      '<span class="gl4-cta__text">' + escapeHtml(label) + '</span></a>'
    );
  }

  function logoHTML(size) {
    return (
      '<span class="gl4-logo" aria-hidden="true">' +
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 48 48" focusable="false">' +
      '<path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 2-1.6 5-4.5 7l-.1.3 6.5 5 .5.1c4.2-3.8 6.6-9.5 6.6-15.7z"/>' +
      '<path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-.3.1-6.7 5.2-.1.3C7.9 41 15.4 46 24 46z"/>' +
      '<path fill="#FBBC05" d="M11.5 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3.1.7-4.4v-.4l-6.9-5.3-.2.1C2.9 17 2 20.4 2 24s.9 7 2.4 10l7.1-5.6z"/>' +
      '<path fill="#EA4335" d="M24 10.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.3 29.9 2 24 2 15.4 2 7.9 7 4.4 14l7.1 5.6c1.8-5.3 6.7-9.1 12.5-9.1z"/></svg></span>'
    );
  }

  /* ----------------------------------------------------- Konfiguration lesen */

  function readConfig(root) {
    var node = root.querySelector('[data-gl4-config]');
    var cfg = {};
    if (node) {
      try {
        cfg = JSON.parse(node.textContent || '{}');
      } catch (e) {
        cfg = {};
      }
    }
    return cfg;
  }

  function parseFallback(raw) {
    if (!raw) return null;
    try {
      var data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!data || !data.reviews) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  /* ----------------------------------------------------- Maps / Places laden */

  function loadMapsScript(apiKey) {
    return new Promise(function (resolve, reject) {
      var win = window;

      /* Sicherheitsnetz: das Widget soll nie ewig im „Laden“-Zustand hängen bleiben */
      var timer = window.setTimeout(function () {
        reject(new Error('maps-script-timeout'));
      }, 20000);

      function done(map) {
        window.clearTimeout(timer);
        resolve(map);
      }
      function fail(err) {
        window.clearTimeout(timer);
        reject(err);
      }

      if (win.google && win.google.maps && win.google.maps.importLibrary) {
        done(win.google.maps);
        return;
      }
      var existing = document.getElementById('gl4-maps');
      if (existing) {
        if (existing.dataset.gl4Loaded === '1') {
          done(win.google.maps);
          return;
        }
        existing.addEventListener('load', function () { done(win.google.maps); });
        existing.addEventListener('error', function () { fail(new Error('maps-script-error')); });
        return;
      }
      var script = document.createElement('script');
      script.id = 'gl4-maps';
      script.src =
        'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(apiKey) +
        '&loading=async&libraries=places&v=weekly';
      script.async = true;
      script.addEventListener('load', function () {
        /* BUGFIX: vorher stand hier `existing` (beim ersten Laden null) –
           der load-Handler warf, `resolve` lief nie, Promise blieb offen. */
        script.dataset.gl4Loaded = '1';
        done(win.google.maps);
      });
      script.addEventListener('error', function () { fail(new Error('maps-script-error')); });
      document.head.appendChild(script);
    });
  }

  /* Wartet, bis die Places-Library verfügbar ist. Unterstützt sowohl den
     Async-Loader (google.maps.importLibrary) als auch den klassischen Loader
     (google.maps.places.Place direkt) – z. B. beim Maps-Demo-Key, bei dem
     importLibrary erst einen Moment nach dem script-load verfügbar ist. */
  function waitForPlaces() {
    return new Promise(function (resolve, reject) {
      var started = Date.now();
      (function attempt() {
        var maps = window.google && window.google.maps;
        if (maps && maps.importLibrary) {
          maps.importLibrary('places').then(resolve, reject);
          return;
        }
        if (maps && maps.places && maps.places.Place) {
          resolve(maps.places);
          return;
        }
        if (Date.now() - started > 15000) {
          reject(new Error('places-library-timeout'));
          return;
        }
        window.setTimeout(attempt, 100);
      })();
    });
  }

  /* Places API (New): Place.fetchFields mit reviews */
  function fetchPlaceData(cfg) {
    return loadMapsScript(cfg.api_key).then(function () {
      return waitForPlaces().then(function (places) {
        var place = new places.Place({
          id: cfg.place_id,
          requestedLanguage: cfg.locale || 'de'
        });
        return place
          .fetchFields({
            /* BUGFIX: `url` gibt es in der Places API (New) nicht –
               das Feld heißt dort `googleMapsURI`. */
            fields: ['displayName', 'rating', 'userRatingCount', 'reviews', 'googleMapsURI', 'editorialSummary']
          })
          .then(function (result) {
            /* fetchFields löst mit { place: <Place> } auf – das befüllte
               Place-Objekt liegt in `result.place`. */
            return result || { place: place };
          })
          .catch(function (err) {
            console.error('[GoogleReviewsLive] Places fetchFields fehlgeschlagen:', err);
            /* Fallback: manche Places haben keine reviews-Rolle – leeres Ergebnis */
            return { place: { rating: null, userRatingCount: null, reviews: [], url: '', googleMapsURI: '' } };
          });
      });
    });
  }

  /* Bewertungstext robust auslesen. Die Places API (New) liefert ein
     FormattableText-Objekt ({ text, languageCode }), andere Quellen
     (Fallback-JSON, Legacy-APIs) liefern einen einfachen String. */
  function reviewTextOf(r) {
    var t = r && r.text;
    if (!t) return '';
    if (typeof t === 'string') return t;
    if (t.text) return t.text;
    if (typeof t.toString === 'function') {
      var s = String(t);
      return s && s !== '[object Object]' ? s : '';
    }
    return '';
  }

  function normalizeReviews(place, maxReviews, totalOverride) {
    var list = (place.reviews || []).slice().sort(function (a, b) {
      var ta = a.publishTime ? new Date(a.publishTime).getTime() : 0;
      var tb = b.publishTime ? new Date(b.publishTime).getTime() : 0;
      return tb - ta;
    });

    var reviews = list.slice(0, maxReviews).map(function (r) {
      var name = (r.authorAttribution && r.authorAttribution.displayName) || 'Google Nutzer';
      return {
        name: name,
        when: r.relativePublishTimeDescription || '',
        rating: Number(r.rating) || 5,
        text: reviewTextOf(r),
        color: avatarColor(name)
      };
    });

    return {
      reviews: reviews,
      rating: Number(place.rating) || 0,
      count: Number(place.userRatingCount) || Number(totalOverride) || 0,
      url: place.googleMapsURI || place.url || ''
    };
  }

  /* -------------------------------------------------------------- URLs bauen */

  function writeUrl(cfg) {
    if (cfg.write_url) return cfg.write_url;
    if (cfg.place_id) return 'https://search.google.com/local/writereview?placeid=' + encodeURIComponent(cfg.place_id);
    return '#';
  }

  function allUrl(cfg, data) {
    if (cfg.all_url) return cfg.all_url;
    if (data.url) return data.url;
    if (cfg.place_id) return 'https://search.google.com/local/reviews?placeid=' + encodeURIComponent(cfg.place_id);
    return '#';
  }

  /* --------------------------------------------------------------- Varianten */

  var RENDER = {
    v1: function (cfg, data) {
      var count = data.count ? data.count + ' ' : '';
      return (
        '<button class="gl4-close" type="button" data-gl4-close aria-label="' + escapeHtml(cfg.close_label || 'Schließen') + '">×</button>' +
        '<div class="gl4-v1__head">' +
          '<div class="gl4-v1__brand">' + logoHTML(22) + '<span>' + escapeHtml(cfg.panel_title || 'Bewertungen') + '</span></div>' +
          '<div class="gl4-v1__score"><span class="gl4-v1__num">' + formatScore(data.rating) + '</span>' + starsHTML(data.rating, 'gl4-stars--lg') + '</div>' +
          '<p class="gl4-v1__meta">' + count + escapeHtml(cfg.reviews_word || 'Bewertungen auf Google') + '</p>' +
          ctaHTML(cfg.cta_label || 'Bewertung schreiben', writeUrl(cfg)) +
        '</div>' +
        '<div class="gl4-v1__list gl4-scroll">' +
          data.reviews.map(function (r) {
            return (
              '<article class="gl4-v1__item"><div class="gl4-v1__top">' + avatarHTML(r.name) +
              '<div><div class="gl4-v1__name">' + escapeHtml(r.name) + '</div>' +
              (r.when ? '<div class="gl4-v1__when">' + escapeHtml(r.when) + '</div>' : '') + '</div></div>' +
              '<div class="gl4-v1__stars">' + starsHTML(r.rating) + '</div>' +
              '<p class="gl4-v1__text">' + escapeHtml(r.text) + '</p></article>'
            );
          }).join('') +
        '</div>' +
        '<div class="gl4-v1__foot">' + ctaHTML(cfg.foot_label || 'Alle auf Google ansehen', allUrl(cfg, data), 'gl4-cta--ghost') + '</div>'
      );
    },

    v2: function (cfg, data) {
      var count = data.count ? data.count + ' ' : '';
      return (
        '<button class="gl4-close" type="button" data-gl4-close aria-label="' + escapeHtml(cfg.close_label || 'Schließen') + '">×</button>' +
        '<div class="gl4-v2__head">' +
          '<span class="gl4-v2__num">' + formatScore(data.rating) + '</span>' +
          '<div><h3 class="gl4-v2__headline">' + escapeHtml(cfg.v2_title || 'Das sagen unsere Kunden') + '</h3>' +
          '<p class="gl4-v2__meta">' + starsHTML(data.rating) + ' &nbsp;' + count + escapeHtml(cfg.reviews_word || 'Google-Bewertungen') + '</p></div>' +
          '<span class="gl4-v2__cta">' + ctaHTML(cfg.v2_cta_label || 'Bewerten', writeUrl(cfg)) + '</span>' +
        '</div>' +
        '<div class="gl4-v2__track" data-gl4-track>' +
          data.reviews.map(function (r) {
            return (
              '<article class="gl4-v2__card"><div class="gl4-v2__who">' + avatarHTML(r.name, true) +
              '<div><div class="gl4-v2__name">' + escapeHtml(r.name) + '</div>' +
              (r.when ? '<div class="gl4-v2__when">' + escapeHtml(r.when) + '</div>' : '') + '</div>' +
              '<span class="gl4-v2__source">' + LOGO + '</span></div>' +
              starsHTML(r.rating) + '<p>' + escapeHtml(r.text) + '</p></article>'
            );
          }).join('') +
        '</div>' +
        '<div class="gl4-v2__dots">' +
          data.reviews.map(function (_, i) { return '<i class="' + (i === 0 ? 'is-active' : '') + '" data-gl4-dot="' + i + '"></i>'; }).join('') +
        '</div>'
      );
    },

    v3: function (cfg, data) {
      var bars = buildBars(cfg);
      var count = data.count ? data.count + ' ' : '';
      return (
        '<button class="gl4-close" type="button" data-gl4-close aria-label="' + escapeHtml(cfg.close_label || 'Schließen') + '">×</button>' +
        '<aside class="gl4-v3__aside">' + logoHTML(26) +
          '<div class="gl4-v3__num">' + formatScore(data.rating) + '</div>' + starsHTML(data.rating, 'gl4-stars--lg') +
          '<p class="gl4-v3__meta">' + escapeHtml((cfg.v3_meta_before || 'basierend auf ') + count + (cfg.v3_meta_after || 'Bewertungen')) + '</p>' +
          (bars ? '<div class="gl4-v3__bars">' + bars + '</div>' : '') +
          ctaHTML(cfg.cta_label || 'Bewertung schreiben', writeUrl(cfg)) +
        '</aside>' +
        '<div class="gl4-v3__main">' +
          '<h3 class="gl4-v3__title">' + escapeHtml(cfg.v3_title || 'Kundenstimmen') + '</h3>' +
          '<div class="gl4-v3__list gl4-scroll">' +
            data.reviews.map(function (r) {
              return (
                '<article class="gl4-v3__item"><div class="gl4-v3__top">' + avatarHTML(r.name) +
                '<div><div class="gl4-v3__name">' + escapeHtml(r.name) + '</div>' +
                (r.when ? '<div class="gl4-v3__when">' + escapeHtml(r.when) + '</div>' : '') + '</div>' +
                '<span class="gl4-v3__source">' + starsHTML(r.rating) + '</span></div>' +
                '<p class="gl4-v3__text">' + escapeHtml(r.text) + '</p></article>'
              );
            }).join('') +
          '</div>' +
        '</div>'
      );
    },

    v4: function (cfg, data) {
      var count = data.count ? data.count + ' ' : '';
      return (
        '<div class="gl4-v4__head"><button class="gl4-close" type="button" data-gl4-close aria-label="' + escapeHtml(cfg.close_label || 'Schließen') + '">×</button>' +
          '<span class="gl4-v4__brand">' + LOGO + escapeHtml(cfg.panel_title || 'Google Bewertungen') + '</span>' +
          '<div class="gl4-v4__num">' + formatScore(data.rating) + '</div>' + starsHTML(data.rating, 'gl4-stars--lg gl4-stars--white') +
          '<p class="gl4-v4__meta">' + count + escapeHtml(cfg.reviews_word || 'Bewertungen') + '</p>' +
        '</div>' +
        '<div class="gl4-v4__list gl4-scroll">' +
          data.reviews.map(function (r) {
            return (
              '<article class="gl4-v4__item"><div class="gl4-v4__top">' + avatarHTML(r.name) +
              '<div><div class="gl4-v4__name">' + escapeHtml(r.name) + '</div>' +
              (r.when ? '<div class="gl4-v4__when">' + escapeHtml(r.when) + '</div>' : '') + '</div>' +
              '<span class="gl4-v4__source">' + starsHTML(r.rating, 'gl4-stars--dark') + '</span></div>' +
              '<p class="gl4-v4__text">' + escapeHtml(r.text) + '</p></article>'
            );
          }).join('') +
        '</div>' +
        '<div class="gl4-v4__foot">' + ctaHTML(cfg.v4_cta_label || 'Jetzt selbst bewerten', writeUrl(cfg), 'gl4-cta--dark') + '</div>'
      );
    },

    v5: function (cfg, data) {
      var title = (cfg.v5_title || '{count} Kunden bewerten {name} mit {score} von 5')
        .replace('{count}', data.count || data.reviews.length)
        .replace('{score}', formatScore(data.rating))
        .replace('{name}', escapeHtml(cfg.business_name || ''));
      return (
        '<button class="gl4-close" type="button" data-gl4-close aria-label="' + escapeHtml(cfg.close_label || 'Schließen') + '">×</button>' +
        '<div class="gl4-v5__eyebrow">' + LOGO + ' ' + escapeHtml(cfg.panel_title || 'Google Bewertungen') + '</div>' +
        '<h3 class="gl4-v5__title">' + title + '</h3>' +
        '<div class="gl4-v5__rule"></div>' +
        '<div class="gl4-v5__list gl4-scroll">' +
          data.reviews.map(function (r) {
            return (
              '<article class="gl4-v5__item"><p class="gl4-v5__quote">„' + escapeHtml(r.text) + '“</p>' +
              '<div class="gl4-v5__by">' + avatarHTML(r.name, true) + '<span><b>' + escapeHtml(r.name) + '</b>' +
              (r.when ? ' · ' + escapeHtml(r.when) : '') + '</span>' +
              '<span style="margin-left:auto">' + starsHTML(r.rating) + '</span></div></article>'
            );
          }).join('') +
        '</div>' +
        '<div class="gl4-v5__foot"><span class="gl4-v5__score"><b>' + formatScore(data.rating) + '</b> / 5 · ' +
        (data.count || data.reviews.length) + ' ' + escapeHtml(cfg.reviews_word || 'Bewertungen') + '</span>' +
        ctaHTML(cfg.cta_label || 'Bewertung schreiben', writeUrl(cfg)) + '</div>'
      );
    }
  };

  /* Optionale Sternverteilung für v3 – nur rendern, wenn echte Werte da sind */
  function buildBars(cfg) {
    var keys = [5, 4, 3, 2, 1];
    var counts = keys.map(function (k) { return Number(cfg['dist_' + k]) || 0; });
    var total = counts.reduce(function (a, b) { return a + b; }, 0);
    if (!total) return '';
    return keys
      .map(function (k, i) {
        var pct = Math.round((counts[i] / total) * 100);
        return (
          '<div class="gl4-v3__bar"><span>' + k + '</span><i><b style="width:' + pct + '%"></b></i><span>' + counts[i] + '</span></div>'
        );
      })
      .join('');
  }

  function renderState(kind, cfg) {
    if (kind === 'loading') {
      return (
        '<div class="gl4-state" role="status">' +
          '<div class="gl4-state__logo">' + LOGO + '</div>' +
          '<div class="gl4-spinner" aria-hidden="true"></div>' +
          '<p class="gl4-state__title">' + escapeHtml(cfg.loading_label || 'Bewertungen werden geladen …') + '</p>' +
        '</div>'
      );
    }
    return (
      '<div class="gl4-state" role="alert">' +
        '<div class="gl4-state__logo">' + LOGO + '</div>' +
        '<p class="gl4-state__title">' + escapeHtml(cfg.error_label || 'Bewertungen konnten gerade nicht geladen werden.') + '</p>' +
        '<button class="gl4-retry" type="button" data-gl4-retry>' + escapeHtml(cfg.retry_label || 'Erneut versuchen') + '</button>' +
      '</div>'
    );
  }

  /* -------------------------------------------------------------- Badge bauen */

  function buildBadgeHTML(cfg, data) {
    return (
      '<button class="gl4-badge" type="button" data-gl4-toggle aria-expanded="false" aria-haspopup="dialog" aria-controls="' + cfg._id + '-overlay">' +
        (cfg.dismissible !== false
          ? '<span class="gl4-badge__dismiss" data-gl4-dismiss role="button" tabindex="0" aria-label="' + escapeHtml(cfg.dismiss_label || 'Badge ausblenden') + '">×</span>'
          : '') +
        '<span class="gl4-badge__logo">' + LOGO + '</span>' +
        (cfg.badge_label ? '<span class="gl4-badge__label">' + escapeHtml(cfg.badge_label) + '</span>' : '') +
        '<span class="gl4-badge__row">' +
          '<span class="gl4-badge__num">' + formatScore(data.rating) + '</span>' +
          starsHTML(data.rating) +
        '</span>' +
      '</button>'
    );
  }

  function buildOverlayHTML(cfg) {
    return (
      '<div class="gl4-overlay" id="' + cfg._id + '-overlay" data-gl4-overlay role="dialog" aria-modal="true" aria-label="' +
        escapeHtml(cfg.panel_title || 'Google Bewertungen') + '">' +
        '<div class="gl4-overlay__inner" data-gl4-inner></div>' +
        '<p class="gl4-overlay__hint">' + escapeHtml(cfg.hint_label || 'Klick auf den Hintergrund oder ESC schließt das Overlay') + '</p>' +
      '</div>'
    );
  }

  /* ------------------------------------------------------------ Interaktion */

  function init(root) {
    if (root.dataset.gl4Init === 'true') return;
    root.dataset.gl4Init = 'true';

    var cfg = readConfig(root);
    var state = { data: null, kind: 'loading', open: false };

    /* Übernahme der Design-Farben aus dem Root für Avatar/Score-Fallbacks */
    cfg._id = 'gl4-' + Math.random().toString(36).slice(2, 9);

    /* Badge + Overlay in den Root setzen */
    root.innerHTML = buildBadgeHTML(cfg, { rating: 0 }) + buildOverlayHTML(cfg);
    var badge = root.querySelector('[data-gl4-toggle]');
    var overlay = root.querySelector('[data-gl4-overlay]');
    var inner = root.querySelector('[data-gl4-inner]');
    var dismiss = root.querySelector('[data-gl4-dismiss]');

    var storageKey = 'gl4-dismissed-' + (cfg.place_id || 'default');

    function open() {
      state.open = true;
      overlay.classList.add('is-open');
      root.classList.add('gl4--open');
      badge.setAttribute('aria-expanded', 'true');
      renderPanel();
      document.addEventListener('keydown', onKeydown);
      document.addEventListener('click', onOutside, true);
      var closeBtn = overlay.querySelector('[data-gl4-close]');
      if (closeBtn) closeBtn.focus({ preventScroll: true });
    }

    function close() {
      state.open = false;
      overlay.classList.remove('is-open');
      root.classList.remove('gl4--open');
      badge.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('click', onOutside, true);
      badge.focus({ preventScroll: true });
    }

    function onKeydown(e) {
      if (e.key === 'Escape') close();
    }

    function onOutside(e) {
      if (!root.contains(e.target)) close();
    }

    function renderPanel() {
      if (state.kind === 'loading') {
        inner.innerHTML = renderState('loading', cfg);
        return;
      }
      if (state.kind === 'error' || !state.data) {
        inner.innerHTML = renderState('error', cfg);
        return;
      }
      var fn = RENDER[cfg.variant || 'v1'];
      var host = document.createElement('div');
      host.className = 'gl4-' + (cfg.variant || 'v1');
      host.innerHTML = fn(cfg, state.data);
      /* Leere Bewertungsliste (z. B. Demo-Key ohne Reviews) sichtbar machen,
         statt ein leeres Panel zu zeigen */
      if (!state.data.reviews || !state.data.reviews.length) {
        var list = host.querySelector('.gl4-scroll') || host.querySelector('[data-gl4-track]');
        if (list) {
          list.innerHTML = '<p class="gl4-empty">' +
            escapeHtml(cfg.empty_label || 'Noch keine Google-Bewertungen verfügbar.') +
            '</p>';
        }
      }
      inner.innerHTML = '';
      inner.appendChild(host);
    }

    badge.addEventListener('click', function (e) {
      if (dismiss && dismiss.contains(e.target)) return;
      open();
    });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.closest('[data-gl4-close]')) close();
    });

    if (dismiss) {
      var hide = function (e) {
        e.stopPropagation();
        root.classList.add('gl4--dismissed');
        /* Immer für die gesamte Browsersitzung ausblenden … */
        rememberSession(storageKey);
        /* … zusätzlich optional dauerhaft (remember_days) */
        remember(storageKey, cfg.remember_days || 0);
      };
      dismiss.addEventListener('click', hide);
      dismiss.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hide(e); }
      });
    }

    inner.addEventListener('click', function (e) {
      var retry = e.target.closest('[data-gl4-retry]');
      if (retry) {
        state.kind = 'loading';
        renderPanel();
        load();
      }
    });

    /* Scroll-Punkte in Variante 2 synchron halten */
    inner.addEventListener('scroll', function (e) {
      var track = e.target.closest && e.target.closest('[data-gl4-track]');
      if (!track) return;
      var dots = inner.querySelectorAll('[data-gl4-dot]');
      if (!dots.length) return;
      var card = track.querySelector('.gl4-v2__card');
      if (!card) return;
      var index = Math.round(track.scrollLeft / (card.offsetWidth + 14));
      dots.forEach(function (dot, i) { dot.classList.toggle('is-active', i === index); });
    }, true);

    /* ------------------------------------------------------- Daten laden */

    function load() {
      var fallback = parseFallback(cfg.fallback_reviews);

      /* In dieser Browsersitzung bereits per X ausgeblendet?
         Dann gar nicht erst laden/anzeigen. */
      if (isSessionDismissed(storageKey)) {
        root.classList.add('gl4--dismissed');
        return;
      }

      if (cfg.hide_on_mobile && window.innerWidth <= MOBILE) {
        /* Badge auf Mobil ausblenden – kein Laden nötig */
        root.style.display = 'none';
        return;
      }

      if (!cfg.api_key || !cfg.place_id) {
        if (fallback) {
          finish(fallback, true);
        } else {
          fail();
        }
        showBadge();
        return;
      }

      fetchPlaceData(cfg)
        .then(function (result) {
          var data = normalizeReviews((result && result.place) || {}, Number(cfg.max_reviews) || 8);
          finish(data, false);
        })
        .catch(function () {
          if (fallback) {
            finish(fallback, true);
          } else {
            fail();
          }
        })
        .then(showBadge);
    }

    function finish(data, isFallback) {
      state.data = data;
      state.kind = 'data';
      var score = Number(data.rating) || 0;
      var num = badge.querySelector('.gl4-badge__num');
      if (num) num.textContent = formatScore(score);
      /* Sterne im Badge aktualisieren */
      var starsBox = badge.querySelector('.gl4-badge__row .gl4-stars');
      if (starsBox) starsBox.outerHTML = starsHTML(score);
      if (state.open) renderPanel();
    }

    function fail() {
      state.kind = 'error';
      if (state.open) renderPanel();
    }

    function showBadge() {
      var delay = (Number(cfg.delay) || 0) * 1000;
      if (isSessionDismissed(storageKey) || isDismissed(storageKey)) {
        root.classList.add('gl4--dismissed');
      } else if (delay > 0) {
        window.setTimeout(function () { root.classList.add('gl4--ready'); }, delay);
      } else {
        root.classList.add('gl4--ready');
      }
    }

    load();
  }

  /* localStorage kann im Safari-Privatmodus werfen – darf das Widget nicht mitreißen */
  function isDismissed(key) {
    try {
      var until = window.localStorage.getItem(key);
      if (!until) return false;
      if (Date.now() > Number(until)) {
        window.localStorage.removeItem(key);
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function remember(key, days) {
    if (!days) return;
    try {
      window.localStorage.setItem(key, String(Date.now() + days * 86400000));
    } catch (e) {
      /* kein Speicher verfügbar – Badge kommt beim nächsten Aufruf wieder */
    }
  }

  /* Sitzungsbezogenes Ausblenden (X geklickt): gilt für alle Seiten des
     aktuellen Tabs, bis der Tab geschlossen wird (sessionStorage). */
  function isSessionDismissed(key) {
    try {
      return window.sessionStorage.getItem(key) === '1';
    } catch (e) {
      return false;
    }
  }

  function rememberSession(key) {
    try {
      window.sessionStorage.setItem(key, '1');
    } catch (e) {
      /* kein Speicher verfügbar – Widget erscheint beim nächsten Seitenaufruf wieder */
    }
  }

  /* --------------------------------------------------------------- Bootstrap */

  function initAll(scope) {
    (scope || document).querySelectorAll('[data-gl4-root]').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initAll(); });
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', function (e) { initAll(e.target); });

  window.GoogleReviewsLive = { init: initAll };
})();
