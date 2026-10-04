/* Hero card motion: plays once, then holds the static final frame, which is
   also every fallback. No network requests; analytics: pp_motion_complete. */
(function () {
  "use strict";

  var fig = document.querySelector("figure.pp-motion[data-pp-motion]");
  if (!fig) return;

  var GATE_MS = 800; // after DOMContentLoaded
  var HOLD_MS = 1000; // partial-view hold
  var LATE_MS = 2500; // later init: static
  var cta = fig.querySelector(".pp-motion__cta");
  var button = fig.querySelector(".pp-motion__control");
  var reduce = matchMedia("(prefers-reduced-motion: reduce)");
  var narrow = matchMedia("(max-width: 560px)");
  var state = "", cut = "", timer = 0, observer, gateAt = Infinity;
  var userPaused = false, inView = false, meaningful = false, inViewSince = 0, reported = false;

  function setState(next) {
    state = next;
    fig.setAttribute("data-pp-motion", next);
  }

  // Ends the run; the static CSS takes over.
  function settle(next) {
    setState(next);
    fig.removeAttribute("data-pp-cut");
    fig.removeAttribute("data-pp-paused");
  }

  function showStatic() {
    settle("static");
    clearTimeout(timer);
    if (observer) observer.disconnect();
    if (button) button.hidden = true;
  }

  function safe(fn) {
    return function (arg) {
      try {
        fn(arg);
      } catch (error) {
        showStatic();
      }
    };
  }

  // Auto pauses never clear a user pause.
  function sync() {
    fig.toggleAttribute("data-pp-paused", state === "armed" || (state === "play" && (userPaused || !inView || document.hidden)));
  }

  // Locks the cut and copies its start times to --d / --m. Also run when
  // arming, so playback never moves an animation back into its delay.
  function setCut() {
    cut = narrow.matches ? "fast" : "standard";
    [["t", "--d"], ["m", "--m"]].forEach(function (hook) {
      fig.querySelectorAll("[data-pp-" + hook[0] + "]").forEach(function (el) {
        el.style.setProperty(hook[1], el.getAttribute("data-pp-" + hook[0]).split(" ")[cut === "fast" ? 0 : 1] + "s");
      });
    });
    fig.setAttribute("data-pp-cut", cut);
  }

  function play() {
    setCut();
    setState("play");
    userPaused = false;
    button.textContent = "Pause";
    button.hidden = false;
    sync();
  }

  function schedule() {
    clearTimeout(timer);
    if (state !== "armed" || !inView || document.hidden) return;
    var at = Math.max(gateAt, meaningful ? 0 : inViewSince + HOLD_MS);
    if (at !== Infinity) timer = setTimeout(safe(play), Math.max(0, at - performance.now()));
  }

  function finish() {
    settle("done");
    button.textContent = "Replay";
    if (!reported && typeof window.ppTrack === "function") window.ppTrack("pp_motion_complete", { cut: cut });
    reported = true;
  }

  // Half the card (or a short viewport) starts; a quarter held HOLD_MS
  // starts too; under a quarter is offscreen.
  function onView(entries) {
    var entry = entries[entries.length - 1];
    var viewport = (entry.rootBounds && entry.rootBounds.height) || innerHeight;
    var share = Math.max(entry.intersectionRatio, entry.intersectionRect.height / viewport);
    var was = inView;
    inView = share >= 0.25;
    meaningful = share >= 0.5;
    if (inView && !was) inViewSince = performance.now();
    update();
  }

  function update() {
    sync();
    schedule();
  }

  function onButton() {
    if (state === "done") return play();
    if (state !== "play") return;
    userPaused = !userPaused;
    button.textContent = userPaused ? "Play" : "Pause";
    sync();
  }

  function ready() {
    if (gateAt === Infinity) gateAt = performance.now() + GATE_MS;
    schedule();
  }

  // Late: past LATE_MS, or the static card already shown in view.
  function late() {
    var r = fig.getBoundingClientRect();
    return performance.now() > LATE_MS || (performance.getEntriesByType("paint").length > 0 && r.top + 24 < innerHeight && r.bottom > 0);
  }

  function init() {
    if (!cta || !button || reduce.matches || late() ||
        (navigator.connection || {}).saveData === true || !("IntersectionObserver" in window)) {
      return showStatic();
    }
    for (var steps = [], i = 0; i <= 20; i += 1) steps.push(i / 20);
    observer = new IntersectionObserver(safe(onView), { threshold: steps });
    setState("armed");
    setCut();
    sync();
    observer.observe(fig);

    fig.addEventListener("animationend", safe(function (e) {
      if (e.target === cta && e.elapsedTime > 0 && state === "play") finish();
    }));
    button.addEventListener("click", safe(onButton));
    document.addEventListener("visibilitychange", safe(update));
    if (reduce.addEventListener) reduce.addEventListener("change", safe(function () {
      if (reduce.matches) showStatic();
    }));
    document.addEventListener("DOMContentLoaded", safe(ready));
    addEventListener("load", safe(ready));
    if (document.readyState === "complete") ready();
  }

  try {
    init();
  } catch (error) {
    showStatic();
  }
}());
