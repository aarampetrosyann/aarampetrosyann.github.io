/* ============================================================
   TAKUZU.JS
   The Takuzu board, drawn into the start screen's board area when
   Play is pressed (game.js fires "gamestart" on the card).

   Rules: fill every cell with a 0 or a 1; no three of the same
   next to each other in a row or column; every row and column has
   as many 0s as 1s; no two rows and no two columns are the same.

   Puzzles are made fresh each time: a random full solution, then
   cells are emptied one by one as long as the puzzle still has
   exactly one solution. Easier levels put some cells back.
   ============================================================ */

/* ---------- Puzzle maker and solver ----------
   A grid is a flat array of n * n cells: 0, 1, or EMPTY. */
var Takuzu = (function () {
  var EMPTY = -1;

  // Indexes of every row and every column, in order.
  function linesOf(n) {
    var lines = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) row.push(r * n + c);
      lines.push(row);
    }
    for (var c2 = 0; c2 < n; c2++) {
      var col = [];
      for (var r2 = 0; r2 < n; r2++) col.push(r2 * n + c2);
      lines.push(col);
    }
    return lines;
  }

  // Fills in every cell the rules force, in place. Returns false if
  // the grid can't be completed.
  function propagate(g, n, lines) {
    var half = n / 2, changed = true;
    function set(i, v) {
      if (g[i] === EMPTY) { g[i] = v; changed = true; return true; }
      return g[i] === v;
    }
    while (changed) {
      changed = false;
      for (var l = 0; l < lines.length; l++) {
        var idx = lines[l], c0 = 0, c1 = 0;
        for (var k = 0; k < n; k++) {
          var v = g[idx[k]];
          if (v === 0) c0++; else if (v === 1) c1++;
          if (v !== EMPTY) continue;
          var a = k >= 2 ? g[idx[k - 2]] : EMPTY, b = k >= 1 ? g[idx[k - 1]] : EMPTY;
          var d = k <= n - 2 ? g[idx[k + 1]] : EMPTY, e = k <= n - 3 ? g[idx[k + 2]] : EMPTY;
          // Two in a row on either side, or the same on both sides,
          // forces the opposite here.
          var force = EMPTY;
          if (b !== EMPTY && a === b) force = 1 - b;
          else if (d !== EMPTY && d === e) force = 1 - d;
          else if (b !== EMPTY && b === d) force = 1 - b;
          if (force !== EMPTY && !set(idx[k], force)) return false;
        }
        if (c0 > half || c1 > half) return false;
        // A line with all its 0s (or 1s) in place gets the rest.
        if (c0 === half || c1 === half) {
          var fill = c0 === half ? 1 : 0;
          for (var k2 = 0; k2 < n; k2++) {
            if (g[idx[k2]] === EMPTY) set(idx[k2], fill);
          }
        }
      }
    }
    return valid(g, n, lines);
  }

  // No three in a row, no line with too many of one digit, and no
  // two full rows (or columns) alike.
  function valid(g, n, lines) {
    return errors(g, n, lines).size === 0;
  }

  // Every cell that breaks a rule. Used both by the solver and to
  // show mistakes on the board.
  function errors(g, n, lines) {
    var bad = new Set(), half = n / 2;
    lines.forEach(function (idx) {
      var c0 = 0, c1 = 0;
      for (var k = 0; k < n; k++) {
        var v = g[idx[k]];
        if (v === 0) c0++; else if (v === 1) c1++;
        if (k >= 2 && v !== EMPTY && v === g[idx[k - 1]] && v === g[idx[k - 2]]) {
          bad.add(idx[k]); bad.add(idx[k - 1]); bad.add(idx[k - 2]);
        }
      }
      [[c0, 0], [c1, 1]].forEach(function (p) {
        if (p[0] > half) idx.forEach(function (i) { if (g[i] === p[1]) bad.add(i); });
      });
    });
    // Rows are lines 0..n-1, columns n..2n-1; compare full ones.
    [0, n].forEach(function (from) {
      for (var x = from; x < from + n; x++) {
        for (var y = x + 1; y < from + n; y++) {
          var A = lines[x], B = lines[y], same = true;
          for (var k = 0; k < n && same; k++) {
            if (g[A[k]] === EMPTY || g[A[k]] !== g[B[k]]) same = false;
          }
          if (same) { A.forEach(function (i) { bad.add(i); }); B.forEach(function (i) { bad.add(i); }); }
        }
      }
    });
    return bad;
  }

  // Counts solutions, stopping once it reaches `limit`.
  function count(grid, n, lines, limit) {
    var g = grid.slice();
    if (!propagate(g, n, lines)) return 0;
    var i = g.indexOf(EMPTY);
    if (i < 0) return 1;
    var total = 0;
    for (var v = 0; v <= 1 && total < limit; v++) {
      var h = g.slice();
      h[i] = v;
      total += count(h, n, lines, limit - total);
    }
    return total;
  }

  // One random complete solution.
  function randomSolution(grid, n, lines) {
    var g = grid.slice();
    if (!propagate(g, n, lines)) return null;
    var i = g.indexOf(EMPTY);
    if (i < 0) return g;
    var order = Math.random() < 0.5 ? [0, 1] : [1, 0];
    for (var t = 0; t < 2; t++) {
      var h = g.slice();
      h[i] = order[t];
      var done = randomSolution(h, n, lines);
      if (done) return done;
    }
    return null;
  }

  function shuffled(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Share of the board shown at the start. Hard keeps only what's
  // needed for a single answer.
  var SHOWN = { Easy: 0.5, Medium: 0.4, Hard: 0 };

  function make(n, level) {
    var lines = linesOf(n), cells = [];
    for (var i = 0; i < n * n; i++) cells.push(i);
    var blank = cells.map(function () { return EMPTY; });
    var solution = randomSolution(blank, n, lines);

    var puzzle = solution.slice();
    shuffled(cells).forEach(function (i) {
      var keep = puzzle[i];
      puzzle[i] = EMPTY;
      if (count(puzzle, n, lines, 2) !== 1) puzzle[i] = keep;
    });

    var target = Math.round(n * n * (SHOWN[level] || 0));
    var shown = puzzle.filter(function (v) { return v !== EMPTY; }).length;
    shuffled(cells).forEach(function (i) {
      if (shown < target && puzzle[i] === EMPTY) { puzzle[i] = solution[i]; shown++; }
    });
    return { n: n, puzzle: puzzle, solution: solution, lines: lines };
  }

  return { EMPTY: EMPTY, make: make, errors: errors, linesOf: linesOf, count: count };
})();

