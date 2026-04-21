# IQC Platform

Web platform for IQC inspection records, vendors, evidence photos, approvals, and notifications.

## Local Run

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000`.

## Production Configuration

Set these environment variables before deploying:

- `IQC_ENV=production`
- `IQC_SECRET_KEY`: long random secret for Flask sessions
- `IQC_DATA_DIR`: persistent storage directory when using SQLite
- `IQC_UPLOAD_DIR`: persistent directory for uploaded evidence photos
- `IQC_ADMIN_USERNAME`, `IQC_ADMIN_PASSWORD`, `IQC_ADMIN_NAME`: initial admin for a new production database
- `IQC_SEED_DEMO_USERS=false`: keep demo/default users disabled in production
- `DATABASE_URL`: optional managed database URL. If omitted, SQLite is stored at `IQC_DATA_DIR/iqc_platform.db`
- `IQC_VAPID_PUBLIC_KEY`, `IQC_VAPID_PRIVATE_KEY`, `IQC_VAPID_SUBJECT`: required only for web push notifications

Do not commit local database files, uploaded evidence, logs, local certificates, or `.env` files.

## Deploy

The app is ready for hosts that run a Python web service from the repo root.

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
gunicorn --chdir backend "app:app"
```

For Render, `render.yaml` is included and attaches a persistent disk at `/var/data`.

Before the first production deploy, set `IQC_ADMIN_PASSWORD` in the hosting dashboard. Without it, a fresh production database will refuse to start instead of creating a public default password.

For Railway, create a web service from the GitHub repo, use the same start command, and attach a volume. Set `IQC_DATA_DIR` and `IQC_UPLOAD_DIR` to paths inside the mounted volume.

## Before GitHub Push

Check that these paths are not included in the commit:

- `backend/iqc_platform.db`
- `backend/uploads/`
- `backend/certs/`
- `backend/cleanup-backup-*/`
- `backend/*.log`
- `.env`
- `iqc-local-ca.crt`
