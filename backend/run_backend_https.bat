@echo off
setlocal

cd /d %~dp0

if not exist .venv (
    python -m venv .venv
)

call .venv\Scripts\activate
python -m pip install -r requirements.txt
python -c "from app import app; app.run(host='0.0.0.0', port=5443, debug=False, ssl_context=('certs/iqc-server.crt','certs/iqc-server.key'))"
