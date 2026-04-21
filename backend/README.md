# IQC Platform Backend

Backend Flask para persistir los modulos que antes vivian solo en cache local.

## Requisitos

- Python 3.10+

## Instalacion local

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

## Produccion

Desde la raiz del repo:

```bash
gunicorn --chdir backend "app:app"
```

Variables importantes:

- `IQC_ENV=production`
- `IQC_SECRET_KEY`
- `IQC_DATA_DIR`
- `IQC_UPLOAD_DIR`
- `IQC_ADMIN_PASSWORD` para la primera base de produccion
- `IQC_SEED_DEMO_USERS=false` en produccion
- `DATABASE_URL` si se usa una base administrada

## Endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/bootstrap`
- `GET /api/datasets/<name>`
- `PUT /api/datasets/<name>`
- `POST /api/photos/<key>`
- `GET /api/photos/<key>`
- `DELETE /api/photos/<key>`

## Base de datos y evidencias

- SQLite local: `backend/iqc_platform.db`
- SQLite en produccion con volumen: `IQC_DATA_DIR/iqc_platform.db`
- Base administrada opcional: `DATABASE_URL`
- Evidencias locales: `backend/uploads/`
- Evidencias en produccion: `IQC_UPLOAD_DIR`
