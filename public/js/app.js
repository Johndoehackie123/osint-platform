// Global State
let ws = null;
let currentPage = 'dashboard';
let currentResults = null;
let searchHistory = [];
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// ============= WebSocket Management =============
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    console.log('✅ WebSocket connected');
    reconnectAttempts = 0;
    updateStatus('Live', true);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'progress') {
        updateProgress(data.status, data.progress);
      }
    } catch (e) {
      console.error('WebSocket message error:', e);
    }
  };

  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
    updateStatus('Offline', false);
  };

  ws.onclose = () => {
    updateStatus('Reconnecting...', false);
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      setTimeout(connectWebSocket, 3000);
    }
  };
}

function updateStatus(text, isLive) {
  const badge = document.getElementById('statusBadge');
  const dot = badge.querySelector('div');
  if (isLive) {
    dot.className = 'w-2 h-2 bg-green-400 rounded-full';
    dot.style.animation = 'pulse-glow 2s ease-in-out infinite';
  } else {
    dot.className = 'w-2 h-2 bg-red-400 rounded-full';
    dot.style.animation = 'none';
  }
  badge.querySelector('span').textContent = text;
}

// ============= Navigation =============
function navigate(page) {
  // Hide all pages
  document.querySelectorAll('[id^="page-"]').forEach(el => {
    el.classList.add('hidden');
  });

  // Show selected page
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) {
    pageEl.classList.remove('hidden');
    pageEl.classList.add('fade-in');
  }

  // Update active tab
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('nav-active');
  });
  const activeTab = document.getElementById(`tab-${page}`);
  if (activeTab) {
    activeTab.classList.add('nav-active');
  }

  currentPage = page;

  // Load page-specific data
  if (page === 'dashboard') {
    loadDashboard();
  } else if (page === 'history') {
    loadHistory();
  }
}

// ============= Progress Management =============
function showProgress() {
  document.getElementById('progressIndicator').classList.remove('hidden');
}

function hideProgress() {
  setTimeout(() => {
    document.getElementById('progressIndicator').classList.add('hidden');
  }, 1000);
}

function updateProgress(status, progress) {
  showProgress();
  const indicator = document.getElementById('progressIndicator');
  const fill = document.getElementById('progressFill');
  const label = document.getElementById('progressLabel');
  const percent = document.getElementById('progressPercent');

  fill.style.width = progress + '%';
  label.textContent = status;
  percent.textContent = progress + '%';

  if (progress === 100) {
    hideProgress();
  }
}

// ============= Tool Execution =============
async function runTool(tool) {
  let endpoint, payload;
  const inputs = {
    domain: document.getElementById('domainInput')?.value,
    ip: document.getElementById('ipInput')?.value,
    email: document.getElementById('emailInput')?.value,
    port: document.getElementById('portHostInput')?.value,
    username: document.getElementById('usernameInput')?.value,
    ssl: document.getElementById('sslInput')?.value,
    subdomain: document.getElementById('subdomainInput')?.value
  };

  switch (tool) {
    case 'domain':
      if (!inputs.domain) return showAlert('Please enter a domain', 'error');
      endpoint = '/api/osint/domain-recon';
      payload = { domain: inputs.domain };
      break;
    case 'ip':
      if (!inputs.ip) return showAlert('Please enter an IP address', 'error');
      endpoint = '/api/osint/ip-lookup';
      payload = { ip: inputs.ip };
      break;
    case 'email':
      if (!inputs.email) return showAlert('Please enter an email', 'error');
      endpoint = '/api/osint/email-verify';
      payload = { email: inputs.email };
      break;
    case 'port':
      if (!inputs.port) return showAlert('Please enter a host', 'error');
      endpoint = '/api/osint/port-scan';
      payload = { host: inputs.port };
      break;
    case 'username':
      if (!inputs.username) return showAlert('Please enter a username', 'error');
      endpoint = '/api/osint/username-search';
      payload = { username: inputs.username };
      break;
    case 'ssl':
      if (!inputs.ssl) return showAlert('Please enter a domain', 'error');
      endpoint = '/api/osint/ssl-lookup';
      payload = { domain: inputs.ssl };
      break;
    case 'subdomain':
      if (!inputs.subdomain) return showAlert('Please enter a domain', 'error');
      endpoint = '/api/osint/subdomain-finder';
      payload = { domain: inputs.subdomain };
      break;
    default:
      return;
  }

  try {
    updateProgress('Initializing search...', 5);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Request failed');
    const result = await response.json();

    if (result.success) {
      currentResults = result.results;
      displayResults(result.results, tool);
      await loadHistory();
      updateProgress('Complete!', 100);
    } else {
      showAlert('Error: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    console.error('Tool error:', error);
    showAlert('Error: ' + error.message, 'error');
  }
}

async function runBulkTool(type) {
  const textarea = type === 'domain' 
    ? document.getElementById('bulkDomainInput')
    : document.getElementById('bulkWhoisInput');
  const items = textarea.value.trim().split('\n').filter(x => x);

  if (items.length === 0) {
    return showAlert('Please enter at least one item', 'error');
  }

  showProgress();
  updateProgress('Processing bulk request...', 10);

  try {
    const results = {};
    for (let i = 0; i < items.length; i++) {
      const item = items[i].trim();
      updateProgress(`Processing ${i + 1} of ${items.length}...`, 10 + (i / items.length) * 80);

      const endpoint = type === 'domain' ? '/api/osint/domain-recon' : '/api/osint/domain-recon';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: item })
      });

      if (response.ok) {
        const data = await response.json();
        results[item] = data.results || {};
      }
    }

    currentResults = results;
    displayResults(results, 'bulk_' + type);
    updateProgress('Bulk processing complete!', 100);
  } catch (error) {
    showAlert('Bulk processing error: ' + error.message, 'error');
  }
}

