"""Plant watering tracker API and command-line interface."""

import json
import os
import tempfile
from datetime import date
from pathlib import Path
from uuid import uuid4

from flask import Flask, jsonify, request, send_from_directory


DATA_FILE = Path(__file__).with_name("plants.json")
WEB_DIR = Path(__file__).with_name("web-interface")
MAX_NAME_LENGTH = 40
MAX_INTERVAL = 365

app = Flask(__name__, static_folder=str(WEB_DIR), static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024


def validate_plant(payload, require_name=True):
	if not isinstance(payload, dict):
		raise ValueError("A JSON object is required.")

	name = str(payload.get("name", "")).strip()
	if require_name and not name:
		raise ValueError("A plant name is required.")
	if len(name) > MAX_NAME_LENGTH:
		raise ValueError("Plant names must be 40 characters or fewer.")

	try:
		interval = int(payload.get("watering_interval", 0))
	except (TypeError, ValueError) as error:
		raise ValueError("Watering interval must be a whole number.") from error
	if not 1 <= interval <= MAX_INTERVAL:
		raise ValueError("Watering interval must be between 1 and 365 days.")

	last_watered = payload.get("last_watered", date.today().isoformat())
	try:
		date.fromisoformat(last_watered)
	except (TypeError, ValueError) as error:
		raise ValueError("Last watered must be a valid date.") from error

	return {
		"id": str(payload.get("id") or uuid4()),
		"name": name,
		"type": str(payload.get("type") or "Houseplant")[:40],
		"watering_interval": interval,
		"last_watered": last_watered,
	}


def load_plants():
	if not DATA_FILE.exists():
		return []

	try:
		with DATA_FILE.open(encoding="utf-8") as file:
			plants = json.load(file)
		if not isinstance(plants, list):
			return []
		return [validate_plant(plant) for plant in plants]
	except (json.JSONDecodeError, OSError):
		print("Could not read plants.json. Starting with an empty list.")
		return []
	except ValueError:
		print("plants.json contains invalid data. Starting with an empty list.")
		return []


def save_plants(plants):
	DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
	with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=DATA_FILE.parent, delete=False) as file:
		json.dump(plants, file, indent=2)
		file.write("\n")
		temporary_name = file.name
	os.chmod(temporary_name, 0o600)
	os.replace(temporary_name, DATA_FILE)


@app.after_request
def add_security_headers(response):
	response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' https://images.unsplash.com data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'"
	response.headers["X-Content-Type-Options"] = "nosniff"
	response.headers["X-Frame-Options"] = "DENY"
	response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
	return response


@app.get("/")
def index():
	return send_from_directory(WEB_DIR, "index.html")


@app.get("/api/plants")
def get_plants():
	return jsonify(load_plants())


@app.post("/api/plants")
def create_plant():
	try:
		plant = validate_plant(request.get_json(silent=True) or {})
	except ValueError as error:
		return jsonify({"error": str(error)}), 400

	plants = load_plants()
	plants.append(plant)
	save_plants(plants)
	return jsonify(plant), 201


@app.patch("/api/plants/<plant_id>/water")
def water_plant(plant_id):
	plants = load_plants()
	plant = next((item for item in plants if item["id"] == plant_id), None)
	if plant is None:
		return jsonify({"error": "Plant not found."}), 404
	plant["last_watered"] = date.today().isoformat()
	save_plants(plants)
	return jsonify(plant)


@app.delete("/api/plants/<plant_id>")
def delete_plant(plant_id):
	plants = load_plants()
	remaining = [plant for plant in plants if plant["id"] != plant_id]
	if len(remaining) == len(plants):
		return jsonify({"error": "Plant not found."}), 404
	save_plants(remaining)
	return "", 204


def days_since_watering(last_watered):
	watered_on = date.fromisoformat(last_watered)
	return (date.today() - watered_on).days


def plant_status(plant):
	days_since = days_since_watering(plant["last_watered"])
	days_until_due = plant["watering_interval"] - days_since

	if days_until_due > 0:
		return f"due in {days_until_due} day(s)"
	if days_until_due == 0:
		return "due today"
	return f"OVERDUE by {abs(days_until_due)} day(s)"


def show_plants(plants):
	if not plants:
		print("\nNo plants yet. Choose 1 to add your first plant.")
		return

	print("\nYour plants")
	print("-" * 68)
	for number, plant in enumerate(plants, start=1):
		days_since = days_since_watering(plant["last_watered"])
		print(
			f"{number}. {plant['name']} | last watered: {plant['last_watered']} | "
			f"dry for: {days_since} day(s) | {plant_status(plant)}"
		)
	print("-" * 68)


def add_plant(plants):
	name = input("Plant name: ").strip()
	if not name:
		print("A plant name is required.")
		return

	try:
		interval = int(input("Water every how many days? "))
		if interval < 1:
			raise ValueError
	except ValueError:
		print("Please enter a whole number greater than zero.")
		return

	plants.append(
		{
			"name": name,
			"watering_interval": interval,
			"last_watered": date.today().isoformat(),
		}
	)
	save_plants(plants)
	print(f"Added {name}. It is marked as watered today.")


def record_watering(plants):
	if not plants:
		print("Add a plant before recording watering.")
		return

	show_plants(plants)
	try:
		plant_number = int(input("Which plant number was watered? ")) - 1
		plant = plants[plant_number]
	except (ValueError, IndexError):
		print("Please choose a valid plant number.")
		return

	plant["last_watered"] = date.today().isoformat()
	save_plants(plants)
	print(f"Recorded watering for {plant['name']} today.")


def remove_plant(plants):
	if not plants:
		print("There are no plants to remove.")
		return

	show_plants(plants)
	try:
		plant_number = int(input("Which plant number should be removed? ")) - 1
		removed = plants.pop(plant_number)
	except (ValueError, IndexError):
		print("Please choose a valid plant number.")
		return

	save_plants(plants)
	print(f"Removed {removed['name']}.")


def main():
	plants = load_plants()
	print("Plant Watering Tracker")

	while True:
		print(
			"\n1. Add plant\n"
			"2. View watering status\n"
			"3. Record watering\n"
			"4. Remove plant\n"
			"5. Exit"
		)
		choice = input("Choose an option: ").strip()

		if choice == "1":
			add_plant(plants)
		elif choice == "2":
			show_plants(plants)
		elif choice == "3":
			record_watering(plants)
		elif choice == "4":
			remove_plant(plants)
		elif choice == "5":
			print("Goodbye!")
			break
		else:
			print("Please choose an option from 1 to 5.")


if __name__ == "__main__":
	if "--web" in os.sys.argv:
		app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "8000")), debug=False)
	else:
		main()
