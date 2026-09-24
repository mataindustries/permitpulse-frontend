(function () {
  "use strict";

  var root = document.documentElement;
  var revealItems = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll("[data-current-year]").forEach(function (element) {
    element.textContent = String(new Date().getFullYear());
  });

  function setupReveal() {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealItems.forEach(function (item) { item.classList.add("is-visible"); });
      return;
    }

    root.classList.add("has-reveal");

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, {
      rootMargin: "0px 0px -8%",
      threshold: 0.08
    });

    revealItems.forEach(function (item, index) {
      item.style.transitionDelay = String(Math.min(index % 4, 3) * 55) + "ms";
      observer.observe(item);
    });
  }

  function showElement(element) {
    if (element) element.hidden = false;
  }

  function hideElement(element) {
    if (element) element.hidden = true;
  }

  function formEventPayload(form) {
    return {
      form_type: form.getAttribute("data-pp-form-type") || "lead",
      page_path: window.location.pathname || "/"
    };
  }

  function prefillSiteCheckIntake() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("source") !== "site-check") return;
    var form = document.getElementById("permit-deep-research-form");
    if (!form) return;

    var handoff;
    try {
      handoff = JSON.parse(window.sessionStorage.getItem("pp_site_check_handoff_v1") || "null");
      window.sessionStorage.removeItem("pp_site_check_handoff_v1");
    } catch (error) {
      return;
    }
    if (!handoff || !Number.isFinite(handoff.created_at) || Date.now() - handoff.created_at > 30 * 60 * 1000 || Date.now() < handoff.created_at) return;
    if (typeof handoff.address !== "string" || !handoff.address.trim() || typeof handoff.intent_label !== "string" || !Array.isArray(handoff.questions)) return;

    function setHidden(name, value) {
      var input = form.querySelector('input[name="' + name + '"]');
      if (!input) {
        input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        form.appendChild(input);
      }
      input.value = value;
    }

    var questions = handoff.questions.filter(function (item) { return typeof item === "string"; }).slice(0, 12);
    form.elements.namedItem("property_address").value = handoff.address.slice(0, 300);
    form.elements.namedItem("research_goal").value = "Planning a build or remodel";
    form.elements.namedItem("research_context").value = "Preliminary Site Check — " + handoff.intent_label + ". Open questions: " + questions.join("; ") + ".";
    setHidden("lead_source", "preliminary-site-check");
    setHidden("page_url", window.location.origin + "/free-tools/site-check/");
    setHidden("originating_tool", "preliminary-site-check");
    setHidden("project_intent", String(handoff.intent || "").slice(0, 40));
    setHidden("site_check_questions", questions.join("; "));
  }

  function setupAsyncForms() {
    document.querySelectorAll("form[data-pp-async-form]").forEach(function (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();

        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        var button = form.querySelector('button[type="submit"]');
        var defaultMarkup = button ? button.innerHTML : "";
        var busyLabel = button ? button.getAttribute("data-busy-label") || "Sending…" : "Sending…";
        var error = document.getElementById(form.getAttribute("data-pp-error-target") || "");
        var success = document.getElementById(form.getAttribute("data-pp-success-target") || "");

        hideElement(error);
        form.setAttribute("aria-busy", "true");
        if (button) {
          button.disabled = true;
          button.textContent = busyLabel;
        }

        window.fetch(form.action, {
          method: form.method || "POST",
          body: new FormData(form),
          headers: { "Accept": "application/json" }
        }).then(function (response) {
          if (!response.ok) throw new Error("form_submit_failed");

          var eventName = form.getAttribute("data-pp-submit-event");
          if (eventName && typeof window.ppTrack === "function") {
            window.ppTrack(eventName, formEventPayload(form));
          }

          form.reset();
          form.hidden = true;
          showElement(success);
          if (success && typeof success.focus === "function") {
            success.focus({ preventScroll: true });
          }
        }).catch(function () {
          showElement(error);
          if (button) {
            button.disabled = false;
            button.innerHTML = defaultMarkup;
          }
        }).finally(function () {
          form.removeAttribute("aria-busy");
        });
      });
    });
  }

  prefillSiteCheckIntake();
  setupReveal();
  setupAsyncForms();
}());
