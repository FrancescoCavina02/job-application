// ── DOM refs ──────────────────────────────────────────────────────────────

// Tabs
const tabJob = document.getElementById('tab-job');
const tabInterest = document.getElementById('tab-interest');
const panelJob = document.getElementById('panel-job');
const panelInterest = document.getElementById('panel-interest');

// Job posting inputs
const urlInput = document.getElementById('url-input');
const generateBtn = document.getElementById('generate-btn');
const createPromptBtn = document.getElementById('create-prompt-btn');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

// Interest inputs
const interestUrlInput = document.getElementById('interest-url-input');
const interestGenerateBtn = document.getElementById('interest-generate-btn');
const createInterestPromptBtn = document.getElementById('create-interest-prompt-btn');
const interestStatusDot = document.getElementById('interest-status-dot');
const interestStatusText = document.getElementById('interest-status-text');

const errorBanner = document.getElementById('error-banner');

// Prompt output card
const promptCard = document.getElementById('prompt-card');
const promptTextarea = document.getElementById('prompt-textarea');
const promptCharCount = document.getElementById('prompt-char-count');
const promptSavedPath = document.getElementById('prompt-saved-path');
const copyPromptBtn = document.getElementById('copy-prompt-btn');

// Shared result cards
const parsedCard = document.getElementById('parsed-card');
const parsedCardTitle = document.getElementById('parsed-card-title');
const metaCompany = document.getElementById('meta-company');
const metaRole = document.getElementById('meta-role');
const metaRoleItem = document.getElementById('meta-role-item');
const metaLocation = document.getElementById('meta-location');
const metaLocationItem = document.getElementById('meta-location-item');
const metaRemote = document.getElementById('meta-remote');
const metaRemoteItem = document.getElementById('meta-remote-item');
const metaSeniority = document.getElementById('meta-seniority');
const metaSeniorityItem = document.getElementById('meta-seniority-item');
const excerptBox = document.getElementById('excerpt-box');

const contactEmailCard = document.getElementById('contact-email-card');
const contactEmailContent = document.getElementById('contact-email-content');

const warningsCard = document.getElementById('warnings-card');
const warningsList = document.getElementById('warnings-list');

const resultsCard = document.getElementById('results-card');
const fileResults = document.getElementById('file-results');

const reportCard = document.getElementById('report-card');
const reportBox = document.getElementById('report-box');

const cvFilesList = document.getElementById('cv-files-list');
const historyList = document.getElementById('history-list');
const refreshHistoryBtn = document.getElementById('refresh-history-btn');

// ── Tabs ──────────────────────────────────────────────────────────────────

tabJob.addEventListener('click', () => {
  tabJob.classList.add('active');
  tabInterest.classList.remove('active');
  show(panelJob);
  hide(panelInterest);
});

tabInterest.addEventListener('click', () => {
  tabInterest.classList.add('active');
  tabJob.classList.remove('active');
  show(panelInterest);
  hide(panelJob);
});

// ── Helpers ───────────────────────────────────────────────────────────────

function setStatus(state, message) {
  statusDot.className = 'status-dot';
  if (state !== 'idle') statusDot.classList.add(state);
  statusText.textContent = message;
}

function setInterestStatus(state, message) {
  interestStatusDot.className = 'status-dot';
  if (state !== 'idle') interestStatusDot.classList.add(state);
  interestStatusText.textContent = message;
}

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function metaValue(el, value) {
  if (value) {
    el.textContent = value;
    el.classList.remove('empty');
  } else {
    el.textContent = 'Not detected';
    el.classList.add('empty');
  }
}

function formatBytes(n) {
  if (n < 1024) return `${n} chars`;
  return `${(n / 1024).toFixed(1)}k chars`;
}

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── CV files ──────────────────────────────────────────────────────────────

async function loadCVFiles() {
  try {
    const res = await fetch('/api/cv-files');
    const data = await res.json();

    if (!data.files || data.files.length === 0) {
      cvFilesList.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">No files found in CVs/ directory.</div>';
      return;
    }

    cvFilesList.innerHTML = data.files.map(f => `
      <div class="cv-file-item ${f.skipped ? 'skipped' : ''}">
        <span class="cv-badge">${f.format.toUpperCase()}</span>
        <span class="cv-name" title="${f.filename}">${f.filename}</span>
        <span class="cv-size">${f.skipped ? 'skipped' : formatBytes(f.chars)}</span>
      </div>
    `).join('');
  } catch {
    cvFilesList.innerHTML = '<div style="font-size:12px;color:var(--error);">Failed to load CV files.</div>';
  }
}

