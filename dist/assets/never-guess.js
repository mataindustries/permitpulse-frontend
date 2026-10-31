/* Homepage campaign behavior: film theater, inquiry tabs, mobile CTA dock.
   Analytics carry fixed values only, never form contents, names, emails,
   or addresses. The film loads nothing until a visitor presses play. */
(function () {
  "use strict";

  var root = document.documentElement;
  var narrow = window.matchMedia("(max-width: 760px)");

  function track(name, params) {
    if (typeof window.ppTrack === "function") window.ppTrack(name, params || {});
  }

  function safe(fn) {
    return function (arg) {
      try {
        return fn(arg);
      } catch (error) {
        return undefined;
      }
    };
  }

  /* ---------- Film ---------- */

  // Only shown once scripts/prepare-film.mjs has placed the film and set
  // data-film-ready="true"; until then the drawn title card stands alone.
  function setupFilm() {
    var film = document.querySelector("[data-film]");
    var dialog = document.getElementById("film-theater");
    if (!film || !dialog || film.getAttribute("data-film-ready") !== "true") return;

    var src = film.getAttribute("data-film-src");
    var posterSrc = film.getAttribute("data-film-poster");
    var video = dialog.querySelector("video");
    var endCard = dialog.querySelector("[data-film-end]");
    var errorCard = dialog.querySelector("[data-film-error]");
    if (!src || !video) return;

    var saveData = (navigator.connection || {}).saveData === true;
    var marks = [25, 50, 75];
    var reached = {};
    var maxPercent = 0;
    var started = false;
    var completed = false;
    var isOpen = false;
    var opener = null;

    if (posterSrc && !saveData) {
      var poster = new Image();
      poster.className = "ng-film__poster";
      poster.alt = "";
      poster.decoding = "async";
      poster.onload = function () { poster.classList.add("is-loaded"); };
      poster.src = posterSrc;
      film.querySelector(".ng-film__frame").insertBefore(poster, film.querySelector(".ng-film__play"));
      video.poster = posterSrc;
    }

    function show(element, visible) {
      if (element) element.hidden = !visible;
    }

    function bucket(percent) {
      return Math.min(100, Math.floor(percent / 25) * 25);
    }

    // Focus returns to the play button unless the visitor left through a link.
    function cleanup(restoreFocus) {
      if (!isOpen) return;
      isOpen = false;
      video.pause();
      root.classList.remove("ng-film-open");
      track("pp_film_close", { percent_watched: bucket(maxPercent) });
      if (restoreFocus !== false && opener && document.contains(opener)) opener.focus({ preventScroll: true });
    }

    function close(restoreFocus) {
      if (!isOpen) return;
      root.classList.remove("ng-film-open");
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      else dialog.removeAttribute("open");
      cleanup(restoreFocus);
    }

    function open(button) {
      opener = button;
      show(endCard, false);
      show(errorCard, false);
      if (!video.getAttribute("src")) video.src = src;
      root.classList.add("ng-film-open");
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      isOpen = true;
      track("pp_film_open", { film_source: button.getAttribute("data-film-open") || "unknown" });
      var playing = video.play();
      if (playing && typeof playing.catch === "function") playing.catch(function () {});
    }

    document.querySelectorAll("[data-film-open]").forEach(function (button) {
      button.hidden = false;
      button.addEventListener("click", safe(function () { open(button); }));
    });

    dialog.addEventListener("close", safe(cleanup));
    dialog.querySelector("[data-film-close]").addEventListener("click", safe(function () { close(); }));
    dialog.addEventListener("click", safe(function (event) {
      if (event.target === dialog || event.target.classList.contains("ng-theater__stage")) close();
    }));
    dialog.addEventListener("keydown", safe(function (event) {
      if (event.key === "Escape" && typeof dialog.showModal !== "function") close();
    }));
    dialog.querySelectorAll("[data-film-nav]").forEach(function (link) {
      link.addEventListener("click", safe(function () { close(false); }));
    });
    dialog.querySelector("[data-film-replay]").addEventListener("click", safe(function () {
      show(endCard, false);
      video.currentTime = 0;
      var playing = video.play();
      if (playing && typeof playing.catch === "function") playing.catch(function () {});
    }));

    video.addEventListener("play", safe(function () {
      show(endCard, false);
      if (started) return;
      started = true;
      track("pp_film_play", { film_source: opener ? opener.getAttribute("data-film-open") : "unknown" });
    }));
    video.addEventListener("timeupdate", safe(function () {
      if (!video.duration) return;
      var percent = (video.currentTime / video.duration) * 100;
      maxPercent = Math.max(maxPercent, percent);
      marks.forEach(function (mark) {
        if (percent >= mark && !reached[mark]) {
          reached[mark] = true;
          track("pp_film_progress", { percent: mark });
        }
      });
    }));
    video.addEventListener("ended", safe(function () {
      maxPercent = 100;
      if (!completed) {
        completed = true;
        track("pp_film_complete", {});
      }
      show(endCard, true);
      var cta = endCard && endCard.querySelector("a");
      if (cta) cta.focus({ preventScroll: true });
    }));
    video.addEventListener("error", safe(function () {
      show(errorCard, true);
      track("pp_film_error", {});
    }));
  }

  /* ---------- Inquiry tabs ---------- */

  // Without this script both inquiry forms simply stack.
  function setupTabs() {
    var container = document.querySelector("[data-ng-tabs]");
    if (!container) return;
    var list = container.querySelector("[data-ng-tablist]");
    var tabs = Array.prototype.slice.call(container.querySelectorAll("[data-ng-tab]"));
    var panels = {};
    container.querySelectorAll("[data-ng-panel]").forEach(function (panel) {
      panels[panel.getAttribute("data-ng-panel")] = panel;
    });
    if (!list || tabs.length < 2) return;

    list.hidden = false;
    list.setAttribute("role", "tablist");
    list.setAttribute("aria-label", "Choose an inquiry");

    function select(name, byUser) {
      if (!panels[name]) return;
      tabs.forEach(function (tab) {
        var on = tab.getAttribute("data-ng-tab") === name;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.tabIndex = on ? 0 : -1;
        panels[tab.getAttribute("data-ng-tab")].hidden = !on;
      });
      if (byUser) track("pp_inquiry_tab", { tab: name });
    }

    tabs.forEach(function (tab, index) {
      var panel = panels[tab.getAttribute("data-ng-tab")];
      tab.setAttribute("role", "tab");
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      tab.addEventListener("click", safe(function () { select(tab.getAttribute("data-ng-tab"), true); }));
      tab.addEventListener("keydown", safe(function (event) {
        var next = null;
        if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
        else if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
        else if (event.key === "Home") next = tabs[0];
        else if (event.key === "End") next = tabs[tabs.length - 1];
        if (!next) return;
        event.preventDefault();
        select(next.getAttribute("data-ng-tab"), true);
        next.focus();
      }));
    });

    function fromHash() {
      var target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
      return target && panels.workflow.contains(target) ? "workflow" : "parcel";
    }

    select(fromHash(), false);

    // Any link into the intake picks its tab; service cards also preselect the path.
    document.addEventListener("click", safe(function (event) {
      var link = event.target.closest && event.target.closest('a[href="#inquire"], a[href="#research-intake"]');
      if (!link) return;
      var workflow = link.getAttribute("href") === "#inquire";
      select(workflow ? "workflow" : "parcel", false);
      var path = link.getAttribute("data-inquiry-path");
      var field = document.querySelector('#workflow-inquiry-form select[name="inquiry_path"]');
      if (workflow && path && field && field.querySelector('option[value="' + path + '"]')) field.value = path;
    }));
    window.addEventListener("hashchange", safe(function () {
      if (window.location.hash === "#inquire" || window.location.hash === "#research-intake") select(fromHash(), false);
    }));
  }

  /* ---------- Mobile dock ---------- */

  // Phones only: appears once the hero CTA scrolls away, and steps aside
  // for the intake, the footer, and the on-screen keyboard.
  function setupDock() {
    var dock = document.querySelector("[data-ng-dock]");
    var hero = document.querySelector(".ng-hero__actions");
    var intake = document.getElementById("research-intake");
    var footer = document.querySelector(".ng-footer");
    if (!dock || !hero || !intake || !footer || !("IntersectionObserver" in window)) return;

    var state = { hero: true, intake: false, footer: false, typing: false };

    function update() {
      dock.classList.toggle("is-shown", narrow.matches && !state.hero && !state.intake && !state.footer && !state.typing);
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.target === hero) state.hero = entry.isIntersecting;
        if (entry.target === intake) state.intake = entry.isIntersecting;
        if (entry.target === footer) state.footer = entry.isIntersecting;
      });
      update();
    });
    [hero, intake, footer].forEach(function (element) { observer.observe(element); });

    document.addEventListener("focusin", function (event) {
      state.typing = /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName);
      update();
    });
    document.addEventListener("focusout", function () {
      state.typing = false;
      update();
    });
    if (narrow.addEventListener) narrow.addEventListener("change", update);
    dock.hidden = false;
    update();
  }

  safe(setupFilm)();
  safe(setupTabs)();
  safe(setupDock)();
}());
