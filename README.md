# 🕵️ OSINT Platform

A comprehensive, production-ready OSINT (Open Source Intelligence) platform optimized for Render's free tier.

## 📊 Features

- **Domain Reconnaissance**: DNS lookup, geolocation, WHOIS data, MX/TXT records
- **IP Address Lookup**: Geolocation, reverse DNS, ASN information
- **Email Verification**: Format validation, MX record checking, mail server discovery
- **Port Scanner**: Multi-threaded port scanning with quick results
- **Username Search**: Cross-platform username availability checking
- **SSL Certificate Lookup**: Certificate history and expiration tracking
- **Subdomain Finder**: Enumerate subdomains from certificate transparency logs
- **Real-time Progress**: WebSocket-powered live updates
- **Search History**: Track all previous searches
- **Statistics Dashboard**: Visual analytics with Chart.js

## 🚀 Quick Start

### Local Development

```bash
npm install
npm run dev
```

Access at `http://localhost:3000`

### Deploy to Render

1. Fork/clone this repository
2. Connect to Render: https://dashboard.render.com
3. Create new Web Service
4. Connect your GitHub repo
5. Use these settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (512 MB RAM)
   - **Node Version**: 18.x

6. Deploy!

## 🔧 Tech Stack

- **Backend**: Express.js (lightweight, fast)
- **Frontend**: HTML5 + Vanilla JS + Tailwind CSS
- **Real-time**: WebSockets (ws library)
- **Database**: SQLite (embedded, zero external dependencies)
- **APIs**: Multiple free OSINT service integrations

## 📈 Performance

Optimized for Render free tier:
- ✅ **Memory**: ~150-200MB typical usage
- ✅ **CPU**: Minimal, well under 0.1 limits
- ✅ **Database**: SQLite embedded, no external DB needed
- ✅ **Response times**: <2s average

## 🔒 Security

- Rate limiting (100 requests/15min per IP)
- Helmet.js security headers
- CORS protection
- Input validation
- Error handling without stack trace leaks

## 📝 API Endpoints

### POST /api/osint/domain-recon
Analyze domain with DNS, geolocation, WHOIS

### POST /api/osint/ip-lookup
Lookup IP geolocation and reverse DNS

### POST /api/osint/email-verify
Verify email format and MX records

### POST /api/osint/port-scan
Scan common ports on a host

### POST /api/osint/username-search
Search for username across platforms

### POST /api/osint/ssl-lookup
Lookup SSL certificate information

### POST /api/osint/subdomain-finder
Find subdomains via certificate transparency

### GET /api/osint/history
Retrieve search history (last 50)

### GET /api/osint/stats
Get statistics by tool type

### GET /health
Health check endpoint

## 🌐 Ad Integration

Integrated promotional banner for https://zexyo.xyz - premium OSINT services.

## ⚠️ Legal & Ethical

**Important**: This tool is for educational and authorized security testing only. Users are responsible for:
- Obtaining proper authorization before reconnaissance
- Complying with local and international laws
- Respecting privacy and data protection regulations
- Using tools ethically and responsibly

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please follow existing code style.

## 📧 Support

For issues and feature requests, please open an issue on GitHub.

---

**Made with ❤️ for the security research community**
