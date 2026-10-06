/* ============================================================
   KAKURO.JS
   The Kakuro board, drawn into the start screen's board area when
   Play is pressed. The frame around it (header, timer, settings,
   Solved window) comes from board.js.

   Rules: fill every white square with a digit from 1 to 9. Each
   clue is the sum of the run of white squares to its right (across)
   or below it (down), and a digit can't repeat within a run.

   Puzzles are made fresh each time: a symmetric layout of black
   squares, a random fill of digits, and the clue sums from it. A
   solver then makes sure there's exactly one answer, revealing a
   starting digit (a given) wherever two answers disagree.
   ============================================================ */

/* ---------- Puzzle maker and solver ----------
   A board is n x n; row 0 and column 0 are always black. Cells are
   numbered r * n + c. */
var Kakuro = (function () {
  // Every set of distinct digits 1-9, as bit masks (bit d = digit d),
  // grouped by how many digits and what they add up to.
  var COMBOS = [];
  for (var len = 0; len <= 9; len++) { COMBOS.push([]); for (var s = 0; s <= 45; s++) COMBOS[len].push([]); }
  for (var m = 0; m < 512; m++) {
    var mask = m << 1, count = 0, sum = 0;
    for (var d = 1; d <= 9; d++) if (mask & (1 << d)) { count++; sum += d; }
    COMBOS[count][sum].push(mask);
  }
  var ALL = 0x3fe;   // digits 1-9

  function bits(x) { var c = 0; while (x) { x &= x - 1; c++; } return c; }
  function shuffled(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Runs of white squares: [{ cells: [...], across: bool, clue: index of
  // the black square holding its sum }], and for each white square,
  // which across and down run it's in.
  function runsOf(n, white) {
    var runs = [], inRun = { across: [], down: [] };
    [true, false].forEach(function (across) {
      for (var a = 1; a < n; a++) {
        var cur = null;
        for (var b = 0; b < n; b++) {
          var i = across ? a * n + b : b * n + a;
          if (white[i]) {
            if (!cur) {
              var before = across ? i - 1 : i - n;
              cur = { cells: [], across: across, clue: before };
              runs.push(cur);
            }
            cur.cells.push(i);
            inRun[across ? "across" : "down"][i] = runs.length - 1;
          } else cur = null;
        }
      }
    });
    return { runs: runs, across: inRun.across, down: inRun.down };
  }

  // Layout: start all white, then add black squares in mirrored pairs
  // while every run stays at least 2 long and the whites stay joined.
  var BLACK_SHARE = { Easy: 0.2, Medium: 0.14, Hard: 0.12 };

  function okLayout(n, white) {
    var total = 0, start = -1;
    for (var r = 1; r < n; r++) {
      for (var c = 1; c < n; c++) {
        var i = r * n + c;
        if (!white[i]) continue;
        total++; start = i;
        var left = white[i - 1], right = c < n - 1 && white[i + 1];
        var up = white[i - n], down = r < n - 1 && white[i + n];
        if (!left && !right) return false;
        if (!up && !down) return false;
      }
    }
    if (!total) return false;
    // all whites connected
    var seen = {}, stack = [start], found = 0;
    seen[start] = true;
    while (stack.length) {
      var x = stack.pop(); found++;
      [x - 1, x + 1, x - n, x + n].forEach(function (y) {
        if (y >= 0 && y < n * n && white[y] && !seen[y] &&
            (Math.abs((y % n) - (x % n)) <= 1)) { seen[y] = true; stack.push(y); }
      });
    }
    return found === total;
  }

  // Longest run allowed: shorter runs have fewer ways to add up, so
  // puzzles need fewer givens; Hard allows the longest. Easy gets its
  // shorter runs from more black squares and its help from givens.
  var MAX_RUN = { Easy: 5, Medium: 5, Hard: 6 };

  function layout(n, level) {
    var white = [];
    for (var i = 0; i < n * n; i++) white.push(i >= n && i % n !== 0);
    var inner = (n - 1) * (n - 1), maxRun = MAX_RUN[level] || 5;
    var mirror = function (p) { return (n - Math.floor(p / n)) * n + (n - p % n); };
    var setBlack = function (p) { white[p] = false; white[mirror(p)] = false; };

    // 1. Scatter mirrored black squares.
    var target = Math.round(inner * (BLACK_SHARE[level] || 0.24) / 2);
    for (var k = 0; k < target; k++) {
      setBlack((1 + Math.floor(Math.random() * (n - 1))) * n + 1 + Math.floor(Math.random() * (n - 1)));
    }

    // 2. Fix it up until nothing changes: a white square alone in its
    //    row or column turns black; a run that's too long is split.
    for (var pass = 0; pass < 50; pass++) {
      var changed = false;
      for (var r = 1; r < n; r++) {
        for (var c = 1; c < n; c++) {
          var x = r * n + c;
          if (!white[x]) continue;
          var h = white[x - 1] || (c < n - 1 && white[x + 1]);
          var v = white[x - n] || (r < n - 1 && white[x + n]);
          if (!h || !v) { setBlack(x); changed = true; }
        }
      }
      runsOf(n, white).runs.forEach(function (run) {
        if (run.cells.length <= maxRun) return;
        var inside = run.cells.slice(2, run.cells.length - 2);
        setBlack(inside[Math.floor(Math.random() * inside.length)]);
        changed = true;
      });
      if (!changed) break;
    }

    // 3. Keep the biggest connected area of white squares.
    var seen = {}, best = [];
    for (var s = 0; s < n * n; s++) {
      if (!white[s] || seen[s]) continue;
      var group = [], stack = [s];
      seen[s] = true;
      while (stack.length) {
        var y = stack.pop(); group.push(y);
        [y - 1, y + 1, y - n, y + n].forEach(function (z) {
          if (z >= 0 && z < n * n && white[z] && !seen[z] && Math.abs((z % n) - (y % n)) <= 1) {
            seen[z] = true; stack.push(z);
          }
        });
      }
      if (group.length > best.length) best = group;
    }
    var keep = {};
    best.forEach(function (g) { keep[g] = true; });
    for (var t = 0; t < n * n; t++) if (white[t] && !keep[t]) white[t] = false;

    // A usable layout: still valid after trimming, and mostly white.
    return okLayout(n, white) && best.length >= inner * 0.45 ? white : null;
  }

  // Digits with no repeats in any run. Each run leans low, high, or
  // neither: sums made of the smallest or largest digits (3 = 1+2,
  // 17 = 8+9) can only be made one way, which keeps answers unique.
  function fill(n, white, R) {
    var cells = [];
    for (var i = 0; i < n * n; i++) if (white[i]) cells.push(i);
    var lean = R.runs.map(function () {
      var x = Math.random();
      return x < 0.35 ? -1 : x < 0.7 ? 1 : 0;   // -1 low, 1 high, 0 neither
    });
    var val = [];
    function used(i) {
      var m = 0;
      [R.runs[R.across[i]], R.runs[R.down[i]]].forEach(function (run) {
        run.cells.forEach(function (j) { if (val[j]) m |= 1 << val[j]; });
      });
      return m;
    }
    function order(i) {
      var bias = lean[R.across[i]] + lean[R.down[i]];
      return [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (d) {
        return { d: d, score: bias * (d - 5) * -1 + Math.random() * 4 };
      }).sort(function (a, b) { return a.score - b.score; }).map(function (o) { return o.d; });
    }
    var steps = 0;
    function go(k) {
      if (k === cells.length) return true;
      if (++steps > 20000) return false;
      var i = cells[k], u = used(i), digits = order(i);
      for (var t = 0; t < 9; t++) {
        if (u & (1 << digits[t])) continue;
        val[i] = digits[t];
        if (go(k + 1)) return true;
      }
      val[i] = 0;
      return false;
    }
    return go(0) ? val : null;
  }

  // Finds up to `limit` solutions. `fixed` holds givens (0 = open).
  // Gives up (returns null) past `budget` steps, so a hard case
  // never stalls the page; the maker then starts over.
  function solve(n, white, R, sums, fixed, limit, budget) {
    var val = fixed.slice(), found = [], steps = 0, gaveUp = false;
    budget = budget || 60000;
    var open = [];
    for (var i = 0; i < n * n; i++) if (white[i] && !val[i]) open.push(i);

    function allowed(run, sum) {
      var u = 0, total = 0, left = 0;
      run.cells.forEach(function (j) { if (val[j]) { u |= 1 << val[j]; total += val[j]; } else left++; });
      var rest = sum - total;
      if (left === 0) return rest === 0 ? -1 : 0;   // -1: complete and fine
      if (rest < 0 || rest > 45) return 0;
      var ok = 0, list = COMBOS[left][rest];
      for (var k = 0; k < list.length; k++) if (!(list[k] & u)) ok |= list[k];
      return ok & ~u;
    }
    function cands(i) {
      var a = R.runs[R.across[i]], d = R.runs[R.down[i]];
      return allowed(a, sums[R.across[i]]) & allowed(d, sums[R.down[i]]) & ALL;
    }
    function go() {
      if (found.length >= limit || gaveUp) return;
      if (++steps > budget) { gaveUp = true; return; }
      var best = -1, bestMask = 0, bestCount = 10;
      for (var k = 0; k < open.length; k++) {
        var i = open[k];
        if (val[i]) continue;
        var c = cands(i), cnt = bits(c);
        if (cnt === 0) return;
        if (cnt < bestCount) { best = i; bestMask = c; bestCount = cnt; }
      }
      if (best < 0) {
        // all filled: every run must add up
        for (var r = 0; r < R.runs.length; r++) if (allowed(R.runs[r], sums[r]) !== -1) return;
        found.push(val.slice());
        return;
      }
      for (var dgt = 1; dgt <= 9 && found.length < limit; dgt++) {
        if (!(bestMask & (1 << dgt))) continue;
        val[best] = dgt;
        go();
      }
      val[best] = 0;
    }
    go();
    return gaveUp ? null : found;
  }

  // Share of white squares given at the start, beyond what's needed
  // for a single answer.
  var GIVEN_SHARE = { Easy: 0.12, Medium: 0.04, Hard: 0 };

  function sumsOf(R, solution) {
    return R.runs.map(function (run) {
      return run.cells.reduce(function (t, j) { return t + solution[j]; }, 0);
    });
  }

  // Changing digits removes ambiguity without givens but can take a
  // while; past this many ms the maker reveals givens instead, so a
  // new puzzle is always quick.
  var PATIENCE = 600;

  function make(n, level) {
    var started = Date.now();
    for (var attempt = 0; attempt < 300; attempt++) {
      var white = layout(n, level);
      if (!white) continue;
      var R = runsOf(n, white);
      var solution = fill(n, white, R);
      if (!solution) continue;
      var givens = [];
      for (var i = 0; i < n * n; i++) givens.push(0);

      // Where two answers disagree, first try changing that digit in
      // the answer (which changes the sums); after a while, reveal it
      // as a given instead.
      var ok = false, sums;
      for (var step = 0; step < 160; step++) {
        sums = sumsOf(R, solution);
        var sols = solve(n, white, R, sums, givens, 2);
        if (!sols || !sols.length) break;
        if (sols.length === 1) { ok = true; break; }
        var diff = [];
        for (var j = 0; j < n * n; j++) if (white[j] && !givens[j] && sols[0][j] !== sols[1][j]) diff.push(j);
        var x = diff[Math.floor(Math.random() * diff.length)];
        if (step < 120 && Date.now() - started < PATIENCE) {
          var u = 0;
          [R.runs[R.across[x]], R.runs[R.down[x]]].forEach(function (run) {
            run.cells.forEach(function (k) { if (k !== x) u |= 1 << solution[k]; });
          });
          var options = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]).filter(function (d) {
            return d !== solution[x] && !(u & (1 << d));
          });
          if (options.length) { solution[x] = options[0]; continue; }
        }
        givens[x] = solution[x];
      }
      if (!ok) continue;

      var whites = [];
      for (var w = 0; w < n * n; w++) if (white[w] && !givens[w]) whites.push(w);
      var extra = Math.round(whites.length * (GIVEN_SHARE[level] || 0));
      shuffled(whites).slice(0, extra).forEach(function (w2) { givens[w2] = solution[w2]; });

      // Clues on the black squares: across sum and down sum (or 0).
      var across = [], down = [];
      for (var b = 0; b < n * n; b++) { across.push(0); down.push(0); }
      R.runs.forEach(function (run, k) {
        (run.across ? across : down)[run.clue] = sums[k];
      });
      return {
        n: n, white: white, runs: R.runs, inAcross: R.across, inDown: R.down,
        sums: sums, across: across, down: down,
        solution: solution, givens: givens
      };
    }
    return null;
  }

  // Squares breaking a rule: a digit repeated in a run, a run adding
  // up to more than its clue, or a full run adding up to something else.
  function errors(p, cur) {
    var bad = new Set();
    p.runs.forEach(function (run, k) {
      var seen = {}, total = 0, full = true;
      run.cells.forEach(function (j) {
        var v = cur[j];
        if (!v) { full = false; return; }
        total += v;
        (seen[v] = seen[v] || []).push(j);
      });
      Object.keys(seen).forEach(function (v) {
        if (seen[v].length > 1) seen[v].forEach(function (j) { bad.add(j); });
      });
      if (total > p.sums[k] || (full && total !== p.sums[k])) {
        run.cells.forEach(function (j) { if (cur[j]) bad.add(j); });
      }
    });
    return bad;
  }

  return { make: make, errors: errors, solve: solve, runsOf: runsOf };
})();

/* ---------- The board ----------
   The frame around it (header, timer, settings, Solved window)
   comes from board.js; this draws the squares, the number pad under
   the board, and plays Kakuro. Click a white square to select it,
   then type a digit or use the pad. Arrow keys move between white
   squares, Backspace or Delete clears. */
(function () {
  var S = window.GameScreen;
  if (!S || !window.Board) return;
  var card = S.card;
  var game = null;   // the puzzle in play: state, squares, and its frame

  function label(i) {
    var p = game.p, n = p.n, v = game.cur[i], mark = game.check && game.check.get(i);
    return "Row " + Math.floor(i / n) + ", column " + (i % n) + ": " + (v || "empty") +
      ". Across " + p.sums[p.inAcross[i]] + ", down " + p.sums[p.inDown[i]] +
      (p.givens[i] ? ", given" : "") + (game.hints.has(i) ? ", hint" : "") +
      (mark ? ", " + mark : "");
  }

  // Squares the player can change: white, not given, not a hint.
  function editable(i) {
    return game.p.white[i] && !game.p.givens[i] && !game.hints.has(i);
  }

  function paint() {
    var p = game.p, bad = Kakuro.errors(p, game.cur), full = true;
    var sel = game.sel, runs = sel >= 0 ? [p.runs[p.inAcross[sel]], p.runs[p.inDown[sel]]] : [];
    game.cells.forEach(function (b, i) {
      if (!p.white[i]) return;
      var v = game.cur[i], mark = game.check && game.check.get(i);
      if (!v) full = false;
      b.textContent = v || "";
      b.classList.toggle("error", game.shell.showMistakes && bad.has(i) && editable(i));
      b.classList.toggle("hint", game.hints.has(i));
      b.classList.toggle("right", mark === "correct");
      b.classList.toggle("wrong", mark === "wrong");
      b.classList.toggle("gb-sel", i === sel);
      b.classList.toggle("gb-line", i !== sel && runs.some(function (r) { return r.cells.indexOf(i) >= 0; }));
      b.setAttribute("aria-label", label(i));
    });
    if (!game.shell.done && full && bad.size === 0) game.shell.finish();
  }

  function select(i) {
    game.sel = i;
    game.cells.forEach(function (b, k) { if (b.tagName === "BUTTON") b.tabIndex = k === i ? 0 : -1; });
    game.cells[i].focus();
    paint();
  }

  function setCell(i, v) {
    if (game.shell.done || game.shell.paused || i < 0 || !editable(i)) return;
    game.cur[i] = v;
    if (game.check) game.check.delete(i);   // a changed square loses its check mark
    paint();
  }

  // The next white square from i in a direction, or i at the edge.
  function step(i, dr, dc) {
    var n = game.p.n, r = Math.floor(i / n) + dr, c = (i % n) + dc;
    while (r > 0 && r < n && c > 0 && c < n) {
      var j = r * n + c;
      if (game.p.white[j]) return j;
      r += dr; c += dc;
    }
    return i;
  }

  // Answers for every empty or wrong square the player can change.
  function missing() {
    var out = [];
    game.cur.forEach(function (v, i) {
      if (editable(i) && v !== game.p.solution[i]) out.push(i);
    });
    return out;
  }

  function newGame(n, level, container) {
    end();
    game = { n: n, level: level, cells: [], sel: -1, hints: new Set(), check: null, p: null };
    var current = game;
    game.shell = Board.create({
      name: "Kakuro", n: n, level: level, container: container,
      storageKey: "kakuro-show-mistakes",
      onNew: function () { newGame(n, level, container); },
      onMistakes: function () { if (game.p) paint(); },
      onCheck: function () {
        if (!game.p) return;
        game.check = new Map();
        game.cur.forEach(function (v, i) {
          if (editable(i) && v) game.check.set(i, v === game.p.solution[i] ? "correct" : "wrong");
        });
        paint();
      },
      onReset: function () {
        if (!game.p) return;
        game.cur = game.p.givens.slice();
        game.hints.clear();
        game.check = null;
        game.shell.resetClock();
        paint();
      },
      onHint: function () {
        if (!game.p) return;
        var options = missing();
        if (!options.length) return;
        var i = options[Math.floor(Math.random() * options.length)];
        game.cur[i] = game.p.solution[i];
        game.hints.add(i);
        if (game.check) game.check.delete(i);
        select(i);
      },
      onSolve: function () {
        if (!game.p) return;
        missing().forEach(function (i) {
          game.cur[i] = game.p.solution[i];
          game.hints.add(i);
        });
        game.check = null;
        paint();
      }
    });

    // Bigger puzzles can take a moment to make, so say so first and
    // let the page paint before the work starts.
    var grid = game.shell.grid;
    grid.innerHTML = '<p class="kk-making">Making a puzzle…</p>';
    setTimeout(function () {
      if (game !== current) return;
      var p = Kakuro.make(n, level);
      if (!p) { grid.innerHTML = '<p class="kk-making">Couldn’t make a puzzle. Try New puzzle.</p>'; return; }
      build(p);
      game.shell.resetClock();   // the clock starts when the board appears
    }, 30);
  }

  function build(p) {
    var n = p.n, grid = game.shell.grid;
    game.p = p;
    game.cur = p.givens.slice();
    grid.innerHTML = "";
    for (var i = 0; i < n * n; i++) {
      var el;
      if (p.white[i]) {
        el = document.createElement("button");
        el.type = "button";
        el.className = "gb-cell" + (p.givens[i] ? " given" : "");
        el.dataset.i = i;
        el.tabIndex = -1;
      } else {
        el = document.createElement("div");
        el.className = "kk-block";
        el.setAttribute("aria-hidden", "true");
        if (p.across[i] || p.down[i]) {
          // A clue square: across sum top right, down sum bottom left,
          // split by the diagonal; an unused half stays black.
          el.className += " kk-clue" + (p.across[i] ? " has-a" : "") + (p.down[i] ? " has-d" : "");
          el.innerHTML =
            '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="0" x2="100" y2="100"/></svg>' +
            (p.across[i] ? '<span class="kk-a">' + p.across[i] + "</span>" : "") +
            (p.down[i] ? '<span class="kk-d">' + p.down[i] + "</span>" : "");
        }
      }
      grid.appendChild(el);
      game.cells.push(el);
    }

    // Number pad under the board: 1-9 and erase.
    var pad = document.createElement("div");
    pad.className = "kk-pad";
    pad.setAttribute("aria-label", "Number pad");
    var keys = "";
    for (var d = 1; d <= 9; d++) keys += '<button type="button" data-d="' + d + '" aria-label="' + d + '">' + d + "</button>";
    keys += '<button type="button" data-d="0" aria-label="Erase" title="Erase">' + Board.icon("backspace") + "</button>";
    pad.innerHTML = keys;
    game.shell.below.appendChild(pad);
    pad.addEventListener("click", function (e) {
      var k = e.target.closest("button");
      if (!k || game.sel < 0) return;
      setCell(game.sel, Number(k.dataset.d));
      game.cells[game.sel].focus();
    });

    grid.addEventListener("click", function (e) {
      if (game.shell.done) return;
      var b = e.target.closest(".gb-cell");
      if (b) select(Number(b.dataset.i));
    });
    grid.addEventListener("keydown", function (e) {
      var b = e.target.closest(".gb-cell");
      if (!b) return;
      var i = Number(b.dataset.i);
      var moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (moves[e.key]) {
        e.preventDefault();
        select(step(i, moves[e.key][0], moves[e.key][1]));
      } else if (/^[1-9]$/.test(e.key)) {
        setCell(i, Number(e.key));
      } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        e.preventDefault();
        setCell(i, 0);
      }
    });

    var first = -1;
    for (var f = 0; f < n * n && first < 0; f++) if (editable(f)) first = f;
    select(first < 0 ? p.white.indexOf(true) : first);
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
