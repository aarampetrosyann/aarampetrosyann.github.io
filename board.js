/* ============================================================
   BOARD.JS
   The in-game frame shared by every game's board, built after Play
   (see "gamestart" in game.js). A game draws its own squares into
   the grid this builds; everything around them lives here:

   - back arrow (top left) and settings gear (top right), which
     becomes a puzzle piece for a new puzzle once the round is over,
   - the settings pill: Check board, Reset board, Hint, Solve puzzle,
     Show mistakes (remembered per game between visits), and
     Highlight (the selected square's lines; one setting for all),
   - the header above the board: size and level, name, pause, timer,
   - the Solved window with three stars, built in like How to play.

   Usage, from a game's script:
     var shell = Board.create({
       name: "Takuzu", n: 8, level: "Easy", container: board,
       storageKey: "takuzu-show-mistakes",
       onCheck, onReset, onHint, onSolve,   // settings pill (leave out
                                            // onCheck or onSolve to drop it)
       onMistakes(on),                       // Show mistakes toggled
       onNew,                                // New puzzle / puzzle piece
       highlight: false                      // optional: no Highlight switch
     });
   then draw squares into shell.grid (and optionally shell.below),
   read shell.paused / shell.done / shell.showMistakes, and call
   shell.finish() when the puzzle is solved, shell.resetClock() on
   reset, shell.destroy() when leaving.
   ============================================================ */
