/* ============================================================
   SCRAMBLE.JS
   On hover, nav link text cycles through random characters and
   resolves back, one letter at a time, left to right.

   To use it on something else, add class="scramble" to it.
   To tune the feel, change SPEED and CHARS below.
   ============================================================ */
(function () {
  var CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&$/*";
  var SPEED = 4;   // frames each letter stays scrambled (higher = slower)
  var STAGGER = 5; // frames between one letter resolving and the next

  // Skip it entirely on touch screens and for anyone who has asked
  // their system to reduce motion.
  var canHover = window.matchMedia("(hover: hover)").matches;
  var wantsMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!canHover || !wantsMotion) return;

  var items = [];

  function setup(el) {
    var original = el.textContent;
    var frame = 0;
    var rafId = null;

    el.style.display = "inline-block";
    el.style.whiteSpace = "nowrap";
    el.style.textAlign = "left";

    // Lock each link to the width of its real text so the nav never
    // reflows while random letters cycle through. Measured after the
    // web font loads, otherwise the number comes from the fallback
    // font and is wrong.
    function measure() {
      el.style.width = "";
      el.style.width = Math.ceil(el.getBoundingClientRect().width) + "px";
    }

    function stop() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      el.textContent = original;
    }

    function run() {
      var out = "";
      var done = 0;

      for (var i = 0; i < original.length; i++) {
        var char = original[i];
        var start = i * STAGGER;
        var end = start + SPEED * 3;

        if (char === " ") {
          out += " ";
          done++;
        } else if (frame >= end) {
          out += char;      // this letter has settled
          done++;
        } else if (frame >= start) {
          out += CHARS[Math.floor(Math.random() * CHARS.length)];
        } else {
          out += char;      // hasn't started scrambling yet
        }
      }

      el.textContent = out;
      frame++;

      if (done < original.length) {
        rafId = requestAnimationFrame(run);
      } else {
        stop();
      }
    }

    el.addEventListener("mouseenter", function () {
      if (rafId) cancelAnimationFrame(rafId);
      frame = 0;
      run();
    });

    el.addEventListener("mouseleave", stop);
    el.addEventListener("blur", stop);

    measure();
    return measure;
  }

  function init() {
    // The nav menu links, plus anything you tag with class="scramble".
    // "nav ul a" deliberately leaves out the name in the corner.
    var targets = document.querySelectorAll("nav ul a, .scramble");
    for (var i = 0; i < targets.length; i++) items.push(setup(targets[i]));
  }

  // Wait for the web font before measuring. The catch covers older
  // browsers that don't support document.fonts.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init).catch(init);
  } else {
    window.addEventListener("load", init);
  }

  // Font size changes at the mobile breakpoint, so re-measure on resize.
  var timer;
  window.addEventListener("resize", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      for (var i = 0; i < items.length; i++) items[i]();
    }, 150);
  });
})();
