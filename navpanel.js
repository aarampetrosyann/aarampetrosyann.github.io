/* ============================================================
   NAVPANEL.JS
   Hovering a nav tab slides a panel down from under the header.
   The panel shows the tab's name, aligned under [AP], with a
   one-line description beneath it.

   EDIT DESCRIPTIONS HERE. Keys are matched against the tab's
   text, so they stay correct on every page without editing the
   nav markup six times. A tab with no entry gets no panel.
   ============================================================ */
(function () {
  var COPY = {
    "Games":      { title: "Games",     desc: "Browser puzzles I build for fun. Free to play, nothing to install." },
    "Blog":       { title: "Blog",      desc: "Notes on software, data, and whatever else has my attention." },
    "Experience": { title: "Experience", desc: "Internships, freelance client work, and teaching." },
    "Projects":   { title: "Projects",  desc: "Things I have built, from statistical models to FPGA hardware." },
    "Contact":    { title: "Contact",   desc: "Email, GitHub, LinkedIn, and my resume." },
    "[...]":      { title: "Settings",  desc: "Switch the theme, or turn the hover effect off." }
  };

  var CLOSE_DELAY = 120; // ms of grace before closing, so small
                         // pointer wobbles between tabs don't flicker
  var BODY_HEIGHT = 132; // px of panel below the header, same for every tab

  // No hover means no way to trigger this, so don't build it at all.
  if (!window.matchMedia("(hover: hover)").matches) return;

  function build() {
    var nav = document.querySelector("nav");
    var wrap = document.querySelector(".wrap");
    if (!nav || !wrap) return;

    // Blurs the page behind the panel. Sits under both the panel
    // and the header, so those two stay sharp.
    var blur = document.createElement("div");
    blur.className = "navblur";
    document.body.appendChild(blur);

    var panel = document.createElement("div");
    panel.className = "navpanel";
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML =
      '<div class="navpanel-inner">' +
        '<p class="navpanel-title"></p>' +
        '<p class="navpanel-desc"></p>' +
        '<div class="navpanel-settings" hidden></div>' +
      '</div>';
    nav.parentNode.insertBefore(panel, nav.nextSibling);

    // The settings controls live in this panel, drawn from the
    // definitions in settings.js so the two never drift apart.
    var setsEl = panel.querySelector(".navpanel-settings");
    if (window.SiteSettings) {
      var defs = window.SiteSettings.defs;
      var html = "";
      for (var d = 0; d < defs.length; d++) {
        html += '<div class="navset-row" data-pref="' + defs[d].key + '">' +
                  '<span class="navset-label">' + defs[d].label + '</span>' +
                  '<span class="navset-opts">';
        for (var o = 0; o < defs[d].options.length; o++) {
          if (o) html += '<span class="navset-sep">|</span>';
          html += '<button type="button" data-value="' + defs[d].options[o].value + '">' +
                  defs[d].options[o].label + '</button>';
        }
        html += '</span></div>';
      }
      setsEl.innerHTML = html;

      // Bold whichever value is currently active.
      function syncSets() {
        var rows = setsEl.querySelectorAll(".navset-row");
        for (var r = 0; r < rows.length; r++) {
          var pref = rows[r].getAttribute("data-pref");
          var bs = rows[r].querySelectorAll("button");
          for (var b = 0; b < bs.length; b++) {
            bs[b].setAttribute("aria-pressed",
              bs[b].getAttribute("data-value") === window.SiteSettings.get(pref) ? "true" : "false");
          }
        }
      }
      setsEl.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        window.SiteSettings.set(b.closest(".navset-row").getAttribute("data-pref"),
                                b.getAttribute("data-value"));
        syncSets();
      });
      syncSets();
    }

    var titleEl = panel.querySelector(".navpanel-title");
    var descEl = panel.querySelector(".navpanel-desc");
    var timer = null;
    var current = null;

    // The panel is pinned to the top of the screen and slides down
    // behind the header, so pad its content past the header height.
    // The description is also capped so its line never runs under
    // the first tab in the menu.
    function place() {
      var inner = panel.querySelector(".navpanel-inner");
      inner.style.paddingTop = (nav.offsetTop + nav.offsetHeight) + "px";

      var home = nav.querySelector(".home");
      var firstTab = nav.querySelector("ul a");
      if (!home || !firstTab) return;

      var left = home.getBoundingClientRect().left;
      var tabLeft = firstTab.getBoundingClientRect().left;
      var room = tabLeft - left - 24;           // 24px of breathing room
      descEl.style.maxWidth = room > 160 ? room + "px" : "";

      // Settings rows start at the same x as the first tab, so the
      // block sits directly under Games.
      var inner2 = panel.querySelector(".navpanel-inner");
      setsEl.style.top = inner2.style.paddingTop;
      setsEl.style.left = (tabLeft - inner2.getBoundingClientRect().left) + "px";
    }

    function open(key) {
      clearTimeout(timer);
      if (current === key) return;
      current = key;
      var copy = COPY[key];
      place();
      descEl.textContent = copy.desc;
      titleEl.textContent = copy.title;
      setsEl.hidden = key !== "[...]";
      place();

      // Every tab opens to the same height, so the panel doesn't
      // jump around as you move across the menu. BODY_HEIGHT is the
      // space below the header; the header height itself varies with
      // the window, so it's measured.
      // max-height only caps a box, it doesn't fill one, so a short
      // description used to give a shorter panel. Setting min-height
      // on the content is what actually makes every tab equal.
      var inner = panel.querySelector(".navpanel-inner");
      var full = parseFloat(inner.style.paddingTop || 0) + BODY_HEIGHT;
      inner.style.minHeight = full + "px";
      panel.style.maxHeight = full + "px";

      panel.classList.add("open");
      blur.classList.add("on");
      document.body.classList.add("nav-open");   // flips the header text color
      panel.setAttribute("aria-hidden", "false");
    }

    function close() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        current = null;
        panel.style.maxHeight = "0px";
        panel.classList.remove("open");
        blur.classList.remove("on");
        document.body.classList.remove("nav-open");
        panel.setAttribute("aria-hidden", "true");
      }, CLOSE_DELAY);
    }

    var links = nav.querySelectorAll("ul a");
    for (var i = 0; i < links.length; i++) {
      (function (link) {
        var key = link.textContent.trim();
        if (!COPY[key]) return;
        if (key === "[...]") {
          link.addEventListener("click", function (e) { e.preventDefault(); open("[...]"); });
        }
        link.addEventListener("mouseenter", function () { open(key); });
        link.addEventListener("focus", function () { open(key); });
        link.addEventListener("blur", close);
      })(links[i]);
    }

    // Keep it open while the pointer is over the nav or the panel
    // itself, close once it leaves both.
    nav.addEventListener("mouseleave", close);
    panel.addEventListener("mouseenter", function () { clearTimeout(timer); });
    panel.addEventListener("mouseleave", close);

    window.addEventListener("resize", place);
    place();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
