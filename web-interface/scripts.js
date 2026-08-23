const plantImages = [
	"https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=160&q=80&auto=format&fit=crop",
	"https://images.unsplash.com/photo-1593691509543-c55fb32e5cee?w=160&q=80&auto=format&fit=crop",
	"https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=160&q=80&auto=format&fit=crop",
	"https://images.unsplash.com/photo-1497250681960-ef046c08a56e?w=160&q=80&auto=format&fit=crop",
];

const today = new Date();
const isoToday = today.toISOString().slice(0, 10);
const defaultPlants = [
	{ name: "Fiddle leaf fig", type: "Ficus lyrata", watering_interval: 7, last_watered: isoToday, image: plantImages[0] },
	{ name: "Calathea orbifolia", type: "Prayer plant", watering_interval: 5, last_watered: dateOffset(-5), image: plantImages[1] },
	{ name: "String of pearls", type: "Succulent", watering_interval: 14, last_watered: dateOffset(-3), image: plantImages[2] },
	{ name: "Monstera deliciosa", type: "Swiss cheese plant", watering_interval: 8, last_watered: dateOffset(-10), image: plantImages[3] },
];

function dateOffset(days) {
	const value = new Date();
	value.setDate(value.getDate() + days);
	return value.toISOString().slice(0, 10);
}

let plants = [];
let searchTerm = "";
let statusFilter = "all";

const plantList = document.querySelector("#plant-list");
const emptyState = document.querySelector("#empty-state");
const modal = document.querySelector("#modal-backdrop");
const form = document.querySelector("#plant-form");
const lastWateredInput = form.elements.lastWatered;

function escapeHtml(value) {
	return String(value).replace(/[&<>'"]/g, (character) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"'": "&#39;",
		'"': "&quot;",
	}[character]));
}

async function requestJson(url, options = {}) {
	const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(body.error || "Could not update your garden.");
	}
	return response.status === 204 ? null : response.json();
}

function showError(error) {
	window.alert(error.message || "Could not update your garden.");
}

function daysSinceWatering(lastWatered) {
	const lastDate = new Date(`${lastWatered}T00:00:00`);
	return Math.max(0, Math.floor((today - lastDate) / 86400000));
}

function getStatus(plant) {
	const daysSince = daysSinceWatering(plant.last_watered);
	const difference = plant.watering_interval - daysSince;
	if (difference > 0) return { key: "on-track", text: `Due in ${difference} day${difference === 1 ? "" : "s"}` };
	if (difference === 0) return { key: "due", text: "Due today" };
	return { key: "due", text: `Overdue by ${Math.abs(difference)} day${Math.abs(difference) === 1 ? "" : "s"}` };
}

function formatDate(value) {
	return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function render() {
	const filteredPlants = plants.filter((plant) => {
		const matchesSearch = plant.name.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesStatus = statusFilter === "all" || getStatus(plant).key === statusFilter;
		return matchesSearch && matchesStatus;
	});

	document.querySelector("#garden-total").textContent = plants.length;
	document.querySelector("#needs-water").textContent = plants.filter((plant) => getStatus(plant).key === "due").length;
	document.querySelector("#growing-well").textContent = plants.filter((plant) => getStatus(plant).key === "on-track").length;
	document.querySelector("#plant-count").textContent = `${plants.length} plant${plants.length === 1 ? "" : "s"}`;
	plantList.innerHTML = filteredPlants.map((plant) => {
		const status = getStatus(plant);
		return `<article class="plant-row">
			<div class="plant-info"><img class="plant-thumb" src="${escapeHtml(plant.image || plantImages[0])}" alt="" /><div><div class="plant-name">${escapeHtml(plant.name)}</div><div class="plant-type">${escapeHtml(plant.type || "Houseplant")}</div></div></div>
			<div><span class="row-label">Last watered</span><span class="row-value">${formatDate(plant.last_watered)}</span></div>
			<div><span class="row-label">Watering rhythm</span><span class="row-value">Every ${plant.watering_interval} days</span></div>
			<div><span class="status-pill ${status.key === "due" ? "due" : ""}">${status.text}</span></div>
			<button class="water-button" type="button" data-water="${escapeHtml(plant.id)}">Watered</button>
			<button class="remove-button" type="button" aria-label="Remove ${escapeHtml(plant.name)}" data-remove="${escapeHtml(plant.id)}">×</button>
		</article>`;
	}).join("");
	emptyState.hidden = filteredPlants.length > 0;
	if (plants.length && !filteredPlants.length) emptyState.querySelector("h3").textContent = "No plants found";
	renderUpcoming();
}

function renderUpcoming() {
	const upcoming = [...plants].sort((a, b) => getStatus(a).text.localeCompare(getStatus(b).text)).slice(0, 3);
	document.querySelector("#upcoming-list").innerHTML = upcoming.length ? upcoming.map((plant) => `<div class="upcoming-item"><span>${escapeHtml(plant.name)}</span><span>${escapeHtml(getStatus(plant).text)}</span></div>`).join("") : `<div class="upcoming-item"><span>Your calendar is clear</span><span>Nice work</span></div>`;
}

function openModal() { modal.hidden = false; lastWateredInput.value = isoToday; form.elements.name.focus(); }
function closeModal() { modal.hidden = true; form.reset(); }

document.querySelector("#open-add").addEventListener("click", openModal);
document.querySelector("#empty-add").addEventListener("click", openModal);
document.querySelector("#close-modal").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });

form.addEventListener("submit", (event) => {
	event.preventDefault();
	const data = new FormData(form);
	requestJson("/api/plants", { method: "POST", body: JSON.stringify({ name: data.get("name"), watering_interval: Number(data.get("interval")), last_watered: data.get("lastWatered") }) })
		.then((plant) => { plants.push({ ...plant, image: plantImages[plants.length % plantImages.length] }); render(); closeModal(); })
		.catch(showError);
});

plantList.addEventListener("click", (event) => {
	const waterName = event.target.dataset.water;
	const removeName = event.target.dataset.remove;
	if (waterName) requestJson(`/api/plants/${encodeURIComponent(waterName)}/water`, { method: "PATCH" }).then((updated) => { plants = plants.map((plant) => plant.id === updated.id ? { ...plant, ...updated } : plant); render(); }).catch(showError);
	if (removeName) {
		const plant = plants.find((item) => item.id === removeName);
		if (plant && window.confirm(`Remove ${plant.name} from your garden?`)) requestJson(`/api/plants/${encodeURIComponent(removeName)}`, { method: "DELETE" }).then(() => { plants = plants.filter((item) => item.id !== removeName); render(); }).catch(showError);
	}
});

document.querySelector("#plant-search").addEventListener("input", (event) => { searchTerm = event.target.value; render(); });
document.querySelector("#status-filter").addEventListener("change", (event) => { statusFilter = event.target.value; render(); });
requestJson("/api/plants", { headers: {} }).then((loadedPlants) => {
	plants = loadedPlants.map((plant, index) => ({ ...plant, image: plantImages[index % plantImages.length] }));
	render();
}).catch(() => {
	plants = defaultPlants.map((plant, index) => ({ ...plant, id: `demo-${index}`, image: plantImages[index] }));
	render();
	showError(new Error("The server could not be reached. Start the app and reload this page."));
});
