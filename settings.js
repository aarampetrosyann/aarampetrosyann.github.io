/* ============================================================
   SETTINGS.JS
   Holds the site preferences and saves them in the browser:

     theme    light (default) or dark
     motion   on (default) or off, which kills the hover scramble

   Loaded in <head> on purpose, so the saved theme is applied
   before the page paints and there's no flash of the wrong one.

   The controls themselves are drawn inside the nav hover panel
   by navpanel.js, which reads window.SiteSettings below. On
   touch screens there is no hover panel, so this file falls back
   to a small popover hung off the [...] tab.
   ============================================================ */
(function () {
  var root = document.documentElement;

  var DEFS = [
    { key: "theme",  label: "Theme",        options: [
      { value: "dark", label: "Dark" }, { value: "light", label: "Light" }] },
    { key: "motion", label: "Hover effect", options: [
      { value: "on", label: "On" }, { value: "off", label: "Off" }] }
  ];
  var DEFAULTS = { theme: "light", motion: "on" };
  var state = {};

  function read(key) {
    try { return localStorage.getItem("site-" + key); }
    catch (e) { return null; }
  }
  function save(key, value) {
    try { localStorage.setItem("site-" + key, value); } catch (e) {}
  }

  for (var i = 0; i < DEFS.length; i++) {
    var k = DEFS[i].key;
    state[k] = read(k) || DEFAULTS[k];
    root.setAttribute("data-" + k, state[k]);
  }

  var listeners = [];

  window.SiteSettings = {
    defs: DEFS,
    get: function (key) { return state[key]; },
    set: function (key, value) {
      state[key] = value;
      root.setAttribute("data-" + key, value);
      save(key, value);
      for (var j = 0; j < listeners.length; j++) listeners[j](key, value);
    },
    onChange: function (fn) { listeners.push(fn); }
  };

  /* ---- touch fallback: a popover, since there's no hover panel ---- */
  if (window.matchMedia("(hover: hover)").matches) return;

  function buildFallback() {
    var btn = document.getElementById("settings-btn");
    if (!btn) return;

    var panel = document.createElement("div");
    panel.className = "settings-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Site settings");
    panel.hidden = true;

    var html = "";
    for (var i = 0; i < DEFS.length; i++) {
      html += '<p class="settings-row-label">' + DEFS[i].label + "</p>";
      html += '<div class="settings-seg" data-pref="' + DEFS[i].key + '">';
      for (var j = 0; j < DEFS[i].options.length; j++) {
        html += '<button type="button" data-value="' + DEFS[i].options[j].value + '">' +
                DEFS[i].options[j].label + "</button>";
      }
      html += "</div>";
    }
    panel.innerHTML = html;
    document.body.appendChild(panel);

    function sync() {
      var segs = panel.querySelectorAll(".settings-seg");
      for (var a = 0; a < segs.length; a++) {
        var pref = segs[a].getAttribute("data-pref");
        var bs = segs[a].querySelectorAll("button");
        for (var b = 0; b < bs.length; b++) {
          bs[b].setAttribute("aria-pressed",
            bs[b].getAttribute("data-value") === state[pref] ? "true" : "false");
        }
      }
    }

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      panel.hidden = !panel.hidden;
      btn.setAttribute("aria-expanded", panel.hidden ? "false" : "true");
    });
    panel.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      window.SiteSettings.set(b.parentNode.getAttribute("data-pref"),
                              b.getAttribute("data-value"));
      sync();
    });
    document.addEventListener("click", function (e) {
      if (panel.hidden || panel.contains(e.target) || btn.contains(e.target)) return;
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    });
    sync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildFallback);
  } else {
    buildFallback();
  }
})();
