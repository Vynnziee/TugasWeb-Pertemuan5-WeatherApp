// ===== Buletin Cuaca — Tugas Rutin 5 =====
// Data cuaca diambil dari OpenWeatherMap API.
//
// Key ditulis langsung di sini supaya situsnya bisa langsung dipakai siapa pun
// tanpa perlu masukin key sendiri. Karena ini file publik yang ikut di-push ke
// GitHub, key di bawah ini otomatis jadi terlihat oleh siapa saja yang buka
// repo atau situsnya — jangan pakai key yang juga dipakai untuk hal lain.
const API_KEY = "d24de08ee199f2f74907d18c61dc0baa";

const CURRENT_URL = "https://api.openweathermap.org/data/2.5/weather";
const FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast";
const HISTORY_KEY = "buletinCuaca.history";
const UNIT_STORAGE = "buletinCuaca.unit";

const el = {
  form: document.getElementById("searchForm"),
  cityInput: document.getElementById("cityInput"),
  unitToggle: document.getElementById("unitToggle"),
  historyRow: document.getElementById("historyRow"),
  statusBox: document.getElementById("statusBox"),
  resultCard: document.getElementById("resultCard"),
  cityName: document.getElementById("cityName"),
  cityMeta: document.getElementById("cityMeta"),
  weatherIcon: document.getElementById("weatherIcon"),
  temperature: document.getElementById("temperature"),
  description: document.getElementById("description"),
  feelsLike: document.getElementById("feelsLike"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  forecastRow: document.getElementById("forecastRow"),
  forecastCards: document.getElementById("forecastCards"),
};

// state ringkas yang dibawa antar-pencarian
const state = {
  unit: localStorage.getItem(UNIT_STORAGE) || "metric",
  lastCity: null,
};

// error khusus supaya pesan 404 bisa dibedakan dari gangguan jaringan
class CityNotFoundError extends Error {}

init();

function init() {
  el.unitToggle.textContent = state.unit === "metric" ? "°C" : "°F";
  renderHistory();

  el.form.addEventListener("submit", handleSearch);
  el.unitToggle.addEventListener("click", handleUnitToggle);
}

async function handleSearch(event) {
  event.preventDefault();
  const city = el.cityInput.value.trim();
  if (!city) return;

  await runSearch(city);
}

async function handleUnitToggle() {
  state.unit = state.unit === "metric" ? "imperial" : "metric";
  localStorage.setItem(UNIT_STORAGE, state.unit);
  el.unitToggle.textContent = state.unit === "metric" ? "°C" : "°F";

  if (state.lastCity) {
    await runSearch(state.lastCity, { silent: true });
  }
}

async function runSearch(city, { silent = false } = {}) {
  setLoading(true, silent);

  try {
    const weather = await fetchCurrentWeather(city);
    const forecast = await fetchForecast(city);

    renderWeather(weather);
    renderForecast(forecast);

    state.lastCity = weather.name;
    addToHistory(weather.name);
    hideStatus();
  } catch (error) {
    el.resultCard.hidden = true;
    el.forecastRow.hidden = true;

    if (error instanceof CityNotFoundError) {
      showStatus(`Kota "${city}" tidak ditemukan. Coba periksa ejaannya.`, "error");
    } else if (error instanceof TypeError) {
      showStatus("Tidak bisa terhubung ke server. Periksa koneksi internet kamu.", "error");
    } else {
      showStatus(error.message || "Terjadi kesalahan saat mengambil data cuaca.", "error");
    }
  } finally {
    setLoading(false, silent);
  }
}

async function fetchCurrentWeather(city) {
  const url = `${CURRENT_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${state.unit}&lang=id`;
  const response = await fetch(url);

  if (response.status === 404) throw new CityNotFoundError();
  if (!response.ok) throw new Error(`Server cuaca membalas dengan status ${response.status}.`);

  return response.json();
}

async function fetchForecast(city) {
  const url = `${FORECAST_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${state.unit}&lang=id`;
  const response = await fetch(url);

  if (response.status === 404) throw new CityNotFoundError();
  if (!response.ok) throw new Error(`Server cuaca membalas dengan status ${response.status}.`);

  return response.json();
}

function renderWeather(data) {
  const unitLabel = state.unit === "metric" ? "°C" : "°F";
  const windUnit = state.unit === "metric" ? "m/s" : "mph";

  el.cityName.textContent = `${data.name}, ${data.sys.country}`;
  el.cityMeta.textContent = new Date().toLocaleString("id-ID", {
    weekday: "long", hour: "2-digit", minute: "2-digit",
  });
  el.weatherIcon.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
  el.weatherIcon.alt = data.weather[0].description;

  el.temperature.textContent = `${Math.round(data.main.temp)}${unitLabel}`;
  el.description.textContent = data.weather[0].description;

  el.feelsLike.textContent = `${Math.round(data.main.feels_like)}${unitLabel}`;
  el.humidity.textContent = `${data.main.humidity}%`;
  el.wind.textContent = `${data.wind.speed} ${windUnit}`;

  el.resultCard.hidden = false;
}

function renderForecast(data) {
  // Kelompokkan entri 3-jam-an dari API forecast menjadi satu titik data per hari,
  // lalu ambil entri jam 12 siang tiap hari sebagai wakil suhu hari itu.
  const grouped = data.list.reduce((acc, entry) => {
    const [date] = entry.dt_txt.split(" ");
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  const dailyEntries = Object.values(grouped)
    .map((entries) => entries.find((e) => e.dt_txt.includes("12:00:00")) || entries[0])
    .slice(0, 5);

  el.forecastCards.innerHTML = dailyEntries
    .map((entry) => {
      const day = new Date(entry.dt_txt).toLocaleDateString("id-ID", { weekday: "short" });
      const icon = entry.weather[0].icon;
      const temp = Math.round(entry.main.temp);
      const unitLabel = state.unit === "metric" ? "°" : "°F";
      return `
        <div class="forecast__card">
          <p class="day">${day}</p>
          <img src="https://openweathermap.org/img/wn/${icon}.png" alt="${entry.weather[0].description}">
          <p class="temp">${temp}${unitLabel}</p>
        </div>`;
    })
    .join("");

  el.forecastRow.hidden = dailyEntries.length === 0;
}

function addToHistory(cityLabel) {
  const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  const withoutDuplicate = stored.filter(
    (item) => item.toLowerCase() !== cityLabel.toLowerCase()
  );
  const updated = [cityLabel, ...withoutDuplicate].slice(0, 8);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  renderHistory();
}

function renderHistory() {
  const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  el.historyRow.hidden = stored.length === 0;
  el.historyRow.innerHTML = stored
    .map((city) => `<button type="button" data-city="${city}">${city}</button>`)
    .join("");

  el.historyRow.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.cityInput.value = btn.dataset.city;
      el.form.requestSubmit();
    });
  });
}

function setLoading(isLoading, silent) {
  const button = el.form.querySelector("button");
  button.disabled = isLoading;
  if (isLoading && !silent) showStatus("Mengambil data cuaca...", "loading");
}

function showStatus(message, type) {
  el.statusBox.hidden = false;
  el.statusBox.textContent = message;
  el.statusBox.className = `status is-${type}`;
}

function hideStatus() {
  el.statusBox.hidden = true;
}
