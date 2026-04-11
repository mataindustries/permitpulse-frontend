(function () {
  const API_ENDPOINT = '/api/instant-snapshot';
  const FULL_REPORT_URL = 'https://buy.stripe.com/3cI3cw1qT9aP6Jx2Fs1wY0e';
  const DONE_FOR_YOU_URL = '/call/';

  const form = document.getElementById('snapshotForm');
  const generateButton = document.getElementById('generateButton');
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
    const values = Array.isArray(items) && items.length ? items : [emptyCopy];
    target.innerHTML = values.map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('');
  }

  function renderPortal(snapshot) {
    if (snapshot.portal_url) {
      resultPortal.innerHTML = '<a class="portal-link" href="' + escapeHtml(snapshot.portal_url) + '" target="_blank" rel="noopener">Open official permit portal</a>';
      resultPortalAction.href = snapshot.portal_url;
      resultPortalAction.hidden = false;
    } else {
      resultPortal.textContent = 'No catalog-backed portal link was matched from the current intake.';
      resultPortalAction.hidden = true;
      resultPortalAction.removeAttribute('href');
    }
  }

  function renderSnapshot(snapshot) {
    const jurisdiction = snapshot.likely_jurisdiction || {};
    const confidence = Math.max(0, Math.min(100, Number(snapshot.confidence) || 0));
    const confidenceDegrees = Math.round((confidence / 100) * 360);
    const jurisdictionLabel = [jurisdiction.name, jurisdiction.state_name || jurisdiction.state].filter(Boolean).join(', ') || 'Partial match';
    const permitPath = jurisdiction.permits_path || '/permits/';
    const matchLabel = jurisdiction.match_type ? jurisdiction.match_type.replace(/_/g, ' ') : 'partial match';

    confidenceRing.style.setProperty('--progress', confidenceDegrees + 'deg');
    resultConfidence.textContent = confidence + '% confidence';
    resultJurisdiction.textContent = jurisdictionLabel;
    resultSummary.textContent = snapshot.project_summary || 'No summary returned.';
    resultNextStep.textContent = snapshot.next_step || 'No next step returned.';
    resultDisclaimer.textContent = snapshot.disclaimer || 'Informational intake brief only.';
    resultMeta.textContent = (jurisdiction.platform ? jurisdiction.platform + ' · ' : '') + matchLabel;
    resultPermitPage.href = permitPath;
    resultPermitPage.hidden = !jurisdiction.permits_path;
    resultFullReport.href = FULL_REPORT_URL;
    resultDoneForYou.href = DONE_FOR_YOU_URL;

    renderPortal(snapshot);
    renderList(resultPermitPath, snapshot.likely_permit_path, 'General building permit intake with scope clarification.');
    renderList(resultMissingInfo, snapshot.missing_info, 'No critical missing info surfaced from the first-pass intake.');
    renderList(resultRiskNotes, snapshot.risk_notes, 'Official portal routing still controls the final permit path.');
  }

  async function runSnapshot(event) {
    event.preventDefault();

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

    generateButton.disabled = true;
    generateButton.textContent = 'Generating Snapshot...';
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
        errorCopy.textContent = 'Snapshot generation returned an invalid response. Re-run the intake and try again.';
      } else {
        errorCopy.textContent = 'Snapshot generation failed. Re-run the intake or try a tighter city and scope description.';
      }
      setView('error');
    } finally {
      generateButton.disabled = false;
      generateButton.textContent = 'Generate Snapshot';
    }
  }

  updateClock();
  setInterval(updateClock, 1000);
  form.addEventListener('submit', runSnapshot);
})();