// ── History ───────────────────────────────────────────────────────────────

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      historyList.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">No runs yet.</div>';
      return;
    }

    historyList.innerHTML = data.slice(0, 15).map(r => `
      <div class="history-item status-${r.status}">
        <div class="h-company">${r.companyName || 'Unknown Company'}</div>
        <div class="h-role">${r.roleTitle || 'Unknown Role'}</div>
        <div class="h-meta">
          <span>${timeAgo(r.timestamp)}</span>
          <span>${r.modelUsed}</span>
          <span style="color: ${r.status === 'success' ? 'var(--success)' : 'var(--error)'};">${r.status}</span>
        </div>
      </div>
    `).join('');
  } catch {
    historyList.innerHTML = '<div style="font-size:12px;color:var(--error);">Failed to load history.</div>';
  }
}

// ── Shared result helpers ─────────────────────────────────────────────────

function resetResultCards() {
  hide(errorBanner);
  hide(promptCard);
  hide(parsedCard);
  hide(contactEmailCard);
  hide(warningsCard);
  hide(resultsCard);
  hide(reportCard);
}

function showWarnings(warnings) {
  if (warnings && warnings.length > 0) {
    warningsList.innerHTML = warnings.map(w =>
      `<div class="warning-item">${escapeHtml(w)}</div>`
    ).join('');
    show(warningsCard);
  }
}

function showFileResults(data) {
  fileResults.innerHTML = `
    <div class="file-result">
      <span class="file-icon">📄</span>
      <div class="file-info">
        <div class="file-label">Tailored CV</div>
        <div class="file-path">${escapeHtml(data.cvPath)}</div>
      </div>
    </div>
    <div class="file-result">
      <span class="file-icon">✉️</span>
      <div class="file-info">
        <div class="file-label">${data.letterLabel || 'Motivation Letter'}</div>
        <div class="file-path">${escapeHtml(data.letterPath)}</div>
      </div>
    </div>
  `;
  show(resultsCard);
}

// ── Job posting generation ────────────────────────────────────────────────

async function runGeneration() {
  const url = urlInput.value.trim();
  if (!url) {
    setStatus('error', 'Please enter a job posting URL.');
    return;
  }
  if (!url.startsWith('http')) {
    setStatus('error', 'URL must start with http:// or https://');
    return;
  }

  resetResultCards();
  generateBtn.disabled = true;
  setStatus('running', 'Fetching job posting...');

  try {
    setStatus('running', 'Parsing job content and calling LLM... (this may take 30–90 seconds)');

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Server error ${res.status}`);
    }

    // ── Parsed job info ──
    parsedCardTitle.textContent = 'Parsed Job Info';
    show(metaRoleItem);
    show(metaLocationItem);
    show(metaRemoteItem);
    show(metaSeniorityItem);
    metaValue(metaCompany, data.company);
    metaValue(metaRole, data.role);
    metaValue(metaLocation, data.location);
    metaValue(metaRemote, data.remoteStatus);
    metaValue(metaSeniority, data.seniority);
    excerptBox.textContent = data.jobExcerpt || '';
    show(parsedCard);

    showWarnings(data.warnings);
    showFileResults({ cvPath: data.cvPath, letterPath: data.letterPath, letterLabel: 'Motivation Letter' });

    if (data.generationReport) {
      reportBox.textContent = data.generationReport;
      show(reportCard);
    }

    setStatus('success', `Done — files saved for ${data.company || 'Unknown Company'}`);
    loadHistory();

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errorBanner.textContent = message;
    show(errorBanner);
    setStatus('error', 'Generation failed — see error above.');
  } finally {
    generateBtn.disabled = false;
  }
}

// ── Working student interest generation ──────────────────────────────────

async function runInterestGeneration() {
  const url = interestUrlInput.value.trim();
  if (!url) {
    setInterestStatus('error', 'Please enter a company website URL.');
    return;
  }
  if (!url.startsWith('http')) {
    setInterestStatus('error', 'URL must start with http:// or https://');
    return;
  }

  resetResultCards();
  interestGenerateBtn.disabled = true;
  setInterestStatus('running', 'Crawling company website (homepage + key sub-pages)...');

  try {
    setInterestStatus('running', 'Crawling website and generating materials... (this may take 60–120 seconds)');

    const res = await fetch('/api/generate-interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Server error ${res.status}`);
    }

    // ── Company info (hide job-specific fields) ──
    parsedCardTitle.textContent = 'Company Info';
    hide(metaRoleItem);
    hide(metaLocationItem);
    hide(metaRemoteItem);
    hide(metaSeniorityItem);
    metaValue(metaCompany, data.company);
    excerptBox.textContent = data.companyExcerpt || '';
    show(parsedCard);

    // ── Contact email ──
    if (data.contactEmail) {
      contactEmailContent.innerHTML = `
        <div class="contact-email-box">
          <span class="email-icon">📧</span>
          <div>
            <div class="email-address">${escapeHtml(data.contactEmail)}</div>
            <div class="email-note">Best contact address identified by the LLM from the company website</div>
          </div>
        </div>
      `;
    } else {
      contactEmailContent.innerHTML = `<div class="contact-email-none">No suitable contact email found. Check the company's careers page, or look for a senior technical or leadership contact on the team page.</div>`;
    }
    show(contactEmailCard);

    showWarnings(data.warnings);
    showFileResults({ cvPath: data.cvPath, letterPath: data.letterPath, letterLabel: 'Interest Letter' });

    if (data.generationReport) {
      reportBox.textContent = data.generationReport;
      show(reportCard);
    }

    const pageWord = data.pagesCrawled === 1 ? 'page' : 'pages';
    setInterestStatus('success', `Done — ${data.pagesCrawled} ${pageWord} crawled, files saved for ${data.company || 'Unknown Company'}`);
    loadHistory();

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errorBanner.textContent = message;
    show(errorBanner);
    setInterestStatus('error', 'Generation failed — see error above.');
  } finally {
    interestGenerateBtn.disabled = false;
  }
}

