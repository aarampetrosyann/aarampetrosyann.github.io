/* ============================================================
   GAME.JS
   Start screen for every game page (games/<game>/index.html):
   - sizes the card's grid of squares and draws the mosaic in five
     shades of the game's color,
   - opens and closes the How to play window, building it in from
     shades of white,
   - and, until the boards exist, answers Play with "Soon".
   ============================================================ */
(function () {
  var card = document.querySelector(".game-card");
  var canvas = card.querySelector(".mosaic");
  var CELL = 58;                 // target square size in px
  var ROWS = 10;                 // rows the layout uses
  var MIX = [[255, 0.22], [255, 0.11], [0, 0], [0, 0.06], [0, 0.12]];

  // Colors come from the card's --game, --game-ink and the shared
  // --game-button-ink, which point at the tokens in styles.css.
  function hexRGB(name, el) {
    var h = getComputedStyle(el || card).getPropertyValue(name).trim();
    return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); });
  }
  var base = hexRGB("--game");
  var shades = MIX.map(function (m) {
    return "rgb(" + base.map(function (c) { return Math.round(c + (m[0] - c) * m[1]); }).join(",") + ")";
  });
  var picks = [];
  function pick(i) {
    while (picks.length <= i) picks.push(Math.floor(Math.random() * shades.length));
    return shades[picks[i]];
  }

  // Content is placed on a grid of small squares. Where there's
  // room, the mosaic uses big squares (2 x 2 small ones), with an
  // odd number across so the logo can sit in the center square:
  // 7 x 5 on a desktop. Narrow screens keep the small squares.
  function layout() {
    var w = card.clientWidth;
    var across = w / (CELL * 2);
    var big = Math.round(across);
    if (big % 2 === 0) big += across > big ? 1 : -1;
    var bigMode = big >= 5;
    var cols = bigMode ? big * 2 : Math.max(6, 2 * Math.round(w / CELL / 2));
    var cell = w / cols;
    var rows = ROWS;
    var unit = bigMode ? 2 : 1;
    var u = cell * unit;
    card.classList.toggle("big", bigMode);
    card.style.setProperty("--cell", cell + "px");
    card.style.setProperty("--u", u + "px");
    card.style.setProperty("--cols", cols);
    card.style.setProperty("--rows", rows);

    var dc = cols / unit, dr = rows / unit;
    var h = rows * cell, dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    for (var r = 0; r < dr; r++) {
      for (var c = 0; c < dc; c++) {
        var x0 = Math.round(c * u), x1 = Math.round((c + 1) * u);
        var y0 = Math.round(r * u), y1 = Math.round((r + 1) * u);
        ctx.fillStyle = pick(r * dc + c);
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }
  }

  var lastW = 0;
  new ResizeObserver(function () {
    if (card.clientWidth !== lastW) { lastW = card.clientWidth; layout(); }
  }).observe(card);

  // How to play window: the help icon opens it, the close icon or
  // Esc closes it, and focus goes back to the help icon.
  var helpBtn = card.querySelector(".help-btn");
  var help = card.querySelector(".help");
  var buildCanvas = help.querySelector(".build");
  var buildFrame = null;

  // Builds the window: each square appears at a random moment in a
  // random shade of white, then fades to pure white at a random
  // moment, after which the content fades in. Shades are mixed from
  // the white and ink tokens in styles.css.
  var APPEAR = 280, SETTLE = 220, FADE = 200;   // ms
  var WHITE_MIX = [0, 0.04, 0.08, 0.12, 0.16];   // amount of near-black
  function build() {
    cancelAnimationFrame(buildFrame);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      help.classList.remove("building");
      return;
    }
    var white = hexRGB("--game-button-ink"), ink = hexRGB("--game-ink");
    var cell = parseFloat(card.style.getPropertyValue("--u"));
    var w = help.clientWidth, h = help.clientHeight;
    var cols = Math.round(w / cell), rows = Math.ceil(h / cell);
    var dpr = window.devicePixelRatio || 1;
    buildCanvas.width = Math.round(w * dpr);
    buildCanvas.height = Math.round(h * dpr);
    var ctx = buildCanvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var squares = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        squares.push({
          x0: Math.round(c * cell), x1: Math.round((c + 1) * cell),
          y0: Math.round(r * cell), y1: Math.round((r + 1) * cell),
          shade: WHITE_MIX[Math.floor(Math.random() * WHITE_MIX.length)],
          appear: Math.random() * APPEAR,
          settle: APPEAR + Math.random() * SETTLE
        });
      }
    }
    var END = APPEAR + SETTLE + FADE;
    help.classList.add("building");
    var start = performance.now();
    (function frame(now) {
      var t = now - start;
      ctx.clearRect(0, 0, w, h);
      squares.forEach(function (q) {
        if (t < q.appear) return;
        var k = Math.min(1, Math.max(0, (t - q.settle) / FADE));
        var mix = q.shade * (1 - k);
        ctx.fillStyle = "rgb(" + white.map(function (v, i) {
          return Math.round(v + (ink[i] - v) * mix);
        }).join(",") + ")";
        ctx.fillRect(q.x0, q.y0, q.x1 - q.x0, q.y1 - q.y0);
      });
      if (t < END) {
        buildFrame = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, w, h);
        help.classList.remove("building");
      }
    })(start);
  }

  function setHelp(open) {
    help.hidden = !open;
    helpBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) build();
    else cancelAnimationFrame(buildFrame);
    (open ? help.querySelector(".close") : helpBtn).focus();
  }
  helpBtn.addEventListener("click", function () { setHelp(true); });
  help.querySelector(".close").addEventListener("click", function () { setHelp(false); });
  help.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setHelp(false);
  });
  layout();

  // Placeholder until the board exists.
  document.getElementById("setup").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = e.target.querySelector(".play");
    btn.textContent = "Soon";
    setTimeout(function () { btn.textContent = "Play"; }, 1500);
  });
})();
