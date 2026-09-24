(function () {
  "use strict";

  var HANDOFF_KEY = "pp_site_check_handoff_v1";
  var BASE_QUESTIONS = [
    "Responsible city or county and parcel identity",
    "Official base zoning, land use, and overlays",
    "Detailed slope, grading, and drainage conditions",
    "Legal site access and mapped hazards"
  ];
  var INTENTS = {
    sb1123: {
      label: "Small subdivision / SB 1123",
      title: "Investigate the small-subdivision pathway",
      copy: "You selected a small-subdivision / SB 1123 concept. Whether that pathway applies to this parcel and proposal is still open. Confirm the governing rules and project criteria with the responsible agency.",
      priority: "Slope, legal access, parcel configuration, and subdivision criteria.",
      topography: "A subdivision can multiply grading, access, retaining-wall, drainage, and utility questions across proposed lots. A survey and agency grading rules are early decision inputs.",
      questions: [
        "What are the recorded parcel dimensions and current lot configuration?",
        "What structures, occupancy history, and prior subdivisions affect the proposal?",
        "What lot, unit, access, and utility plan is actually proposed?"
      ],
      verification: ["Parcel dimensions, boundaries, and prior subdivisions", "Existing structures and occupancy history", "Proposed lots, units, access, and utilities", "SB 1123 site and project criteria with the responsible agency"]
    },
    adu: {
      label: "ADU",
      title: "Investigate the ADU pathway",
      copy: "Start with the responsible local agency's current ADU rules and the existing property's record. The selected intent alone cannot establish whether an accessory unit fits this parcel or design.",
      priority: "Slope, existing structures, access, and utility capacity.",
      topography: "Grade changes can affect an ADU's foundation, drainage, access, retaining work, and utility connections. Confirm the terrain and proposed location before treating the layout as settled.",
      questions: [
        "What primary dwelling and other structures are documented?",
        "Where would the unit sit relative to grade, access, and utilities?",
        "Which current local ADU rules and agency records govern the address?"
      ],
      verification: ["Existing structures and permit history", "ADU location, drainage, and utility connections", "Local ADU standards and agency interpretation"]
    },
    multifamily: {
      label: "Multifamily housing",
      title: "Investigate the housing-program pathway",
      copy: "Base zoning comes first. The proposed unit count, existing housing, and local rules will determine which multifamily pathways deserve investigation. No program has been matched to this address here.",
      priority: "Base zoning, slope, housing overlays, and project details.",
      topography: "Slope can change building placement, grading, access, parking, drainage, and the practical shape of a multifamily proposal. Compare the concept with surveyed conditions before estimating capacity.",
      questions: [
        "What zoning, plan designation, and overlays apply to the parcel?",
        "How many units and what affordability or tenure concept is proposed?",
        "Do current local housing maps or incentive programs warrant review?"
      ],
      verification: ["Existing units, occupancy, and proposed unit count", "Applicable housing-program map and project criteria", "Agency interpretation of any conflicting records"]
    },
    residential: {
      label: "General residential development",
      title: "Define the residential development path",
      copy: "Confirm the parcel and base zoning before narrowing the project path. The number of units, work type, existing conditions, and local agency process can change what must be reviewed.",
      priority: "Base zoning, slope, legal access, and utilities.",
      topography: "Grading, drainage, access, and retaining work can turn a promising residential concept into a more complex site plan. Confirm surveyed conditions early.",
      questions: [
        "Is this new construction, an addition, redevelopment, or a conversion?",
        "What zoning and site-development standards apply?",
        "What existing records or site conditions could change the plan?"
      ],
      verification: ["Existing structures and record history", "Proposed scope and unit count", "Utility capacity and service requirements", "Local planning and building process"]
    },
    other: {
      label: "Other",
      title: "Define the project before choosing a pathway",
      copy: "Write down the intended use, construction scope, and key decision. Then match the parcel to the responsible agency and its current rules before drawing a project-specific conclusion.",
      priority: "Jurisdiction, zoning, slope, and project scope.",
      topography: "Terrain can affect access, grading, drainage, and construction methods across many project types. The right topography question depends on the proposed scope.",
      questions: [
        "What use and physical work are proposed?",
        "Which agency and land-use rules govern the parcel?",
        "What site conditions or records could affect the decision?"
      ],
      verification: ["Proposed use and construction scope", "Relevant agency review path", "Utility and access conditions"]
    }
  };

  var form = document.getElementById("site-check-form");
  var entry = document.getElementById("check-entry");
  var result = document.getElementById("site-check-result");
  var addressInput = document.getElementById("property-address");
  var currentResult = null;
  var started = false;
  if (!form || !entry || !result || !addressInput) return;

  function track(name, payload) {
    if (typeof window.ppTrack === "function") window.ppTrack(name, payload);
  }

  function selectedIntent() {
    var selected = form.querySelector('input[name="intent"]:checked');
    return selected ? selected.value : "";
  }

  function markStarted() {
    if (started) return;
    started = true;
    track("site_check_started", { project_intent: selectedIntent() || "not_selected" });
  }

  function fillList(id, items) {
    var list = document.getElementById(id);
    list.replaceChildren();
    items.forEach(function (item) {
      var li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
  }

  function render(address, intent) {
    var config = INTENTS[intent];
    var questions = BASE_QUESTIONS.concat(config.verification);
    currentResult = { address: address, intent: intent, label: config.label, questions: questions };
    document.getElementById("result-address").textContent = address;
    document.getElementById("result-intent").textContent = config.label;
    document.getElementById("result-priority").textContent = config.priority;
    document.getElementById("topography-copy").textContent = config.topography;
    document.getElementById("pathway-title").textContent = config.title;
    document.getElementById("pathway-copy").textContent = config.copy;
    fillList("pathway-questions", config.questions);
    fillList("verification-list", config.verification);
    entry.hidden = true;
    result.hidden = false;
    result.focus({ preventScroll: true });
    result.scrollIntoView({ behavior: "instant", block: "start" });
    track("site_check_completed", { project_intent: intent, preliminary_signal: "verify" });
    track("site_check_result_verify", { project_intent: intent });
  }

  function storeHandoff() {
    if (!currentResult) return;
    try {
      window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({
        address: currentResult.address,
        intent: currentResult.intent,
        intent_label: currentResult.label,
        questions: currentResult.questions,
        created_at: Date.now()
      }));
    } catch (error) {
      // The link still opens the existing intake if storage is unavailable.
    }
  }

  var requestedIntent = new URLSearchParams(window.location.search).get("intent");
  if (Object.prototype.hasOwnProperty.call(INTENTS, requestedIntent)) {
    var option = form.querySelector('input[name="intent"][value="' + requestedIntent + '"]');
    if (option) option.checked = true;
  }

  addressInput.addEventListener("input", function () { addressInput.setCustomValidity(""); });
  form.addEventListener("input", markStarted);
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var address = addressInput.value.replace(/\s+/g, " ").trim();
    if (!address) {
      addressInput.setCustomValidity("Enter a property address to continue.");
      addressInput.reportValidity();
      return;
    }
    var intent = selectedIntent();
    if (!Object.prototype.hasOwnProperty.call(INTENTS, intent)) {
      form.reportValidity();
      return;
    }
    markStarted();
    render(address, intent);
  });

  document.querySelectorAll("[data-site-check-handoff]").forEach(function (link) {
    link.addEventListener("click", storeHandoff);
  });
  document.getElementById("check-another").addEventListener("click", function () {
    result.hidden = true;
    entry.hidden = false;
    addressInput.focus({ preventScroll: true });
    entry.scrollIntoView({ behavior: "instant", block: "start" });
    addressInput.select();
  });
}());