// ── Create Prompt (job posting) ──────────────────────────────────────────

async function runCreatePrompt() {
  const url = urlInput.value.trim();
  if (!url) {
    setStatus('error', 'Please enter a job posting URL.');
    return;
  }
  if (!url.startsWith('http')) {
    setStatus('error', 'URL must start with http:// or https://');
    return;
  }

  resetResultCards();
  createPromptBtn.disabled = true;
  generateBtn.disabled = true;
  setStatus('running', 'Fetching and parsing job posting...');

  try {
    setStatus('running', 'Building prompt... (this may take 10–30 seconds)');

    const res = await fetch('/api/create-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Server error ${res.status}`);
    }

    showPromptCard(data);
    showWarnings(data.warnings);
    setStatus('success', `Prompt ready — ${data.company || 'Unknown Company'}${data.role ? ` / ${data.role}` : ''}`);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errorBanner.textContent = message;
    show(errorBanner);
    setStatus('error', 'Failed to build prompt — see error above.');
  } finally {
    createPromptBtn.disabled = false;
    generateBtn.disabled = false;
  }
}

// ── Create Prompt (interest) ─────────────────────────────────────────

async function runCreateInterestPrompt() {
  const url = interestUrlInput.value.trim();
  if (!url) {
    setInterestStatus('error', 'Please enter a company website URL.');
    return;
  }
  if (!url.startsWith('http')) {
    setInterestStatus('error', 'URL must start with http:// or https://');
    return;
  }

  resetResultCards();
  createInterestPromptBtn.disabled = true;
  interestGenerateBtn.disabled = true;
  setInterestStatus('running', 'Crawling company website...');

  try {
    setInterestStatus('running', 'Building prompt... (this may take 20–60 seconds)');

    const res = await fetch('/api/create-interest-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Server error ${res.status}`);
    }

    showPromptCard(data);
    showWarnings(data.warnings);
    const pageWord = data.pagesCrawled === 1 ? 'page' : 'pages';
    setInterestStatus('success', `Prompt ready — ${data.pagesCrawled} ${pageWord} crawled, ${data.company || 'Unknown Company'}`);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errorBanner.textContent = message;
    show(errorBanner);
    setInterestStatus('error', 'Failed to build prompt — see error above.');
  } finally {
    createInterestPromptBtn.disabled = false;
    interestGenerateBtn.disabled = false;
  }
}

// ── Prompt card display helper ───────────────────────────────────────

function showPromptCard(data) {
  promptTextarea.value = data.promptText || '';
  const chars = data.charCount || (data.promptText || '').length;
  promptCharCount.textContent = chars.toLocaleString() + ' chars';
  promptSavedPath.textContent = data.savedPath || '';
  show(promptCard);
  // Scroll the card into view smoothly
  promptCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Copy to clipboard ───────────────────────────────────────────────

copyPromptBtn.addEventListener('click', async () => {
  const text = promptTextarea.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copyPromptBtn.textContent = '✅ Copied!';
    copyPromptBtn.classList.add('copied');
    setTimeout(() => {
      copyPromptBtn.textContent = '📋 Copy to clipboard';
      copyPromptBtn.classList.remove('copied');
    }, 2200);
  } catch {
    // Fallback for browsers that block clipboard API
    promptTextarea.select();
    document.execCommand('copy');
    copyPromptBtn.textContent = '✅ Copied!';
    copyPromptBtn.classList.add('copied');
    setTimeout(() => {
      copyPromptBtn.textContent = '📋 Copy to clipboard';
      copyPromptBtn.classList.remove('copied');
    }, 2200);
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Event listeners ───────────────────────────────────────────────────────

generateBtn.addEventListener('click', runGeneration);
urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runGeneration(); });
createPromptBtn.addEventListener('click', runCreatePrompt);

interestGenerateBtn.addEventListener('click', runInterestGeneration);
interestUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runInterestGeneration(); });
createInterestPromptBtn.addEventListener('click', runCreateInterestPrompt);

refreshHistoryBtn.addEventListener('click', loadHistory);

// ── Init ──────────────────────────────────────────────────────────────────
loadCVFiles();
loadHistory();
