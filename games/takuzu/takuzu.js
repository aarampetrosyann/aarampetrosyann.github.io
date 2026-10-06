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
   The frame around it (header, timer, settings, Solved window)
   comes from board.js; this draws the squares and plays Takuzu.
   Click or tap cycles a square: empty, 0, 1, empty. Arrow keys
   move, 0 and 1 fill, Backspace or Delete clears. */
(function () {
  var S = window.GameScreen;
  if (!S || !window.Board) return;
  var card = S.card, E = Takuzu.EMPTY;
  var game = null;   // the puzzle in play: state, squares, and its frame

  function label(i) {
    var n = game.n, r = Math.floor(i / n) + 1, c = (i % n) + 1, v = game.cur[i];
    var mark = game.check && game.check.get(i);
    return "Row " + r + ", column " + c + ": " + (v === E ? "empty" : v) +
      (game.puzzle[i] !== E ? ", given" : "") +
      (game.hints.has(i) ? ", hint" : "") +
      (mark ? ", " + mark : "");
  }

  function paint() {
    var bad = Takuzu.errors(game.cur, game.n, game.lines);
    var n = game.n, sel = game.sel, sr = Math.floor(sel / n), sc = sel % n;
    game.cells.forEach(function (b, i) {
      var v = game.cur[i], mark = game.check && game.check.get(i);
      // The selected square and its row and column, except starting
      // numbers, which keep their gray.
      var given = game.puzzle[i] !== E;
      b.classList.toggle("gb-sel", sel >= 0 && i === sel && !given);
      b.classList.toggle("gb-line", sel >= 0 && i !== sel && !given &&
        (Math.floor(i / n) === sr || i % n === sc));
      b.textContent = v === E ? "" : v;
      b.classList.toggle("error", game.shell.showMistakes && bad.has(i) && editable(i));
      b.classList.toggle("hint", game.hints.has(i));
      b.classList.toggle("right", mark === "correct");
      b.classList.toggle("wrong", mark === "wrong");
      b.setAttribute("aria-label", label(i));
    });
    if (!game.shell.done && game.cur.indexOf(E) < 0 && bad.size === 0) game.shell.finish();
  }

  // Squares the player can change: not given, not revealed by a hint.
  function editable(i) {
    return game.puzzle[i] === E && !game.hints.has(i);
  }

  function setCell(i, v) {
    if (game.shell.done || game.shell.paused || !editable(i)) return;
    game.cur[i] = v;
    if (game.check) game.check.delete(i);   // a changed square loses its check mark
    paint();
  }

  function focusCell(i) {
    game.cells.forEach(function (b, k) { b.tabIndex = k === i ? 0 : -1; });
    game.cells[i].focus();
    game.sel = i;
    paint();
  }

  // Answers for every empty or wrong square the player can change.
  function missing() {
    return game.cur.map(function (v, i) { return i; }).filter(function (i) {
      return editable(i) && game.cur[i] !== game.solution[i];
    });
  }

  function newGame(n, level, container) {
    end();
    var made = Takuzu.make(n, level);
    game = {
      n: n, level: level, lines: made.lines,
      puzzle: made.puzzle, cur: made.puzzle.slice(), solution: made.solution,
      hints: new Set(), check: null, cells: [], sel: -1
    };
    game.shell = Board.create({
      name: "Takuzu", n: n, level: level, container: container,
      storageKey: "takuzu-show-mistakes",
      onNew: function () { newGame(n, level, container); },
      onMistakes: paint,

      // Check: entries turn blue if right, red if wrong, until changed.
      onCheck: function () {
        game.check = new Map();
        game.cur.forEach(function (v, i) {
          if (editable(i) && v !== E) game.check.set(i, v === game.solution[i] ? "correct" : "wrong");
        });
        paint();
      },
      // Reset: starting numbers only, no hints or marks, clock at zero.
      onReset: function () {
        game.cur = game.puzzle.slice();
        game.hints.clear();
        game.check = null;
        game.shell.resetClock();
        paint();
      },
      // Hint: one random empty or wrong square gets its answer, fixed.
      onHint: function () {
        var options = missing();
        if (!options.length) return;
        var i = options[Math.floor(Math.random() * options.length)];
        game.cur[i] = game.solution[i];
        game.hints.add(i);
        if (game.check) game.check.delete(i);
        paint();
        focusCell(i);
      },
      // Solve: every empty or wrong square gets its answer, like hints.
      onSolve: function () {
        missing().forEach(function (i) {
          game.cur[i] = game.solution[i];
          game.hints.add(i);
        });
        game.check = null;
        paint();
      }
    });

    var grid = game.shell.grid;
    for (var i = 0; i < n * n; i++) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "gb-cell" + (game.puzzle[i] !== E ? " given" : "");
      b.dataset.i = i;
      b.tabIndex = -1;
      grid.appendChild(b);
      game.cells.push(b);
    }

    grid.addEventListener("click", function (e) {
      if (game.shell.done) return;
      var b = e.target.closest(".gb-cell");
      if (!b) return;
      var i = Number(b.dataset.i), v = game.cur[i];
      focusCell(i);
      setCell(i, v === E ? 0 : v === 0 ? 1 : E);
    });
    grid.addEventListener("keydown", function (e) {
      var b = e.target.closest(".gb-cell");
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

    paint();
    var first = game.puzzle.indexOf(E);
    focusCell(first < 0 ? 0 : first);
  }

  function end() {
    if (game) game.shell.destroy();
    game = null;
  }

  card.addEventListener("gamestart", function (e) {
    e.preventDefault();
    newGame(e.detail.size, e.detail.level, e.detail.board);
  });
  card.addEventListener("gameend", end);
  card.addEventListener("gamelayout", function () { if (game) game.shell.fit(); });
})();
