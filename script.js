(() => {
  "use strict";

  const STORAGE_KEY = "emberOakReservations_v1";
  const STAFF_SESSION_KEY = "emberOakStaffAuthorized";
  const STAFF_PASSWORD = "staff123";
  const DINING_MINUTES = 90;
  const TABLES = [
    { id: "T1", capacity: 2 }, { id: "T2", capacity: 2 }, { id: "T3", capacity: 2 }, { id: "T4", capacity: 2 },
    { id: "T5", capacity: 4 }, { id: "T6", capacity: 4 }, { id: "T7", capacity: 4 }, { id: "T8", capacity: 4 },
    { id: "T9", capacity: 6 }, { id: "T10", capacity: 6 }, { id: "T11", capacity: 6 },
    { id: "T12", capacity: 8 }
  ];
  const TIMES = Array.from({ length: 21 }, (_, index) => {
    const minutes = 12 * 60 + index * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  });
  const IMAGES = [
    { url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1300&q=85", label: "A warmly lit restaurant dining room" },
    { url: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1300&q=85", label: "A beautifully plated seasonal dinner" },
    { url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1300&q=85", label: "Friends gathered around a dinner table" }
  ];

  const $ = (selector) => document.querySelector(selector);
  const els = {
    date: $("#booking-date"), party: $("#party-size"), slots: $("#slot-grid"), slotMessage: $("#slot-message"),
    form: $("#guest-form"), guestPanel: $("#guest-panel"), submit: $("#submit-booking"),
    selectedSlot: $("#selected-slot"), guestMessage: $("#guest-message"), confirmation: $("#confirmation"),
    lookupForm: $("#lookup-form"), lookupCode: $("#lookup-code"), lookupMessage: $("#lookup-message"),
    lookupResult: $("#lookup-result"), waitlistStatus: $("#waitlist-status"), toast: $("#toast"),
    staff: $("#staff"), staffDate: $("#staff-date"), staffDashboard: $("#staff-dashboard"),
    availability: $("#availability-grid"), reservations: $("#reservation-list"), reservationCount: $("#reservation-count"),
    waitlist: $("#staff-waitlist"), waitlistCount: $("#waitlist-count"), notifications: $("#notification-list"),
    stats: $("#staff-stats"), carouselDots: $("#carousel-dots")
  };

  let state = loadState();
  let selectedTime = null;
  let toastTimer;
  let currentSlide = 0;

  function localDate(offset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function initialServiceDate() {
    const upcomingDates = [
      ...state.reservations.filter((item) => isActive(item) && item.date >= localDate()).map((item) => item.date),
      ...state.waitlist.filter((item) => item.date >= localDate()).map((item) => item.date)
    ].sort();
    return upcomingDates[0] || localDate();
  }

  function makeCode() {
    let code;
    do {
      code = `EO-${String(Math.floor(1000 + Math.random() * 9000))}`;
    } while (state.reservations.some((item) => item.code === code));
    return code;
  }

  function seededState() {
    const tomorrow = localDate(1);
    const yesterday = localDate(-1);
    return {
      reservations: [
        { code: "EO-4821", name: "Maya Chen", phone: "+1 555 014 2290", email: "maya@example.com", request: "Window seat, if possible", date: tomorrow, time: "19:30", party: 8, table: "T12", status: "confirmed", createdAt: Date.now() - 7200000 },
        { code: "EO-3167", name: "Leo Martin", phone: "+1 555 014 3811", email: "leo@example.com", request: "", date: tomorrow, time: "18:00", party: 2, table: "T1", status: "confirmed", createdAt: Date.now() - 4600000 },
        { code: "EO-7742", name: "Nina Patel", phone: "+1 555 014 5621", email: "nina@example.com", request: "", date: tomorrow, time: "19:30", party: 4, table: "T5", status: "confirmed", createdAt: Date.now() - 3300000 },
        { code: "EO-2904", name: "Sam Rivera", phone: "+1 555 014 0932", email: "sam@example.com", request: "", date: yesterday, time: "20:00", party: 2, table: "T2", status: "seated", createdAt: Date.now() - 90000000 }
      ],
      waitlist: [
        { id: "W-1001", name: "Aman Shah", phone: "+1 555 014 7330", email: "aman@example.com", date: tomorrow, time: "19:30", party: 8, createdAt: Date.now() - 2100000 },
        { id: "W-1002", name: "Olivia Brooks", phone: "+1 555 014 8402", email: "olivia@example.com", date: tomorrow, time: "19:30", party: 4, createdAt: Date.now() - 1200000 }
      ],
      notifications: [
        { id: "N-1", type: "Email", recipient: "Maya Chen", message: "Your table for 8 is confirmed for tomorrow at 7:30 PM. Code EO-4821.", createdAt: Date.now() - 7100000 },
        { id: "N-2", type: "SMS", recipient: "Aman Shah", message: "You're on the waitlist for a table for 8 at 7:30 PM. You're currently #1.", createdAt: Date.now() - 2000000 }
      ]
    };
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        const fresh = seededState();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        return fresh;
      }
      const parsed = JSON.parse(saved);
      if (!parsed || !Array.isArray(parsed.reservations) || !Array.isArray(parsed.waitlist) || !Array.isArray(parsed.notifications)) {
        throw new Error("Saved reservation data has an unexpected format.");
      }
      return parsed;
    } catch (error) {
      console.error("Could not load saved reservations:", error);
      const fresh = seededState();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      } catch (storageError) {
        console.error("Could not initialize reservation storage:", storageError);
      }
      return fresh;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Could not save reservation data:", error);
      showToast("Your changes could not be saved in this browser. Check your storage settings.");
    }
  }

  function bookingEnd(time) {
    const [hour, minute] = time.split(":").map(Number);
    const end = hour * 60 + minute + DINING_MINUTES;
    return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  }

  function overlaps(timeA, timeB) {
    const toMinutes = (time) => {
      const [hour, minute] = time.split(":").map(Number);
      return hour * 60 + minute;
    };
    return toMinutes(timeA) < toMinutes(bookingEnd(timeB)) && toMinutes(timeB) < toMinutes(bookingEnd(timeA));
  }

  function isActive(reservation) {
    return reservation.status === "confirmed" || reservation.status === "seated";
  }

  function tableIsFree(table, date, time, ignoreCode = null) {
    return !state.reservations.some((reservation) =>
      reservation.code !== ignoreCode &&
      isActive(reservation) &&
      reservation.date === date &&
      reservation.table === table.id &&
      overlaps(time, reservation.time)
    );
  }

  function suitableFreeTables(date, time, party) {
    return TABLES
      .filter((table) => table.capacity >= party && tableIsFree(table, date, time))
      .sort((a, b) => a.capacity - b.capacity || a.id.localeCompare(b.id));
  }

  function slotStatus(date, time, party) {
    const free = suitableFreeTables(date, time, party);
    if (free.length === 0) return { status: "full", count: 0 };
    return { status: free.length <= 2 ? "limited" : "available", count: free.length };
  }

  function isPast(date, time) {
    const [hour, minute] = time.split(":").map(Number);
    const candidate = new Date(`${date}T00:00:00`);
    candidate.setHours(hour, minute, 0, 0);
    return candidate.getTime() < Date.now();
  }

  function formatDate(dateString, options = { weekday: "long", month: "long", day: "numeric", year: "numeric" }) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined, options).format(new Date(year, month - 1, day));
  }

  function formatTime(time, includeMinutes = true) {
    const [hour, minute] = time.split(":").map(Number);
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: includeMinutes ? "2-digit" : undefined }).format(new Date(2000, 0, 1, hour, minute));
  }

  function renderSlots() {
    if (!els.date) return;
    const date = els.date.value;
    const party = Number(els.party.value);
    els.slots.replaceChildren();
    selectedTime = null;
    els.selectedSlot.textContent = "Select a time to get started";
    els.selectedSlot.classList.remove("is-selected");
    els.submit.disabled = true;
    els.submit.textContent = "Choose a time first";
    els.guestMessage.textContent = "";
    els.guestPanel.classList.remove("has-confirmation");
    if (!date) {
      els.slotMessage.textContent = "Choose a date to see available times.";
      return;
    }
    if (date < localDate()) {
      els.slotMessage.textContent = "Please choose today or a future date.";
      return;
    }
    els.slotMessage.textContent = "";
    TIMES.forEach((time) => {
      const result = slotStatus(date, time, party);
      const past = isPast(date, time);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `time-slot status-${result.status}`;
      button.dataset.time = time;
      button.disabled = past;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `${formatTime(time, true)}, ${past ? "past" : result.status === "full" ? "full, join waitlist" : result.status}`);
      button.innerHTML = `<span class="slot-time">${formatTime(time, true)}</span><span class="slot-status">${past ? "Past" : result.status === "full" ? "Full · waitlist" : result.status === "limited" ? "Limited" : "Available"}</span>`;
      button.addEventListener("click", () => selectTime(time, result.status));
      els.slots.append(button);
    });
  }

  function selectTime(time, status) {
    selectedTime = time;
    [...els.slots.children].forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.time === time)));
    els.selectedSlot.textContent = `${formatDate(els.date.value, { month: "short", day: "numeric" })} · ${formatTime(time)} · ${els.party.value} ${Number(els.party.value) === 1 ? "guest" : "guests"}`;
    els.selectedSlot.classList.add("is-selected");
    els.submit.disabled = false;
    els.submit.textContent = status === "full" ? "Join the waitlist" : "Confirm reservation";
    els.guestMessage.textContent = "";
    els.confirmation.hidden = true;
  }

  function safeText(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function sendNotification(type, recipient, message) {
    state.notifications.unshift({ id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, recipient, message, createdAt: Date.now() });
    state.notifications = state.notifications.slice(0, 100);
    saveState();
    showToast(`${type} simulated · ${message}`);
    renderStaff();
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 4200);
  }

  function submitGuest(event) {
    event.preventDefault();
    els.guestMessage.textContent = "";
    if (!selectedTime || !els.date.value) {
      els.guestMessage.textContent = "Please choose an available time first.";
      return;
    }
    const formData = new FormData(els.form);
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const request = String(formData.get("request") || "").trim();
    if (name.length < 2) {
      els.guestMessage.textContent = "Please enter your name (at least 2 characters).";
      $("#guest-name").focus();
      return;
    }
    if (!/^[+()\d\s.-]{7,24}$/.test(phone) || phone.replace(/\D/g, "").length < 7) {
      els.guestMessage.textContent = "Please enter a valid phone number.";
      $("#guest-phone").focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      els.guestMessage.textContent = "Please enter a valid email address.";
      $("#guest-email").focus();
      return;
    }
    if (isPast(els.date.value, selectedTime)) {
      els.guestMessage.textContent = "That time has passed. Please choose another time.";
      renderSlots();
      return;
    }

    const party = Number(els.party.value);
    const freeTable = suitableFreeTables(els.date.value, selectedTime, party)[0];
    if (freeTable) {
      const reservation = {
        code: makeCode(), name, phone, email, request, date: els.date.value, time: selectedTime,
        party, table: freeTable.id, status: "confirmed", createdAt: Date.now()
      };
      state.reservations.push(reservation);
      saveState();
      showConfirmation(reservation);
      sendNotification("Email", name, `Your table for ${party} is confirmed for ${formatTime(selectedTime)}. Code ${reservation.code}.`);
    } else {
      const entry = {
        id: `W-${Date.now()}`, name, phone, email, date: els.date.value, time: selectedTime,
        party, createdAt: Date.now()
      };
      state.waitlist.push(entry);
      state.waitlist.sort((a, b) => a.createdAt - b.createdAt);
      saveState();
      const position = state.waitlist.filter((item) => item.date === entry.date && item.time === entry.time).length;
      showWaitlistConfirmation(entry, position);
      sendNotification("SMS", name, `You're on the waitlist for a table for ${party} at ${formatTime(selectedTime)}. You're currently #${position}.`);
    }
    els.form.reset();
    els.date.value = els.date.dataset.lastSelected || els.date.value;
    renderSlots();
    renderStaff();
  }

  function showConfirmation(reservation) {
    els.confirmation.hidden = false;
    els.confirmation.innerHTML = `
      <div class="confirmation-mark">✓</div>
      <p class="eyebrow">YOU'RE ALL SET</p>
      <h3>A table is waiting.</h3>
      <p>${safeText(formatDate(reservation.date))} at ${safeText(formatTime(reservation.time))} · ${reservation.party} ${reservation.party === 1 ? "guest" : "guests"}</p>
      <p class="confirmation-table">Table ${safeText(reservation.table)} · ${reservation.party}-guest party</p>
      <div class="code-chip">BOOKING CODE <strong>${safeText(reservation.code)}</strong></div>
      <button class="text-button confirmation-lookup" type="button">Manage this booking</button>`;
    els.confirmation.querySelector(".confirmation-lookup").addEventListener("click", () => {
      els.lookupCode.value = reservation.code;
      showLookupResult(reservation);
      $("#manage").scrollIntoView({ behavior: "smooth" });
    });
    els.confirmation.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function showWaitlistConfirmation(entry, position) {
    els.confirmation.hidden = false;
    els.confirmation.innerHTML = `
      <div class="confirmation-mark wait-mark">↗</div>
      <p class="eyebrow">WE'LL BE IN TOUCH</p>
      <h3>You're on the list.</h3>
      <p>${safeText(formatDate(entry.date))} at ${safeText(formatTime(entry.time))} · ${entry.party} ${entry.party === 1 ? "guest" : "guests"}</p>
      <div class="queue-position">#${position}<span>in the queue</span></div>
      <p class="confirmation-table">Estimated wait: about ${Math.max(15, position * 20)} minutes. We’ll text you if a table opens up.</p>
      <button class="button button-soft" id="leave-confirmation-waitlist" type="button">Leave waitlist</button>
      <br><button class="text-button confirmation-waitlist" type="button">View waitlist status</button>`;
    els.confirmation.querySelector(".confirmation-waitlist").addEventListener("click", () => {
      showWaitlistStatus(entry);
      $("#manage").scrollIntoView({ behavior: "smooth" });
    });
    $("#leave-confirmation-waitlist").addEventListener("click", () => leaveWaitlist(entry.id));
    els.confirmation.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function showLookupResult(reservation) {
    els.lookupMessage.textContent = "";
    els.lookupResult.innerHTML = `<div class="booking-result-row">
      <p><strong>${safeText(reservation.name)}</strong> · ${safeText(formatDate(reservation.date, { month: "short", day: "numeric" }))}, ${safeText(formatTime(reservation.time))} · ${reservation.party} guests · Table ${safeText(reservation.table)}<br><span class="optional">${safeText(reservation.code)} · ${safeText(reservation.status)}</span></p>
      ${reservation.status === "confirmed" ? `<button class="button button-danger" type="button" id="cancel-guest">Cancel booking</button>` : ""}
    </div>`;
    const cancelButton = $("#cancel-guest");
    if (cancelButton) cancelButton.addEventListener("click", () => cancelReservation(reservation.code, "guest"));
  }

  function lookupBooking(event) {
    event.preventDefault();
    const code = els.lookupCode.value.trim().toUpperCase();
    const reservation = state.reservations.find((item) => item.code.toUpperCase() === code);
    if (!reservation) {
      els.lookupResult.replaceChildren();
      els.lookupMessage.textContent = "We couldn't find that code. Please check it and try again.";
      return;
    }
    if (reservation.status === "cancelled" || reservation.status === "no-show") {
      els.lookupResult.innerHTML = `<div class="booking-result-row"><p><strong>${safeText(reservation.name)}</strong> · ${safeText(reservation.code)}<br><span class="optional">This booking is ${safeText(reservation.status)}.</span></p></div>`;
      els.lookupMessage.textContent = "";
      return;
    }
    showLookupResult(reservation);
  }

  function showWaitlistStatus(entry) {
    const queue = state.waitlist.filter((item) => item.date === entry.date && item.time === entry.time).sort((a, b) => a.createdAt - b.createdAt);
    const position = queue.findIndex((item) => item.id === entry.id) + 1;
    if (position === 0) {
      els.waitlistStatus.innerHTML = `<h3>Your waitlist spot has changed</h3><p>This place is no longer active. Check your messages for an update.</p>`;
    } else {
      const waitMinutes = Math.max(15, position * 20);
      els.waitlistStatus.innerHTML = `<h3>Your waitlist status</h3><p><strong>${safeText(entry.name)}</strong> · ${safeText(formatDate(entry.date, { month: "short", day: "numeric" }))} at ${safeText(formatTime(entry.time))} · ${entry.party} guests</p><p>You’re <strong>#${position}</strong> in line. Estimated wait: about ${waitMinutes} minutes.</p><button class="button button-soft" id="leave-waitlist" type="button">Leave waitlist</button>`;
      $("#leave-waitlist").addEventListener("click", () => leaveWaitlist(entry.id));
    }
    els.waitlistStatus.hidden = false;
  }

  function leaveWaitlist(id) {
    const index = state.waitlist.findIndex((item) => item.id === id);
    if (index < 0) return;
    const [entry] = state.waitlist.splice(index, 1);
    saveState();
    els.waitlistStatus.hidden = true;
    els.confirmation.hidden = true;
    sendNotification("SMS", entry.name, "Your waitlist request has been removed.");
    renderSlots();
  }

  function promoteWaitlist(table, date, time) {
    const next = state.waitlist
      .filter((entry) => entry.date === date && entry.time === time && entry.party <= table.capacity)
      .sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!next) return false;
    state.waitlist = state.waitlist.filter((entry) => entry.id !== next.id);
    const reservation = {
      code: makeCode(), name: next.name, phone: next.phone, email: next.email, request: "",
      date: next.date, time: next.time, party: next.party, table: table.id, status: "confirmed", createdAt: Date.now()
    };
    state.reservations.push(reservation);
    saveState();
    sendNotification("SMS", next.name, `Good news! A table for ${next.party} is now confirmed for ${formatTime(next.time)}. Code ${reservation.code}.`);
    return true;
  }

  function cancelReservation(code, source = "staff") {
    const reservation = state.reservations.find((item) => item.code === code);
    if (!reservation || reservation.status !== "confirmed") return;
    reservation.status = "cancelled";
    saveState();
    sendNotification("Email", reservation.name, `Your reservation for ${formatTime(reservation.time)} has been cancelled.`);
    const table = TABLES.find((item) => item.id === reservation.table);
    if (table) promoteWaitlist(table, reservation.date, reservation.time);
    if (source === "guest") {
      showLookupResult(reservation);
      els.lookupResult.innerHTML = `<div class="booking-result-row"><p><strong>${safeText(reservation.name)}</strong> · ${safeText(reservation.code)}<br><span class="optional">Your booking has been cancelled.</span></p></div>`;
    }
    renderSlots();
    renderStaff();
  }

  function updateReservationStatus(code, status) {
    const reservation = state.reservations.find((item) => item.code === code);
    if (!reservation || reservation.status !== "confirmed") return;
    reservation.status = status;
    saveState();
    if (status === "seated") {
      sendNotification("SMS", reservation.name, `Welcome to Ember & Oak! Your party is marked as seated at table ${reservation.table}.`);
    } else {
      sendNotification("Email", reservation.name, `Your table for ${formatTime(reservation.time)} has been released.`);
      const table = TABLES.find((item) => item.id === reservation.table);
      if (table) promoteWaitlist(table, reservation.date, reservation.time);
    }
    renderSlots();
    renderStaff();
  }

  function renderStaff() {
    if (!els.staff || els.staff.hidden || els.staffDashboard.hidden) return;
    const date = els.staffDate.value || localDate();
    const bookings = state.reservations.filter((item) => item.date === date && item.status !== "cancelled" && item.status !== "no-show").sort((a, b) => a.time.localeCompare(b.time));
    const queue = state.waitlist.slice().sort((a, b) => a.createdAt - b.createdAt);
    els.stats.innerHTML = `
      <div class="stat-card"><strong>${bookings.length}</strong><span>Reservations on service date</span></div>
      <div class="stat-card"><strong>${state.waitlist.length}</strong><span>Guests on the waitlist</span></div>
      <div class="stat-card"><strong>${TABLES.length}</strong><span>Tables on the floor</span></div>`;
    els.reservationCount.textContent = String(bookings.length);
    els.waitlistCount.textContent = String(queue.length);
    renderAvailability(date);
    renderReservationList(bookings);
    renderWaitlistList(queue);
    renderNotificationList();
  }

  function renderAvailability(date) {
    let html = `<table class="availability-table"><thead><tr><th scope="col">Table</th><th scope="col">Seats</th>${TIMES.map((time) => `<th scope="col">${safeText(formatTime(time, true))}</th>`).join("")}</tr></thead><tbody>`;
    TABLES.forEach((table) => {
      html += `<tr><th scope="row" class="table-name">${table.id}</th><td>${table.capacity}</td>`;
      TIMES.forEach((time) => {
        const reservation = state.reservations.find((item) => item.date === date && item.table === table.id && isActive(item) && overlaps(time, item.time));
        const status = reservation ? "Reserved" : "Free";
        const details = reservation ? `${reservation.name} · ${reservation.code} · party of ${reservation.party}` : `${table.capacity}-seat table is available`;
        html += `<td class="${reservation ? "booked" : ""}" data-table="${table.id}" data-time="${time}" title="${safeText(details)}" aria-label="${table.id} at ${safeText(formatTime(time, true))}: ${status}${reservation ? `, ${safeText(reservation.name)}` : ""}">${status}</td>`;
      });
      html += "</tr>";
    });
    els.availability.innerHTML = `${html}</tbody></table>`;
  }

  function renderReservationList(bookings) {
    if (!bookings.length) {
      els.reservations.innerHTML = `<div class="empty-state">No reservations for this date yet.</div>`;
      return;
    }
    els.reservations.innerHTML = bookings.map((item) => `<div class="staff-item">
      <div class="staff-item-top"><strong>${safeText(formatTime(item.time))} · ${safeText(item.name)}</strong><span class="optional">${item.party} guests · ${safeText(item.table)}</span></div>
      <p>${safeText(item.code)}${item.request ? ` · ${safeText(item.request)}` : ""} · ${safeText(item.status)}</p>
      ${item.status === "confirmed" ? `<div class="staff-item-actions"><button class="mini-button" data-action="seated" data-code="${safeText(item.code)}">Mark seated</button><button class="mini-button" data-action="no-show" data-code="${safeText(item.code)}">No-show</button><button class="mini-button danger" data-action="cancel" data-code="${safeText(item.code)}">Cancel</button></div>` : ""}
    </div>`).join("");
    els.reservations.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const { action, code } = button.dataset;
        if (action === "cancel") cancelReservation(code);
        else updateReservationStatus(code, action);
      });
    });
  }

  function renderWaitlistList(queue) {
    if (!queue.length) {
      els.waitlist.innerHTML = `<div class="empty-state">The waitlist is clear. Lovely.</div>`;
      return;
    }
    els.waitlist.innerHTML = queue.map((item, index) => `<div class="staff-item">
      <div class="staff-item-top"><strong>#${index + 1} · ${safeText(item.name)}</strong><span class="optional">${item.party} guests</span></div>
      <p>${safeText(formatDate(item.date, { month: "short", day: "numeric" }))} · ${safeText(formatTime(item.time))} · joined ${safeText(new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(item.createdAt)))}</p>
    </div>`).join("");
  }

  function renderNotificationList() {
    if (!state.notifications.length) {
      els.notifications.innerHTML = `<div class="empty-state">No messages sent yet.</div>`;
      return;
    }
    els.notifications.innerHTML = state.notifications.slice(0, 30).map((item) => `<div class="notification-item">
      <strong>${safeText(item.type)} to ${safeText(item.recipient)}</strong><p>${safeText(item.message)}</p>
      <time>${safeText(new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(item.createdAt)))}</time>
    </div>`).join("");
  }

  function renderCarousel() {
    const track = $("#carousel-track");
    const images = [...track.querySelectorAll(".carousel-image")];
    images.forEach((element, index) => {
      const slideIndex = (currentSlide + index + IMAGES.length - 1) % IMAGES.length;
      element.style.backgroundImage = `url("${IMAGES[slideIndex].url}")`;
      element.setAttribute("aria-label", IMAGES[slideIndex].label);
      element.dataset.slide = String(slideIndex);
    });
    els.carouselDots.innerHTML = IMAGES.map((_, index) => `<button class="carousel-dot" type="button" aria-label="Show image ${index + 1}" aria-current="${index === currentSlide}"></button>`).join("");
    els.carouselDots.querySelectorAll("button").forEach((button, index) => button.addEventListener("click", () => {
      currentSlide = index;
      renderCarousel();
    }));
  }

  function initializeReveal() {
    const selectors = ".story-section, .booking-section, .manage-card, .staff-card";
    document.querySelectorAll(selectors).forEach((element) => element.classList.add("reveal"));
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .12 });
    document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
  }

  function initialize() {
    if (!els.date) {
      const loginForm = $("#staff-login-form");
      const loginPanel = $("#staff-login");
      const passwordInput = $("#staff-password");
      const loginMessage = $("#staff-login-message");
      const navigation = $("#staff-navigation");
      const showDashboard = (authorized) => {
        loginPanel.hidden = authorized;
        els.staffDashboard.hidden = !authorized;
        navigation.hidden = !authorized;
        if (authorized) renderStaff();
      };
      let isAuthorized = false;
      try {
        isAuthorized = sessionStorage.getItem(STAFF_SESSION_KEY) === "true";
      } catch (error) {
        console.error("Could not read the staff demo session:", error);
        loginMessage.textContent = "This browser blocked session storage. Please allow it to use the staff demo login.";
      }
      showDashboard(isAuthorized);
      loginForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (passwordInput.value !== STAFF_PASSWORD) {
          loginMessage.textContent = "That password doesn't match. Please try again.";
          passwordInput.select();
          return;
        }
        try {
          sessionStorage.setItem(STAFF_SESSION_KEY, "true");
        } catch (error) {
          console.error("Could not save the staff demo session:", error);
          loginMessage.textContent = "This browser blocked session storage, so the demo cannot keep you signed in.";
          return;
        }
        passwordInput.value = "";
        loginMessage.textContent = "";
        showDashboard(true);
      });
      $("#staff-logout").addEventListener("click", () => {
        try {
          sessionStorage.removeItem(STAFF_SESSION_KEY);
        } catch (error) {
          console.error("Could not clear the staff demo session:", error);
          showToast("Could not clear this browser session. Close the tab to sign out.");
        }
        showDashboard(false);
        passwordInput.value = "";
        loginMessage.textContent = "";
        passwordInput.focus();
      });
      els.staffDate.min = localDate();
      els.staffDate.value = initialServiceDate();
      els.staffDate.addEventListener("change", renderStaff);
      $("#clear-notifications").addEventListener("click", () => {
        state.notifications = [];
        saveState();
        renderStaff();
      });
      initializeReveal();
      return;
    }

    els.date.min = localDate();
    els.date.value = localDate();
    els.date.addEventListener("change", () => {
      els.date.dataset.lastSelected = els.date.value;
      els.confirmation.hidden = true;
      renderSlots();
    });
    els.party.addEventListener("change", () => {
      els.confirmation.hidden = true;
      renderSlots();
    });
    els.form.addEventListener("submit", submitGuest);
    els.lookupForm.addEventListener("submit", lookupBooking);
    $(".carousel-prev").addEventListener("click", () => {
      currentSlide = (currentSlide + IMAGES.length - 1) % IMAGES.length;
      renderCarousel();
    });
    $(".carousel-next").addEventListener("click", () => {
      currentSlide = (currentSlide + 1) % IMAGES.length;
      renderCarousel();
    });
    renderCarousel();
    renderSlots();
    initializeReveal();
  }

  initialize();
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    state = loadState();
    renderSlots();
    renderStaff();
  });
})();
