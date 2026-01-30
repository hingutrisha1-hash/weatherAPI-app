// Weather app script
// Replace the placeholder API key with your own for dev/testing.
// For production, keep the API key server-side or use a proxy to avoid exposing it in client code.
const API_KEY = "YOUR_OPENWEATHERMAP_API_KEY"; // <-- REPLACE THIS
const WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather";

const elems = {
  form: document.getElementById("searchForm"),
  cityInput: document.getElementById("cityInput"),
  geoBtn: document.getElementById("geoBtn"),
  status: document.getElementById("status"),
  weatherCard: document.getElementById("weatherCard"),
  weatherIcon: document.getElementById("weatherIcon"),
  location: document.getElementById("location"),
  description: document.getElementById("description"),
  temp: document.getElementById("temp"),
  feels: document.getElementById("feels"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  pressure: document.getElementById("pressure"),
};

// Utilities
function setStatus(msg, isError = false) {
  elems.status.textContent = msg || "";
  elems.status.style.color = isError ? "#ffb4b4" : "";
}

function showCard(show = true) {
  elems.weatherCard.classList.toggle("hidden", !show);
  elems.weatherCard.setAttribute("aria-hidden", !show);
}

function getSelectedUnits() {
  const selected = document.querySelector('input[name="units"]:checked');
  return selected ? selected.value : "metric";
}

function formatTemperature(t, units) {
  const unitChar = units === "metric" ? "°C" : "°F";
  return `${Math.round(t)}${unitChar}`;
}

function buildIconUrl(iconCode) {
  // OpenWeatherMap icon endpoint (compact)
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

// Main fetch function
async function fetchWeatherByQuery(query) {
  const units = getSelectedUnits();
  const url = `${WEATHER_URL}?q=${encodeURIComponent(query)}&units=${units}&appid=${API_KEY}`;
  return fetchWeather(url);
}

async function fetchWeatherByCoords(lat, lon) {
  const units = getSelectedUnits();
  const url = `${WEATHER_URL}?lat=${lat}&lon=${lon}&units=${units}&appid=${API_KEY}`;
  return fetchWeather(url);
}

async function fetchWeather(url) {
  try {
    setStatus("Loading...");
    showCard(false);
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 401) throw new Error("Invalid API key (401). Check your API key.");
      if (res.status === 404) throw new Error("Location not found. Try a different city.");
      throw new Error(`Error fetching weather: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    setStatus("");
    renderWeather(data);
    return data;
  } catch (err) {
    setStatus(err.message, true);
    console.error(err);
    showCard(false);
    return null;
  }
}

// Render data into the card
function renderWeather(data) {
  if (!data) return;
  const units = getSelectedUnits();
  const weather = data.weather && data.weather[0];
  const main = data.main || {};
  const wind = data.wind || {};
  elems.weatherIcon.src = weather ? buildIconUrl(weather.icon) : "";
  elems.weatherIcon.alt = weather ? weather.description : "weather icon";
  elems.location.textContent = `${data.name}${data.sys && data.sys.country ? ", " + data.sys.country : ""}`;
  elems.description.textContent = weather ? weather.description : "";
  elems.temp.textContent = formatTemperature(main.temp, units);
  elems.feels.textContent = `Feels like ${formatTemperature(main.feels_like, units)}`;
  elems.humidity.textContent = main.humidity != null ? main.humidity : "-";
  elems.wind.textContent = wind.speed != null ? wind.speed : "-";
  elems.pressure.textContent = main.pressure != null ? main.pressure : "-";
  showCard(true);
}

// Event handlers
elems.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const city = elems.cityInput.value.trim();
  if (!city) {
    setStatus("Please enter a city name.", true);
    return;
  }
  await fetchWeatherByQuery(city);
});

elems.geoBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Geolocation not supported by this browser.", true);
    return;
  }
  setStatus("Looking up your location...");
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    await fetchWeatherByCoords(latitude, longitude);
  }, (err) => {
    setStatus("Unable to retrieve location: " + err.message, true);
  }, {
    timeout: 10000
  });
});

// Refresh when units change
document.querySelectorAll('input[name="units"]').forEach(radio => {
  radio.addEventListener("change", () => {
    // If a card is visible, re-run the last query or use the displayed location
    const visible = !elems.weatherCard.classList.contains("hidden");
    if (!visible) return;
    const currentLocation = elems.location.textContent.split(",")[0];
    if (currentLocation) fetchWeatherByQuery(currentLocation);
  });
});

// Optionally pre-fill with a default city
(function init() {
  // Example: default city for first view
  const defaultCity = "New York";
  elems.cityInput.value = "";
  // Leave blank to avoid auto lookup; uncomment to auto-load:
  // fetchWeatherByQuery(defaultCity);
})();