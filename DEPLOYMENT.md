# IndiaHost VPS Production Deployment Guide

This guide provides step-by-step instructions for deploying the **Aylem Learning Student Portal** to a dedicated Linux VPS (IndiaHost) running Ubuntu 22.04 or 24.04 LTS.

---

## Architecture Overview

```
Internet (HTTPS)
      │
      ▼
Nginx (Reverse Proxy, SSL/TLS Termination, Security Headers, Port 80/443)
      │
      ▼
Next.js 16 Standalone Server (systemd service, localhost:3000)
      │
      ├─ Drizzle ORM
      ▼
PostgreSQL (Local database, localhost:5432, private network only)
      │
      └─ Cloudflare R2 (Private S3-compatible PDF storage with signed URLs)
```

---

## 1. VPS Prerequisites & Initial Hardening

Connect to your IndiaHost VPS via SSH:

```bash
ssh root@YOUR_SERVER_IP
```

Update system repositories and install essential packages:

```bash
apt update && apt upgrade -y
apt install -y curl git ufw nginx postgresql postgresql-contrib certbot python3-certbot-nginx
```

Configure the UFW firewall to block all incoming traffic except SSH, HTTP, and HTTPS:

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

Create a non-root system service user:

```bash
useradd -m -s /bin/bash aylem
```

---

## 2. Runtime Installation (Node.js 22 LTS & Bun)

