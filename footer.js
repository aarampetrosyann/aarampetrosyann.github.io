/* ============================================================
   FOOTER.JS
   Keeps the copyright year in the footer current on its own.
   ============================================================ */
(function () {
  var yr = document.querySelector(".site-footer .yr");
  if (yr) yr.textContent = new Date().getFullYear();
})();
