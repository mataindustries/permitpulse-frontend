(function () {
  const state = {
    activeDossier: null,
  };

  const missionForm = document.getElementById("missionForm");
  const runButton = document.getElementById("runButton");
  const loadingPanel = document.getElementById("loadingPanel");
  const loadingSteps = Array.from(document.querySelectorAll("#loadingSteps li .step-icon"));
  const emptyPanel = document.getElementById("emptyPanel");
  const dossier = document.getElementById("dossier");
  const copyScriptButton = document.getElementById("copyScriptButton");
  const clock = document.getElementById("missionClock");

  function updateClock() {
    const now = new Date();
    clock.textContent = `${now.toISOString().slice(11, 19)} UTC`;
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
      copyScriptButton.textContent = "Copied";
      setTimeout(function () {
        copyScriptButton.textContent = "Copy Script";
      }, 1200);
    } catch (error) {
      copyScriptButton.textContent = "Clipboard Blocked";
      setTimeout(function () {
        copyScriptButton.textContent = "Copy Script";
      }, 1200);
    }
  });

  async function runMissionScan() {
    const formData = new FormData(missionForm);
    const input = {
      address: String(formData.get("address") || "").trim(),
      city: String(formData.get("city") || "").trim(),
      apn: String(formData.get("apn") || "").trim(),
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
      await simulateLoading();
      const mockDossier = await buildMockDossier(input);
      state.activeDossier = mockDossier;
      renderDossier(mockDossier);
      dossier.hidden = false;
      dossier.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      loadingPanel.hidden = true;
      runButton.disabled = false;
    }
  }

  function resetLoadingIndicators() {
    loadingSteps.forEach(function (stepIcon) {
      stepIcon.textContent = "○";
      stepIcon.className = "step-icon";
    });
  }

  async function simulateLoading() {
    for (let index = 0; index < loadingSteps.length; index += 1) {
      const current = loadingSteps[index];
      current.textContent = "▶";
      current.className = "step-icon active";
      await wait(380);
      current.textContent = "✓";
      current.className = "step-icon done";
    }
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function buildMockDossier(input) {
    await wait(160);

    // TODO: Replace this mock builder with a real PermitPulse dossier request.
    // Expected integration shape:
    // 1. Resolve parcel + jurisdiction metadata from address/APN.
    // 2. Fetch permit activity, inspection events, and public-record flags.
    // 3. Return normalized JSON for the sections rendered below.
    const city = input.city || "Los Angeles";
    const address = `${input.address}, ${city}, CA`;

    return {
      projectName: "Adaptive Reuse / Tenant Improvement",
      address: address,
      projectSummary:
        "Signals suggest an active commercial reuse effort with moderate momentum but elevated coordination risk around fire review, phased approvals, and deferred tenant-improvement scope.",
      pulledAt: new Date().toLocaleString(),
      stats: [
        { label: "Risk Posture", value: "Moderate / Watchlist" },
        { label: "Primary APN", value: input.apn || "5182-014-031" },
        { label: "Jurisdiction", value: `${city} Building + Fire` },
        { label: "Latest Activity", value: "Revision request 6 days ago" },
      ],
      confidence: 82,
      riskNarrative:
        "The permit trail points to a project that is still alive, but it is no longer moving cleanly. Plan review activity resumed after a quiet period, which usually means the file was reopened to address cross-department comments rather than to issue approvals. Fire review appears to be the pacing item. That matters because the timeline already shows phased activity and a tenant-improvement scope that can fragment across disciplines. The likely near-term outcome is not rejection, but another correction loop unless the applicant closes the fire-life-safety comments quickly.",
      timeline: [
        {
          date: "2025-11-18",
          title: "Core shell permit filed",
          detail: "Initial adaptive reuse filing entered for shell conversion and life-safety upgrades.",
          status: "done",
        },
        {
          date: "2025-12-02",
          title: "Planning clearance attached",
          detail: "Zoning path cleared with reuse conditions recorded in portal notes.",
          status: "done",
        },
        {
          date: "2026-01-14",
          title: "Fire review comments issued",
          detail: "Egress and alarm sequencing comments created a downstream hold condition.",
          status: "warn",
        },
        {
          date: "2026-03-28",
          title: "Applicant resubmittal logged",
          detail: "Updated sheets uploaded, but no discipline has fully signed off yet.",
          status: "warn",
        },
        {
          date: "2026-04-03",
          title: "Revision queue active",
          detail: "Portal reflects reviewer touch within the past week, indicating the file is still live.",
          status: "active",
        },
      ],
      redFlags: [
        {
          title: "Fire review pacing the file",
          detail: "Cross-discipline approvals often stall when fire comments remain unresolved after architectural resubmittal.",
          severity: "high",
        },
        {
          title: "Phased permit structure",
          detail: "Separate shell and tenant-improvement sequencing can create false progress unless final dependencies are tracked together.",
          severity: "medium",
        },
        {
          title: "Recent movement may be procedural only",
          detail: "A fresh reviewer touch does not mean approval is imminent; it may only indicate comment routing.",
          severity: "low",
        },
      ],
      actions: [
        {
          step: "Action 01",
          title: "Confirm the exact fire hold item",
          copy: "Call plan check or review portal notes to determine whether the blocking issue is alarm, exiting, or occupancy classification.",
        },
        {
          step: "Action 02",
          title: "Check for separate TI permit numbers",
          copy: "Make sure any linked tenant-improvement permits are pulled into the same operator view before advising on schedule risk.",
        },
        {
          step: "Action 03",
          title: "Pressure-test contractor continuity",
          copy: "If a contractor change or design-team handoff happened during the quiet period, expect another resubmittal cycle.",
        },
      ],
      operatorTags: ["Priority: Fire Review", "Mode: Recovery", "Escalation: Moderate"],
      operatorScript:
        "This is PermitPulse Mission Control.\n\nWe are tracking a live permit file at " +
        address +
        ". The visible pattern suggests the project is active but trapped in a review loop.\n\nImmediate operator posture:\n1. Confirm whether the latest activity represents accepted corrections or just reviewer routing.\n2. Ask if any linked tenant-improvement or deferred-submittal permits need to clear before issuance.\n3. If the fire comments are still open, move the conversation toward exact outstanding items and response timing.",
    };
  }

  function renderDossier(data) {
    document.getElementById("projectName").textContent = data.projectName;
    document.getElementById("projectAddress").textContent = data.address;
    document.getElementById(
      "projectSummary"
    ).textContent = `${data.projectSummary} Pulled ${data.pulledAt}.`;
    document.getElementById("riskNarrative").textContent = data.riskNarrative;
    document.getElementById("confidenceValue").textContent = `${data.confidence}%`;
    document.getElementById("confidenceFill").style.width = `${data.confidence}%`;
    document.getElementById("operatorScript").textContent = data.operatorScript;

    document.getElementById("projectStats").innerHTML = data.stats
      .map(function (stat) {
        return `
          <div class="stat-card">
            <span class="stat-label">${escapeHtml(stat.label)}</span>
            <div class="stat-value">${escapeHtml(stat.value)}</div>
          </div>
        `;
      })
      .join("");

    document.getElementById("timelineList").innerHTML = data.timeline
      .map(function (entry) {
        return `
          <li class="timeline-item">
            <span class="timeline-dot ${escapeHtml(entry.status)}"></span>
            <div class="timeline-date">${escapeHtml(entry.date)}</div>
            <h3 class="timeline-title">${escapeHtml(entry.title)}</h3>
            <p class="timeline-detail">${escapeHtml(entry.detail)}</p>
          </li>
        `;
      })
      .join("");

    document.getElementById("redFlagsList").innerHTML = data.redFlags
      .map(function (flag) {
        const severityLabel = flag.severity === "high" ? "High" : flag.severity === "medium" ? "Medium" : "Low";
        return `
          <section class="flag-card">
            <div class="flag-head">
              <h3 class="flag-title">${escapeHtml(flag.title)}</h3>
              <span class="severity ${escapeHtml(flag.severity)}">${severityLabel}</span>
            </div>
            <p class="flag-meta">${escapeHtml(flag.detail)}</p>
          </section>
        `;
      })
      .join("");

    document.getElementById("actionsList").innerHTML = data.actions
      .map(function (action) {
        return `
          <section class="action-card">
            <div class="action-step">
              <span>${escapeHtml(action.step)}</span>
            </div>
            <h3 class="action-title">${escapeHtml(action.title)}</h3>
            <p class="action-copy">${escapeHtml(action.copy)}</p>
          </section>
        `;
      })
      .join("");

    document.getElementById("operatorTags").innerHTML = data.operatorTags
      .map(function (tag) {
        return `<span class="operator-tag">${escapeHtml(tag)}</span>`;
      })
      .join("");
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