async function runDNSTool(recordType) {
  const domain = document.getElementById('dnsInput').value;
  if (!domain) return showAlert('Please enter a domain', 'error');

  try {
    updateProgress('Fetching DNS records...', 20);
    const response = await fetch('/api/osint/dns-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, recordType })
    });

    if (!response.ok) throw new Error('DNS lookup failed');
    const result = await response.json();

    if (result.success) {
      currentResults = result.results;
      displayResults(result.results, 'dns_' + recordType);
      updateProgress('DNS lookup complete!', 100);
    }
  } catch (error) {
    showAlert('DNS lookup error: ' + error.message, 'error');
  }
}

async function runGeoIP() {
  const ips = document.getElementById('geoipInput').value.split(/[\s,]+/).filter(x => x);
  if (ips.length === 0) return showAlert('Please enter IP address(es)', 'error');

  try {
    updateProgress('Mapping IP locations...', 10);
    const results = {};
    for (let i = 0; i < ips.length; i++) {
      const ip = ips[i];
      updateProgress(`Mapping ${i + 1} of ${ips.length}...`, 10 + (i / ips.length) * 80);

      const response = await fetch('/api/osint/ip-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip })
      });

      if (response.ok) {
        const data = await response.json();
        results[ip] = data.results || {};
      }
    }

    currentResults = results;
    displayResults(results, 'geoip');
    updateProgress('GeoIP mapping complete!', 100);
  } catch (error) {
    showAlert('GeoIP error: ' + error.message, 'error');
  }
}

