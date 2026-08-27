(function () {
  "use strict";

  var root = document.querySelector("[data-case-integrity-demo]");
  if (!root) return;

  var form = root.querySelector("[data-demo-form]");
  var runButton = root.querySelector("[data-demo-run]");
  var addressInput = root.querySelector("[data-sample-property]");
  var disclosure = root.querySelector("[data-demo-disclosure]");
  var loadError = root.querySelector("[data-demo-error]");
  var progress = root.querySelector("[data-demo-progress]");
  var progressState = root.querySelector("[data-demo-progress-state]");
  var liveStatus = root.querySelector("[data-demo-live-status]");
  var result = root.querySelector("[data-demo-result]");
  var evidenceGrid = root.querySelector("[data-demo-evidence]");
  var conflictConfidence = root.querySelector("[data-conflict-confidence]");
  var clientStatement = root.querySelector("[data-client-statement]");
  var nextQuestion = root.querySelector("[data-next-question]");
  var unknownStatus = root.querySelector("[data-unknown-status]");
  var unknownStatement = root.querySelector("[data-unknown-statement]");
  var checks = Array.prototype.slice.call(root.querySelectorAll("[data-demo-check]"));
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var demoData = null;
  var running = false;

  function hasText(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function isSourceEvidence(record) {
    return record &&
      hasText(record.id) &&
      hasText(record.observed_display_value) &&
      record.source_authority === "official" &&
      record.source &&
      hasText(record.source.source_agency) &&
      hasText(record.source.source_title) &&
      hasText(record.source.retrieved_at) &&
      record.source.record_origin === "source_evidence" &&
      record.provenance &&
      record.provenance.is_ai_generated === false;
  }

  function isClientSafeDemo(value) {
    if (!value || value.schema_version !== "case-integrity-public-demo-v1") return false;
    if (value.demo_kind !== "fixture_powered") return false;
    if (!value.sample_property || value.sample_property.fictional !== true) return false;
    if (!value.integrity_boundary ||
        value.integrity_boundary.deterministic_validation !== true ||
        value.integrity_boundary.ai_used !== false ||
        value.integrity_boundary.client_safe_projection_validated !== true) return false;

    var conflict = value.conflict;
    if (!conflict ||
        conflict.classification !== "conflict" ||
        !conflict.normalized_value ||
        conflict.normalized_value.kind !== "unresolved" ||
        conflict.confidence.conclusion !== null ||
        conflict.human_review_required !== true ||
        conflict.ai_interpretation !== null ||
        !hasText(conflict.statement) ||
        !hasText(conflict.next_question) ||
        !Array.isArray(conflict.evidence) ||
        conflict.evidence.length !== 2 ||
        !conflict.evidence.every(isSourceEvidence)) return false;

    var unknown = value.unknown_example;
    return Boolean(unknown &&
      unknown.separate_sample === true &&
      unknown.classification === "unknown" &&
      unknown.normalized_value &&
      unknown.normalized_value.kind === "unknown" &&
      unknown.confidence.conclusion === null &&
      unknown.human_review_required === true &&
      unknown.ai_interpretation === null &&
      hasText(unknown.statement));
  }

  function textElement(tag, className, value) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    return element;
  }

  function formatEvidenceType(value) {
    return String(value || "source record").replace(/_/g, " ");
  }

  function formatRetrievedAt(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Retrieval time unavailable";
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC"
    }).format(date) + " UTC";
  }

  function appendDetail(list, term, description, className) {
    list.appendChild(textElement("dt", "", term));
    list.appendChild(textElement("dd", className || "", description));
  }

  function createEvidenceCard(record) {
    var card = document.createElement("article");
    card.className = "case-demo-evidence-card";
    card.setAttribute("aria-label", record.source.source_agency + " source observation: " + record.observed_display_value);

    var badges = document.createElement("div");
    badges.className = "case-demo-evidence-card__badges";
    badges.appendChild(textElement("span", "", "Official source"));
    badges.appendChild(textElement("span", "", "Source observation"));
    card.appendChild(badges);
    card.appendChild(textElement("p", "case-demo-evidence-card__agency", record.source.source_agency));
    card.appendChild(textElement("h3", "", record.claim_label));
    card.appendChild(textElement("strong", "case-demo-evidence-card__value", record.observed_display_value));

    var details = document.createElement("details");
    var summary = textElement("summary", "", "Source & retrieval details");
    var list = document.createElement("dl");
    appendDetail(list, "Source record", record.source.source_title);
    appendDetail(list, "Retrieved", formatRetrievedAt(record.source.retrieved_at));
    appendDetail(list, "Evidence type", formatEvidenceType(record.source.evidence_type));
    appendDetail(list, "Evidence ID", record.id, "case-demo-breakable");
    appendDetail(list, "Anonymized locator", record.source.source_url || "Not available", "case-demo-breakable");
    details.appendChild(summary);
    details.appendChild(list);
    card.appendChild(details);

    return card;
  }

  function renderEvidence(records) {
    evidenceGrid.replaceChildren();
    records.forEach(function (record, index) {
      evidenceGrid.appendChild(createEvidenceCard(record));
      if (index === 0) {
        var divider = document.createElement("div");
        divider.className = "case-demo-evidence__divider";
        divider.setAttribute("aria-hidden", "true");
        divider.appendChild(textElement("span", "", "≠"));
        divider.appendChild(textElement("small", "", "conflict"));
        evidenceGrid.appendChild(divider);
      }
    });
  }

  function renderResult() {
    var conflict = demoData.conflict;
    renderEvidence(conflict.evidence);
    conflictConfidence.textContent = conflict.confidence.classification +
      "% confidence the sources disagree · underlying designation unresolved";
    clientStatement.textContent = conflict.statement;
    nextQuestion.textContent = conflict.next_question;
    unknownStatus.textContent = demoData.unknown_example.classification.toUpperCase();
    unknownStatement.textContent = demoData.unknown_example.statement +
      " Additional verification is required.";
  }

  function wait(duration) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, duration);
    });
  }

  function resetCheck(check, index) {
    check.classList.remove("is-checking", "is-complete");
    check.querySelector("[data-check-icon]").textContent = String(index + 1).padStart(2, "0");
    check.querySelector("[data-check-status]").textContent = "Queued";
  }

  function startCheck(check) {
    check.classList.add("is-checking");
    check.querySelector("[data-check-status]").textContent = "Checking";
  }

  function completeCheck(check) {
    check.classList.remove("is-checking");
    check.classList.add("is-complete");
    check.querySelector("[data-check-icon]").textContent = "✓";
    check.querySelector("[data-check-status]").textContent = "Checked";
  }

  function track(eventName) {
    if (typeof window.ppTrack === "function") {
      window.ppTrack(eventName, { demo_type: "fictional_fixture" });
    }
  }

  async function runDemo(event) {
    event.preventDefault();
    if (!demoData || running) return;
    running = true;
    track("pp_case_integrity_demo_start");

    result.hidden = true;
    result.classList.remove("is-revealed");
    progress.hidden = false;
    progressState.textContent = "Reviewing sample";
    checks.forEach(resetCheck);
    runButton.disabled = true;
    runButton.textContent = "Checking sample evidence…";

    for (var index = 0; index < checks.length; index += 1) {
      var check = checks[index];
      var label = check.querySelector("strong").textContent;
      startCheck(check);
      liveStatus.textContent = "Checking " + label + ".";
      await wait(reduceMotion ? 0 : 360);
      completeCheck(check);
      await wait(reduceMotion ? 0 : 110);
    }

    progressState.textContent = "Integrity check complete";
    liveStatus.textContent = "Sample check complete. An official-source conflict was found.";
    renderResult();
    result.hidden = false;
    window.requestAnimationFrame(function () {
      result.classList.add("is-revealed");
    });
    runButton.disabled = false;
    runButton.textContent = "Run sample again";
    running = false;
    track("pp_case_integrity_conflict_reveal");

    result.focus({ preventScroll: true });
    result.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start"
    });
  }

  function prepareDemo(value) {
    if (!isClientSafeDemo(value)) throw new Error("unsafe_demo_payload");
    demoData = value;
    addressInput.value = value.sample_property.address_line_1 + ", " + value.sample_property.locality;
    disclosure.textContent = "Fictional sample · validated fixture · no live lookup";
    runButton.textContent = "Run Case Integrity check";
    runButton.disabled = false;
  }

  function failClosed() {
    demoData = null;
    runButton.textContent = "Sample unavailable";
    runButton.disabled = true;
    loadError.hidden = false;
  }

  form.addEventListener("submit", runDemo);

  window.fetch("/assets/case-integrity-demo-data.json", {
    credentials: "same-origin",
    headers: { "Accept": "application/json" }
  }).then(function (response) {
    if (!response.ok) throw new Error("demo_payload_unavailable");
    return response.json();
  }).then(prepareDemo).catch(failClosed);
}());
