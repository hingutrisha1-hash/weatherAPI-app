// Simple Weather app using OpenWeatherMap
// CONFIG: If you want a quick client-only demo, set USE_PROXY = false and put YOUR_API_KEY_CLIENT below.
// Recommended: run the small Node proxy (server.js) and set USE_PROXY = true to avoid exposing your API key to browsers.

const USE_PROXY = true; // set to false for client-side direct requests (not recommended for production)
const YOUR_API_KEY_CLIENT = 'REPLACE_WITH_YOUR_KEY_IF_NOT_USING_PROXY'; // only used if USE_PROXY === false

const DOM = {
  btnGetWeather: document.getElementById('btn-get-weather'),
  manualForm: document.getElementById('manual-form'),
  cityInput: document.getElementById('city-input'),
  hint: document.getElementById('hint'),
  result: document.getElementById('result'),
  locationName: document.getElementById('location-name'),
  weatherSummary: document.getElementById('weather-summary'),
  weatherDetails: document.getElementById('weather-details'),
  message: document.getElementById('message')
};

function showMessage(msg, type = 'info') {
  DOM.message.textContent = msg;
  DOM.message.className = `message ${type}`;
  DOM.message.classList.remove('hidden');
}

function hideMessage() {
  DOM.message.classList.add('hidden');
}

function showResult() {
  DOM.result.classList.remove('hidden');
}
function hideResult() {
  DOM.result.classList.add('hidden');
}

async function getLocationAndWeather() {
  hideResult();
  hideMessage();
  DOM.hint.textContent = 'Checking location permission...';

  try {
    const pos = await requestLocationWithPermissionCheck();
    if (pos) {
      return await fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
    } else {
      // permission was denied or not available — try fallback to IP
      DOM.hint.textContent = 'Falling back to IP-based location...';
      const ip = await fetchIPLocation();
      if (ip) {
        return await fetchWeatherByCoords(ip.latitude, ip.longitude, { source: 'ip' });
      } else {
        showMessage('Unable to determine location. Please enter a city or postal code above.', 'error');
        return null;
      }
    }
  } catch (err) {
    console.error(err);
    showMessage('Error while getting location: ' + (err.message || err), 'error');
    return null;
  }
}

async function requestLocationWithPermissionCheck() {
  if (!('geolocation' in navigator)) {
    showMessage('Geolocation is not supported by this browser.', 'error');
    return null;
  }

  // Try Permissions API if available
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state === 'denied') {
        // user has permanently blocked location for this site
        DOM.hint.innerHTML = 'Location permission is <strong>denied</strong>. You need to enable it in your browser settings.';
        return null;
      }
      // if 'prompt' or 'granted', try to get it
    } catch (e) {
      // ignore and try to request position
    }
  }

  return getCurrentPositionPromise({ enableHighAccuracy: true, timeout: 10000 });
}

function getCurrentPositionPromise(options = {}) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos),
      err => {
        // err.code: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
        console.warn('Geolocation error', err);
        if (err.code === 1) {
          DOM.hint.textContent = 'User denied Geolocation. You can allow location in your browser or enter a city below.';
        } else if (err.code === 3) {
          DOM.hint.textContent = 'Location request timed out.';
        } else {
          DOM.hint.textContent = 'Unable to retrieve device location.';
        }
        resolve(null); // return null to trigger fallback
      },
      options
    );
  });
}

async function fetchIPLocation() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) throw new Error('IP geolocation failed');
    const data = await res.json();
    return { latitude: data.latitude, longitude: data.longitude };
  } catch (e) {
    console.warn('IP fallback failed', e);
    return null;
  }
}

