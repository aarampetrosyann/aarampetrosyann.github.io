/* ============================================================
   SCRAMBLE.JS
   Hover text effects, and a small shared API other scripts use.

   Elements handled automatically:
     nav links                -> text scrambles into itself
     [data-hover-text]        -> text morphs into that string on
                                 hover and retracts on leave

   Exposed for other scripts:
     window.SiteText.morph(el, toString)

   Skipped on touch screens, when the OS asks for reduced motion,
   and when the hover effect is switched off in site settings.
   ============================================================ */
(function () {
  var CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&$/*";
  var SPEED = 2;   // frames each letter stays scrambled (higher = slower)
  var STAGGER = 3; // frames between one letter resolving and the next

  var canHover = window.matchMedia("(hover: hover)").matches;
  var systemOk = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function motionOff() {
    return document.documentElement.getAttribute("data-motion") === "off";
  }
  function enabled() {
    return canHover && systemOk && !motionOff();
  }
  function rand() {
    return CHARS[Math.floor(Math.random() * CHARS.length)];
  }

  /* Walk an element's text from one string to another.

     Growing text resolves left to right, so the word builds up.
     Shrinking text resolves right to left, so the tail is cleared
     first and the string retracts instead of leaving loose
     characters dangling past the end of the short version. */
  function animateText(el, from, to, done) {
    var len = Math.max(from.length, to.length);
    var reverse = to.length < from.length;
    var frame = 0;
    var rafId = null;

    /* Letters the two strings already share are left alone. [AP] and
       [Aram Petrosyan] both start with "[A", so the animation starts
       at the P and that bracket-A stays put the whole time. */
    var prefix = 0;
    if (from !== to) {
      // Only when the text actually changes. A link scrambling into
      // its own text shares every character, and skipping shared
      // characters would leave nothing to animate.
      while (prefix < from.length && prefix < to.length && from[prefix] === to[prefix]) prefix++;
    }

    function step() {
      var out = "";
      var settled = 0;

      for (var i = 0; i < len; i++) {
        var target = to[i] || "";

        if (i < prefix) {          // shared opening, never scrambled
          out += target;
          settled++;
          continue;
        }

        // Growing text resolves left to right from the first letter
        // that differs. Shrinking text resolves right to left, so the
        // tail clears first and the string retracts.
        var order = reverse ? (len - 1 - i) : (i - prefix);
        var start = order * STAGGER;
        var end = start + SPEED * 3;

        if (frame >= end) {
          out += target;
          settled++;
        } else if (frame >= start) {
          out += target === " " ? " " : rand();
        } else {
          out += from[i] || "";
        }
      }

      el.textContent = out;
      frame++;

      if (settled < len) rafId = requestAnimationFrame(step);
      else {
        el.textContent = to;
        rafId = null;
        if (done) done();
      }
    }

    step();
    return function cancel() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    };
  }

  // Shared helper. Falls back to plain text when effects are off.
  window.SiteText = {
    morph: function (el, to) {
      if (el._cancelMorph) el._cancelMorph();
      if (!enabled()) { el.textContent = to; return; }
      el._cancelMorph = animateText(el, el.textContent, to);
    }
  };

  if (!canHover || !systemOk) return;

  var measurers = [];

  function setup(el) {
    var base = el.textContent;
    var hover = el.getAttribute("data-hover-text");

    el.style.display = "inline-block";
    el.style.whiteSpace = "nowrap";
    el.style.textAlign = "left";

    // Pin the width so the nav doesn't reflow mid-scramble. Skipped
    // for morphing text, which has to be free to grow and shrink.
    function measure() {
      if (hover) return;
      el.style.width = "";
      el.style.width = Math.ceil(el.getBoundingClientRect().width) + "px";
    }

    el.addEventListener("mouseenter", function () {
      window.SiteText.morph(el, hover || base);
    });

    el.addEventListener("mouseleave", function () {
      if (hover) {
        // [AP] retracts from the full name, which is worth animating.
        window.SiteText.morph(el, base);
      } else {
        // A plain link already reads its own text. Animating the exit
        // too makes one hover feel like two, so it just snaps back.
        if (el._cancelMorph) el._cancelMorph();
        el.textContent = base;
      }
    });

    measure();
    return measure;
  }

  function init() {
    // Menu links plus anything tagged .scramble. The settings tab
    // opts out with .no-scramble, since scrambling dots reads as a bug.
    var targets = document.querySelectorAll("nav a:not(.no-scramble), .scramble");
    for (var i = 0; i < targets.length; i++) measurers.push(setup(targets[i]));
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init).catch(init);
  } else {
    window.addEventListener("load", init);
  }

  var timer;
  window.addEventListener("resize", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      for (var i = 0; i < measurers.length; i++) measurers[i]();
    }, 150);
  });
})();
