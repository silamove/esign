const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
const http = require('http');

class DevSMTPServer {
  constructor() {
    this.emails = [];
    this.server = null;
    this.webServer = null;
  }

  start() {
    // Create SMTP server
    this.server = new SMTPServer({
      name: 'OnDottedLine Dev SMTP',
      banner: 'OnDottedLine Development SMTP Server',
      authOptional: true,
      onAuth: (auth, session, callback) => {
        // Accept any authentication for development
        callback(null, { user: auth.username });
      },
      onData: (stream, session, callback) => {
        this.handleEmail(stream, session, callback);
      }
    });

    // Start SMTP server on port 1025
    this.server.listen(1025, () => {
      console.log('🚀 Development SMTP Server running on port 1025');
    });

    // Create web interface server
    this.createWebInterface();
  }

  handleEmail(stream, session, callback) {
    simpleParser(stream, (err, parsed) => {
      if (err) {
        console.error('Error parsing email:', err);
        return callback(err);
      }

      const email = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        from: parsed.from?.text || 'Unknown',
        to: parsed.to?.text || 'Unknown',
        subject: parsed.subject || 'No Subject',
        text: parsed.text || '',
        html: parsed.html || '',
        headers: parsed.headers || {},
        attachments: parsed.attachments || []
      };

      this.emails.unshift(email); // Add to beginning of array
      
      // Keep only last 100 emails
      if (this.emails.length > 100) {
        this.emails = this.emails.slice(0, 100);
      }

      console.log(`📧 Email received: ${email.subject} (from: ${email.from})`);
      callback();
    });
  }

  createWebInterface() {
    this.webServer = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      
      if (url.pathname === '/api/emails') {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify(this.emails));
      } else if (url.pathname === '/api/clear') {
        this.emails = [];
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ message: 'Emails cleared' }));
      } else if (url.pathname.startsWith('/api/email/')) {
        const emailId = url.pathname.split('/')[3];
        const email = this.emails.find(e => e.id.toString() === emailId);
        if (email) {
          res.setHeader('Content-Type', 'application/json');
          res.writeHead(200);
          res.end(JSON.stringify(email));
        } else {
          res.writeHead(404);
          res.end('Email not found');
        }
      } else {
        // Serve the web interface
        this.serveWebInterface(res);
      }
    });

    this.webServer.listen(8025, () => {
      console.log('🌐 SMTP Web Interface running on http://localhost:8025');
    });
  }

  serveWebInterface(res) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OnDottedLine - Dev SMTP Server</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
        .header { background: #1f2937; color: white; padding: 1rem; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .stats { display: flex; gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex: 1; }
        .emails-container { display: grid; grid-template-columns: 1fr 2fr; gap: 2rem; height: 70vh; }
        .email-list { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .email-item { padding: 1rem; border-bottom: 1px solid #e5e7eb; cursor: pointer; transition: background 0.2s; }
        .email-item:hover { background: #f9fafb; }
        .email-item.selected { background: #dbeafe; border-left: 4px solid #3b82f6; }
        .email-preview { background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: auto; }
        .email-subject { font-weight: 600; margin-bottom: 0.5rem; }
        .email-meta { font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem; }
        .email-body { margin-top: 1rem; }
        .btn { background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
        .btn:hover { background: #2563eb; }
        .no-emails { text-align: center; color: #6b7280; padding: 2rem; }
        .loading { text-align: center; padding: 2rem; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📧 OnDottedLine Development SMTP Server</h1>
        <p>SMTP: localhost:1025 | Web Interface: localhost:8025</p>
    </div>
    
    <div class="container">
        <div class="stats">
            <div class="stat-card">
                <h3>Total Emails</h3>
                <div id="emailCount">Loading...</div>
            </div>
            <div class="stat-card">
                <h3>SMTP Status</h3>
                <div style="color: #10b981;">✅ Running on :1025</div>
            </div>
            <div class="stat-card">
                <button class="btn" onclick="clearEmails()">Clear All Emails</button>
                <button class="btn" onclick="refreshEmails()" style="margin-left: 0.5rem;">Refresh</button>
            </div>
        </div>

        <div class="emails-container">
            <div class="email-list">
                <div style="padding: 1rem; background: #f9fafb; border-bottom: 1px solid #e5e7eb; font-weight: 600;">
                    Received Emails
                </div>
                <div id="emailsList">
                    <div class="loading">Loading emails...</div>
                </div>
            </div>
            
            <div class="email-preview">
                <div id="emailPreview">
                    <div class="no-emails">Select an email to view its content</div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let emails = [];
        let selectedEmailId = null;

        async function loadEmails() {
            try {
                const response = await fetch('/api/emails');
                emails = await response.json();
                renderEmailList();
                updateStats();
            } catch (error) {
                console.error('Error loading emails:', error);
            }
        }

        function renderEmailList() {
            const listElement = document.getElementById('emailsList');
            
            if (emails.length === 0) {
                listElement.innerHTML = '<div class="no-emails">No emails received yet</div>';
                return;
            }

            listElement.innerHTML = emails.map(email => \`
                <div class="email-item \${selectedEmailId === email.id ? 'selected' : ''}" 
                     onclick="selectEmail(\${email.id})">
                    <div class="email-subject">\${email.subject}</div>
                    <div class="email-meta">From: \${email.from}</div>
                    <div class="email-meta">To: \${email.to}</div>
                    <div class="email-meta">\${new Date(email.timestamp).toLocaleString()}</div>
                </div>
            \`).join('');
        }

        function selectEmail(emailId) {
            selectedEmailId = emailId;
            const email = emails.find(e => e.id === emailId);
            renderEmailList(); // Re-render to show selection
            renderEmailPreview(email);
        }

        function renderEmailPreview(email) {
            const previewElement = document.getElementById('emailPreview');
            
            previewElement.innerHTML = \`
                <div>
                    <h2>\${email.subject}</h2>
                    <div style="margin: 1rem 0; padding: 1rem; background: #f9fafb; border-radius: 6px;">
                        <div><strong>From:</strong> \${email.from}</div>
                        <div><strong>To:</strong> \${email.to}</div>
                        <div><strong>Date:</strong> \${new Date(email.timestamp).toLocaleString()}</div>
                    </div>
                    
                    <div class="email-body">
                        <h4>Content:</h4>
                        <div style="margin-top: 0.5rem; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 6px;">
                            \${email.html || \`<pre style="white-space: pre-wrap; font-family: inherit;">\${email.text}</pre>\`}
                        </div>
                    </div>
                    
                    \${email.attachments && email.attachments.length > 0 ? \`
                        <div style="margin-top: 1rem;">
                            <h4>Attachments:</h4>
                            <ul>
                                \${email.attachments.map(att => \`<li>\${att.filename} (\${att.contentType})</li>\`).join('')}
                            </ul>
                        </div>
                    \` : ''}
                </div>
            \`;
        }

        function updateStats() {
            document.getElementById('emailCount').textContent = emails.length;
        }

        async function clearEmails() {
            if (confirm('Are you sure you want to clear all emails?')) {
                try {
                    await fetch('/api/clear');
                    emails = [];
                    selectedEmailId = null;
                    renderEmailList();
                    updateStats();
                    document.getElementById('emailPreview').innerHTML = 
                        '<div class="no-emails">Select an email to view its content</div>';
                } catch (error) {
                    console.error('Error clearing emails:', error);
                }
            }
        }

        function refreshEmails() {
            loadEmails();
        }

        // Auto-refresh every 5 seconds
        setInterval(loadEmails, 5000);

        // Load initial emails
        loadEmails();
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.writeHead(200);
    res.end(html);
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
    if (this.webServer) {
      this.webServer.close();
    }
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const smtpServer = new DevSMTPServer();
  smtpServer.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down SMTP server...');
    smtpServer.stop();
    process.exit(0);
  });
}

module.exports = DevSMTPServer;
