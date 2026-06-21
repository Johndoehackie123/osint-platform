// Initialize WebSocket
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    console.log('WebSocket connected');
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
    console.error('WebSocket error:', error);
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
  const statusEl = document.getElementById('status');
  const indicator = statusEl.querySelector('div');
  if (isLive) {
    indicator.className = 'w-2 h-2 bg-green-400 rounded-full pulse-ring';
  } else {
    indicator.className = 'w-2 h-2 bg-red-400 rounded-full';
  }
  statusEl.querySelector('span').textContent = text;
}

function updateProgress(status, progress) {
  const container = document.getElementById('progressContainer');
  const bar = document.getElementById('progressBar');
  const label = document.getElementById('progressLabel');
  const percent = document.getElementById('progressPercent');

  if (progress > 0 && progress < 100) {
    container.classList.remove('hidden');
  } else if (progress === 100) {
    setTimeout(() => container.classList.add('hidden'), 1000);
  }

  bar.style.width = progress + '%';
  label.textContent = status;
  percent.textContent = progress + '%';
}

async function runTool(tool) {
  let endpoint, payload;

  switch (tool) {
    case 'domain':
      const domain = document.getElementById('domainInput').value;
      if (!domain) return alert('Please enter a domain');
      endpoint = '/api/osint/domain-recon';
      payload = { domain };
      break;
    case 'ip':
      const ip = document.getElementById('ipInput').value;
      if (!ip) return alert('Please enter an IP address');
      endpoint = '/api/osint/ip-lookup';
      payload = { ip };
      break;
    case 'email':
      const email = document.getElementById('emailInput').value;
      if (!email) return alert('Please enter an email');
      endpoint = '/api/osint/email-verify';
      payload = { email };
      break;
    case 'port':
      const host = document.getElementById('portHostInput').value;
      if (!host) return alert('Please enter a host');
      endpoint = '/api/osint/port-scan';
      payload = { host };
      break;
    case 'username':
      const username = document.getElementById('usernameInput').value;
      if (!username) return alert('Please enter a username');
      endpoint = '/api/osint/username-search';
      payload = { username };
      break;
    case 'ssl':
      const sslDomain = document.getElementById('sslInput').value;
      if (!sslDomain) return alert('Please enter a domain');
      endpoint = '/api/osint/ssl-lookup';
      payload = { domain: sslDomain };
      break;
    case 'subdomain':
      const subDomain = document.getElementById('subdomainInput').value;
      if (!subDomain) return alert('Please enter a domain');
      endpoint = '/api/osint/subdomain-finder';
      payload = { domain: subDomain };
      break;
    default:
      return;
  }

  try {
    updateProgress('Initializing...', 5);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Request failed');
    const result = await response.json();

    if (result.success) {
      displayResults(result.results);
      loadHistory();
      loadStats();
    } else {
      alert('Error: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Tool error:', error);
    alert('Error running tool: ' + error.message);
  }
}

function displayResults(results) {
  const container = document.getElementById('resultsContainer');
  const content = document.getElementById('resultsJSON');
  content.textContent = JSON.stringify(results, null, 2);
  container.classList.remove('hidden');
  container.scrollIntoView({ behavior: 'smooth' });
}

async function loadHistory() {
  try {
    const response = await fetch('/api/osint/history');
    const data = await response.json();
    const historyList = document.getElementById('historyList');

    if (data.results && data.results.length > 0) {
      historyList.innerHTML = data.results.map(item => `
        <div class="bg-gray-700 rounded p-3 hover:bg-gray-600 cursor-pointer transition">
          <div class="flex justify-between items-center">
            <span class="font-semibold text-blue-400 text-sm">${item.type.replace('_', ' ')}</span>
            <span class="text-gray-400 text-xs">${new Date(item.created_at).toLocaleDateString()}</span>
          </div>
          <p class="text-gray-300 text-sm truncate">${item.query}</p>
        </div>
      `).join('');
    } else {
      historyList.innerHTML = '<p class="text-gray-400">No searches yet</p>';
    }
  } catch (error) {
    console.error('History load error:', error);
  }
}

let statsChart = null;

async function loadStats() {
  try {
    const response = await fetch('/api/osint/stats');
    const data = await response.json();
    const ctx = document.getElementById('statsChart').getContext('2d');

    if (statsChart) {
      statsChart.destroy();
    }

    if (data.results && data.results.length > 0) {
      statsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: data.results.map(r => r.type.replace('_', ' ')),
          datasets: [{
            data: data.results.map(r => r.count),
            backgroundColor: [
              '#3b82f6',
              '#8b5cf6',
              '#ec4899',
              '#f59e0b',
              '#10b981',
              '#06b6d4',
              '#6366f1'
            ],
            borderColor: '#1f2937',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              labels: {
                color: '#e5e7eb',
                font: { size: 12 }
              }
            }
          }
        }
      });
    }
  } catch (error) {
    console.error('Stats load error:', error);
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  connectWebSocket();
  loadHistory();
  loadStats();

  // Auto-refresh statistics every 30 seconds
  setInterval(() => {
    loadStats();
  }, 30000);
});

// Allow Enter key to submit
document.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const activeElement = document.activeElement;
    if (activeElement.id === 'domainInput') runTool('domain');
    if (activeElement.id === 'ipInput') runTool('ip');
    if (activeElement.id === 'emailInput') runTool('email');
    if (activeElement.id === 'portHostInput') runTool('port');
    if (activeElement.id === 'usernameInput') runTool('username');
    if (activeElement.id === 'sslInput') runTool('ssl');
    if (activeElement.id === 'subdomainInput') runTool('subdomain');
  }
});