var Board = (function () {
  var S = window.GameScreen;

  // Material Symbols Rounded "star", filled, weight 500, as SVG.
  var STAR = '<svg viewBox="0 -960 960 960"><path d="M480-259.91 313.28-159.43q-12.67 7.95-26.35 6.83-13.67-1.12-23.86-9.07-10.2-7.96-15.8-20.01-5.6-12.06-2.12-26.73l44.24-189.72-147.72-127.72q-11.43-10.19-14.29-23.25-2.86-13.05 1.38-25.49 4.24-12.43 13.79-20.63 9.56-8.19 25.23-10.19l194.72-17 75.48-178.96q5.72-13.91 17.53-20.63 11.82-6.72 24.49-6.72 12.67 0 24.49 6.72 11.81 6.72 17.53 20.63l75.48 178.96 194.72 17q15.67 2 25.23 10.19 9.55 8.2 13.79 20.63 4.24 12.44 1.38 25.49-2.86 13.06-14.29 23.25L670.61-398.13l44.24 189.72q3.48 14.67-2.12 26.73-5.6 12.05-15.8 20.01-10.19 7.95-23.86 9.07-13.68 1.12-26.35-6.83L480-259.91Z"/></svg>';

  function icon(name) {
    return '<span class="material-symbols-outlined" aria-hidden="true">' + name + "</span>";
  }

  function create(o) {
    var card = S.card, n = o.n;
    var showMistakes = true;
    try { showMistakes = localStorage.getItem(o.storageKey) !== "0"; } catch (err) {}
    // Highlighting the selected square's lines is a matter of taste,
    // so one setting covers every game.
    var highlight = true;
    try { highlight = localStorage.getItem("board-highlight") !== "0"; } catch (err) {}

    var wrap = document.createElement("div");
    wrap.className = "gb";
    wrap.innerHTML =
      '<button class="icon-btn gb-exit" type="button" aria-label="Back to options">' + icon("arrow_back") + "</button>" +
      '<button class="icon-btn gb-again" type="button" aria-label="New puzzle" title="New puzzle" hidden>' + icon("extension") + "</button>" +
      '<button class="icon-btn gb-settings" type="button" aria-label="Settings" aria-expanded="false" aria-controls="gb-menu">' + icon("settings") + "</button>" +
      '<div class="gb-menu" id="gb-menu" role="menu" aria-label="Settings">' +
        (o.onCheck ? '<button type="button" role="menuitem" class="gb-check" aria-label="Check board" title="Check board">' + icon("check") + "</button>" : "") +
        '<button type="button" role="menuitem" class="gb-reset" aria-label="Reset board" title="Reset board">' + icon("restart_alt") + "</button>" +
        '<button type="button" role="menuitem" class="gb-hint" aria-label="Hint" title="Hint">' + icon("lightbulb") + "</button>" +
        (o.onSolve ? '<button type="button" role="menuitem" class="gb-solve" aria-label="Solve puzzle" title="Solve puzzle">' + icon("auto_fix_high") + "</button>" : "") +
        '<button type="button" role="menuitemcheckbox" class="gb-mistakes" aria-label="Show mistakes" title="Show mistakes" aria-checked="true">' + icon("visibility") + "</button>" +
        (o.highlight === false ? "" :
          '<button type="button" role="menuitemcheckbox" class="gb-highlight" aria-label="Highlight row and column" title="Highlight" aria-checked="true">' + icon("water_drop") + "</button>") +
      "</div>" +
      '<div class="gb-board">' +
        // Header right above the board: size and level, name, pause, time.
        '<div class="gb-head">' +
          '<p class="gb-size">' + n + "×" + n + " · " + o.level + "</p>" +
          '<p class="gb-name">' + o.name + "</p>" +
          '<div class="gb-clock">' +
            '<button class="gb-pause" type="button" aria-label="Pause" aria-pressed="false">' + icon("pause") + "</button>" +
            '<p class="gb-timer" role="timer" aria-label="Time">0:00</p>' +
          "</div>" +
        "</div>" +
        '<div class="gb-grid" role="group" aria-label="' + o.name + ", " + n + " by " + n + ", " + o.level + '"></div>' +
        '<div class="gb-below"></div>' +
      "</div>" +
      '<div class="gb-win" role="dialog" aria-labelledby="gb-win-h" hidden>' +
        '<canvas class="build" aria-hidden="true"></canvas>' +
        '<div class="gb-stars" aria-hidden="true">' + STAR + STAR + STAR + "</div>" +
        '<h2 id="gb-win-h">Solved</h2>' +
        '<p class="gb-time"></p>' +
        '<div class="gb-actions">' +
          '<button class="gb-new" type="button">New puzzle</button>' +
          '<button class="gb-back" type="button">Back to puzzle</button>' +
          '<button class="gb-options" type="button">Change options</button>' +
        "</div>" +
      "</div>";
    o.container.appendChild(wrap);

    var q = function (sel) { return wrap.querySelector(sel); };
    var els = {
      board: q(".gb-board"), grid: q(".gb-grid"), below: q(".gb-below"),
      settings: q(".gb-settings"), again: q(".gb-again"), menu: q(".gb-menu"),
      mistakes: q(".gb-mistakes"), highlight: q(".gb-highlight"),
      pause: q(".gb-pause"), timer: q(".gb-timer"),
      win: q(".gb-win")
    };
    els.board.style.setProperty("--sq-n", n);

    // Timer: `base` ms already counted, plus time since `since` while
    // running (since is null while paused or finished).
    var base = 0, since = Date.now(), paused = false, done = false, alive = true;
    var tickId = setInterval(tick, 1000);

    function ms() { return base + (since ? Date.now() - since : 0); }
    function elapsed() {
      var secs = Math.floor(ms() / 1000);
      var h = Math.floor(secs / 3600), m = Math.floor(secs / 60) % 60, sec = secs % 60;
      var mm = h ? String(m).padStart(2, "0") : String(m);
      return (h ? h + ":" : "") + mm + ":" + String(sec).padStart(2, "0");
    }
    function tick() { els.timer.textContent = elapsed(); }

    // Squares are the card's small grid squares, or less on narrow
    // screens; the frame and gutters scale with them, like the icons.
    function fit() {
      var cell = parseFloat(card.style.getPropertyValue("--cell"));
      var size = Math.min(cell, card.clientWidth / n);
      els.board.style.setProperty("--sq", size + "px");
      els.board.style.setProperty("--sq-gap", Math.max(3, Math.round(size * 0.08)) + "px");
    }

    // Pause stops the clock, hides the board and ignores input, so a
    // pause can't be used to keep thinking. Play picks up where it was.
    function setPaused(p) {
      if (p && !paused) { base = ms(); since = null; }
      if (!p && paused) { since = Date.now(); }
      paused = p;
      if (p) setMenu(false);
      els.settings.disabled = p;
      els.grid.classList.toggle("paused", p);
      els.below.classList.toggle("paused", p);
      els.pause.innerHTML = icon(p ? "play_arrow" : "pause");
      els.pause.setAttribute("aria-label", p ? "Resume" : "Pause");
      els.pause.setAttribute("aria-pressed", p ? "true" : "false");
      tick();
    }

    function setMenu(open) {
      if (open && (paused || done)) return;
      els.menu.classList.toggle("open", open);
      els.settings.classList.toggle("open", open);
      els.settings.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) els.menu.querySelector("button").focus();
    }

    function mistakesButton() {
      els.mistakes.innerHTML = icon(showMistakes ? "visibility" : "visibility_off");
      els.mistakes.setAttribute("aria-checked", showMistakes ? "true" : "false");
      els.mistakes.title = showMistakes ? "Show mistakes: on" : "Show mistakes: off";
    }
    mistakesButton();

    // Highlight on or off: the grid's class switches the tints off.
    function highlightButton() {
      if (!els.highlight) return;
      els.highlight.innerHTML = icon(highlight ? "water_drop" : "format_color_reset");
      els.highlight.setAttribute("aria-checked", highlight ? "true" : "false");
      els.highlight.title = highlight ? "Highlight: on" : "Highlight: off";
      els.grid.classList.toggle("no-highlight", !highlight);
    }
    highlightButton();

    // Shows the Solved window, building it in the first time.
    var winShown = false;   // the window has opened once (so a click may bring it back)
    function openWin(build) {
      winShown = true;
      els.win.hidden = false;
      var focusNew = function () { q(".gb-new").focus(); };
      if (!build || S.reduceMotion.matches) { focusNew(); return; }
      els.win.classList.add("building");
      S.buildIn(q(".gb-win .build"), S.hexRGB("--game-button-ink"), S.hexRGB("--game-ink"),
        function () { els.win.classList.remove("building"); focusNew(); });
    }
    function backToPuzzle() {
      els.win.hidden = true;
      var first = els.grid.querySelector("button");
      if (first) first.focus();
    }

    // A click outside the gear or the menu closes the menu.
    function outside(e) {
      if (!e.target.closest(".gb-settings, .gb-menu")) setMenu(false);
    }
    document.addEventListener("click", outside);

    q(".gb-exit").addEventListener("click", S.exit);
    q(".gb-options").addEventListener("click", S.exit);
    q(".gb-new").addEventListener("click", o.onNew);
    els.again.addEventListener("click", o.onNew);
    q(".gb-back").addEventListener("click", backToPuzzle);
    els.win.addEventListener("keydown", function (e) { if (e.key === "Escape") backToPuzzle(); });
    els.pause.addEventListener("click", function () { if (!done) setPaused(!paused); });
    els.settings.addEventListener("click", function () { setMenu(!els.menu.classList.contains("open")); });
    els.menu.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { setMenu(false); els.settings.focus(); }
    });
    if (o.onCheck) q(".gb-check").addEventListener("click", function () { setMenu(false); o.onCheck(); });
    q(".gb-reset").addEventListener("click", function () { setMenu(false); o.onReset(); });
    q(".gb-hint").addEventListener("click", function () { setMenu(false); o.onHint(); });
    if (o.onSolve) q(".gb-solve").addEventListener("click", function () { setMenu(false); o.onSolve(); });
    els.mistakes.addEventListener("click", function () {
      showMistakes = !showMistakes;
      try { localStorage.setItem(o.storageKey, showMistakes ? "1" : "0"); } catch (err) {}
      mistakesButton();

    // Highlight on or off: the grid's class switches the tints off.
    function highlightButton() {
      if (!els.highlight) return;
      els.highlight.innerHTML = icon(highlight ? "water_drop" : "format_color_reset");
      els.highlight.setAttribute("aria-checked", highlight ? "true" : "false");
      els.highlight.title = highlight ? "Highlight: on" : "Highlight: off";
      els.grid.classList.toggle("no-highlight", !highlight);
    }
    highlightButton();
      o.onMistakes(showMistakes);
    });
    if (els.highlight) els.highlight.addEventListener("click", function () {
      highlight = !highlight;
      try { localStorage.setItem("board-highlight", highlight ? "1" : "0"); } catch (err) {}
      highlightButton();
    });
    // On a finished board, a click on it brings the Solved window back,
    // but only after it has opened once: the click that ends a drag
    // solving the puzzle would otherwise open it early, with no build.
    els.grid.addEventListener("click", function () {
      if (done && winShown && els.win.hidden) openWin(false);
    });

    var shell = {
      grid: els.grid,
      below: els.below,
      get paused() { return paused; },
      get done() { return done; },
      get showMistakes() { return showMistakes; },
      fit: fit,

      // Back to zero and running, e.g. after Reset board.
      resetClock: function () {
        base = 0;
        since = Date.now();
        setPaused(false);
      },

      // The puzzle is solved: stop the clock, swap the gear for the
      // puzzle piece, and build in the Solved window.
      finish: function () {
        if (done) return;
        done = true;
        setMenu(false);
        base = ms();
        since = null;
        clearInterval(tickId);
        tick();
        els.pause.disabled = true;
        els.settings.hidden = true;
        els.again.hidden = false;
        els.grid.classList.add("solved");
        q(".gb-time").textContent = n + "×" + n + " · " + o.level + " · " + elapsed();
        setTimeout(function () { if (alive) openWin(true); }, 700);
      },

      destroy: function () {
        alive = false;
        clearInterval(tickId);
        document.removeEventListener("click", outside);
        wrap.remove();
      }
    };
    fit();
    return shell;
  }

  return { create: create, icon: icon };
})();