Install Node.js 22 LTS (recommended runtime for Next.js 16):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v   # Verify >= 22.12.0
```

Install Bun for package management and CLI commands:

```bash
curl -fsSL https://bun.sh/install | bash
# Add bun to system PATH
cp /root/.bun/bin/bun /usr/local/bin/
bun -v
```

---

## 3. PostgreSQL Database Setup

PostgreSQL should bind strictly to `localhost` (`127.0.0.1`) so it is never reachable over the public internet.

Verify `/etc/postgresql/*/main/postgresql.conf`:
```text
listen_addresses = 'localhost'
```

Create the dedicated database and user:

```bash
sudo -u postgres psql
```

Inside the PostgreSQL prompt:
```sql
CREATE USER aylem_app WITH ENCRYPTED PASSWORD 'GENERATE_A_STRONG_RANDOM_PASSWORD';
CREATE DATABASE aylem_portal OWNER aylem_app;
GRANT ALL PRIVILEGES ON DATABASE aylem_portal TO aylem_app;
\q
```

Test the connection:
```bash
psql -U aylem_app -d aylem_portal -h 127.0.0.1 -W
```

---

## 4. Application Directory & Repository Setup

Create the deployment directory:

```bash
mkdir -p /var/www/aylem-portal
chown -R aylem:aylem /var/www/aylem-portal
```

Clone the repository into the directory as the `aylem` user:

```bash
sudo -u aylem git clone <REPO_URL> /var/www/aylem-portal
cd /var/www/aylem-portal
```

Install project dependencies:

```bash
sudo -u aylem bun install --frozen-lockfile
```

---

## 5. Production Environment Configuration

Create the production environment file:

```bash
cp deploy/.env.production.example /var/www/aylem-portal/.env.production
chmod 600 /var/www/aylem-portal/.env.production
chown aylem:aylem /var/www/aylem-portal/.env.production
```

Edit `/var/www/aylem-portal/.env.production` and configure your credentials:

```ini
NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1

DATABASE_URL=postgresql://aylem_app:YOUR_DB_PASSWORD@127.0.0.1:5432/aylem_portal
ALLOW_PUBLIC_SIGNUP=false

R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_r2_bucket_name
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
```

---

## 6. Database Migrations

Apply the initial schema migrations to PostgreSQL:

```bash
cd /var/www/aylem-portal
sudo -u aylem bun run db:migrate
```

*(Note: Never run development seed scripts in production. Accounts will be provisioned as customers enroll).*

---

## 7. Next.js Standalone Build

Build the optimized standalone production bundle:

```bash
cd /var/www/aylem-portal
sudo -u aylem bun run build
```

Copy the static assets required by Next.js standalone mode:

```bash
sudo -u aylem cp -r public .next/standalone/ || true
sudo -u aylem cp -r .next/static .next/standalone/.next/
```

---

## 8. Process Management (systemd)

Copy the pre-configured systemd service file:

```bash
cp /var/www/aylem-portal/deploy/aylem-portal.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable aylem-portal
systemctl start aylem-portal
```

Verify service status:

```bash
systemctl status aylem-portal
curl -I http://127.0.0.1:3000
```

Inspect real-time application logs:

```bash
journalctl -u aylem-portal -f
```

---

## 9. Nginx Reverse Proxy Setup

Copy the Nginx configuration:

```bash
cp /var/www/aylem-portal/deploy/nginx-aylem-portal.conf /etc/nginx/sites-available/aylem-portal.conf
ln -s /etc/nginx/sites-available/aylem-portal.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
```

Test configuration syntax:

```bash
nginx -t
systemctl reload nginx
```

---

## 10. DNS Configuration

In your DNS provider (e.g. Cloudflare, Namecheap, GoDaddy):
- Create an **A record**:
  - Name: `portal` (for `portal.aylemlearning.com`)
  - Value: `<YOUR_INDIAHOST_VPS_IP>`
  - TTL: 300 seconds

Wait for DNS propagation:
```bash
dig +short portal.aylemlearning.com
```

---

## 11. HTTPS / TLS Setup (Let's Encrypt Certbot)

Once DNS resolves to the VPS, obtain a free trusted SSL/TLS certificate:

```bash
certbot --nginx -d portal.aylemlearning.com
```

Certbot automatically configures HTTPS redirection and installs the certificates.

Test renewal:
```bash
certbot renew --dry-run
```

---

## 12. Update & Deployment Procedure

When deploying new code updates:

```bash
cd /var/www/aylem-portal
sudo -u aylem git pull origin main
sudo -u aylem bun install --frozen-lockfile
sudo -u aylem bun run db:migrate
sudo -u aylem bun run build
sudo -u aylem cp -r .next/static .next/standalone/.next/
systemctl restart aylem-portal
```

---

## 13. Automated Daily Database Backups

Install the automated backup routine:

```bash
mkdir -p /var/backups/aylem-portal
chmod 700 /var/backups/aylem-portal
cp /var/www/aylem-portal/deploy/backup-db.sh /usr/local/bin/backup-aylem-db.sh
chmod +x /usr/local/bin/backup-aylem-db.sh
```

Add a daily cron job in `/etc/cron.d/aylem-backup`:

```text
0 2 * * * root /usr/local/bin/backup-aylem-db.sh > /dev/null 2>&1
```

To restore a backup:

```bash
gunzip -c /var/backups/aylem-portal/aylem_portal_YYYYMMDD_HHMMSS.sql.gz | psql -U aylem_app -d aylem_portal -h 127.0.0.1
```

---

## 14. Basic Troubleshooting

| Issue | Diagnostic Step | Solution |
|-------|-----------------|----------|
| **502 Bad Gateway** | `systemctl status aylem-portal` | Check if Node.js server is crashed or stopped. Check `journalctl -u aylem-portal -e`. |
| **Database Connection Refused** | `systemctl status postgresql` | Verify PostgreSQL is running. Test `psql -h 127.0.0.1 -U aylem_app -d aylem_portal`. |
| **Static assets 404** | Check `.next/standalone/.next/static` | Run `cp -r .next/static .next/standalone/.next/` and verify permissions. |
| **Too Many Login Attempts** | Check client IP header | Nginx must pass `X-Real-IP $remote_addr;`. Rate limiter resets after 15 min. |
| **PDF Download Fails (503)** | Verify R2 credentials | Check `.env.production` for valid Cloudflare R2 bucket name, endpoint, and keys. |
