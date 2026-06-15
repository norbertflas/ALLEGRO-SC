@echo off
REM Uruchamia scraper z Twojego komputera (domowe IP omija blokade Akamai).
REM Uzycie: kliknij dwukrotnie ten plik albo uruchom w terminalu: run_local.bat
cd /d "%~dp0"

if not exist .env (
  echo Brak pliku .env.
  echo Skopiuj .env.example -^> .env i uzupelnij WORKER_URL oraz INGEST_TOKEN.
  pause
  exit /b 1
)

if not exist .venv (
  echo ^>^> Tworze srodowisko Pythona (.venv)...
  python -m venv .venv
)
call .venv\Scripts\activate.bat

echo ^>^> Instaluje zaleznosci...
python -m pip install --quiet --upgrade pip
pip install --quiet -e .

echo ^>^> Instaluje przegladarke Playwright (Chromium)...
python -m playwright install chromium

echo ^>^> Startuje scraper...
python -m allegro_sc.run
echo ^>^> Gotowe. Wyniki sprawdz w dashboardzie.
pause
