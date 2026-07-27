const config = window.APP_CONFIG || {};
const setupNotice = document.getElementById("setupNotice");
const feedbackEl = document.getElementById("feedback");
const eventsContainer = document.getElementById("eventsContainer");
const tableBody = document.getElementById("dashboardTableBody");
const statsCards = document.getElementById("statsCards");
const createEventForm = document.getElementById("createEventForm");
const createEventBtn = document.getElementById("createEventBtn");
const refreshBtn = document.getElementById("refreshBtn");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminUnlockBtn = document.getElementById("adminUnlockBtn");
const adminCreatePanel = document.getElementById("adminCreatePanel");
const adminAccessStatus = document.getElementById("adminAccessStatus");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

let supabaseClient = null;
let adminUnlocked = false;
const recentlySavedEvents = new Map();

function setFeedback(message, isError = false) {
  feedbackEl.textContent = message;
  feedbackEl.style.color = isError ? "var(--danger)" : "var(--accent-2)";
}

function formatDate(dateString) {
  return new Date(dateString + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isPastEvent(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(dateString + "T00:00:00");
  return eventDate < today;
}

function formatTime12(timeValue) {
  if (!timeValue) {
    return "TBD";
  }

  const [hours, minutes = "00"] = String(timeValue).split(":");
  const timeDate = new Date();
  timeDate.setHours(Number(hours), Number(minutes), 0, 0);
  return timeDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeInput(timeValue) {
  if (!timeValue) {
    return "";
  }
  return String(timeValue).slice(0, 5);
}

function markEventAsRecentlySaved(eventId) {
  recentlySavedEvents.set(eventId, Date.now());
}

function isEventRecentlySaved(eventId) {
  const savedAt = recentlySavedEvents.get(eventId);
  if (!savedAt) {
    return false;
  }

  const withinWindow = Date.now() - savedAt < 5000;
  if (!withinWindow) {
    recentlySavedEvents.delete(eventId);
  }
  return withinWindow;
}

function badgeClass(status) {
  if (status === "done") {
    return "done";
  }
  if (status === "court_booked") {
    return "booked";
  }
  if (status === "cancelled") {
    return "cancelled";
  }
  return "planned";
}

function statusLabel(status) {
  if (status === "done") {
    return "Done";
  }
  if (status === "court_booked") {
    return "Court Booked";
  }
  if (status === "cancelled") {
    return "Cancelled";
  }
  return "Open for Votes";
}

function isAdminUnlocked() {
  return adminUnlocked;
}

function setAdminUnlocked(unlocked) {
  adminUnlocked = unlocked;
  updateAdminUi();
}

function syncAdminUrl(unlocked) {
  const url = new URL(window.location.href);
  if (unlocked) {
    url.searchParams.set("admin", "1");
  } else {
    url.searchParams.delete("admin");
    url.searchParams.delete("admin_code");
  }
  window.history.replaceState({}, "", url.toString());
}

function updateAdminUi() {
  const unlocked = isAdminUnlocked();
  adminCreatePanel.classList.toggle("hidden", !unlocked);
  adminLoginForm.classList.toggle("hidden", unlocked);
  adminLogoutBtn.classList.toggle("hidden", !unlocked);
  adminAccessStatus.textContent = unlocked
    ? "Admin view is unlocked. You can create events now."
    : "Enter the admin code to show the create-event form.";
}

function attemptAdminUnlock() {
  const adminCodeInput = adminLoginForm.querySelector('input[name="admin_code"]');
  const adminCode = String(adminCodeInput?.value || "").trim();

  if (!config.adminAccessCode) {
    setFeedback("Admin code is not set in config.js.", true);
    return;
  }

  if (adminCode !== config.adminAccessCode) {
    setFeedback("Wrong admin code.", true);
    return;
  }

  setAdminUnlocked(true);
  syncAdminUrl(true);
  if (adminCodeInput) {
    adminCodeInput.value = "";
  }
  setFeedback("Admin view unlocked.");
  renderAll();
}

async function createEvent(payload) {
  const { error } = await supabaseClient.from("events").insert(payload);
  if (error) {
    throw error;
  }
}

async function addVote(eventId, playerName, isAvailable) {
  const votePayload = {
    event_id: eventId,
    player_name: playerName.trim(),
    is_available: isAvailable,
  };

  const { error } = await supabaseClient.from("event_votes").upsert(votePayload, {
    onConflict: "event_id,player_name",
  });

  if (error) {
    throw error;
  }
}

async function deleteVote(eventId, playerName) {
  const { error } = await supabaseClient
    .from("event_votes")
    .delete()
    .eq("event_id", eventId)
    .eq("player_name", playerName);

  if (error) {
    throw error;
  }
}

async function updateEventStatus(eventId, status) {
  const { error } = await supabaseClient.from("events").update({ status }).eq("id", eventId);
  if (error) {
    throw error;
  }
}

async function updateEventDetails(eventId, payload) {
  const { error } = await supabaseClient.from("events").update(payload).eq("id", eventId);
  if (error) {
    throw error;
  }
}

async function deleteEvent(eventId) {
  const { error } = await supabaseClient.from("events").delete().eq("id", eventId);
  if (error) {
    throw error;
  }
}

async function fetchEvents() {
  const { data, error } = await supabaseClient
    .from("events")
    .select("id,title,event_date,start_time,end_time,number_of_courts,min_players,status,created_at,event_votes(player_name,is_available)")
    .order("event_date", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

function getAvailabilityCounts(votes = []) {
  const available = votes.filter((v) => v.is_available).length;
  const unavailable = votes.length - available;
  return { available, unavailable };
}

function renderStats(events) {
  if (!statsCards) {
    return;
  }

  const total = events.length;
  const booked = events.filter((e) => e.status === "court_booked").length;
  const open = events.filter((e) => e.status === "planned").length;
  const players = new Set();

  events.forEach((e) => {
    (e.event_votes || []).forEach((v) => {
      if (v.is_available) {
        players.add(v.player_name.toLowerCase());
      }
    });
  });

  statsCards.innerHTML = `
    <div class="stat-card"><p>Total Events</p><h3>${total}</h3></div>
    <div class="stat-card"><p>Open for Votes</p><h3>${open}</h3></div>
    <div class="stat-card"><p>Court Booked</p><h3>${booked}</h3></div>
    <div class="stat-card"><p>Unique Available Players</p><h3>${players.size}</h3></div>
  `;
}

function renderDashboardTable(events) {
  tableBody.innerHTML = "";

  if (!events.length) {
    tableBody.innerHTML = `<tr><td colspan="8" class="small">No events yet.</td></tr>`;
    return;
  }

  const rows = events
    .map((event) => {
      const votes = event.event_votes || [];
      const { available } = getAvailabilityCounts(votes);
      const names = votes
        .filter((v) => v.is_available)
        .map((v) => v.player_name)
        .sort((a, b) => a.localeCompare(b));

      return `
      <tr class="${isPastEvent(event.event_date) ? 'past-event' : ''}">
        <td>${formatDate(event.event_date)}</td>
        <td>${formatTime12(event.start_time)}</td>
        <td>${formatTime12(event.end_time)}</td>
        <td>${event.title}</td>
        <td>${event.number_of_courts} court${Number(event.number_of_courts) === 1 ? "" : "s"}</td>
        <td>${statusLabel(event.status)}</td>
        <td>${available} / ${event.min_players}</td>
        <td>${names.length ? names.join(", ") : "-"}</td>
      </tr>`;
    })
    .join("");

  tableBody.innerHTML = rows;
}

function buildEventCard(event) {
  const votes = event.event_votes || [];
  const eventIsPast = isPastEvent(event.event_date);

  if (eventIsPast) {
    const card = document.createElement("article");
    card.className = "event-card past-event condensed-past";
    card.innerHTML = `
      <div class="past-main">
        <strong class="past-title">${event.title}</strong>
        <span class="badge done">Done</span>
        <span class="small past-date">${formatDate(event.event_date)}</span>
      </div>
      <button type="button" class="ghost delete-event-btn condensed-delete-btn" data-event-id="${event.id}">Delete Event</button>
    `;
    return card;
  }

  const { available, unavailable } = getAvailabilityCounts(votes);
  const enoughPlayers = available >= event.min_players;
  const availableNames = votes
    .filter((v) => v.is_available)
    .map((v) => v.player_name)
    .sort((a, b) => a.localeCompare(b));
  const unavailableNames = votes
    .filter((v) => !v.is_available)
    .map((v) => v.player_name)
    .sort((a, b) => a.localeCompare(b));

  const previewNames = (names, max = 3) => {
    if (!names.length) {
      return "-";
    }
    const visible = names.slice(0, max);
    const remaining = names.length - visible.length;
    return remaining > 0 ? `${visible.join(", ")} +${remaining}` : visible.join(", ");
  };

  const yesList = votes
    .filter((v) => v.is_available)
    .map((v) => `<li>${v.player_name}${isAdminUnlocked() ? ` <button type="button" class="ghost delete-player-btn" data-event-id="${event.id}" data-player-name="${v.player_name}">Delete</button>` : ""}</li>`)
    .join("");
  const noList = votes
    .filter((v) => !v.is_available)
    .map((v) => `<li>${v.player_name}${isAdminUnlocked() ? ` <button type="button" class="ghost delete-player-btn" data-event-id="${event.id}" data-player-name="${v.player_name}">Delete</button>` : ""}</li>`)
    .join("");

  const card = document.createElement("article");
  card.className = `event-card ${eventIsPast ? "past-event" : ""}`;
  const eventWasRecentlySaved = isEventRecentlySaved(event.id);
  card.innerHTML = `
    <div class="event-top">
      <div>
        <h3>${event.title}</h3>
        <p class="event-date">${formatDate(event.event_date)}</p>
        <p class="small">${formatTime12(event.start_time)} - ${formatTime12(event.end_time)} · ${event.number_of_courts} court${Number(event.number_of_courts) === 1 ? "" : "s"}</p>
      </div>
      <span class="badge ${badgeClass(event.status)}">${statusLabel(event.status)}</span>
    </div>

    <div class="meta">
      <span>Available: <strong>${available}</strong></span>
      <span>Not Available: <strong>${unavailable}</strong></span>
      <span>Minimum Needed: <strong>${event.min_players}</strong></span>
      <span>${enoughPlayers ? "Enough players to book" : "Waiting for more players"}</span>
    </div>

    <div class="players-compact">
      <p class="small players-preview"><strong>Available:</strong> ${previewNames(availableNames)}</p>
      <p class="small players-preview"><strong>Not Available:</strong> ${previewNames(unavailableNames)}</p>
      <details class="players-details">
        <summary class="small">View full player list</summary>
        <div class="split compact-split">
          <div>
            <p class="small">Available Players</p>
            <ul class="vote-list">${yesList || "<li>-</li>"}</ul>
          </div>
          <div>
            <p class="small">Not Available</p>
            <ul class="vote-list">${noList || "<li>-</li>"}</ul>
          </div>
        </div>
      </details>
    </div>

    <form class="form-stack vote-form" data-event-id="${event.id}">
      <div class="vote-inline-fields">
        <input class="vote-name-input" name="player_name" maxlength="24" required placeholder="Your name" aria-label="Your name" />
        <label class="vote-join-field">
          <input type="checkbox" name="is_available" checked />
          I will join
        </label>
        <button type="submit" class="vote-submit-btn">submit</button>
      </div>
    </form>

    <div class="section-head booking-head">
      <label class="small">${isAdminUnlocked() ? "Update Booking Status" : "Booking Status (admin only)"}</label>
      <select class="status-select" data-event-id="${event.id}" ${isAdminUnlocked() ? "" : 'disabled aria-disabled="true"'}>
        <option value="planned" ${event.status === "planned" ? "selected" : ""}>Open for Votes</option>
        <option value="court_booked" ${event.status === "court_booked" ? "selected" : ""}>Court Booked</option>
        <option value="cancelled" ${event.status === "cancelled" ? "selected" : ""}>Cancelled</option>
      </select>
    </div>

    ${isAdminUnlocked() ? `
      <form class="form-stack edit-event-form" data-event-id="${event.id}">
        <p class="small">Admin Edit Event</p>
        <div class="edit-grid">
          <label>
            Title
            <input name="title" value="${event.title || ""}" maxlength="80" required />
          </label>
          <label>
            Date
            <input type="date" name="event_date" value="${event.event_date || ""}" required />
          </label>
          <label>
            Start Time
            <input type="time" name="start_time" value="${formatTimeInput(event.start_time)}" required />
          </label>
          <label>
            End Time
            <input type="time" name="end_time" value="${formatTimeInput(event.end_time)}" required />
          </label>
          <label>
            Number of Courts
            <input type="number" name="number_of_courts" min="1" step="1" value="${Number(event.number_of_courts) || 1}" required />
          </label>
        </div>
        <div class="edit-actions">
          <button type="submit" class="ghost save-event-btn ${eventWasRecentlySaved ? "is-saved" : ""}">${eventWasRecentlySaved ? "Saved" : "Save Event Changes"}</button>
        </div>
      </form>

      <div class="section-head">
        <span class="small">Admin Action</span>
        <button type="button" class="ghost delete-event-btn" data-event-id="${event.id}">Delete Event</button>
      </div>
    ` : ""}
  `;

  return card;
}

async function handleDeletePlayer(ev) {
  const deleteButton = ev.target.closest(".delete-player-btn");
  if (!deleteButton) {
    return;
  }

  if (!isAdminUnlocked()) {
    setFeedback("Admin access required to delete players.", true);
    return;
  }

  const eventId = deleteButton.dataset.eventId;
  const playerName = deleteButton.dataset.playerName;
  if (!eventId || !playerName) {
    return;
  }

  const confirmed = window.confirm(`Delete player ${playerName}?`);
  if (!confirmed) {
    return;
  }

  try {
    await deleteVote(eventId, playerName);
    setFeedback("Player deleted.");
    await renderAll();
  } catch (error) {
    setFeedback(`Could not delete player: ${error.message}`, true);
  }
}

async function renderAll() {
  try {
    const events = await fetchEvents();
    const sortedEvents = [
      ...events.filter((event) => !isPastEvent(event.event_date)),
      ...events.filter((event) => isPastEvent(event.event_date)),
    ];

    eventsContainer.innerHTML = "";

    if (!sortedEvents.length) {
      eventsContainer.innerHTML = `<p class="small">No events yet. Create your first event above.</p>`;
    }

    sortedEvents.forEach((event) => {
      eventsContainer.appendChild(buildEventCard(event));
    });

    renderStats(events);
    renderDashboardTable(events);
  } catch (error) {
    setFeedback(`Could not load events: ${error.message}`, true);
  }
}

async function submitCreateEvent() {
  const formData = new FormData(createEventForm);

  const payload = {
    title: String(formData.get("title") || "").trim(),
    event_date: formData.get("event_date"),
    start_time: String(formData.get("start_time") || "").trim(),
    end_time: String(formData.get("end_time") || "").trim(),
    number_of_courts: Number(formData.get("number_of_courts") || 0),
    // Backward compatibility for existing DBs that still enforce venue NOT NULL.
    venue: String(formData.get("number_of_courts") || "").trim(),
    min_players: Number(formData.get("min_players") || 4),
    status: "planned",
  };

  if (!payload.title || !payload.event_date || !payload.start_time || !payload.end_time || Number.isNaN(payload.number_of_courts) || payload.number_of_courts < 1 || Number.isNaN(payload.min_players)) {
    setFeedback("Please fill all event fields correctly.", true);
    return;
  }

  if (payload.end_time <= payload.start_time) {
    setFeedback("End time must be after start time.", true);
    return;
  }

  try {
    await createEvent(payload);
    createEventForm.reset();
    setFeedback("Event created.");
    await renderAll();
  } catch (error) {
    setFeedback(`Could not create event: ${error.message}`, true);
  }
}

async function handleCreateEventSubmit(ev) {
  if (ev) {
    ev.preventDefault();
  }
  await submitCreateEvent();
}

function handleAdminLogout() {
  setAdminUnlocked(false);
  syncAdminUrl(false);
  setFeedback("Admin view locked.");
  renderAll();
}

async function handleDeleteEvent(ev) {
  const deleteButton = ev.target.closest(".delete-event-btn");
  if (!deleteButton) {
    return;
  }

  const eventId = deleteButton.dataset.eventId;
  if (!eventId) {
    return;
  }

  const confirmed = window.confirm("Delete this event and all votes for it?");
  if (!confirmed) {
    return;
  }

  try {
    await deleteEvent(eventId);
    setFeedback("Event deleted.");
    await renderAll();
  } catch (error) {
    setFeedback(`Could not delete event: ${error.message}`, true);
  }
}

async function handleVoteSubmit(ev) {
  const form = ev.target.closest(".vote-form");
  if (!form) {
    return;
  }

  ev.preventDefault();

  const eventId = form.dataset.eventId;
  const formData = new FormData(form);
  const playerName = String(formData.get("player_name") || "").trim();
  const isAvailable = formData.get("is_available") === "on";

  if (!eventId || !playerName) {
    setFeedback("Player name is required.", true);
    return;
  }

  try {
    await addVote(eventId, playerName, isAvailable);
    form.reset();
    setFeedback("Vote saved.");
    await renderAll();
  } catch (error) {
    setFeedback(`Could not save vote: ${error.message}`, true);
  }
}

async function handleEditEventSubmit(ev) {
  const form = ev.target.closest(".edit-event-form");
  if (!form) {
    return;
  }

  ev.preventDefault();

  if (!isAdminUnlocked()) {
    setFeedback("Admin access required to edit events.", true);
    return;
  }

  const eventId = form.dataset.eventId;
  const submitBtn = form.querySelector(".save-event-btn");
  const formData = new FormData(form);
  const payload = {
    title: String(formData.get("title") || "").trim(),
    event_date: String(formData.get("event_date") || "").trim(),
    start_time: String(formData.get("start_time") || "").trim(),
    end_time: String(formData.get("end_time") || "").trim(),
    number_of_courts: Number(formData.get("number_of_courts") || 0),
    // Backward compatibility for DBs that still enforce venue NOT NULL.
    venue: String(formData.get("number_of_courts") || "").trim(),
  };

  if (!eventId || !payload.title || !payload.event_date || !payload.start_time || !payload.end_time || Number.isNaN(payload.number_of_courts) || payload.number_of_courts < 1) {
    setFeedback("Please fill all edit fields correctly.", true);
    return;
  }

  if (payload.end_time <= payload.start_time) {
    setFeedback("End time must be after start time.", true);
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving...";
    }

    await updateEventDetails(eventId, payload);
    markEventAsRecentlySaved(eventId);
    setFeedback("Event updated.");
    await renderAll();
  } catch (error) {
    setFeedback(`Could not update event: ${error.message}`, true);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }
}

async function handleStatusChange(ev) {
  const select = ev.target.closest(".status-select");
  if (!select) {
    return;
  }

  if (!isAdminUnlocked()) {
    setFeedback("Admin access required to update booking status.", true);
    return;
  }

  const eventId = select.dataset.eventId;
  const status = select.value;

  try {
    await updateEventStatus(eventId, status);
    setFeedback("Status updated.");
    await renderAll();
  } catch (error) {
    setFeedback(`Could not update status: ${error.message}`, true);
  }
}

function hasConfig() {
  return !!config.supabaseUrl && !!config.supabaseAnonKey;
}

function getAdminCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("admin_code") || "").trim();
}

function getAdminModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("admin") === "1";
}

async function init() {
  if (!hasConfig()) {
    setupNotice.classList.remove("hidden");
    setFeedback("App config missing. Add Supabase credentials in config.js.", true);
    return;
  }

  adminUnlocked = false;
  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

  const adminCodeFromUrl = getAdminCodeFromUrl();
  if ((config.adminAccessCode && adminCodeFromUrl === config.adminAccessCode) || getAdminModeFromUrl()) {
    adminUnlocked = true;
  }

  createEventForm.addEventListener("submit", handleCreateEventSubmit);
  createEventBtn.addEventListener("click", submitCreateEvent);
  adminUnlockBtn.addEventListener("click", attemptAdminUnlock);
  adminLogoutBtn.addEventListener("click", handleAdminLogout);
  eventsContainer.addEventListener("submit", handleVoteSubmit);
  eventsContainer.addEventListener("submit", handleEditEventSubmit);
  eventsContainer.addEventListener("change", handleStatusChange);
  eventsContainer.addEventListener("click", handleDeleteEvent);
  eventsContainer.addEventListener("click", handleDeletePlayer);
  refreshBtn.addEventListener("click", () => {
    renderAll();
  });

  updateAdminUi();
  syncAdminUrl(adminUnlocked);
  await renderAll();
}

init();
