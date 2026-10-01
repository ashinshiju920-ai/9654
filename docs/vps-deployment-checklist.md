# Aylem Learning Student Portal — IndiaHost VPS Deployment Checklist

Use this operational checklist when executing **Phase 1 — Step 6** (Actual VPS Deployment).

---

## 1. PRE-DEPLOYMENT

- [ ] Repository verified locally with `bun run test`, `bun run lint`, `bun run typecheck`, and `bun run build`.
- [ ] No Supabase dependencies or SDKs remain in `package.json` or `src/`.
- [ ] Dedicated IndiaHost VPS provisioned with Ubuntu 22.04 LTS or 24.04 LTS.
- [ ] SSH access established with non-root sudo user.
- [ ] SSH key-based authentication enforced (`PasswordAuthentication no`).
- [ ] Cloudflare R2 bucket provisioned with API credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`).
- [ ] DNS access available for `portal.aylemlearning.com` (do not cut over until ready).

---

## 2. VPS SETUP

- [ ] System packages updated: `sudo apt update && sudo apt upgrade -y`.
- [ ] Essential packages installed: `sudo apt install -y curl git ufw nginx postgresql postgresql-contrib certbot python3-certbot-nginx`.
- [ ] Dedicated service account created: `sudo useradd -m -s /bin/bash aylem`.
- [ ] Node.js 22 LTS installed: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`.
- [ ] Bun installed: `curl -fsSL https://bun.sh/install | bash`.
- [ ] Deployment directory created: `sudo mkdir -p /var/www/aylem-portal && sudo chown -R aylem:aylem /var/www/aylem-portal`.
- [ ] Firewall configured (`ufw`):
  - [ ] `sudo ufw default deny incoming`
  - [ ] `sudo ufw default allow outgoing`
  - [ ] `sudo ufw allow OpenSSH`
  - [ ] `sudo ufw allow 'Nginx Full'`
  - [ ] `sudo ufw enable`

---

## 3. DATABASE (POSTGRESQL)

- [ ] PostgreSQL bound strictly to localhost (`127.0.0.1`) in `/etc/postgresql/*/main/postgresql.conf`:
  - `listen_addresses = 'localhost'`
- [ ] Dedicated database user created:
  ```bash
  sudo -u postgres psql -c "CREATE USER aylem_app WITH ENCRYPTED PASSWORD 'GENERATE_STRONG_PASSWORD_HERE';"
  ```
- [ ] Dedicated database created:
  ```bash
  sudo -u postgres psql -c "CREATE DATABASE aylem_portal OWNER aylem_app;"
  ```
- [ ] Permissions verified:
  ```bash
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE aylem_portal TO aylem_app;"
  ```
- [ ] Connection tested locally:
  ```bash
  psql -U aylem_app -d aylem_portal -h 127.0.0.1 -W
  ```

---

## 4. APPLICATION

- [ ] Code cloned or pulled into `/var/www/aylem-portal`.
- [ ] Production environment file created at `/var/www/aylem-portal/.env.production` (permissions `chmod 600`).
- [ ] `DATABASE_URL` configured to `postgresql://aylem_app:PASSWORD@127.0.0.1:5432/aylem_portal`.
- [ ] `ALLOW_PUBLIC_SIGNUP=false` verified.
- [ ] R2 credentials and bucket details populated.
- [ ] Production dependencies installed: `bun install --frozen-lockfile`.
- [ ] Database migrations applied: `bun run db:migrate`.
- [ ] Standalone Next.js production build created: `bun run build`.
- [ ] Static assets copied into standalone folder:
  ```bash
  cp -r public .next/standalone/ || true
  cp -r .next/static .next/standalone/.next/
  ```
- [ ] File permissions granted to service account: `sudo chown -R aylem:aylem /var/www/aylem-portal`.

---

## 5. PROCESS MANAGEMENT (SYSTEMD)

- [ ] Systemd service file copied:
  ```bash
  sudo cp deploy/aylem-portal.service /etc/systemd/system/
  ```
