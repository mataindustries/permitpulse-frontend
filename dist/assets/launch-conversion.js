(function () {
  var FORM_ACTION = "https://formspree.io/f/mojnlqol";
  var selectedTier = "";

  function track(eventName, params) {
    try {
      if (window.gtag) {
        window.gtag("event", eventName, params || {});
      }
    } catch (err) {}
  }

  function bodyDataset() {
    return document.body && document.body.dataset ? document.body.dataset : {};
  }

  function pageContext() {
    var data = bodyDataset();
    return {
      pageType: data.ppPageType || "page",
      jurisdictionSlug: data.ppJurisdictionSlug || "",
      jurisdictionName: data.ppJurisdictionName || "",
      pagePath: location.pathname,
      pageTitle: document.title
    };
  }

  function captureQueryParam(form, name) {
    var value = new URLSearchParams(location.search).get(name) || "";
    var field = form.querySelector('input[name="' + name + '"]');
    if (field) field.value = value;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setSelectedTier(label) {
    selectedTier = label || "";
    document.querySelectorAll('[data-pp-input="requested_tier"]').forEach(function (field) {
      field.value = selectedTier;
    });
    document.querySelectorAll("[data-pp-selected-tier]").forEach(function (node) {
      node.textContent = selectedTier ? "Selected tier: " + selectedTier : "Select a tier above or describe what you need.";
    });
  }

  function buildIntakeMarkup(root) {
    var title = escapeHtml(root.dataset.ppIntakeTitle || "Request Permit History + Risk Report");
    var contextLine = escapeHtml(root.dataset.ppIntakeContext || "Share the address and your goal. PermitPulse replies with the right scope and next step.");
    var source = escapeHtml(root.dataset.ppIntakeSource || "launch_page");
    var jurisdiction = escapeHtml(root.dataset.ppIntakeJurisdiction || "");
    var buttonLabel = escapeHtml(root.dataset.ppIntakeButton || "Request report");
    var formId = root.id ? root.id + "-form" : "pp-intake-form";
    var pageType = escapeHtml(bodyDataset().ppPageType || "page");
    var pagePath = escapeHtml(location.pathname);
    var pageTitle = escapeHtml(document.title);

    root.innerHTML = [
      '<div class="pp-intake">',
      '  <div class="pp-intake-head">',
      '    <div class="kicker">Request intake</div>',
      "    <h2>" + title + "</h2>",
      "    <p class=\"lead\">" + contextLine + "</p>",
      '    <div class="pp-inline-meta">',
      jurisdiction ? '      <span class="pp-chip">Jurisdiction: ' + jurisdiction + "</span>" : "",
      '      <span class="pp-chip" data-pp-selected-tier>Select a tier above or describe what you need.</span>',
      "    </div>",
      "  </div>",
      '  <form class="pp-intake-grid" id="' + formId + '" action="' + FORM_ACTION + '" method="POST">',
      '    <input type="hidden" name="form_type" value="launch_intake" />',
      '    <input type="hidden" name="page_type" value="' + pageType + '" />',
      '    <input type="hidden" name="page_path" value="' + pagePath + '" />',
      '    <input type="hidden" name="page_title" value="' + pageTitle + '" />',
      '    <input type="hidden" name="source" value="' + source + '" />',
      '    <input type="hidden" name="jurisdiction" value="' + jurisdiction + '" />',
      '    <input type="hidden" name="requested_tier" value="" data-pp-input="requested_tier" />',
      '    <input type="hidden" name="utm_source" value="" />',
      '    <input type="hidden" name="utm_medium" value="" />',
      '    <input type="hidden" name="utm_campaign" value="" />',
      '    <input type="hidden" name="utm_term" value="" />',
      '    <input type="hidden" name="utm_content" value="" />',
      '    <div class="pp-intake-row">',
      '      <div class="pp-field">',
      '        <label for="' + formId + '-email">Email</label>',
      '        <input id="' + formId + '-email" name="email" type="email" autocomplete="email" required placeholder="you@company.com" />',
      "      </div>",
      '      <div class="pp-field">',
      '        <label for="' + formId + '-address">Property address</label>',
      '        <input id="' + formId + '-address" name="address" type="text" autocomplete="street-address" required placeholder="123 Main St, Los Angeles, CA" />',
      "      </div>",
      "    </div>",
      '    <div class="pp-intake-row">',
      '      <div class="pp-field">',
      '        <label for="' + formId + '-goal">What are you trying to do?</label>',
      '        <select id="' + formId + '-goal" name="goal" required>',
      '          <option value="">Select one</option>',
      '          <option value="quote">Quote or bid confidently</option>',
      '          <option value="buy">Review before purchase or diligence</option>',
      '          <option value="submit">Prepare or route a submission</option>',
      '          <option value="closeout">Clear a close-out blocker</option>',
      '          <option value="other">Something else</option>',
      "        </select>",
      "      </div>",
      '      <div class="pp-field">',
      '        <label for="' + formId + '-deadline">Deadline</label>',
      '        <input id="' + formId + '-deadline" name="deadline" type="text" placeholder="This week, before escrow, no hard deadline" />',
      "      </div>",
      "    </div>",
      '    <div class="pp-field">',
      '      <label for="' + formId + '-notes">Known permit number, scope, or question</label>',
      '      <textarea id="' + formId + '-notes" name="notes" placeholder="Optional. Share permit number, visible work, or what feels uncertain."></textarea>',
      "    </div>",
      '    <div class="pp-intake-actions">',
      '      <button class="btn btn-primary" type="submit" data-pp-submit-button>' + buttonLabel + "</button>",
      '      <a class="btn btn-secondary" href="tel:+15626762691">Call or text</a>',
      "    </div>",
      '    <p class="pp-form-note">No account required. We follow up with the right scope, timing, and next step for the address.</p>',
      '    <p class="pp-form-state" aria-live="polite"></p>',
      "  </form>",
      "</div>"
    ].join("");
  }

  function wireIntakeForms() {
    document.querySelectorAll("[data-pp-intake-root]").forEach(function (root) {
      buildIntakeMarkup(root);
    });

    document.querySelectorAll('form[id$="-form"]').forEach(function (form) {
      if (!form.closest("[data-pp-intake-root]")) return;

      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(function (name) {
        captureQueryParam(form, name);
      });

      var submitButton = form.querySelector("[data-pp-submit-button]");
      var state = form.querySelector(".pp-form-state");
      var context = pageContext();

      form.addEventListener("submit", async function (event) {
        event.preventDefault();

        var originalLabel = submitButton ? submitButton.textContent : "Request report";
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = "Sending...";
        }
        if (state) {
          state.className = "pp-form-state";
          state.textContent = "";
        }

        try {
          var data = new FormData(form);
          var response = await fetch(form.action, {
            method: "POST",
            body: data,
            headers: { Accept: "application/json" }
          });

          if (!response.ok) {
            throw new Error("Form submission failed");
          }

          track("submit_intake", {
            page_type: context.pageType,
            jurisdiction_slug: context.jurisdictionSlug,
            jurisdiction_name: context.jurisdictionName,
            requested_tier: data.get("requested_tier") || "",
            goal: data.get("goal") || "",
            source: data.get("source") || ""
          });

          form.reset();
          setSelectedTier(selectedTier);
          if (state) {
            state.className = "pp-form-state is-success";
            state.textContent = "Request received. PermitPulse will follow up with the right scope and next step.";
          }
        } catch (error) {
          if (state) {
            state.className = "pp-form-state is-error";
            state.textContent = "Could not submit right now. Call or text 562-676-2691.";
          }
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalLabel;
          }
        }
      });
    });
  }

  function wireTracking() {
    var context = pageContext();

    if (context.pageType === "jurisdiction") {
      track("page_view_jurisdiction", {
        jurisdiction_slug: context.jurisdictionSlug,
        jurisdiction_name: context.jurisdictionName,
        page_path: context.pagePath
      });
    }

    if (context.pageType === "sample_report") {
      track("view_sample_report", {
        page_path: context.pagePath,
        page_title: context.pageTitle
      });
    }

    document.querySelectorAll("[data-pp-track]").forEach(function (node) {
      node.addEventListener("click", function () {
        var type = node.getAttribute("data-pp-track");
        var payload = {
          page_type: context.pageType,
          jurisdiction_slug: context.jurisdictionSlug,
          jurisdiction_name: context.jurisdictionName,
          location: node.getAttribute("data-pp-location") || "",
          href: node.getAttribute("href") || "",
          requested_tier: node.getAttribute("data-pp-tier") || selectedTier || ""
        };

        if (type === "request_report") {
          if (payload.requested_tier) {
            setSelectedTier(payload.requested_tier);
          }
          track("click_request_report", payload);
        }

        if (type === "official_portal") {
          track("click_official_portal", payload);
        }
      });
    });
  }

  function wireTierPrefills() {
    document.querySelectorAll("[data-pp-tier]").forEach(function (node) {
      node.addEventListener("click", function () {
        setSelectedTier(node.getAttribute("data-pp-tier") || "");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireIntakeForms();
    wireTierPrefills();
    wireTracking();
  });
})();
