/* DealHunters — lógica del cliente. Sin dependencias ni terceros. Todo el contenido dinámico se crea con textContent (sin HTML inyectado). */
(function () {
  "use strict";
  var body = document.body;
  var ROOT = body.dataset.root || "./";
  var LANG = body.dataset.lang || "en";
  var PAGE = body.dataset.page || "";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
    sget: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    sset: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ok */ } }
  };
  var I = {};
  try { I = JSON.parse(($("#dh-i18n") || {}).textContent || "{}"); } catch (e) { I = {}; }

  /* ---------- utilidades ---------- */
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function okUrl(u) { try { return new URL(u).protocol === "https:"; } catch (e) { return false; } }
  function fmt(v, cur) {
    var n = Number(v), d = Number.isInteger(n) ? 0 : 2;
    try { return new Intl.NumberFormat("en-US", { style: "currency", currency: cur || "USD", minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
    catch (e) { return String(n); }
  }
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function tokens(s) { return norm(s).split(/[^a-z0-9À-￿]+/).filter(function (t) { return t.length > 0; }); }
  function toast(msg) {
    var t = el("div", "toast", msg); t.setAttribute("role", "status"); document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }
  var catPromise = null;
  function catalog() {
    if (!catPromise) {
      catPromise = fetch(ROOT + "offers.public.json", { credentials: "omit" }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
    }
    return catPromise;
  }
  function matches(o, q) {
    var hay = norm(o.title + " " + o.store);
    return tokens(q).every(function (t) { return hay.indexOf(t) > -1; });
  }

  /* ---------- idioma ---------- */
  var LK = "dh_lang";
  function bestLang(list) {
    var prefs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ""];
    for (var i = 0; i < prefs.length; i++) {
      var p = String(prefs[i] || "").toLowerCase().split("-")[0];
      if (list.indexOf(p) > -1) return p;
    }
    return null;
  }
  if (body.dataset.redirect) {
    var avail = (body.dataset.langs || "").split(",");
    var saved = store.get(LK);
    var target = (saved && avail.indexOf(saved) > -1) ? saved : (bestLang(avail) || avail[0]);
    location.replace(target + "/" + location.search + location.hash);
    return;
  }
  var langMenu = $("#lang-menu");
  $$("#lang-menu a[data-lang]").forEach(function (a) {
    a.addEventListener("click", function () { store.set(LK, a.dataset.lang); });
  });
  document.addEventListener("click", function (ev) { if (langMenu && langMenu.open && !langMenu.contains(ev.target)) langMenu.open = false; });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && langMenu && langMenu.open) { langMenu.open = false; } });
  (function langBanner() {
    var bar = $("#langbar");
    if (!bar || store.get(LK) || store.sget("dh_lang_x") || !I.langs) return;
    var best = bestLang(I.langs);
    if (!best || best === LANG) return;
    var link = $('#lang-menu a[data-lang="' + best + '"]');
    if (!link) return;
    $("#langbar-text").textContent = String(I.lang_suggest || "").replace("{lang}", (I.lang_names || {})[best] || best);
    var go = $("#langbar-go"); go.textContent = I.lang_switch || "OK"; go.href = link.href;
    go.addEventListener("click", function () { store.set(LK, best); });
    $("#langbar-x").addEventListener("click", function () { store.sset("dh_lang_x", "1"); bar.hidden = true; });
    bar.hidden = false;
  })();

  /* ---------- imágenes rotas ---------- */
  function swapImg(img) {
    if (!img.parentNode) return;
    var ph = el("span", "ph", "🛍️");
    img.replaceWith(ph);
  }
  function guard(img) {
    if (img.dataset.g) return; img.dataset.g = "1";
    if (img.complete && !img.naturalWidth) return swapImg(img);
    img.addEventListener("error", function () { swapImg(img); });
    img.addEventListener("load", function () { if (img.naturalWidth < 40) swapImg(img); });
  }
  function guardAll(root) { $$(".media img, .tile img, .spot-img img, .arow img, .pal-row img", root).forEach(guard); }
  guardAll();

  /* ---------- favoritos ---------- */
  var FK = "dh_favs";
  function favs() { try { var a = JSON.parse(store.get(FK) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function setFavs(a) { store.set(FK, JSON.stringify(a.slice(0, 500))); paintFavs(); }
  function paintFavs() {
    var f = favs(), badge = $("#fav-count");
    if (badge) { badge.textContent = f.length; badge.hidden = !f.length; }
    $$("[data-fav]").forEach(function (b) {
      var on = f.indexOf(b.dataset.fav) > -1;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      var label = on ? I.fav_remove : I.fav_add;
      var span = $("span", b);
      if (span) span.textContent = label; else b.setAttribute("aria-label", label);
    });
  }
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-fav]");
    if (!b) return;
    ev.preventDefault();
    var id = b.dataset.fav, f = favs(), i = f.indexOf(id);
    if (i > -1) f.splice(i, 1); else f.unshift(id);
    setFavs(f);
    if (PAGE === "favs" && i > -1) { var c = b.closest(".card"); if (c) c.remove(); if (!$$("#grid .card").length) $("#fav-empty").hidden = false; }
  });
  window.addEventListener("storage", paintFavs);

  /* ---------- tarjeta (misma estructura que la del servidor) ---------- */
  function card(o) {
    var c = el("article", "card"); c.dataset.id = o.id;
    var href = ROOT + LANG + "/deal/" + encodeURIComponent(o.id) + "/";
    var m = el("a", "media"); m.href = href; m.tabIndex = -1; m.setAttribute("aria-hidden", "true");
    if (o.image && okUrl(o.image)) {
      var im = el("img"); im.src = o.image; im.alt = ""; im.loading = "lazy"; im.decoding = "async"; im.referrerPolicy = "no-referrer"; m.appendChild(im);
    } else { m.appendChild(el("span", "ph", (I.icons && I.icons[o.niche]) || "🛍️")); }
    if (o.discount >= 5) m.appendChild(el("span", "pill disc", "-" + o.discount + "%"));
    m.appendChild(el("span", "pill store", o.store));
    c.appendChild(m);
    var h = el("button", "heart"); h.type = "button"; h.dataset.fav = o.id; h.setAttribute("aria-pressed", "false"); h.setAttribute("aria-label", I.fav_add || "Save");
    h.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/></svg>';
    c.appendChild(h);
    var b = el("div", "cbody");
    var h3 = el("h3"); var a = el("a", "", o.title); a.href = href; h3.appendChild(a); b.appendChild(h3);
    var pr = el("div", "price"); pr.appendChild(el("b", "", fmt(o.price, o.currency)));
    if (o.discount) pr.appendChild(el("s", "", fmt(o.old_price, o.currency)));
    b.appendChild(pr);
    if (okUrl(o.url)) {
      var buy = el("a", "buy", I.view_deal || "View"); buy.href = o.url; buy.target = "_blank"; buy.rel = "sponsored nofollow noopener noreferrer"; b.appendChild(buy);
    }
    c.appendChild(b);
    return c;
  }

  /* ---------- paleta de búsqueda ---------- */
  var pal = $("#palette"), palQ = $("#pal-q"), palRes = $("#pal-res"), palSel = -1;
  function palOpen() {
    if (!pal) return;
    if (typeof pal.showModal === "function") { if (!pal.open) pal.showModal(); } else { pal.setAttribute("open", ""); }
    palQ.value = ""; palRender(); setTimeout(function () { palQ.focus(); }, 30);
  }
  function palClose() { if (pal && pal.open) { if (pal.close) pal.close(); else pal.removeAttribute("open"); } }
  function palRow(href, title, sub, o, cls) {
    var a = el("a", "pal-row" + (cls ? " " + cls : "")); a.href = href;
    if (o) {
      if (o.image && okUrl(o.image)) { var im = el("img"); im.src = o.image; im.alt = ""; im.referrerPolicy = "no-referrer"; im.loading = "lazy"; a.appendChild(im); }
      else a.appendChild(el("span", "pi", (I.icons && I.icons[o.niche]) || "🛍️"));
    }
    var t = el("span", "pt"); t.appendChild(el("b", "", title)); if (sub) t.appendChild(el("small", "", sub)); a.appendChild(t);
    return a;
  }
  function palRender() {
    var q = palQ.value.trim();
    catalog().then(function (all) {
      if (q !== palQ.value.trim()) return;
      palRes.textContent = ""; palSel = -1;
      var list = q ? all.filter(function (o) { return matches(o, q); }) : all.slice().sort(function (a, b) { return b.discount - a.discount; });
      list = list.filter(function (o) { return o.image; }).concat(list.filter(function (o) { return !o.image; })).slice(0, 6);
      palRes.appendChild(el("div", "pal-h", I.sug_title));
      if (!list.length) palRes.appendChild(el("div", "pal-h", I.sug_none));
      list.forEach(function (o) { palRes.appendChild(palRow(ROOT + LANG + "/deal/" + encodeURIComponent(o.id) + "/", o.title, o.store + " · " + fmt(o.price, o.currency), o)); });
      if (q) {
        palRes.appendChild(palRow(ROOT + LANG + "/explore/?q=" + encodeURIComponent(q), String(I.sug_all || "").replace("{q}", q), "", null, "act"));
        palRes.appendChild(palRow(ROOT + LANG + "/ai/?q=" + encodeURIComponent(q), String(I.ask_ai_for || "").replace("{q}", q), "", null, "act"));
      }
      guardAll(palRes);
    });
  }
  if (pal) {
    $("#cmd-open").addEventListener("click", palOpen);
    $("#pal-x").addEventListener("click", palClose);
    pal.addEventListener("click", function (ev) { if (ev.target === pal) palClose(); });
    palQ.addEventListener("input", palRender);
    palQ.addEventListener("keydown", function (ev) {
      var rows = $$(".pal-row", palRes);
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault(); if (!rows.length) return;
        palSel = (palSel + (ev.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
        rows.forEach(function (r, i) { r.classList.toggle("sel", i === palSel); });
        rows[palSel].scrollIntoView({ block: "nearest" });
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        var q = palQ.value.trim();
        if (palSel > -1 && rows[palSel]) location.href = rows[palSel].href;
        else if (q) location.href = ROOT + LANG + "/explore/?q=" + encodeURIComponent(q);
      }
    });
    document.addEventListener("keydown", function (ev) {
      var tag = (ev.target && ev.target.tagName) || "";
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (ev.target && ev.target.isContentEditable);
      if ((ev.key === "/" && !typing && !ev.ctrlKey && !ev.metaKey) || ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k")) { ev.preventDefault(); palOpen(); }
    });
  }

  /* ---------- explorar ---------- */
  if (PAGE === "explore") {
    var grid = $("#grid"), PAGE_SIZE = 48, shown = PAGE_SIZE, all = [], view = [];
    var S = { q: "", cat: "", stores: [], region: "", min: "", max: "", disc: 0, sort: "new" };
    var qs = new URLSearchParams(location.search);
    S.q = (qs.get("q") || "").slice(0, 100); S.cat = qs.get("cat") || ""; S.region = qs.get("region") || "";
    S.stores = (qs.get("store") || "").split(",").filter(Boolean); S.min = qs.get("min") || ""; S.max = qs.get("max") || "";
    S.disc = parseInt(qs.get("disc") || "0", 10) || 0; S.sort = qs.get("sort") || "new";
    var exq = $("#ex-q"), fregion = $("#f-region"), fsort = $("#f-sort"), fmin = $("#f-min"), fmax = $("#f-max");
    if (fregion && window.Intl && Intl.DisplayNames) {
      try {
        var dn = new Intl.DisplayNames([LANG], { type: "region" });
        $$("option[data-r]", fregion).forEach(function (o) {
          if (o.value === "global") return;
          var n = dn.of(o.value === "uk" ? "GB" : o.value.toUpperCase()); if (n) o.textContent = n;
        });
      } catch (e) { /* navegador antiguo */ }
    }
    function syncUI() {
      exq.value = S.q;
      $$("#f-cat .chip").forEach(function (c) { c.classList.toggle("on", c.dataset.v === S.cat); });
      $$("#f-store .chip").forEach(function (c) { var on = S.stores.indexOf(c.dataset.v) > -1; c.classList.toggle("on", on); c.setAttribute("aria-pressed", on); });
      $$("#f-disc .chip").forEach(function (c) { c.classList.toggle("on", parseInt(c.dataset.v, 10) === S.disc); });
      if (fregion) fregion.value = S.region; fsort.value = S.sort; fmin.value = S.min; fmax.value = S.max;
    }
    function apply() {
      var min = parseFloat(S.min), max = parseFloat(S.max);
      view = all.filter(function (o) {
        if (S.q && !matches(o, S.q)) return false;
        if (S.cat && o.niche !== S.cat) return false;
        if (S.stores.length && S.stores.indexOf(o.store) < 0) return false;
        if (S.region && o.market !== S.region && o.market !== "global") return false;
        if (!isNaN(min) && o.price < min) return false;
        if (!isNaN(max) && o.price > max) return false;
        if (S.disc && o.discount < S.disc) return false;
        return true;
      });
      view.sort(function (a, b) {
        if (S.sort === "disc") return b.discount - a.discount;
        if (S.sort === "price") return a.price - b.price;
        return a.verified_at < b.verified_at ? 1 : -1;
      });
      draw(true); chipsActive(); urlSync();
    }
    function draw(reset) {
      if (reset) { shown = PAGE_SIZE; grid.textContent = ""; }
      var from = grid.children.length, to = Math.min(shown, view.length);
      var frag = document.createDocumentFragment();
      for (var i = from; i < to; i++) frag.appendChild(card(view[i]));
      grid.appendChild(frag); guardAll(grid); paintFavs();
      $("#count").textContent = view.length + " " + I.results;
      $("#more").hidden = to >= view.length;
      var empty = $("#ex-empty"); empty.hidden = view.length > 0;
      var ai = $("a.btn", empty); if (ai) ai.href = ROOT + LANG + "/ai/" + (S.q ? "?q=" + encodeURIComponent(S.q) : "");
    }
    function chipsActive() {
      var box = $("#active"); box.textContent = ""; var n = 0;
      function add(label, fn) { var b = el("button", "", label); b.type = "button"; b.addEventListener("click", function () { fn(); syncUI(); apply(); }); box.appendChild(b); n++; }
      if (S.q) add("“" + S.q + "”", function () { S.q = ""; });
      if (S.cat) add(I.niches[S.cat] || S.cat, function () { S.cat = ""; });
      S.stores.forEach(function (s) { add(s, function () { S.stores = S.stores.filter(function (x) { return x !== s; }); }); });
      if (S.region && fregion) add(fregion.selectedOptions[0].textContent, function () { S.region = ""; });
      if (S.min || S.max) add((S.min || "0") + " – " + (S.max || "∞") + " USD", function () { S.min = ""; S.max = ""; });
      if (S.disc) add(S.disc + "%+", function () { S.disc = 0; });
      var badge = $("#f-badge"); badge.textContent = n; badge.hidden = !n;
    }
    function urlSync() {
      var p = new URLSearchParams();
      if (S.q) p.set("q", S.q); if (S.cat) p.set("cat", S.cat); if (S.stores.length) p.set("store", S.stores.join(","));
      if (S.region) p.set("region", S.region); if (S.min) p.set("min", S.min); if (S.max) p.set("max", S.max);
      if (S.disc) p.set("disc", S.disc); if (S.sort !== "new") p.set("sort", S.sort);
      try { history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : "")); } catch (e) { /* ok */ }
    }
    var timer;
    exq.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(function () { S.q = exq.value.trim().slice(0, 100); apply(); }, 150); });
    $("#f-cat").addEventListener("click", function (ev) { var c = ev.target.closest(".chip"); if (c) { S.cat = c.dataset.v; syncUI(); apply(); } });
    var fs = $("#f-store");
    if (fs) fs.addEventListener("click", function (ev) {
      var c = ev.target.closest(".chip"); if (!c) return; var v = c.dataset.v, i = S.stores.indexOf(v);
      if (i > -1) S.stores.splice(i, 1); else S.stores.push(v); syncUI(); apply();
    });
    $("#f-disc").addEventListener("click", function (ev) { var c = ev.target.closest(".chip"); if (c) { S.disc = parseInt(c.dataset.v, 10) || 0; syncUI(); apply(); } });
    if (fregion) fregion.addEventListener("change", function () { S.region = fregion.value; apply(); });
    fsort.addEventListener("change", function () { S.sort = fsort.value; apply(); });
    [fmin, fmax].forEach(function (inp) { inp.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(function () { S.min = fmin.value; S.max = fmax.value; apply(); }, 250); }); });
    $("#f-clear").addEventListener("click", function () { S = { q: "", cat: "", stores: [], region: "", min: "", max: "", disc: 0, sort: "new" }; syncUI(); apply(); });
    $("#more").addEventListener("click", function () { shown += PAGE_SIZE; draw(false); });
    var sheet = $("#filters");
    function sheetOpen(v) { sheet.classList.toggle("open", v); body.classList.toggle("sheet", v); }
    $("#f-open").addEventListener("click", function () { sheetOpen(true); });
    $("#f-close").addEventListener("click", function () { sheetOpen(false); });
    $("#f-apply").addEventListener("click", function () { sheetOpen(false); window.scrollTo(0, 0); });
    document.addEventListener("click", function (ev) { if (body.classList.contains("sheet") && !sheet.contains(ev.target) && !ev.target.closest("#f-open")) sheetOpen(false); });
    syncUI();
    catalog().then(function (d) { all = d; apply(); });
  }

  /* ---------- guardadas ---------- */
  if (PAGE === "favs") {
    catalog().then(function (all) {
      var ids = favs(), grid = $("#grid");
      var map = {}; all.forEach(function (o) { map[o.id] = o; });
      ids.forEach(function (id) { if (map[id]) grid.appendChild(card(map[id])); });
      guardAll(grid); paintFavs();
      $("#fav-empty").hidden = grid.children.length > 0;
    });
  }

  /* ---------- oferta: compartir ---------- */
  var sh = $("#share-btn");
  if (sh) sh.addEventListener("click", function () {
    var data = { title: document.title, url: location.href.split("#")[0] };
    if (navigator.share) { navigator.share(data).catch(function () { /* cancelado */ }); }
    else if (navigator.clipboard) { navigator.clipboard.writeText(data.url).then(function () { toast(I.copied); }); }
  });

  /* ---------- AI Hunter ---------- */
  var form = $("#ask-form"), out = $("#ask-out");
  if (form && out && I.bot_api) {
    var qi = $("#ask-q");
    function show(nodes) { out.textContent = ""; nodes.forEach(function (n) { out.appendChild(n); }); }
    function link(cls, href, label, sub) {
      var a = el("a", cls); a.href = href; a.target = "_blank"; a.rel = "sponsored nofollow noopener noreferrer";
      a.appendChild(el("span", "", label)); if (sub) a.appendChild(el("small", "", sub)); return a;
    }
    function ask(text) {
      var q = text.trim(); if (q.length < 2) return; qi.value = q;
      var btn = $("button[type=submit]", form); btn.disabled = true;
      var th = el("p", "thinking"); th.appendChild(el("i")); th.appendChild(el("i")); th.appendChild(el("i")); th.appendChild(el("span", "", " " + I.ai_wait));
      show([th]);
      fetch(I.bot_api + "/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: q, lang: LANG }), credentials: "omit", referrerPolicy: "no-referrer" })
        .then(function (r) { if (r.status === 429) throw new Error("limit"); if (!r.ok) throw new Error("err"); return r.json(); })
        .then(function (d) {
          var nodes = [];
          if (d.kind === "unclear") return show([el("p", "meta", I.ai_unclear)]);
          if (d.kind === "travel") {
            var map = { flights: ["flights"], transfer: ["transfer"], tours: ["tours"], esim: ["esim"], other: ["flights", "tours"] };
            var keys = map[d.travel_type] || map.other;
            if (d.travel_type === "hotels") return show([el("p", "meta", I.tr_none)]);
            nodes.push(el("h4", "", I.ai_travel_title));
            var box = el("div", "alinks");
            keys.forEach(function (k) { var p = I.travel[k]; if (p && okUrl(p.url)) box.appendChild(link("alink", p.url, I["tr_" + k] || k, p.name)); });
            nodes.push(box, el("p", "meta", I.ai_travel_note));
            return show(nodes);
          }
          if (d.name) nodes.push(el("h3", "", d.name));
          nodes.push(el("h4", "", I.ai_links_title));
          var ls = el("div", "alinks");
          (d.links || []).forEach(function (l) { if (okUrl(l.url)) ls.appendChild(link("alink", l.url, l.store)); });
          nodes.push(ls, el("p", "meta", I.ai_note), el("h4", "", I.ai_offers_title));
          var offers = (d.offers || []).filter(function (o) { return okUrl(o.url); });
          if (offers.length) {
            var g = el("div", "asklist");
            offers.forEach(function (o) {
              var a = el("a", "arow"); a.href = ROOT + LANG + "/deal/" + encodeURIComponent(o.id) + "/";
              if (o.image && okUrl(o.image)) { var im = el("img"); im.src = o.image; im.alt = ""; im.referrerPolicy = "no-referrer"; a.appendChild(im); } else a.appendChild(el("span", "pi", "🛍️"));
              var t = el("div"); t.appendChild(el("b", "", o.title)); t.appendChild(el("span", "", o.store + " · " + fmt(o.price, o.currency) + (o.discount ? " · -" + o.discount + "%" : ""))); a.appendChild(t);
              g.appendChild(a);
            });
            nodes.push(g);
          } else { nodes.push(el("p", "meta", I.ai_empty)); }
          show(nodes); guardAll(out);
        })
        .catch(function (e) { show([el("p", "meta", e && e.message === "limit" ? I.ai_limit : I.ai_err)]); })
        .then(function () { btn.disabled = false; });
    }
    form.addEventListener("submit", function (ev) { ev.preventDefault(); ask(qi.value); });
    $$("#ai-chips .chip").forEach(function (c) { c.addEventListener("click", function () { ask(c.dataset.q); }); });
    var pq = new URLSearchParams(location.search).get("q");
    if (pq) ask(pq.slice(0, 120));
  }

  paintFavs();
})();
