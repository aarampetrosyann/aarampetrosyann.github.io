/* ============================================================
   GAME.JS
   Start screen for every game page (games/<game>/index.html):
   - sizes the card's grid of squares and draws the mosaic in five
     shades of the game's color,
   - opens and closes the How to play window, building it in from
     shades of white,
   - and, on Play, covers the start screen in shades of the page
     background to clear a cell for the board (a placeholder until
     the boards exist).
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
  // Build-in, shared by the How to play window and by Play: over a
  // canvas covering a region, each square appears at a random moment
  // in a random shade of a base color, then fades to the base color
  // at a random moment. Shades mix the base toward a second color.
  // Returns a function that cancels it.
  var APPEAR = 280, SETTLE = 220, FADE = 200;   // ms
  var SHADES = [0, 0.04, 0.08, 0.12, 0.16];      // amount of the second color
  function buildIn(canvas, base, toward, done) {
    var frameId = null;
    var cell = parseFloat(card.style.getPropertyValue("--u"));
    // Measured unrounded, and the last row and column run to the far
    // edge, so no sliver of what's underneath shows through.
    var box = canvas.getBoundingClientRect();
    var w = box.width, h = box.height;
    var cols = Math.round(w / cell), rows = Math.ceil(h / cell - 0.01);
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.ceil(w * dpr);
    canvas.height = Math.ceil(h * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var squares = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        squares.push({
          x0: Math.round(c * cell), x1: c === cols - 1 ? Math.ceil(w) : Math.round((c + 1) * cell),
          y0: Math.round(r * cell), y1: r === rows - 1 ? Math.ceil(h) : Math.round((r + 1) * cell),
          shade: SHADES[Math.floor(Math.random() * SHADES.length)],
          appear: Math.random() * APPEAR,
          settle: APPEAR + Math.random() * SETTLE
        });
      }
    }
    var END = APPEAR + SETTLE + FADE;
    var start = performance.now();
    (function frame(now) {
      var t = now - start;
      ctx.clearRect(0, 0, Math.ceil(w), Math.ceil(h));
      squares.forEach(function (q) {
        if (t < q.appear) return;
        var k = Math.min(1, Math.max(0, (t - q.settle) / FADE));
        var mix = q.shade * (1 - k);
        ctx.fillStyle = "rgb(" + base.map(function (v, i) {
          return Math.round(v + (toward[i] - v) * mix);
        }).join(",") + ")";
        ctx.fillRect(q.x0, q.y0, q.x1 - q.x0, q.y1 - q.y0);
      });
      if (t < END) {
        frameId = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, Math.ceil(w), Math.ceil(h));
        done();
      }
    })(start);
    return function () { cancelAnimationFrame(frameId); };
  }
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // How to play window builds in from shades of white.
  var buildCanvas = help.querySelector(".build");
  var cancelHelpBuild = function () {};
  function build() {
    cancelHelpBuild();
    if (reduceMotion.matches) { help.classList.remove("building"); return; }
    help.classList.add("building");
    cancelHelpBuild = buildIn(buildCanvas,
      hexRGB("--game-button-ink"), hexRGB("--game-ink"),
      function () { help.classList.remove("building"); });
  }

  function setHelp(open) {
    help.hidden = !open;
    helpBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) build();
    else cancelHelpBuild();
    (open ? help.querySelector(".close") : helpBtn).focus();
  }
  helpBtn.addEventListener("click", function () { setHelp(true); });
  help.querySelector(".close").addEventListener("click", function () { setHelp(false); });
  help.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setHelp(false);
  });
  layout();

  // Play: the start screen is covered square by square in shades of
  // the page background (the theme's --paper, mixed toward --ink),
  // leaving a plain cell of the grid where the board goes. Until the
  // board exists, that cell shows the chosen options and a Back button.
  var form = document.getElementById("setup");
  var cover = document.createElement("canvas");
  cover.className = "cover";
  cover.setAttribute("aria-hidden", "true");
  var board = document.createElement("div");
  board.className = "board";
  board.innerHTML =
    '<p class="board-info" aria-live="polite"></p>' +
    '<p class="board-note">The board goes here.</p>' +
    '<button class="board-back" type="button">Back</button>';
  card.appendChild(cover);
  card.appendChild(board);
  var info = board.querySelector(".board-info");
  var back = board.querySelector(".board-back");
  var cancelCover = function () {};

  function startGame() {
    var size = form.elements.size.value, level = form.elements.level.value;
    info.textContent = size + "\u00d7" + size + " \u00b7 " + level;
    card.classList.add("playing");
    back.focus();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!help.hidden) { help.hidden = true; helpBtn.setAttribute("aria-expanded", "false"); cancelHelpBuild(); }
    cancelCover();
    if (reduceMotion.matches) { startGame(); return; }
    card.classList.add("covering");
    cancelCover = buildIn(cover, hexRGB("--paper"), hexRGB("--ink"), function () {
      card.classList.remove("covering");
      startGame();
    });
  });

  back.addEventListener("click", function () {
    card.classList.remove("playing");
    form.querySelector(".play").focus();
  });
})();
