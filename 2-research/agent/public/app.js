const form = document.getElementById('evalForm');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const scoreGridEl = document.getElementById('scoreGrid');
const summaryBoxEl = document.getElementById('summaryBox');
const notesBoxEl = document.getElementById('notesBox');
const rawJsonEl = document.getElementById('rawJson');
const submitBtn = document.getElementById('submitBtn');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;
  statusEl.textContent = 'Running evaluation...';
  resultsEl.classList.add('hidden');
  scoreGridEl.innerHTML = '';

  const payload = {
    companyName: document.getElementById('companyName').value.trim(),
    zipCode: document.getElementById('zipCode').value.trim()
  };

  try {
    const response = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');

    renderReport(data);
    statusEl.textContent = 'Done.';
    resultsEl.classList.remove('hidden');
  } catch (error) {
    statusEl.textContent = `Error: ${error.message}`;
  } finally {
    submitBtn.disabled = false;
  }
});

function renderReport(data) {
  summaryBoxEl.innerHTML = `
    <div class="metric">
      <div>
        <div class="muted">Overall score</div>
        <div class="score">${data.totalScore}</div>
      </div>
      <div>
        <div class="muted">Company</div>
        <div><strong>${escapeHtml(data.companyName)}</strong> · ${escapeHtml(data.zipCode)}</div>
      </div>
    </div>
    <p>${escapeHtml(data.summary)}</p>
  `;

  const labels = {
    seo: 'SEO',
    aeo: 'AEO',
    maps: 'Maps',
    yelp: 'Yelp',
    social: 'Social',
    website: 'Website'
  };

  scoreGridEl.innerHTML = Object.entries(data.categories).map(([key, value]) => `
    <article class="card">
      <div class="metric">
        <div>
          <div class="muted">${labels[key] || key}</div>
          <div class="score">${value.score}</div>
        </div>
        <span class="pill ${value.status}">${value.status}</span>
      </div>
      <div>
        <strong>Findings</strong>
        <ul>${value.findings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>
      <div style="margin-top:12px;">
        <strong>Improvements</strong>
        <ul>${value.improvements.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>
    </article>
  `).join('');

  const notes = data.dataQualityNotes?.length
    ? `<ul>${data.dataQualityNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p class="muted">No major data quality issues reported.</p>';

  notesBoxEl.innerHTML = `<strong>Data quality notes</strong>${notes}`;
  rawJsonEl.textContent = JSON.stringify(data.rawSignals, null, 2);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
