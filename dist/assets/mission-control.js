(function () {
  const REPORT_ENDPOINT = "/api/mission-control/report";
  const state = {
    activeDossier: null,
    activeAction: "",
  };

  const missionForm = document.getElementById("missionForm");
  const runButton = document.getElementById("runButton");
  const loadingPanel = document.getElementById("loadingPanel");
  const loadingSteps = Array.from(document.querySelectorAll("#loadingSteps li"));
  const loadingProgressFill = document.getElementById("loadingProgressFill");
  const emptyPanel = document.getElementById("emptyPanel");
  const dossier = document.getElementById("dossier");
  const copyScriptButton = document.getElementById("copyScriptButton");
  const actionOutput = document.getElementById("actionOutput");
  const toolButtons = Array.from(document.querySelectorAll("[data-mission-action]"));
  const clock = document.getElementById("missionClock");

  function updateClock() {
    const now = new Date();
    clock.textContent = now.toISOString().slice(11, 19) + " UTC";
  }

  updateClock();
  setInterval(updateClock, 1000);

  missionForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    await runMissionScan();
  });

  copyScriptButton.addEventListener("click", async function () {
    if (!state.activeDossier) return;

    try {
      await navigator.clipboard.writeText(state.activeDossier.operatorScript);
      flashButton(copyScriptButton, "Copied");
    } catch (error) {
      flashButton(copyScriptButton, "Clipboard Blocked");
    }
  });

  toolButtons.forEach(function (button) {
    button.addEventListener("click", async function () {
      if (!state.activeDossier) return;
      toolButtons.forEach(function (item) {
        item.classList.toggle("is-active", item === button);
      });
      state.activeAction = button.getAttribute("data-mission-action") || "";
      actionOutput.classList.add("is-updating");
      await wait(220);
      renderActionOutput(state.activeAction, state.activeDossier);
      actionOutput.classList.remove("is-updating");
    });
  });

  async function runMissionScan() {
    const formData = new FormData(missionForm);
    const input = {
      address: String(formData.get("address") || "").trim(),
      city: String(formData.get("city") || "").trim(),
      apn: String(formData.get("apn") || "").trim(),
      permit_number: String(formData.get("permit_number") || "").trim(),
    };

    if (!input.address) {
      document.getElementById("addressInput").focus();
      return;
    }

    runButton.disabled = true;
    loadingPanel.hidden = false;
    emptyPanel.hidden = true;
    dossier.hidden = true;
    resetLoadingIndicators();

    try {
      const [apiDossier] = await Promise.all([
        fetchMissionControlDossier(input),
        simulateLoading()
      ]);
      state.activeDossier = apiDossier;
      state.activeAction = "";
      toolButtons.forEach(function (button) {
        button.classList.remove("is-active");
      });
      renderDossier(apiDossier);
      renderDefaultActionOutput();
      dossier.hidden = false;
      dossier.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      loadingPanel.hidden = true;
      runButton.disabled = false;
    }
  }

  function resetLoadingIndicators() {
    loadingProgressFill.style.width = "0%";
    loadingSteps.forEach(function (step) {
      step.classList.remove("is-active", "is-done");
      const icon = step.querySelector(".step-icon");
      icon.textContent = "○";
      icon.className = "step-icon";
    });
  }

  async function simulateLoading() {
    for (let index = 0; index < loadingSteps.length; index += 1) {
      const step = loadingSteps[index];
      const icon = step.querySelector(".step-icon");
      step.classList.add("is-active");
      icon.textContent = "▶";
      icon.className = "step-icon active";
      loadingProgressFill.style.width = Math.round(((index + 1) / loadingSteps.length) * 100) + "%";
      await wait(320 + index * 60);
      step.classList.remove("is-active");
      step.classList.add("is-done");
      icon.textContent = "✓";
      icon.className = "step-icon done";
    }
    await wait(160);
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function buildMockDossier(input) {
    await wait(180);

    const city = input.city || "Los Angeles";
    const address = input.address + ", " + city + ", CA";
    const apn = input.apn || "5182-014-031";
    const permitNumber = input.permit_number || "MC-2026-01884";

    return {
      projectName: permitNumber ? "Permit " + permitNumber : "Adaptive Reuse / Tenant Improvement",
      address: address,
      apn: apn,
      pulseLabel: "Live pulse: review loop",
      projectSummary:
        "Signals suggest an active mixed-use reuse effort with real forward momentum, but the file is trapped in a review loop around fire-life-safety coordination, phased tenant-improvement scope, and deferred sign package sequencing.",
      pulledAt: new Date().toLocaleString(),
      stats: [
        { label: "Risk Posture", value: "Moderate / Watchlist" },
        { label: "Primary APN", value: apn },
        { label: "Permit Number", value: permitNumber },
        { label: "Jurisdiction", value: city + " Building + Fire" },
        { label: "Job Type", value: "Adaptive reuse + TI" },
        { label: "Permit Family", value: "Core shell / TI / signage" },
        { label: "Latest Activity", value: "Revision request 6 days ago" },
      ],
      confidence: 87,
      riskNarrative:
        "The permit trail points to a project that is still alive, but no longer moving in a straight line. Planning and shell-level routing are already cleared enough to keep the file active, which reduces outright entitlement risk. The problem is execution risk: fire review appears to be pacing the package while a separate tenant-improvement sequence and deferred sign work create more surfaces for comments to reopen. The latest reviewer touch is encouraging, but it likely reflects coordination rather than issuance. The practical reading is that this project can recover quickly if the team closes exact fire comments and keeps linked permit numbers aligned; otherwise, it will continue to show activity without meaningful progress.",
      signals: [
        "Fire review pacing issuance",
        "Recent reviewer touch detected",
        "Deferred sign package risk",
        "Multi-permit coordination required"
      ],
      timeline: [
        {
          date: "Apr 03",
          title: "Revision queue re-opened",
          detail: "Reviewer touch logged after applicant upload, suggesting active coordination rather than abandonment.",
          status: "active"
        },
        {
          date: "Mar 28",
          title: "Applicant resubmittal posted",
          detail: "Updated architectural and code sheets uploaded in response to prior comments.",
          status: "warn"
        },
        {
          date: "Feb 19",
          title: "Tenant-improvement package linked",
          detail: "Secondary permit family associated with occupancy and interior life-safety scope.",
          status: "done"
        },
        {
          date: "Jan 14",
          title: "Fire review comments issued",
          detail: "Alarm sequencing, exiting clearance, and occupancy load notes created a hold condition.",
          status: "warn"
        },
        {
          date: "Dec 02",
          title: "Planning clearance attached",
          detail: "Reuse conditions and zoning notes entered into the active permit record.",
          status: "done"
        },
        {
          date: "Nov 18",
          title: "Core shell permit filed",
          detail: "Initial adaptive reuse filing entered for shell conversion and life-safety upgrades.",
          status: "done"
        }
      ],
      redFlags: [
        {
          title: "Fire comments likely govern the whole schedule",
          detail: "If the latest upload did not fully address egress and alarm sequencing, the shell package can continue to look active while issuance stays blocked.",
          severity: "high"
        },
        {
          title: "Linked permit numbers can hide true progress",
          detail: "A separate tenant-improvement or signage permit may carry dependencies that are not obvious from the primary shell record alone.",
          severity: "medium"
        },
        {
          title: "Recent movement may be procedural only",
          detail: "Reviewer touches within the portal are positive, but they can indicate routing, reassignment, or note cleanup rather than approval.",
          severity: "low"
        }
      ],
      actions: [
        {
          step: "Action 01",
          title: "Confirm the exact fire hold item",
          copy: "Call plan check or review notes to determine whether the open blocker is alarm, exiting, occupancy, or sheet coordination."
        },
        {
          step: "Action 02",
          title: "Map all linked permit families",
          copy: "Pull the tenant-improvement and signage permit numbers into the same operator view before giving schedule guidance."
        },
        {
          step: "Action 03",
          title: "Pressure-test team continuity",
          copy: "Verify whether the GC, architect, or fire consultant changed during the quiet period; if they did, assume another correction cycle."
        }
      ],
      operatorTags: ["Priority: Fire Review", "Mode: Recovery", "Escalation: Moderate"],
      operatorScript:
        "This is PermitPulse Mission Control.\n\nWe are tracking a live permit file at " +
        address +
        ". The visible pattern suggests the project is active but trapped in a review loop.\n\nImmediate operator posture:\n1. Confirm whether the latest activity represents accepted corrections or just reviewer routing.\n2. Ask if any linked tenant-improvement, signage, or deferred-submittal permits must clear before issuance.\n3. If the fire comments are still open, move the conversation toward exact outstanding items, responsible party, and response timing.",
      outputs: {
        clientSummary:
          "Client-ready readout: The project remains active and recoverable, but issuance is likely being paced by unresolved fire review comments and multi-permit coordination. Momentum is real, yet not clean. Near-term success depends on closing the exact life-safety comments and aligning linked permit numbers before another review loop forms.",
        outreachAngle:
          "Outreach angle: position PermitPulse as the team that clarifies hidden blockers across linked permit families. Lead with speed to diagnosis, not generic expediting. The strongest hook is helping the owner or GC understand whether the file is truly close or only showing procedural activity.",
        exportReport:
          "Export staged: mock PDF dossier package prepared with project header, risk narrative, timeline, red flags, action plan, and operator script. This is a UI-only simulation and does not generate a file yet.",
        requestReport:
          "Full report request staged: Mission Control would hand this case off to PermitPulse's deeper dossier workflow, adding public-record retrieval, linked permit verification, correction memo review, and client formatting. No live submission is connected yet."
      }
    };
  }

  async function fetchMissionControlDossier(input) {
    try {
      const response = await fetch(REPORT_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          address: input.address,
          city: input.city,
          apn: input.apn,
          permit_number: input.permit_number,
        }),
      });

      if (!response.ok) {
        throw new Error("report_request_failed:" + response.status);
      }

      const payload = await response.json();
      return normalizeApiDossier(payload, input);
    } catch (error) {
      return buildFallbackDossierFromError(input, error);
    }
  }

  async function buildFallbackDossierFromError(input, error) {
    const fallbackDossier = await buildMockDossier(input);
    const reason = String((error && error.message) || error || "unknown_error");

    fallbackDossier.pulseLabel = "Fallback pulse: local mock";
    fallbackDossier.projectSummary =
      fallbackDossier.projectSummary +
      " API fallback engaged after report request error (" +
      reason +
      ").";
    fallbackDossier.stats = [
      { label: "Mode", value: "Frontend fallback" },
      { label: "Primary APN", value: fallbackDossier.apn },
      { label: "Permit Number", value: input.permit_number || "Not supplied" },
      { label: "Jurisdiction", value: input.city || "Los Angeles" },
      { label: "Endpoint", value: REPORT_ENDPOINT },
      { label: "Fallback Reason", value: reason },
    ];
    fallbackDossier.outputs.exportReport =
      "Export staged: frontend fallback mock dossier is rendering because the Mission Control API did not complete successfully.";
    fallbackDossier.outputs.requestReport =
      "Full report request unavailable from the frontend fallback state. Re-run once /api/mission-control/report is reachable.";

    return fallbackDossier;
  }

  function normalizeApiDossier(payload, input) {
    if (!payload || payload.ok !== true) {
      throw new Error("invalid_report_payload");
    }

    const city = input.city || "Los Angeles";
    const addressLine = input.address || "Address pending";
    const address = addressLine + ", " + city + ", CA";
    const permitNumber = input.permit_number || "Not supplied";
    const apn = input.apn || "Not supplied";
    const confidence = clampPercentage(payload.confidence_score);
    const pulseLabel = payload.project_pulse || "Live pulse: dossier ready";
    const sourceLinks = Array.isArray(payload.source_links) ? payload.source_links : [];

    return {
      projectName: permitNumber !== "Not supplied" ? "Permit " + permitNumber : "Mission Control dossier",
      address: address,
      apn: apn,
      pulseLabel: pulseLabel,
      projectSummary: String(payload.project_summary || "").trim() || "Mission Control returned a dossier without a summary.",
      pulledAt: new Date().toLocaleString(),
      stats: buildStatsFromApiPayload(payload, permitNumber, apn),
      confidence: confidence,
      riskNarrative: buildRiskNarrativeFromPayload(payload),
      signals: buildSignalsFromPayload(payload, sourceLinks),
      timeline: normalizeTimeline(payload.timeline),
      redFlags: normalizeRedFlags(payload.red_flags),
      actions: normalizeActions(payload.next_actions),
      operatorTags: buildOperatorTags(payload, sourceLinks),
      operatorScript: buildOperatorScript(payload, input),
      outputs: buildOutputsFromApiPayload(payload, input, sourceLinks),
    };
  }

  function buildStatsFromApiPayload(payload, permitNumber, apn) {
    const timeline = Array.isArray(payload.timeline) ? payload.timeline : [];
    const latestActivity = timeline.length ? String(timeline[0].date || "Recent activity available") : "Timeline pending";

    return [
      { label: "Risk Posture", value: confidenceBand(payload.confidence_score) },
      { label: "Primary APN", value: apn },
      { label: "Permit Number", value: permitNumber },
      { label: "Jurisdiction", value: String(payload.jurisdiction || "Jurisdiction pending") },
      { label: "Mode", value: String(payload.mode || "report") },
      { label: "Latest Activity", value: latestActivity },
    ];
  }

  function buildRiskNarrativeFromPayload(payload) {
    const redFlags = Array.isArray(payload.red_flags) ? payload.red_flags : [];
    const nextActions = Array.isArray(payload.next_actions) ? payload.next_actions : [];
    const narrativeParts = [String(payload.project_summary || "").trim()];

    if (redFlags.length) {
      narrativeParts.push("Primary escalation point: " + String(redFlags[0].detail || "").trim());
    }

    if (nextActions.length) {
      narrativeParts.push("Immediate next move: " + String(nextActions[0].detail || "").trim());
    }

    return narrativeParts.filter(Boolean).join(" ");
  }

  function buildSignalsFromPayload(payload, sourceLinks) {
    const redFlags = Array.isArray(payload.red_flags) ? payload.red_flags : [];
    const signals = redFlags.slice(0, 3).map(function (flag) {
      return String(flag.title || "").trim();
    }).filter(Boolean);

    if (payload.mode) {
      signals.push("Mode: " + String(payload.mode));
    }

    if (sourceLinks.length) {
      signals.push("Sources: " + sourceLinks.length);
    }

    if (!signals.length && payload.project_pulse) {
      signals.push(String(payload.project_pulse));
    }

    return signals.slice(0, 5);
  }

  function normalizeTimeline(entries) {
    const timeline = Array.isArray(entries) ? entries : [];

    return timeline.map(function (entry) {
      return {
        date: formatTimelineDate(entry && entry.date),
        title: String((entry && entry.event) || "Timeline event").trim(),
        detail: String((entry && entry.detail) || "").trim(),
        status: normalizeStatus(entry && entry.status),
      };
    });
  }

  function normalizeRedFlags(flags) {
    const redFlags = Array.isArray(flags) ? flags : [];

    return redFlags.map(function (flag) {
      return {
        title: String((flag && flag.title) || "Flag").trim(),
        detail: String((flag && flag.detail) || "").trim(),
        severity: normalizeSeverity(flag && flag.severity),
      };
    });
  }

  function normalizeActions(actions) {
    const nextActions = Array.isArray(actions) ? actions : [];

    return nextActions.map(function (action, index) {
      return {
        step: String((action && action.step) || ("Action " + padActionNumber(index + 1))).trim(),
        title: String((action && action.title) || "Recommended action").trim(),
        copy: String((action && action.detail) || "").trim(),
      };
    });
  }

  function buildOperatorTags(payload, sourceLinks) {
    const tags = [];

    tags.push("Mode: " + String(payload.mode || "report"));
    tags.push("Confidence: " + clampPercentage(payload.confidence_score) + "%");
    tags.push("Jurisdiction: " + String(payload.jurisdiction || "pending"));

    if (sourceLinks.length) {
      tags.push("Sources: " + sourceLinks.length);
    }

    return tags;
  }

  function buildOperatorScript(payload, input) {
    const addressLine = input.address || "the subject property";
    const city = input.city || "the target jurisdiction";
    const timeline = Array.isArray(payload.timeline) ? payload.timeline : [];
    const firstAction = Array.isArray(payload.next_actions) && payload.next_actions.length
      ? payload.next_actions[0]
      : null;

    return [
      "This is PermitPulse Mission Control.",
      "",
      "We are tracking " + addressLine + " in " + city + ".",
      "Current pulse: " + String(payload.project_pulse || "permit activity under review") + ".",
      "",
      "Immediate operator posture:",
      "1. Confirm the most recent visible event: " + String((timeline[0] && timeline[0].event) || "timeline pending") + ".",
      "2. Pressure-test the lead blocker described in the dossier before making schedule claims.",
      "3. Move next on " + String((firstAction && firstAction.title) || "record validation") + ".",
    ].join("\n");
  }

  function buildOutputsFromApiPayload(payload, input, sourceLinks) {
    const sourceLabel = sourceLinks.length
      ? sourceLinks.map(function (link) { return link.label; }).join(", ")
      : "Mission Control sources";

    return {
      clientSummary:
        "Client-ready readout: " + String(payload.project_summary || "").trim(),
      outreachAngle:
        "Outreach angle: " + String(payload.outreach_angle || "").trim(),
      exportReport:
        "Export staged: dossier rendered from /api/mission-control/report for " +
        (input.address || "the requested property") +
        ". Source set: " +
        sourceLabel +
        ".",
      requestReport:
        "Full report request staged: Mission Control dossier returned in " +
        String(payload.mode || "report") +
        " mode. Use this output as the intake layer for deeper PermitPulse review.",
    };
  }

  function confidenceBand(value) {
    const confidence = clampPercentage(value);

    if (confidence >= 80) return "High / Moving";
    if (confidence >= 60) return "Moderate / Watchlist";
    if (confidence >= 40) return "Cautious / Validate";
    return "Low / Thin record";
  }

  function clampPercentage(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }

  function normalizeStatus(value) {
    const status = String(value || "").toLowerCase();
    if (status === "done" || status === "warn" || status === "active") {
      return status;
    }
    return "active";
  }

  function normalizeSeverity(value) {
    const severity = String(value || "").toLowerCase();
    if (severity === "high" || severity === "medium" || severity === "low") {
      return severity;
    }
    return "low";
  }

  function formatTimelineDate(value) {
    if (!value) return "Unknown";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    });
  }

  function padActionNumber(value) {
    return String(value).padStart(2, "0");
  }

  function renderDossier(data) {
    document.getElementById("projectName").textContent = data.projectName;
    document.getElementById("projectAddress").textContent = data.address;
    document.getElementById("projectSummary").textContent =
      data.projectSummary + " Pulled " + data.pulledAt + ".";
    document.getElementById("riskNarrative").textContent = data.riskNarrative;
    document.getElementById("confidenceValue").textContent = data.confidence + "%";
    document.getElementById("confidenceFill").style.width = data.confidence + "%";
    document.getElementById("confidenceBadge").textContent = data.confidence + "% confidence";
    document.getElementById("pulseBadge").textContent = data.pulseLabel;
    document.getElementById("operatorScript").textContent = data.operatorScript;

    document.getElementById("projectStats").innerHTML = data.stats.map(function (stat) {
      return (
        '<div class="stat-card">' +
          '<span class="stat-label">' + escapeHtml(stat.label) + "</span>" +
          '<div class="stat-value">' + escapeHtml(stat.value) + "</div>" +
        "</div>"
      );
    }).join("");

    document.getElementById("signalStrip").innerHTML = data.signals.map(function (signal) {
      return '<span class="signal-pill">' + escapeHtml(signal) + "</span>";
    }).join("");

    document.getElementById("timelineList").innerHTML = data.timeline.map(function (entry) {
      return (
        '<li class="timeline-item">' +
          '<div class="timeline-date">' + escapeHtml(entry.date) + "</div>" +
          '<div class="timeline-main">' +
            '<span class="timeline-dot ' + escapeHtml(entry.status) + '"></span>' +
            '<h3 class="timeline-title">' + escapeHtml(entry.title) + "</h3>" +
            '<p class="timeline-detail">' + escapeHtml(entry.detail) + "</p>" +
          "</div>" +
        "</li>"
      );
    }).join("");

    document.getElementById("redFlagsList").innerHTML = data.redFlags.map(function (flag) {
      const severityLabel = flag.severity === "high" ? "High" : flag.severity === "medium" ? "Medium" : "Low";
      return (
        '<section class="flag-card">' +
          '<div class="flag-head">' +
            '<h3 class="flag-title">' + escapeHtml(flag.title) + "</h3>" +
            '<span class="severity ' + escapeHtml(flag.severity) + '">' + severityLabel + "</span>" +
          "</div>" +
          '<p class="flag-meta">' + escapeHtml(flag.detail) + "</p>" +
        "</section>"
      );
    }).join("");

    document.getElementById("actionsList").innerHTML = data.actions.map(function (action) {
      return (
        '<section class="action-card">' +
          '<div class="action-step"><span>' + escapeHtml(action.step) + "</span></div>" +
          '<h3 class="action-title">' + escapeHtml(action.title) + "</h3>" +
          '<p class="action-copy">' + escapeHtml(action.copy) + "</p>" +
        "</section>"
      );
    }).join("");

    document.getElementById("operatorTags").innerHTML = data.operatorTags.map(function (tag) {
      return '<span class="operator-tag">' + escapeHtml(tag) + "</span>";
    }).join("");
  }

  function renderDefaultActionOutput() {
    actionOutput.innerHTML =
      '<p class="action-output-kicker">Output Console</p>' +
      '<p class="action-output-body">The dossier is live. Tap an action above to generate a mock client summary, outreach angle, export status, or full-report handoff.</p>';
  }

  function renderActionOutput(action, dossierData) {
    const copyByAction = {
      "client-summary": dossierData.outputs.clientSummary,
      "outreach-angle": dossierData.outputs.outreachAngle,
      "export-report": dossierData.outputs.exportReport,
      "request-report": dossierData.outputs.requestReport
    };

    const labels = {
      "client-summary": "Client Summary",
      "outreach-angle": "Outreach Angle",
      "export-report": "Export Report",
      "request-report": "Full Report Request"
    };

    actionOutput.innerHTML =
      '<p class="action-output-kicker">' + escapeHtml(labels[action] || "Output Console") + "</p>" +
      '<p class="action-output-body">' + escapeHtml(copyByAction[action] || "") + "</p>";
  }

  function flashButton(button, text) {
    const original = button.textContent;
    button.textContent = text;
    setTimeout(function () {
      button.textContent = original;
    }, 1200);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
