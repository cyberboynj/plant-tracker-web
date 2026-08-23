# Sprout Plant Tracker

A small Flask web application for tracking houseplant watering schedules. Plant data is stored in `plants.json` beside the application and is written atomically.

## Run locally

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python plant_tracker.py --web
```

Open <http://127.0.0.1:8000>. The app binds to localhost by default. For a production deployment, use the included `Procfile` and set `PORT` through the hosting provider.

## API

- `GET /api/plants` lists plants
- `POST /api/plants` creates a plant with `name`, `watering_interval`, and `last_watered`
- `PATCH /api/plants/<id>/water` records watering today
- `DELETE /api/plants/<id>` removes a plant

The server validates all input, limits request size, returns security headers, and never enables Flask debug mode. This is a single-user file-backed app: keep `plants.json` private and add authentication before exposing it to an untrusted network. Use HTTPS when deploying publicly.