- [ ] Service daemon reloaded: `sudo systemctl daemon-reload`.
- [ ] Service enabled for automatic start on boot: `sudo systemctl enable aylem-portal`.
- [ ] Service started: `sudo systemctl start aylem-portal`.
- [ ] Service status verified: `sudo systemctl status aylem-portal`.
- [ ] Application responds locally on internal port: `curl -I http://127.0.0.1:3000`.

---

## 6. NGINX REVERSE PROXY

- [ ] Nginx configuration copied:
  ```bash
  sudo cp deploy/nginx-aylem-portal.conf /etc/nginx/sites-available/aylem-portal.conf
  sudo ln -s /etc/nginx/sites-available/aylem-portal.conf /etc/nginx/sites-enabled/
  ```
- [ ] Default Nginx site disabled: `sudo rm -f /etc/nginx/sites-enabled/default`.
- [ ] Configuration syntax tested: `sudo nginx -t`.
- [ ] Nginx reloaded: `sudo systemctl reload nginx`.

---

## 7. DNS

- [ ] In domain registrar / DNS provider, create an `A` record:
  - **Host**: `portal` (for `portal.aylemlearning.com`)
  - **Type**: `A`
  - **Points to**: `<YOUR_INDIAHOST_VPS_PUBLIC_IP>`
  - **TTL**: `300` (short TTL during migration)
- [ ] Verify DNS propagation: `dig +short portal.aylemlearning.com` or `nslookup portal.aylemlearning.com`.

---

## 8. HTTPS (TLS / CERTBOT)

- [ ] Obtain Let's Encrypt SSL certificate via Certbot:
  ```bash
  sudo certbot --nginx -d portal.aylemlearning.com
  ```
- [ ] Select automatic HTTP $\to$ HTTPS redirection.
- [ ] Test automatic certificate renewal:
  ```bash
  sudo certbot renew --dry-run
  ```
- [ ] Verify SSL rating via Qualys SSL Labs (aim for A / A+).

---

## 9. SECURITY VERIFICATION

- [ ] Port check: verify only ports 22, 80, and 443 are open to the internet (`sudo nmap -sT -O localhost` and external scan).
- [ ] Confirm PostgreSQL port `5432` is NOT accessible from the internet.
- [ ] Confirm Next.js port `3000` is NOT accessible from the internet.
- [ ] Confirm `ALLOW_PUBLIC_SIGNUP=false` rejects public registration attempts (`POST /api/auth/signup` returns 403).
- [ ] Confirm `aylem_session` cookie has `HttpOnly`, `Secure`, and `SameSite=Lax`.
- [ ] Confirm server security headers are present (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`).
- [ ] Confirm Nginx rate-limiting blocks rapid login bursts.

---

## 10. POST-DEPLOYMENT SMOKE TESTS

- [ ] Open `https://portal.aylemlearning.com/login` in browser.
- [ ] Log in with provisioned student account.
- [ ] Verify redirection to `/dashboard`.
- [ ] Browse course pages (`/courses/ielts`, `/courses/oet`, etc.).
- [ ] Click study material PDF and verify authenticated signed R2 download link opens.
- [ ] Access quiz preview (`/courses/ielts/quiz`).
- [ ] Check profile details (`/profile`) and update full name.
- [ ] Click logout and verify session invalidation and redirection to `/login`.
- [ ] Attempt opening `/dashboard` directly and verify automatic redirect back to `/login`.

---

## 11. AUTOMATED BACKUPS

- [ ] Backup script installed:
  ```bash
  sudo mkdir -p /var/backups/aylem-portal
  sudo cp deploy/backup-db.sh /usr/local/bin/backup-aylem-db.sh
  sudo chmod +x /usr/local/bin/backup-aylem-db.sh
  ```
- [ ] Test run executed: `sudo /usr/local/bin/backup-aylem-db.sh`.
- [ ] Daily cron job registered in `/etc/cron.d/aylem-db-backup`:
  ```text
  0 2 * * * root /usr/local/bin/backup-aylem-db.sh > /dev/null 2>&1
  ```
- [ ] Configure off-site sync (e.g., automated rsync or S3/R2 backup bucket upload).
