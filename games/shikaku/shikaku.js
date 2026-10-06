/* ============================================================
   SHIKAKU.JS
   The Shikaku board, drawn into the start screen's board area when
   Play is pressed. The frame around it (header, timer, settings,
   Solved window) comes from board.js.

   Rules: divide the whole grid into rectangles (squares count too).
   Every rectangle holds exactly one number, and that number is its
   area: how many squares it covers.

   Puzzles are made fresh each time: the board is split into random
   rectangles, each gets its area as a number in one of its squares,
   and a solver makes sure there's exactly one way to divide it.
   ============================================================ */

/* ---------- Puzzle maker and solver ----------
   Squares are numbered r * n + c. A rectangle is { r0, c0, r1, c1 }
   with r1 and c1 inclusive. */
var Shikaku = (function () {
  // Largest rectangle per level: smaller rectangles are easier.
  var MAX_AREA = { Easy: 6, Medium: 9, Hard: 12 };

  function area(t) { return (t.r1 - t.r0 + 1) * (t.c1 - t.c0 + 1); }
  function inside(t, r, c) { return r >= t.r0 && r <= t.r1 && c >= t.c0 && c <= t.c1; }
  function shuffled(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Splits the board into random rectangles of area 2 to max. Each
  // step starts at the first uncovered square (reading order) and
  // picks a random rectangle growing right and down from it.
  function split(n, max) {
    var owner = [], rects = [];
    for (var i = 0; i < n * n; i++) owner.push(-1);
    for (var s = 0; s < n * n; s++) {
      if (owner[s] >= 0) continue;
      var r0 = Math.floor(s / n), c0 = s % n, options = [];
      // widest run of free squares to the right
      var wMax = 0;
      while (c0 + wMax < n && owner[r0 * n + c0 + wMax] < 0) wMax++;
      for (var w = 1; w <= wMax; w++) {
        for (var h = 1; r0 + h <= n; h++) {
          var free = true;
          for (var c = c0; c < c0 + w && free; c++) if (owner[(r0 + h - 1) * n + c] >= 0) free = false;
          if (!free) break;
          var a = w * h;
          if (a > max) break;
          if (a >= 2) options.push({ r0: r0, c0: c0, r1: r0 + h - 1, c1: c0 + w - 1 });
        }
      }
      if (!options.length) return null;   // a lone square left over: start again
      var t = options[Math.floor(Math.random() * options.length)];
      for (var r = t.r0; r <= t.r1; r++) for (var c2 = t.c0; c2 <= t.c1; c2++) owner[r * n + c2] = rects.length;
      rects.push(t);
    }
    return rects;
  }

  // Every rectangle of the clue's area that covers its square and no
  // other clue's square.
  function candidates(n, clues, k) {
    var cl = clues[k], out = [], A = cl.value;
    for (var h = 1; h <= A; h++) {
      if (A % h) continue;
      var w = A / h;
      for (var r0 = cl.r - h + 1; r0 <= cl.r; r0++) {
        for (var c0 = cl.c - w + 1; c0 <= cl.c; c0++) {
          if (r0 < 0 || c0 < 0 || r0 + h > n || c0 + w > n) continue;
          var t = { r0: r0, c0: c0, r1: r0 + h - 1, c1: c0 + w - 1 }, ok = true;
          for (var j = 0; j < clues.length && ok; j++) {
            if (j !== k && inside(t, clues[j].r, clues[j].c)) ok = false;
          }
          if (ok) out.push(t);
        }
      }
    }
    return out;
  }

  // Finds up to `limit` ways to divide the board. Gives up (null)
  // past `budget` steps.
  function solve(n, clues, limit, budget) {
    var cands = clues.map(function (cl, k) { return candidates(n, clues, k); });
    var used = [], pick = [], found = [], steps = 0, gaveUp = false;
    for (var i = 0; i < n * n; i++) used.push(false);
    budget = budget || 50000;

    function fits(t) {
      for (var r = t.r0; r <= t.r1; r++) for (var c = t.c0; c <= t.c1; c++) if (used[r * n + c]) return false;
      return true;
    }
    function mark(t, v) {
      for (var r = t.r0; r <= t.r1; r++) for (var c = t.c0; c <= t.c1; c++) used[r * n + c] = v;
    }
    function go(placed) {
      if (found.length >= limit || gaveUp) return;
      if (++steps > budget) { gaveUp = true; return; }
      if (placed === clues.length) { found.push(pick.slice()); return; }
      // the clue with the fewest rectangles that still fit
      var best = -1, bestList = null;
      for (var k = 0; k < clues.length; k++) {
        if (pick[k]) continue;
        var list = cands[k].filter(fits);
        if (!list.length) return;
        if (!bestList || list.length < bestList.length) { best = k; bestList = list; }
      }
      for (var x = 0; x < bestList.length && found.length < limit; x++) {
        pick[best] = bestList[x];
        mark(bestList[x], true);
        go(placed + 1);
        mark(bestList[x], false);
        pick[best] = null;
      }
    }
    go(0);
    return gaveUp ? null : found;
  }

  function make(n, level) {
    var max = Math.min(MAX_AREA[level] || 9, n * n);
    for (var attempt = 0; attempt < 400; attempt++) {
      var rects = split(n, max);
      if (!rects) continue;
      // Try a few placements of the numbers before a fresh split.
      for (var tries = 0; tries < 8; tries++) {
        var clues = rects.map(function (t) {
          var r = t.r0 + Math.floor(Math.random() * (t.r1 - t.r0 + 1));
          var c = t.c0 + Math.floor(Math.random() * (t.c1 - t.c0 + 1));
          return { r: r, c: c, value: area(t) };
        });
        var sols = solve(n, clues, 2);
        if (sols && sols.length === 1) {
          // Solution in clue order (each clue's own rectangle).
          return { n: n, clues: clues, solution: sols[0] };
        }
      }
    }
    return null;
  }

  // A rectangle is right when it holds exactly one number and that
  // number is its area.
  function valid(clues, t) {
    var inIt = clues.filter(function (cl) { return inside(t, cl.r, cl.c); });
    return inIt.length === 1 && inIt[0].value === area(t);
  }

  return { make: make, solve: solve, valid: valid, area: area, inside: inside };
})();

/* ---------- The board ----------
   The frame around it (header, timer, settings, Solved window)
   comes from board.js; this draws the squares and rectangles and
   plays Shikaku.

   Drag from any square to any other to draw a rectangle (squares
   count too); it replaces any rectangle it overlaps. While it covers
   two or more numbers it shows pulsing stripes, and letting go there
   places nothing. Tap a rectangle to remove it. Hint points one step
   in a direction a number's rectangle still has to grow.

   Keyboard: arrows move, Enter or Space starts a rectangle, arrows
   stretch it, Enter or Space places it, Escape cancels, Backspace or
   Delete removes the one under you. */
(function () {
  var S = window.GameScreen;
  if (!S || !window.Board) return;
  var card = S.card;
  var game = null;   // the puzzle in play: state, elements, and its frame
  var SHADES = 5;    // tints of the game's red, so neighbours differ
  var NUDGE_MS = 3200;

  function same(a, b) { return a.r0 === b.r0 && a.c0 === b.c0 && a.r1 === b.r1 && a.c1 === b.c1; }
  function overlaps(a, b) { return a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1; }
  function within(a, b) { return a.r0 >= b.r0 && a.r1 <= b.r1 && a.c0 >= b.c0 && a.c1 <= b.c1; }
  function touches(a, b) {
    var rowsMeet = a.r0 <= b.r1 && b.r0 <= a.r1, colsMeet = a.c0 <= b.c1 && b.c0 <= a.c1;
    return (rowsMeet && (a.c1 + 1 === b.c0 || b.c1 + 1 === a.c0)) ||
           (colsMeet && (a.r1 + 1 === b.r0 || b.r1 + 1 === a.r0));
  }
  function square(i) {
    var n = game.n, r = Math.floor(i / n), c = i % n;
    return { r0: r, c0: c, r1: r, c1: c };
  }
  function at(i) {
    var n = game.n, r = Math.floor(i / n), c = i % n;
    for (var k = 0; k < game.rects.length; k++) if (Shikaku.inside(game.rects[k], r, c)) return k;
    return -1;
  }

  // The number's rectangle so far, or just its square.
  function base(num) {
    var k = at(num);
    return k >= 0 ? game.rects[k] : square(num);
  }

  // The rectangle with squares a and b at opposite corners.
  function span(a, b) {
    var n = game.n, ar = Math.floor(a / n), ac = a % n, br = Math.floor(b / n), bc = b % n;
    return { r0: Math.min(ar, br), c0: Math.min(ac, bc), r1: Math.max(ar, br), c1: Math.max(ac, bc) };
  }

  // A shade no touching rectangle uses (random among the free ones).
  function shadeFor(t) {
    var taken = {};
    game.rects.forEach(function (o) { if (touches(t, o)) taken[o.shade] = true; });
    var free = [];
    for (var s = 0; s < SHADES; s++) if (!taken[s]) free.push(s);
    var pool = free.length ? free : [0, 1, 2, 3, 4];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // A rectangle can't hold more than one number.
  function blocked(t) {
    return game.p.clues.filter(function (cl) { return Shikaku.inside(t, cl.r, cl.c); }).length > 1;
  }

  // Removes the rectangle covering square i, if any.
  function removeAt(i) {
    var k = at(i);
    if (k >= 0) game.rects.splice(k, 1);
  }

  // Adds a rectangle, dropping any it overlaps.
  function place(t) {
    var r = { r0: t.r0, c0: t.c0, r1: t.r1, c1: t.c1 };
    game.rects = game.rects.filter(function (o) { return !overlaps(o, r); });
    r.shade = shadeFor(r);
    game.rects.push(r);
  }

  // An outline layer on the grid (draft, nudge, cursor), made once.
  function layer(cls, t) {
    var grid = game.shell.grid, el = grid.querySelector("." + cls);
    if (!t) { if (el) el.remove(); return null; }
    if (!el) { el = document.createElement("div"); el.className = cls; el.setAttribute("aria-hidden", "true"); grid.appendChild(el); }
    el.style.gridRow = (t.r0 + 1) + " / " + (t.r1 + 2);
    el.style.gridColumn = (t.c0 + 1) + " / " + (t.c1 + 2);
    return el;
  }

  function paint() {
    var n = game.n, grid = game.shell.grid;
    grid.querySelectorAll(".sk-rect").forEach(function (el) { el.remove(); });
    var allValid = true, covered = 0;
    game.rects.forEach(function (t) {
      var ok = Shikaku.valid(game.p.clues, t);
      if (!ok) allValid = false;
      covered += Shikaku.area(t);
      var el = document.createElement("div");
      el.className = "sk-rect shade-" + t.shade + (game.shell.showMistakes && !ok ? " error" : "");
      el.style.gridRow = (t.r0 + 1) + " / " + (t.r1 + 2);
      el.style.gridColumn = (t.c0 + 1) + " / " + (t.c1 + 2);
      el.setAttribute("aria-hidden", "true");
      grid.appendChild(el);
    });

    // The rectangle being drawn, striped while it covers two or more numbers.
    var draft = layer("sk-draft", game.draft);
    if (draft) draft.classList.toggle("bad", blocked(game.draft));
    layer("sk-nudge", game.nudge);
    // Keyboard cursor (no row and column highlight in Shikaku: it
    // would muddle the shaded rectangles).
    layer("sk-cursor", square(game.sel));

    game.cells.forEach(function (b, i) {
      var r = Math.floor(i / n), c = i % n, k = at(i), clue = game.clueAt[i];
      b.setAttribute("aria-label", "Row " + (r + 1) + ", column " + (c + 1) +
        (clue ? ": " + clue.value : "") +
        (k >= 0 ? ", in a " + (game.rects[k].r1 - game.rects[k].r0 + 1) + " by " +
          (game.rects[k].c1 - game.rects[k].c0 + 1) + " rectangle" : ""));
    });
    if (!game.shell.done && covered === n * n && allValid) game.shell.finish();
  }

  function clearNudge() {
    clearTimeout(game.nudgeTimer);
    game.nudge = null;
  }

  // fromPointer: focus quietly, so the keyboard cursor only shows
  // when the keyboard is in use.
  function focusCell(i, fromPointer) {
    game.sel = i;
    game.cells.forEach(function (b, k) { b.tabIndex = k === i ? 0 : -1; });
    game.cells[i].focus({ preventScroll: true, focusVisible: !fromPointer });
    if (game.anchor >= 0) game.draft = span(game.anchor, i);
    paint();
  }

  function newGame(n, level, container) {
    end();
    var p = Shikaku.make(n, level);
    game = { n: n, level: level, p: p, rects: [], cells: [], clueAt: {}, sel: 0,
             anchor: -1, draft: null, nudge: null, nudgeTimer: null };
    p.clues.forEach(function (cl, k) { game.clueAt[cl.r * n + cl.c] = { value: cl.value, k: k }; });

    game.shell = Board.create({
      name: "Shikaku", n: n, level: level, container: container,
      storageKey: "shikaku-show-mistakes",
      highlight: false,
      onNew: function () { newGame(n, level, container); },
      onMistakes: paint,
      onReset: function () {
        game.rects = [];
        game.anchor = -1;
        game.draft = null;
        clearNudge();
        game.shell.resetClock();
        paint();
      },
      // Hint: pick a number whose rectangle isn't its answer yet, and
      // show its rectangle one step bigger in a direction the answer
      // goes, pulsing, for a few seconds.
      onHint: function () {
        var options = [];
        p.clues.forEach(function (cl, k) {
          var num = cl.r * n + cl.c, idx = at(num);
          if (idx < 0 || !same(game.rects[idx], p.solution[k])) options.push(k);
        });
        if (!options.length) return;
        var k = options[Math.floor(Math.random() * options.length)];
        var sol = p.solution[k], num = p.clues[k].r * n + p.clues[k].c;
        var from = base(num);
        if (!within(from, sol)) from = square(num);   // off track: start from the number
        var steps = [];
        if (sol.c0 < from.c0) steps.push({ r0: from.r0, r1: from.r1, c0: from.c0 - 1, c1: from.c1 });
        if (sol.c1 > from.c1) steps.push({ r0: from.r0, r1: from.r1, c0: from.c0, c1: from.c1 + 1 });
        if (sol.r0 < from.r0) steps.push({ r0: from.r0 - 1, r1: from.r1, c0: from.c0, c1: from.c1 });
        if (sol.r1 > from.r1) steps.push({ r0: from.r0, r1: from.r1 + 1, c0: from.c0, c1: from.c1 });
        if (!steps.length) return;
        clearNudge();
        game.nudge = steps[Math.floor(Math.random() * steps.length)];
        var current = game;
        game.nudgeTimer = setTimeout(function () {
          if (game === current) { game.nudge = null; paint(); }
        }, NUDGE_MS);
        paint();
      }
    });

    var grid = game.shell.grid;
    grid.classList.add("sk-grid");
    for (var i = 0; i < n * n; i++) {
      var r = Math.floor(i / n), c = i % n;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "gb-cell";
      b.dataset.i = i;
      b.tabIndex = -1;
      b.style.gridRow = r + 1;
      b.style.gridColumn = c + 1;
      grid.appendChild(b);
      game.cells.push(b);
      if (game.clueAt[i]) {
        // Numbers sit above the rectangles, so they always show.
        var num = document.createElement("span");
        num.className = "sk-num";
        num.textContent = game.clueAt[i].value;
        num.style.gridRow = r + 1;
        num.style.gridColumn = c + 1;
        num.setAttribute("aria-hidden", "true");
        grid.appendChild(num);
      }
    }

    // Drag to draw. Pointer capture keeps the drag going if it leaves
    // the board; the square under the pointer is found by position.
    var start = -1, moved = false;
    function cellAt(x, y) {
      var el = document.elementFromPoint(x, y);
      var b = el && el.closest && el.closest(".sk-grid .gb-cell");
      return b ? Number(b.dataset.i) : -1;
    }
    grid.addEventListener("pointerdown", function (e) {
      if (game.shell.done || game.shell.paused) return;
      var b = e.target.closest(".gb-cell");
      if (!b) return;
      e.preventDefault();
      var i = Number(b.dataset.i);
      clearNudge();
      focusCell(i, true);
      game.anchor = -1;
      start = i;
      moved = false;
      try { grid.setPointerCapture(e.pointerId); } catch (err) {}
      game.draft = span(i, i);
      paint();
    });
    grid.addEventListener("pointermove", function (e) {
      if (start < 0) return;
      var i = cellAt(e.clientX, e.clientY);
      if (i < 0) return;
      if (i !== start) moved = true;
      game.draft = span(start, i);
      game.sel = i;
      paint();
    });
    function finishDrag() {
      if (start < 0) return;
      var t = game.draft;
      game.draft = null;
      if (!moved) removeAt(start);        // a tap removes the rectangle under it
      else if (!blocked(t)) place(t);     // over two numbers: nothing is placed
      start = -1;
      paint();
    }
    grid.addEventListener("pointerup", finishDrag);
    grid.addEventListener("pointercancel", function () { start = -1; game.draft = null; paint(); });

    grid.addEventListener("keydown", function (e) {
      var b = e.target.closest(".gb-cell");
      if (!b || game.shell.done || game.shell.paused) return;
      var i = Number(b.dataset.i), r = Math.floor(i / n), c = i % n;
      var moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (moves[e.key]) {
        e.preventDefault();
        var nr = Math.min(n - 1, Math.max(0, r + moves[e.key][0]));
        var nc = Math.min(n - 1, Math.max(0, c + moves[e.key][1]));
        focusCell(nr * n + nc);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        clearNudge();
        if (game.anchor < 0) {
          game.anchor = i;
          game.draft = span(i, i);
        } else {
          if (!blocked(game.draft)) place(game.draft);
          game.anchor = -1;
          game.draft = null;
        }
        paint();
      } else if (e.key === "Escape") {
        game.anchor = -1;
        game.draft = null;
        paint();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        removeAt(i);
        paint();
      }
    });

    focusCell(0, true);
  }

  function end() {
    if (game) { clearNudge(); game.shell.destroy(); }
    game = null;
  }

  card.addEventListener("gamestart", function (e) {
    e.preventDefault();
    newGame(e.detail.size, e.detail.level, e.detail.board);
  });
  card.addEventListener("gameend", end);
  card.addEventListener("gamelayout", function () { if (game) game.shell.fit(); });
})();