/* ---------- The board ----------
   Squares are the card's small grid squares (--cell), so the board
   lines up with the mosaic grid; on narrow screens they shrink to
   fit the width. Click or tap cycles a square: empty, 0, 1, empty.
   Arrow keys move, 0 and 1 fill, Backspace or Delete clears. */
(function () {
  var S = window.GameScreen;
  if (!S) return;
  var card = S.card, E = Takuzu.EMPTY;
  var game = null;   // the puzzle in play, its state and its elements

  // Show mistakes is remembered between visits (on unless turned off).
  var showMistakes = true;
  try { showMistakes = localStorage.getItem("takuzu-show-mistakes") !== "0"; } catch (err) {}

  // A click anywhere outside the gear or the menu closes the menu.
  document.addEventListener("click", function (e) {
    if (game && !e.target.closest(".tz-settings, .tz-menu")) setMenu(false);
  });

  var STAR = '<svg viewBox="0 -960 960 960"><path d="m233-120 65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Z"/></svg>';

  function icon(name) {
    return '<span class="material-symbols-outlined" aria-hidden="true">' + name + "</span>";
  }

  function label(i) {
    var n = game.n, r = Math.floor(i / n) + 1, c = (i % n) + 1, v = game.cur[i];
    var mark = game.check && game.check.get(i);
    return "Row " + r + ", column " + c + ": " + (v === E ? "empty" : v) +
      (game.puzzle[i] !== E ? ", given" : "") +
      (game.hints.has(i) ? ", hint" : "") +
      (mark ? ", " + mark : "");
  }

  function fit() {
    if (!game) return;
    var cell = parseFloat(card.style.getPropertyValue("--cell"));
    var size = Math.min(cell, card.clientWidth / game.n);
    game.els.board.style.setProperty("--tz", size + "px");
    // Frame and gutters scale with the squares, like the icon's.
    game.els.board.style.setProperty("--tz-gap", Math.max(3, Math.round(size * 0.08)) + "px");
  }

  function paint() {
    var bad = Takuzu.errors(game.cur, game.n, game.lines);
    game.els.cells.forEach(function (b, i) {
      var v = game.cur[i], mark = game.check && game.check.get(i);
      b.textContent = v === E ? "" : v;
      b.classList.toggle("error", showMistakes && bad.has(i) && editable(i));
      b.classList.toggle("hint", game.hints.has(i));
      b.classList.toggle("right", mark === "correct");
      b.classList.toggle("wrong", mark === "wrong");
      b.setAttribute("aria-label", label(i));
    });
    if (game.cur.indexOf(E) < 0 && bad.size === 0) solved();
  }

  // Squares the player can change: not given, not revealed by a hint.
  function editable(i) {
    return game.puzzle[i] === E && !game.hints.has(i);
  }

  function setCell(i, v) {
    if (game.done || game.paused || !editable(i)) return;
    game.cur[i] = v;
    if (game.check) game.check.delete(i);   // a changed square loses its check mark
    paint();
  }

  function focusCell(i) {
    game.els.cells.forEach(function (b, k) { b.tabIndex = k === i ? 0 : -1; });
    game.els.cells[i].focus();
  }

  function newGame(n, level, board) {
    end();
    var made = Takuzu.make(n, level);
    game = {
      n: n, level: level, lines: made.lines,
      puzzle: made.puzzle, cur: made.puzzle.slice(), solution: made.solution,
      hints: new Set(), check: null,
      // Timer: `base` ms already counted, plus time since `since`
      // while running (since is null while paused or solved).
      base: 0, since: Date.now(), paused: false, done: false, els: {}
    };

    var wrap = document.createElement("div");
    wrap.className = "tz";
    wrap.innerHTML =
      '<button class="icon-btn tz-exit" type="button" aria-label="Back to options">' + icon("arrow_back") + "</button>" +
      '<button class="icon-btn tz-again" type="button" aria-label="New puzzle" title="New puzzle" hidden>' + icon("extension") + "</button>" +
      '<button class="icon-btn tz-settings" type="button" aria-label="Settings" aria-expanded="false" aria-controls="tz-menu">' + icon("settings") + "</button>" +
      '<div class="tz-menu" id="tz-menu" role="menu" aria-label="Settings">' +
        '<button type="button" role="menuitem" class="tz-check" aria-label="Check board" title="Check board">' + icon("check") + "</button>" +
        '<button type="button" role="menuitem" class="tz-reset" aria-label="Reset board" title="Reset board">' + icon("restart_alt") + "</button>" +
        '<button type="button" role="menuitem" class="tz-hint" aria-label="Hint" title="Hint">' + icon("lightbulb") + "</button>" +
        '<button type="button" role="menuitemcheckbox" class="tz-mistakes" aria-label="Show mistakes" title="Show mistakes" aria-checked="true">' + icon("visibility") + "</button>" +
      "</div>" +
      '<div class="tz-board">' +
        // Header row right above the board: size, name, pause and time.
        '<div class="tz-head">' +
          '<p class="tz-size">' + n + "\u00d7" + n + " \u00b7 " + level + "</p>" +
          '<p class="tz-name">Takuzu</p>' +
          '<div class="tz-clock">' +
            '<button class="tz-pause" type="button" aria-label="Pause" aria-pressed="false">' + icon("pause") + "</button>" +
            '<p class="tz-timer" role="timer" aria-label="Time">0:00</p>' +
          "</div>" +
        "</div>" +
        '<div class="tz-grid" role="group" aria-label="Takuzu, ' + n + " by " + n + ", " + level + '"></div>' +
      "</div>" +
      '<div class="tz-win" role="dialog" aria-labelledby="tz-win-h" hidden>' +
        '<canvas class="build" aria-hidden="true"></canvas>' +
        // Material Symbols "star", filled, inlined as SVG.
        '<div class="tz-stars" aria-hidden="true">' + STAR + STAR + STAR + "</div>" +
        '<h2 id="tz-win-h">Solved</h2>' +
        '<p class="tz-time"></p>' +
        '<div class="tz-actions">' +
          '<button class="tz-new" type="button">New puzzle</button>' +
          '<button class="tz-back" type="button">Back to puzzle</button>' +
          '<button class="tz-options" type="button">Change options</button>' +
        "</div>" +
      "</div>";
    board.appendChild(wrap);

    var grid = wrap.querySelector(".tz-grid");
    wrap.querySelector(".tz-board").style.setProperty("--tz-n", n);
    var cells = [];
    for (var i = 0; i < n * n; i++) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tz-cell" + (game.puzzle[i] !== E ? " given" : "");
      b.dataset.i = i;
      b.tabIndex = -1;
      grid.appendChild(b);
      cells.push(b);
    }
    game.els = {
      wrap: wrap, board: wrap.querySelector(".tz-board"), grid: grid, cells: cells,
      win: wrap.querySelector(".tz-win"), timer: wrap.querySelector(".tz-timer"),
      pause: wrap.querySelector(".tz-pause"),
      settings: wrap.querySelector(".tz-settings"), menu: wrap.querySelector(".tz-menu"),
      mistakes: wrap.querySelector(".tz-mistakes")
    };
    showMistakesButton();
    game.tick = setInterval(tick, 1000);

    grid.addEventListener("click", function (e) {
      if (game.done) { if (game.els.win.hidden) openWin(false); return; }
      var b = e.target.closest(".tz-cell");
      if (!b) return;
      var i = Number(b.dataset.i), v = game.cur[i];
      focusCell(i);
      setCell(i, v === E ? 0 : v === 0 ? 1 : E);
    });
    grid.addEventListener("keydown", function (e) {
      var b = e.target.closest(".tz-cell");
      if (!b) return;
      var i = Number(b.dataset.i), r = Math.floor(i / n), c = i % n;
      var moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (moves[e.key]) {
        e.preventDefault();
        var nr = Math.min(n - 1, Math.max(0, r + moves[e.key][0]));
        var nc = Math.min(n - 1, Math.max(0, c + moves[e.key][1]));
        focusCell(nr * n + nc);
      } else if (e.key === "0" || e.key === "1") {
        setCell(i, Number(e.key));
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        setCell(i, E);
      }
    });
    wrap.querySelector(".tz-exit").addEventListener("click", S.exit);
    // Settings menu: a pill that slides down under the gear.
    game.els.settings.addEventListener("click", function () {
      setMenu(!game.els.menu.classList.contains("open"));
    });
    game.els.menu.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { setMenu(false); game.els.settings.focus(); }
    });
    wrap.querySelector(".tz-check").addEventListener("click", function () { checkBoard(); setMenu(false); });
    wrap.querySelector(".tz-reset").addEventListener("click", function () { resetBoard(); setMenu(false); });
    wrap.querySelector(".tz-hint").addEventListener("click", function () { hint(); setMenu(false); });
    game.els.mistakes.addEventListener("click", function () {
      showMistakes = !showMistakes;
      try { localStorage.setItem("takuzu-show-mistakes", showMistakes ? "1" : "0"); } catch (err) {}
      showMistakesButton();
      paint();
    });
    game.els.pause.addEventListener("click", function () {
      if (!game.done) setPaused(!game.paused);
    });
    wrap.querySelector(".tz-again").addEventListener("click", function () {
      newGame(game.n, game.level, board);
    });
    wrap.querySelector(".tz-new").addEventListener("click", function () {
      newGame(game.n, game.level, board);
    });
    wrap.querySelector(".tz-options").addEventListener("click", S.exit);
    // Back to puzzle (or Esc) closes the Solved window and leaves the
    // finished board on screen.
    function backToPuzzle() {
      game.els.win.hidden = true;
      game.els.cells[0].focus();
    }
    wrap.querySelector(".tz-back").addEventListener("click", backToPuzzle);
    game.els.win.addEventListener("keydown", function (e) {
      if (e.key === "Escape") backToPuzzle();
    });

    fit();
    paint();
    var first = game.puzzle.indexOf(E);
    focusCell(first < 0 ? 0 : first);
  }

  // Solved: the board turns the game's color, then the Solved window
  // builds in over it, like How to play.
  function solved() {
    game.done = true;
    setMenu(false);
    // The gear's square now starts a new puzzle (a puzzle-piece icon).
    game.els.settings.hidden = true;
    game.els.wrap.querySelector(".tz-again").hidden = false;
    clearInterval(game.tick);
    game.base = ms();
    game.since = null;
    tick();
    game.els.pause.disabled = true;
    var time = elapsed();
    game.els.wrap.querySelector(".tz-time").textContent =
      game.n + "×" + game.n + " · " + game.level + " · " + time;
    game.els.grid.classList.add("solved");
    var current = game;
    setTimeout(function () {
      if (game === current) openWin(true);
    }, 700);
  }

  // Shows the Solved window, building it in the first time. Clicking
  // the finished board brings it back after Back to puzzle.
  function openWin(build) {
    var win = game.els.win;
    win.hidden = false;
    var focusNew = function () { win.querySelector(".tz-new").focus(); };
    if (!build || S.reduceMotion.matches) { focusNew(); return; }
    win.classList.add("building");
    S.buildIn(win.querySelector(".build"), S.hexRGB("--game-button-ink"), S.hexRGB("--game-ink"),
      function () { win.classList.remove("building"); focusNew(); });
  }

  function end() {
    if (game) {
      clearInterval(game.tick);
      if (game.els.wrap) game.els.wrap.remove();
    }
    game = null;
  }

  // Pause stops the clock, hides the numbers and ignores input, so a
  // pause can't be used to keep thinking. Play picks up where it was.
  function setPaused(paused) {
    if (paused && !game.paused) { game.base = ms(); game.since = null; }
    if (!paused && game.paused) { game.since = Date.now(); }
    game.paused = paused;
    if (paused) setMenu(false);
    game.els.settings.disabled = paused;
    game.els.grid.classList.toggle("paused", paused);
    game.els.pause.innerHTML = icon(paused ? "play_arrow" : "pause");
    game.els.pause.setAttribute("aria-label", paused ? "Resume" : "Pause");
    game.els.pause.setAttribute("aria-pressed", paused ? "true" : "false");
    tick();
  }

  function setMenu(open) {
    if (!game) return;
    if (open && (game.paused || game.done)) return;
    game.els.menu.classList.toggle("open", open);
    game.els.settings.classList.toggle("open", open);
    game.els.settings.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) game.els.menu.querySelector("button").focus();
  }

  // Check: every square the player filled turns blue if right, red
  // text if wrong. A mark clears when that square changes.
  function checkBoard() {
    game.check = new Map();
    game.cur.forEach(function (v, i) {
      if (editable(i) && v !== E) game.check.set(i, v === game.solution[i] ? "correct" : "wrong");
    });
    paint();
  }

  // Reset: back to the starting numbers, with no hints, no check
  // marks, and the clock at zero.
  function resetBoard() {
    game.cur = game.puzzle.slice();
    game.hints.clear();
    game.check = null;
    game.base = 0;
    game.since = Date.now();
    setPaused(false);
    paint();
  }

  // Hint: one random empty or wrong square gets its answer, in yellow,
  // and stays fixed from then on.
  function hint() {
    var options = [];
    game.cur.forEach(function (v, i) {
      if (editable(i) && v !== game.solution[i]) options.push(i);
    });
    if (!options.length) return;
    var i = options[Math.floor(Math.random() * options.length)];
    game.cur[i] = game.solution[i];
    game.hints.add(i);
    if (game.check) game.check.delete(i);
    paint();
    focusCell(i);
  }

  function showMistakesButton() {
    var b = game.els.mistakes;
    b.innerHTML = icon(showMistakes ? "visibility" : "visibility_off");
    b.setAttribute("aria-checked", showMistakes ? "true" : "false");
    b.title = showMistakes ? "Show mistakes: on" : "Show mistakes: off";
  }

  // Milliseconds played so far, not counting pauses.
  function ms() {
    return game.base + (game.since ? Date.now() - game.since : 0);
  }

  // Time played, as m:ss (or h:mm:ss past an hour).
  function elapsed() {
    var secs = Math.floor(ms() / 1000);
    var h = Math.floor(secs / 3600), m = Math.floor(secs / 60) % 60, sec = secs % 60;
    var mm = h ? String(m).padStart(2, "0") : String(m);
    return (h ? h + ":" : "") + mm + ":" + String(sec).padStart(2, "0");
  }
  function tick() {
    if (game && game.els.timer) game.els.timer.textContent = elapsed();
  }

  card.addEventListener("gamestart", function (e) {
    e.preventDefault();
    newGame(e.detail.size, e.detail.level, e.detail.board);
  });
  card.addEventListener("gameend", end);
  card.addEventListener("gamelayout", fit);
})();
