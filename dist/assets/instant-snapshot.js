(function () {
  const API_ENDPOINT = '/api/instant-snapshot';
  const FULL_REPORT_URL = 'https://buy.stripe.com/9B614ofhJ72H5Ft93Q1wY0l';
  const DONE_FOR_YOU_URL = '/call/';
  const DEMO_EXAMPLE = {
    address: '742 S Mission Rd',
    city: 'Los Angeles',
    project_description: 'Interior remodel with panel upgrade and two new bathrooms.',
    apn: '',
    role: 'contractor',
    voice_transcript: '',
  };

  const form = document.getElementById('snapshotForm');
  const generateButton = document.getElementById('generateButton');
  const demoExampleButton = document.getElementById('demoExampleButton');
  const clock = document.getElementById('snapshotClock');
  const emptyState = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const resultState = document.getElementById('resultState');
  const errorCopy = document.getElementById('errorCopy');
  const confidenceRing = document.getElementById('confidenceRing');
  const resultConfidence = document.getElementById('resultConfidence');
  const resultJurisdiction = document.getElementById('resultJurisdiction');
  const resultPortal = document.getElementById('resultPortal');
  const resultSummary = document.getElementById('resultSummary');
  const resultPermitPath = document.getElementById('resultPermitPath');
  const resultMissingInfo = document.getElementById('resultMissingInfo');
  const resultRiskNotes = document.getElementById('resultRiskNotes');
  const resultNextStep = document.getElementById('resultNextStep');
  const resultDisclaimer = document.getElementById('resultDisclaimer');
  const resultMeta = document.getElementById('resultMeta');
  const resultPermitPage = document.getElementById('resultPermitPage');
  const resultPortalAction = document.getElementById('resultPortalAction');
  const resultFullReport = document.getElementById('resultFullReport');
  const resultDoneForYou = document.getElementById('resultDoneForYou');
  const runAnotherSnapshot = document.getElementById('runAnotherSnapshot');
  const summaryCard = document.getElementById('summaryCard');
  const permitPathCard = document.getElementById('permitPathCard');
  const missingInfoCard = document.getElementById('missingInfoCard');
  const riskNotesCard = document.getElementById('riskNotesCard');
  const nextStepCard = document.getElementById('nextStepCard');
  const portalCard = document.getElementById('portalCard');

  function setSubmitting(isSubmitting) {
    generateButton.disabled = isSubmitting;
    generateButton.setAttribute('aria-busy', isSubmitting ? 'true' : 'false');
    generateButton.textContent = isSubmitting ? 'Running Snapshot...' : 'Run Instant Snapshot';
    if (demoExampleButton) {
      demoExampleButton.disabled = isSubmitting;
      demoExampleButton.setAttribute('aria-disabled', isSubmitting ? 'true' : 'false');
    }
  }

  function updateClock() {
    clock.textContent = new Date().toISOString().slice(11, 19) + ' UTC';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setView(next) {
    emptyState.hidden = next !== 'empty';
    loadingState.hidden = next !== 'loading';
    errorState.hidden = next !== 'error';
    resultState.hidden = next !== 'result';
  }

  function renderList(target, items, emptyCopy) {
    const values = Array.isArray(items) && items.filter(Boolean).length ? items.filter(Boolean) : [emptyCopy];
    target.innerHTML = values.map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('');
  }

  function setCardVisibility(card, shouldShow) {
    if (!card) return;
    card.hidden = !shouldShow;
  }

  function focusFirstField() {
    const firstField = form.querySelector('input[name="address"]');
    if (firstField) {
      firstField.focus();
      firstField.select();
    }
  }

  function resetForAnotherRun() {
    setView('empty');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(focusFirstField, 180);
  }

  function applyDemoExample() {
    Object.keys(DEMO_EXAMPLE).forEach(function (key) {
      const field = form.elements.namedItem(key);
      if (field) {
        field.value = DEMO_EXAMPLE[key];
      }
    });
    focusFirstField();
  }

  function renderPortal(snapshot) {
    if (snapshot.portal_url) {
      resultPortal.innerHTML = '<a class="portal-link" href="' + escapeHtml(snapshot.portal_url) + '" target="_blank" rel="noopener">Open official permit portal</a>';
      resultPortalAction.href = snapshot.portal_url;
      resultPortalAction.hidden = false;
    } else {
      resultPortal.textContent = 'No official portal link was confidently matched from this intake. Confirm the exact jurisdiction first, then use PermitPulse to route the filing lane cleanly.';
      resultPortalAction.hidden = true;
      resultPortalAction.removeAttribute('href');
    }
  }

  function getMatchMeta(jurisdiction, confidence) {
    if (!jurisdiction || !jurisdiction.name) {
      return confidence >= 50 ? 'Directional jurisdiction match' : 'Jurisdiction still needs confirmation';
    }

    if (jurisdiction.match_type === 'exact_city') {
      return (jurisdiction.platform ? jurisdiction.platform + ' portal' : 'Catalog-backed match') + ' · strong city match';
    }

    if (jurisdiction.match_type === 'partial_city' || jurisdiction.match_type === 'ambiguous_city') {
      return (jurisdiction.platform ? jurisdiction.platform + ' portal' : 'Catalog-backed match') + ' · directional city match';
    }

    return confidence >= 50 ? 'Directional catalog match' : 'Jurisdiction still needs confirmation';
  }

  function renderSnapshot(snapshot) {
    const jurisdiction = snapshot.likely_jurisdiction || {};
    const confidence = Math.max(0, Math.min(100, Number(snapshot.confidence) || 0));
    const confidenceDegrees = Math.round((confidence / 100) * 360);
    const jurisdictionLabel = [jurisdiction.name, jurisdiction.state_name || jurisdiction.state].filter(Boolean).join(', ') || 'Partial match';
    const permitPath = jurisdiction.permits_path || '/permits/';
    const summary = String(snapshot.project_summary || '').trim();
    const nextStep = String(snapshot.next_step || '').trim();
    const permitPathItems = Array.isArray(snapshot.likely_permit_path) ? snapshot.likely_permit_path.filter(Boolean) : [];
    const missingInfoItems = Array.isArray(snapshot.missing_info) ? snapshot.missing_info.filter(Boolean) : [];
    const riskNotesItems = Array.isArray(snapshot.risk_notes) ? snapshot.risk_notes.filter(Boolean) : [];

    confidenceRing.style.setProperty('--progress', confidenceDegrees + 'deg');
    resultConfidence.textContent = confidence + '% confidence';
    resultJurisdiction.textContent = jurisdictionLabel;
    resultSummary.textContent = summary || 'PermitPulse generated a directional intake read from the address, city, and scope provided.';
    resultNextStep.textContent = nextStep || 'Confirm the exact jurisdiction, then decide whether to route directly or escalate into PermitPulse help.';
    resultDisclaimer.textContent = snapshot.disclaimer || 'Informational intake brief only.';
    resultMeta.textContent = getMatchMeta(jurisdiction, confidence);
    resultPermitPage.href = permitPath;
    resultPermitPage.hidden = !jurisdiction.permits_path;
    resultFullReport.href = FULL_REPORT_URL;
    resultDoneForYou.href = DONE_FOR_YOU_URL;

    renderPortal(snapshot);
    renderList(resultPermitPath, permitPathItems, 'General building permit intake with tighter scope confirmation before filing.');
    renderList(resultMissingInfo, missingInfoItems, 'No major intake gaps surfaced from the current draft. Pressure-test the scope before the first portal pass.');
    renderList(resultRiskNotes, riskNotesItems, 'Official jurisdiction routing still controls the final filing lane and permit sequence.');

    setCardVisibility(summaryCard, true);
    setCardVisibility(portalCard, true);
    setCardVisibility(permitPathCard, true);
    setCardVisibility(missingInfoCard, true);
    setCardVisibility(riskNotesCard, true);
    setCardVisibility(nextStepCard, true);
  }

  async function runSnapshot(event) {
    event.preventDefault();

    if (generateButton.disabled) {
      return;
    }

    const formData = new FormData(form);
    const payload = {
      address: String(formData.get('address') || '').trim(),
      city: String(formData.get('city') || '').trim(),
      project_description: String(formData.get('project_description') || '').trim(),
      apn: String(formData.get('apn') || '').trim(),
      role: String(formData.get('role') || '').trim(),
      voice_transcript: String(formData.get('voice_transcript') || '').trim(),
    };

    if (!payload.address || !payload.city || !payload.project_description) {
      errorCopy.textContent = 'Address, city, and project description are required before PermitPulse can stage a snapshot.';
      setView('error');
      return;
    }

    setSubmitting(true);
    setView('loading');

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();
      let data = null;

      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch (parseError) {
        throw new Error('invalid_json');
      }

      if (!response.ok || !data || !data.ok || !data.snapshot) {
        throw new Error((data && data.error) || 'snapshot_failed');
      }

      renderSnapshot(data.snapshot);
      setView('result');
      resultState.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      if (error && error.message === 'missing_required_fields') {
        errorCopy.textContent = 'Address, city, and project description are required before PermitPulse can stage a snapshot.';
      } else if (error && error.message === 'invalid_json') {
        errorCopy.textContent = 'Snapshot returned an unreadable response. Re-run the intake and keep the address, city, and scope tight.';
      } else {
        errorCopy.textContent = 'Snapshot could not finish this pass. Try a fuller address, confirmed city, and a tighter project scope.';
      }
      setView('error');
    } finally {
      setSubmitting(false);
    }
  }

  updateClock();
  setInterval(updateClock, 1000);
  setSubmitting(false);
  form.addEventListener('submit', runSnapshot);
  if (demoExampleButton) {
    demoExampleButton.addEventListener('click', applyDemoExample);
  }
  if (runAnotherSnapshot) {
    runAnotherSnapshot.addEventListener('click', resetForAnotherRun);
  }
})();
