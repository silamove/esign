# MailHog Setup for Development

MailHog is a fake SMTP server with a web UI that's perfect for testing emails during development.

## Quick Start with Docker

1. **Start MailHog:**
   ```bash
   docker run -d -p 1025:1025 -p 8025:8025 --name mailhog mailhog/mailhog
   ```

2. **Configure Environment:**
   Already configured in `.env`:
   ```properties
   USE_MAILHOG=true
   SMTP_HOST=localhost
   SMTP_PORT=1025
   MAILHOG_WEB_PORT=8025
   ```

3. **Access Web UI:**
   Open http://localhost:8025 to view sent emails

## Alternative: Install MailHog Locally

### Windows:
```bash
# Using Go (if installed)
go install github.com/mailhog/MailHog@latest

# Or download binary from: https://github.com/mailhog/MailHog/releases
```

### macOS:
```bash
brew install mailhog
mailhog
```

### Linux:
```bash
# Download binary
wget https://github.com/mailhog/MailHog/releases/download/v1.0.1/MailHog_linux_amd64
chmod +x MailHog_linux_amd64
sudo mv MailHog_linux_amd64 /usr/local/bin/mailhog
mailhog
```

## Usage

1. **Start MailHog** (choose one method above)
2. **Start your backend server:**
   ```bash
   cd backend
   npm run dev
   ```
3. **Test emails via API:**
   - Web UI: http://localhost:8025
   - SMTP: localhost:1025
   - Test endpoint: `POST /api/email/test`

## API Endpoints

- `GET /api/email/status` - Check email service status
- `POST /api/email/test` - Send test email
- `POST /api/email/welcome` - Send welcome email
- `POST /api/email/envelope-invitation` - Send signature request
- `POST /api/email/envelope-completed` - Send completion notification

## Fallback: Ethereal Email

If MailHog is not available, set `USE_MAILHOG=false` in `.env` to use Ethereal Email:
- Web UI: https://ethereal.email/login
- Credentials will be displayed in console on startup

## Email Templates Included

1. **Welcome Email** - New user registration
2. **Envelope Invitation** - Signature request
3. **Envelope Completed** - All signatures collected
4. **Test Email** - Development testing

All emails are responsive and include proper branding for OnDottedLine.