async function fetchWeatherByCoords(lat, lon, opts = {}) {
  try {
    const url = buildWeatherUrl({ lat, lon });
    DOM.hint.textContent = `Fetching weather (${opts.source || 'device'})...`;
    const res = await fetch(url);
    if (res.status === 401) {
      showMessage('Invalid API key (401). Check your API key and whether you are using a proxy. See console for more details.', 'error');
      console.error('Weather API returned 401. Response body:', await safeText(res));
      return null;
    }
    if (!res.ok) {
      const text = await safeText(res);
      showMessage(`Weather API error: ${res.status} ${res.statusText}`, 'error');
      console.error('Weather API error:', res.status, res.statusText, text);
      return null;
    }
    const json = await res.json();
    renderWeather(json, { source: opts.source || 'device' });
    return json;
  } catch (e) {
    console.error('fetchWeatherByCoords error', e);
    showMessage('Network or parsing error retrieving weather.', 'error');
    return null;
  }
}

async function fetchWeatherByCity(q) {
  try {
    const url = buildWeatherUrl({ q });
    DOM.hint.textContent = `Fetching weather for "${q}"...`;
    const res = await fetch(url);
    if (res.status === 401) {
      showMessage('Invalid API key (401). Check your API key and whether you are using a proxy. See console for details.', 'error');
      console.error('Weather API returned 401. Response body:', await safeText(res));
      return null;
    }
    if (!res.ok) {
      const text = await safeText(res);
      showMessage(`Weather API error: ${res.status} ${res.statusText}`, 'error');
      console.error('Weather API error:', res.status, res.statusText, text);
      return null;
    }
    const json = await res.json();
    renderWeather(json, { source: 'manual' });
    return json;
  } catch (e) {
    console.error('fetchWeatherByCity error', e);
    showMessage('Network or parsing error retrieving weather.', 'error');
    return null;
  }
}

function buildWeatherUrl({ lat, lon, q }) {
  if (USE_PROXY) {
    // our proxy endpoint that keeps the API key on the server
    if (lat && lon) return `/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
    if (q) return `/weather?q=${encodeURIComponent(q)}`;
    throw new Error('Missing parameters for buildWeatherUrl');
  } else {
    // Direct client call to OpenWeatherMap (unsecure: exposes API key to browser)
    const apiKey = YOUR_API_KEY_CLIENT;
    const base = 'https://api.openweathermap.org/data/2.5/weather';
    if (lat && lon) return `${base}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=metric&appid=${encodeURIComponent(apiKey)}`;
    if (q) return `${base}?q=${encodeURIComponent(q)}&units=metric&appid=${encodeURIComponent(apiKey)}`;
    throw new Error('Missing parameters for buildWeatherUrl');
  }
}

function safeText(res) {
  return res.text().catch(() => '[unavailable]');
}

function renderWeather(data, meta = {}) {
  hideMessage();
  showResult();
  const name = data.name || (data.coord ? `(${data.coord.lat.toFixed(2)}, ${data.coord.lon.toFixed(2)})` : 'Unknown');
  DOM.locationName.textContent = `${name} ${meta.source ? ` — ${meta.source}` : ''}`;
  const main = data.main || {};
  const weather = (data.weather && data.weather[0]) || {};
  DOM.weatherSummary.textContent = `${weather.main || 'Weather'} — ${Math.round(main.temp)}°C (${weather.description || ''})`;

  DOM.weatherDetails.innerHTML = `
    <li>Temperature: ${main.temp ?? 'N/A'} °C</li>
    <li>Feels like: ${main.feels_like ?? 'N/A'} °C</li>
    <li>Humidity: ${main.humidity ?? 'N/A'}%</li>
    <li>Pressure: ${main.pressure ?? 'N/A'} hPa</li>
    <li>Wind speed: ${data.wind?.speed ?? 'N/A'} m/s</li>
  `;
  DOM.hint.textContent = '';
}

// Wire up UI
DOM.btnGetWeather.addEventListener('click', async () => {
  DOM.hint.textContent = '';
  await getLocationAndWeather();
});

DOM.manualForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const q = DOM.cityInput.value.trim();
  if (!q) {
    showMessage('Please enter a city or postal code.', 'error');
    return;
  }
  hideResult();
  hideMessage();
  await fetchWeatherByCity(q);
});