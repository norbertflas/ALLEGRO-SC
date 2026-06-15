#!/usr/bin/env bash
# Uruchamia scraper z Twojego komputera (domowe IP omija blokadę Akamai).
# Użycie:  ./run_local.sh
set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Brak pliku .env."
  echo "Skopiuj .env.example -> .env i uzupełnij WORKER_URL oraz INGEST_TOKEN."
  exit 1
fi

if [ ! -d .venv ]; then
  echo ">> Tworzę środowisko Pythona (.venv)..."
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
. .venv/bin/activate

echo ">> Instaluję zależności..."
pip install --quiet --upgrade pip
pip install --quiet -e .

echo ">> Instaluję przeglądarkę Playwright (Chromium)..."
python -m playwright install chromium

echo ">> Startuję scraper..."
python -m allegro_sc.run
echo ">> Gotowe. Wyniki sprawdź w dashboardzie."
