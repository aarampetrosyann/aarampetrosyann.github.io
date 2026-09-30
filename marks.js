/* ============================================================
   MARKS.JS
   Drops a cross at each point where a horizontal divider crosses
   one of the two vertical rules. The cross itself is drawn in CSS
   from the element's two pseudo-elements.

   They are real elements rather than pseudo-elements because a
   divider needs three marks in total: the full width line itself,
   which uses ::after, plus a + at each end.
   ============================================================ */
(function () {
  function add() {
    var blocks = document.querySelectorAll(".hero, .page-head, section");

    for (var i = 0; i < blocks.length; i++) {
      var el = blocks[i];
      // The last section on a page has no divider, so nothing to mark.
      if (el.tagName === "SECTION" && el.matches("section:last-of-type")) continue;
      if (el.querySelector(":scope > .xmark")) continue;

      var sides = ["left", "right"];
      for (var s = 0; s < sides.length; s++) {
        var mark = document.createElement("span");
        mark.className = "xmark " + sides[s];
        mark.setAttribute("aria-hidden", "true");
        el.appendChild(mark);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", add);
  } else {
    add();
  }
})();
