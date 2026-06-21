import express from 'express';
import axios from 'axios';
import geoip from 'geoip-lite';
import dns from 'dns';
import { promisify } from 'util';
import Database from 'better-sqlite3';

const router = express.Router();
const dnsLookup = promisify(dns.lookup);
const dnsReverse = promisify(dns.reverse);
const db = new Database('osint.db');

// Helper to broadcast progress
const sendProgress = (status, progress, data = {}) => {
  global.broadcastProgress({
    type: 'progress',
    status,
    progress,
    ...data,
    timestamp: new Date().toISOString()
  });
};

// 1. Domain Reconnaissance
router.post('/domain-recon', async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain required' });

  try {
    sendProgress('Starting domain reconnaissance...', 10);
    const results = {};

    // DNS lookup
    sendProgress('Resolving DNS...', 20);
    try {
      const dnsResult = await dnsLookup(domain);
      results.ipAddress = dnsResult.address;
      results.family = dnsResult.family === 4 ? 'IPv4' : 'IPv6';
    } catch (e) {
      results.dnsError = e.message;
    }

    // Geolocation
    if (results.ipAddress) {
      sendProgress('Fetching geolocation...', 40);
      const geo = geoip.lookup(results.ipAddress);
      results.geolocation = geo;
    }

    // Whois info via API
    sendProgress('Fetching WHOIS data...', 60);
    try {
      const whoisRes = await axios.get(`https://whois.iana.org/lookup?query=${domain}`, {
        timeout: 5000
      }).catch(() => ({ data: 'WHOIS data unavailable' }));
      results.whoisPreview = 'WHOIS data available';
    } catch (e) {
      results.whoisError = 'Could not fetch WHOIS';
    }

    // MX Records
    sendProgress('Fetching MX records...', 75);
    try {
      const mxRes = await new Promise((resolve, reject) => {
        dns.resolveMx(domain, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      results.mxRecords = mxRes.slice(0, 5);
    } catch (e) {
      results.mxError = e.message;
    }

    // TXT Records
    sendProgress('Fetching TXT records...', 85);
    try {
      const txtRes = await new Promise((resolve, reject) => {
        dns.resolveTxt(domain, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      results.txtRecords = txtRes.slice(0, 5);
    } catch (e) {
      results.txtError = e.message;
    }

    sendProgress('Domain reconnaissance complete', 100);

    // Store in database
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO searches (type, query, result, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run('domain_recon', domain, JSON.stringify(results), new Date().toISOString());

    res.json({ success: true, results });
  } catch (error) {
    console.error('Domain recon error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. IP Address Lookup
router.post('/ip-lookup', async (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP address required' });

  try {
    sendProgress('Starting IP lookup...', 10);
    const results = {};

    // Geolocation
    sendProgress('Fetching geolocation...', 30);
    const geo = geoip.lookup(ip);
    results.geolocation = geo;

    // Reverse DNS
    sendProgress('Reverse DNS lookup...', 50);
    try {
      const reverseDns = await dnsReverse(ip);
      results.hostname = reverseDns[0] || 'No hostname found';
    } catch (e) {
      results.hostname = 'Reverse DNS failed';
    }

    // ASN info via API
    sendProgress('Fetching ASN information...', 70);
    try {
      const asnRes = await axios.get(`https://ipapi.co/${ip}/json/`, {
        timeout: 5000
      }).catch(() => null);
      if (asnRes?.data) {
        results.asn = asnRes.data.asn;
        results.org = asnRes.data.org;
      }
    } catch (e) {
      // API failed, continue
    }

    sendProgress('IP lookup complete', 100);

    // Store in database
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO searches (type, query, result, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run('ip_lookup', ip, JSON.stringify(results), new Date().toISOString());

    res.json({ success: true, results });
  } catch (error) {
    console.error('IP lookup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Email Verification
router.post('/email-verify', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    sendProgress('Starting email verification...', 10);
    const results = {};

    // Basic validation
    sendProgress('Validating email format...', 20);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    results.formatValid = emailRegex.test(email);

    if (results.formatValid) {
      const [localPart, domain] = email.split('@');
      results.localPart = localPart;
      results.domain = domain;

      // MX record check
      sendProgress('Checking MX records...', 50);
      try {
        const mxRecords = await new Promise((resolve, reject) => {
          dns.resolveMx(domain, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        results.mxRecords = mxRecords.length > 0;
        results.mailServers = mxRecords.slice(0, 3).map(r => r.exchange);
      } catch (e) {
        results.mxRecords = false;
        results.mailServersError = e.message;
      }
    }

    sendProgress('Email verification complete', 100);

    // Store in database
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO searches (type, query, result, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run('email_verify', email, JSON.stringify(results), new Date().toISOString());

    res.json({ success: true, results });
  } catch (error) {
    console.error('Email verify error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Port Scanner (simple version)
router.post('/port-scan', async (req, res) => {
  const { host, ports } = req.body;
  if (!host) return res.status(400).json({ error: 'Host required' });

  try {
    sendProgress('Starting port scan...', 10);
    const results = { host, openPorts: [], commonPorts: {} };
    const portList = ports ? ports.split(',').map(p => parseInt(p)) : [80, 443, 22, 3306, 5432, 8080, 8443];

    sendProgress('Scanning ports...', 20);
    for (let i = 0; i < portList.length; i++) {
      const port = portList[i];
      try {
        const net = await import('net');
        const socket = new net.Socket();
        
        await new Promise((resolve) => {
          socket.setTimeout(1000);
          socket.on('error', () => resolve());
          socket.on('timeout', () => {
            socket.destroy();
            resolve();
          });
          
          socket.connect(port, host, () => {
            results.openPorts.push(port);
            socket.destroy();
            resolve();
          });
        });
      } catch (e) {
        // Port closed
      }
      sendProgress(`Scanning ports... ${i + 1}/${portList.length}`, 20 + (i / portList.length) * 70);
    }

    sendProgress('Port scan complete', 100);

    // Store in database
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO searches (type, query, result, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run('port_scan', host, JSON.stringify(results), new Date().toISOString());

    res.json({ success: true, results });
  } catch (error) {
    console.error('Port scan error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Username Search
router.post('/username-search', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  try {
    sendProgress('Starting username search...', 10);
    const results = { username, platforms: {} };

    const platforms = [
      { name: 'GitHub', url: 'https://github.com/{username}' },
      { name: 'Twitter', url: 'https://twitter.com/{username}' },
      { name: 'Instagram', url: 'https://instagram.com/{username}/' },
      { name: 'Reddit', url: 'https://reddit.com/user/{username}' },
      { name: 'LinkedIn', url: 'https://linkedin.com/in/{username}' },
      { name: 'TikTok', url: 'https://tiktok.com/@{username}' },
      { name: 'Twitch', url: 'https://twitch.tv/{username}' },
      { name: 'YouTube', url: 'https://youtube.com/@{username}' }
    ];

    let checked = 0;
    for (const platform of platforms) {
      const url = platform.url.replace('{username}', username);
      try {
        const response = await axios.head(url, { timeout: 3000, maxRedirects: 5 }).catch(() => ({ status: 404 }));
        results.platforms[platform.name] = {
          found: response.status === 200,
          url: url,
          status: response.status
        };
      } catch (e) {
        results.platforms[platform.name] = {
          found: false,
          url: url,
          status: 'unknown'
        };
      }
      checked++;
      sendProgress(`Searching platforms... ${checked}/${platforms.length}`, 10 + (checked / platforms.length) * 80);
    }

    sendProgress('Username search complete', 100);

    // Store in database
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO searches (type, query, result, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run('username_search', username, JSON.stringify(results), new Date().toISOString());

    res.json({ success: true, results });
  } catch (error) {
    console.error('Username search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. SSL Certificate Lookup
router.post('/ssl-lookup', async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain required' });

  try {
    sendProgress('Starting SSL certificate lookup...', 10);
    const results = {};

    sendProgress('Fetching SSL certificate data...', 50);
    try {
      const certRes = await axios.get(`https://crt.sh/?q=${domain}&output=json`, {
        timeout: 5000
      }).catch(() => ({ data: [] }));
      
      results.certificates = certRes.data.slice(0, 5).map(cert => ({
        issuer: cert.issuer_name,
        notBefore: cert.not_before,
        notAfter: cert.not_after
      })) || [];
    } catch (e) {
      results.certificatesError = e.message;
    }

    sendProgress('SSL lookup complete', 100);

    // Store in database
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO searches (type, query, result, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run('ssl_lookup', domain, JSON.stringify(results), new Date().toISOString());

    res.json({ success: true, results });
  } catch (error) {
    console.error('SSL lookup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Subdomain Finder
router.post('/subdomain-finder', async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain required' });

  try {
    sendProgress('Starting subdomain enumeration...', 10);
    const results = { domain, subdomains: [] };

    sendProgress('Querying subdomain APIs...', 50);
    try {
      const subRes = await axios.get(`https://crt.sh/?q=%.${domain}&output=json`, {
        timeout: 5000
      }).catch(() => ({ data: [] }));
      
      const subs = new Set();
      if (Array.isArray(subRes.data)) {
        subRes.data.forEach(item => {
          const names = item.name_value?.split('\n') || [];
          names.forEach(name => {
            if (name.endsWith(domain)) subs.add(name);
          });
        });
      }
      results.subdomains = Array.from(subs).slice(0, 20);
    } catch (e) {
      results.error = 'Could not fetch subdomains';
    }

    sendProgress('Subdomain enumeration complete', 100);

    // Store in database
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO searches (type, query, result, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run('subdomain_finder', domain, JSON.stringify(results), new Date().toISOString());

    res.json({ success: true, results });
  } catch (error) {
    console.error('Subdomain finder error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 8. Search History
router.get('/history', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM searches ORDER BY created_at DESC LIMIT 50');
    const results = stmt.all();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Statistics
router.get('/stats', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT type, COUNT(*) as count FROM searches GROUP BY type
    `);
    const results = stmt.all();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
