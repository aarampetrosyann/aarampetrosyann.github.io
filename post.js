/* ============================================================
   POST.JS
   Loaded by every post in posts/. Fills in the parts of a post
   that would otherwise need editing by hand:

   - "On this page": a link to each <h2> in the writing, with
     the section you're reading in bold.
   - A Copy button on each code block, plus its file name when
     the <pre> has data-file="name.ext".
   - The Copy link, LinkedIn and Email share buttons.
   ============================================================ */
(function () {
  var prose = document.querySelector(".prose");
  if (!prose) return;

  /* ---------- On this page ---------- */
  var toc = document.querySelector(".toc");
  var heads = prose.querySelectorAll("h2");
  var links = [];

  if (toc && heads.length) {
    var ul = toc.querySelector("ul");
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      if (!h.id) {
        h.id = h.textContent.toLowerCase().trim()
          .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      ul.appendChild(li);
      links.push(a);
    }
    toc.hidden = false;

    // The current section is the last heading above the top third of the window.
    var markCurrent = function () {
      var line = window.innerHeight / 3, current = 0;
      for (var j = 0; j < heads.length; j++) {
        if (heads[j].getBoundingClientRect().top < line) current = j;
      }
      for (var k = 0; k < links.length; k++) {
        if (k === current) links[k].setAttribute("aria-current", "true");
        else links[k].removeAttribute("aria-current");
      }
    };
    window.addEventListener("scroll", markCurrent, { passive: true });
    window.addEventListener("resize", markCurrent);
    markCurrent();
  }

  /* ---------- Copy buttons on code ---------- */
  function flash(button, text) {
    var label = button.textContent;
    button.textContent = text;
    setTimeout(function () { button.textContent = label; }, 1500);
  }

  var pres = prose.querySelectorAll("pre");
  for (var p = 0; p < pres.length; p++) {
    (function (pre) {
      var box = document.createElement("div");
      box.className = "code";
      var bar = document.createElement("div");
      bar.className = "code-bar";
      if (pre.dataset.file) {
        var name = document.createElement("span");
        name.textContent = pre.dataset.file;
        bar.appendChild(name);
      }
      var copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "Copy";
      copy.addEventListener("click", function () {
        navigator.clipboard.writeText(pre.textContent).then(
          function () { flash(copy, "Copied"); },
          function () { flash(copy, "Couldn't copy"); }
        );
      });
      bar.appendChild(copy);
      pre.parentNode.insertBefore(box, pre);
      box.appendChild(bar);
      box.appendChild(pre);
    })(pres[p]);
  }

  /* ---------- Share ---------- */
  var url = location.href.split("#")[0];
  var title = document.querySelector(".post-head h1");
  title = title ? title.textContent : document.title;

  var copyLink = document.querySelector("[data-share='copy']");
  if (copyLink) {
    copyLink.addEventListener("click", function () {
      navigator.clipboard.writeText(url).then(
        function () { flash(copyLink, "Copied"); },
        function () { flash(copyLink, "Couldn't copy"); }
      );
    });
  }
  var linkedin = document.querySelector("[data-share='linkedin']");
  if (linkedin) {
    linkedin.href = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(url);
  }
  var email = document.querySelector("[data-share='email']");
  if (email) {
    email.href = "mailto:?subject=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(url);
  }
})();