// ============= Results Display =============
function displayResults(results, toolType) {
  const modal = document.getElementById('resultsModal');
  const content = document.getElementById('resultsContent');

  let html = '';

  if (typeof results === 'object') {
    Object.entries(results).forEach(([key, value]) => {
      if (typeof value === 'object') {
        html += `
          <div class="result-item">
            <strong>${key}:</strong>
            <div style="margin-left: 16px; margin-top: 8px;">
              ${Object.entries(value)
                .map(([k, v]) => `<div><span class="text-muted">${k}:</span> ${JSON.stringify(v)}</div>`)
                .join('')}
            </div>
          </div>
        `;
      } else {
        html += `<div class="result-item"><strong>${key}:</strong> ${value}</div>`;
      }
    });
  } else {
    html = `<div class="result-item">${JSON.stringify(results, null, 2)}</div>`;
  }

  content.innerHTML = html || '<p class="text-muted">No results found</p>';
  modal.classList.add('active');
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

function closeModal() {
  document.getElementById('resultsModal').classList.remove('active');
}

function copyResults() {
  const text = document.getElementById('resultsContent').innerText;
  navigator.clipboard.writeText(text).then(() => {
    showAlert('Results copied to clipboard!', 'success');
  });
}

function exportResults() {
  const json = JSON.stringify(currentResults, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `osint-results-${Date.now()}.json`;
  a.click();
}

// ============= History Management =============
async function loadHistory() {
  try {
    const response = await fetch('/api/osint/history');
    const data = await response.json();

    if (data.results) {
      searchHistory = data.results;
      updateHistoryDisplay(data.results, 'all');
    }
  } catch (error) {
    console.error('History load error:', error);
  }
}

function updateHistoryDisplay(items, filter) {
  const container = document.getElementById('historyContainer');
  const recentContainer = document.getElementById('recentSearches');

  // Filter items
  let filtered = items;
  if (filter !== 'all') {
    filtered = items.filter(item => item.type === filter);
  }

  // Update recent searches on dashboard
  if (recentContainer) {
    recentContainer.innerHTML = items.slice(0, 5).map(item => `
      <div class="result-item cursor-pointer hover:bg-white/10" onclick="viewHistoryItem('${item.id}')">
        <div class="flex justify-between items-start">
          <div>
            <span class="text-blue-400 font-semibold text-sm">${item.type.replace(/_/g, ' ').toUpperCase()}</span>
            <p class="text-white font-medium mt-1">${item.query}</p>
          </div>
          <span class="text-xs text-muted">${new Date(item.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');
  }

  // Update history page
  if (container) {
    if (filtered.length === 0) {
      container.innerHTML = '<p class="text-muted">No searches found</p>';
      return;
    }

    container.innerHTML = filtered.map(item => `
      <div class="glass-effect rounded-lg p-4 border-blue-500/20 cursor-pointer card-hover" onclick="viewHistoryItem('${item.id}')">
        <div class="flex justify-between items-start mb-2">
          <span class="text-blue-400 font-semibold text-sm">${item.type.replace(/_/g, ' ').toUpperCase()}</span>
          <span class="text-xs text-muted">${new Date(item.created_at).toLocaleString()}</span>
        </div>
        <p class="text-white font-medium mb-2">${item.query}</p>
        <p class="text-muted text-sm truncate">${JSON.stringify(item.result || {}).substring(0, 100)}...</p>
      </div>
    `).join('');
  }
}

function filterHistory(filter) {
  // Update active tab
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  updateHistoryDisplay(searchHistory, filter);
}

function viewHistoryItem(id) {
  const item = searchHistory.find(x => x.id === parseInt(id));
  if (item && item.result) {
    currentResults = item.result;
    displayResults(item.result, item.type);
  }
}

async function clearHistory() {
  if (confirm('Are you sure you want to clear all search history?')) {
    try {
      await fetch('/api/osint/history', { method: 'DELETE' });
      searchHistory = [];
      updateHistoryDisplay([], 'all');
      showAlert('History cleared!', 'success');
    } catch (error) {
      showAlert('Error clearing history', 'error');
    }
  }
}

// ============= Dashboard =============
async function loadDashboard() {
  try {
    const statsResponse = await fetch('/api/osint/stats');
    const statsData = await statsResponse.json();

    // Update stats
    if (statsData.results) {
      const total = statsData.results.reduce((sum, item) => sum + item.count, 0);
      document.getElementById('stat-searches').textContent = total;

      const domains = statsData.results.find(x => x.type === 'domain_recon')?.count || 0;
      document.getElementById('stat-domains').textContent = domains;

      const ips = statsData.results.find(x => x.type === 'ip_lookup')?.count || 0;
      document.getElementById('stat-ips').textContent = ips;

      // Update charts
      updateCharts(statsData.results);
    }

    // Load history
    await loadHistory();
  } catch (error) {
    console.error('Dashboard load error:', error);
  }
}

let usageChart, activityChart;

function updateCharts(stats) {
  // Destroy old charts
  if (usageChart) usageChart.destroy();
  if (activityChart) activityChart.destroy();

  // Usage chart
  const usageCtx = document.getElementById('usageChart');
  if (usageCtx) {
    usageChart = new Chart(usageCtx, {
      type: 'doughnut',
      data: {
        labels: stats.map(s => s.type.replace(/_/g, ' ')),
        datasets: [{
          data: stats.map(s => s.count),
          backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1'],
          borderColor: '#1e293b',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#e5e7eb' } }
        }
      }
    });
  }

  // Activity chart
  const activityCtx = document.getElementById('activityChart');
  if (activityCtx) {
    const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    const data = [12, 19, 8, 15];

    activityChart = new Chart(activityCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Searches',
          data: data,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#e5e7eb' } }
        },
        scales: {
          y: { ticks: { color: '#9ca3af' } },
          x: { ticks: { color: '#9ca3af' } }
        }
      }
    });
  }
}

// ============= Utilities =============
function handleEnter(event, tool) {
  if (event.key === 'Enter') {
    runTool(tool);
  }
}

function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `fixed top-4 right-4 px-6 py-3 rounded-lg font-semibold text-white z-50 slide-in ${
    type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500'
  }`;
  alertDiv.textContent = message;
  document.body.appendChild(alertDiv);

  setTimeout(() => {
    alertDiv.style.opacity = '0';
    setTimeout(() => alertDiv.remove(), 300);
  }, 3000);
}

function toggleTheme() {
  document.body.classList.toggle('dark');
}

// ============= Initialization =============
document.addEventListener('DOMContentLoaded', () => {
  connectWebSocket();
  navigate('dashboard');

  // Periodic dashboard refresh
  setInterval(() => {
    if (currentPage === 'dashboard') {
      loadDashboard();
    }
  }, 30000);
});

// Close modal on escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});