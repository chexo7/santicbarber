document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const loginSection = document.getElementById('login-section');
    const adminPanel = document.getElementById('admin-panel');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutButton = document.getElementById('logout-button');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const appointmentsListContainer = document.getElementById('appointments-list');
    const appointmentsFeedback = document.getElementById('appointments-feedback');
    // Horario Estándar
    const standardScheduleForm = document.getElementById('standard-schedule-form');
    const weeklyScheduleContainer = document.getElementById('weekly-schedule-inputs');
    const scheduleSaveFeedback = document.getElementById('schedule-save-feedback');
    // Excepciones
    const availabilityDateInput = document.getElementById('availability-date');
    const availabilityTimeSlotsContainer = document.getElementById('availability-time-slots');
    // Servicios Tab Elements
    const servicesAdminListContainer = document.getElementById('services-list-admin');
    const addNewServiceButton = document.getElementById('add-new-service-btn');
    const servicesAdminFeedback = document.getElementById('services-admin-feedback');

    // --- Firebase Services (from global scope) ---
    const {
        auth, database, signInWithEmailAndPassword, signOut, onAuthStateChanged,
        ref, set, get, child, remove, update: firebaseUpdate // Renamed to avoid conflict
    } = window.firebaseServices;

    // --- Constantes y Estado ---
    // Firebase DB Paths (keys are now paths)
    const APPOINTMENTS_PATH = 'appointments';
    const BLOCKED_SLOTS_PATH = 'blockedSlots';
    const STANDARD_SCHEDULE_PATH = 'standardSchedule';
    const SERVICES_PATH = 'services';

    const suggestedIcons = [
        { value: '', text: '-- Sin Icono --' }, { value: '✂️', text: '✂️ Tijeras' },
        { value: '💈', text: '💈 Poste Barbería' }, { value: '✨', text: '✨ Destellos' },
        { value: '🧴', text: '🧴 Botella Loción' }, { value: '🧔', text: '🧔 Barba' },
        { value: '🧑‍🦲', text: '🧑‍🦲 Cabeza Calva' }, { value: '🧒', text: '🧒 Niño/Junior' },
        { value: '🧼', text: '🧼 Jabón/Espuma' }, { value: '🔥', text: '🔥 Fuego (Toallas Calientes)' },
        { value: '💨', text: '💨 Aire (Peinado/Secado)' }, { value: '👌', text: '👌 OK Hand' },
        { value: '❓', text: '❓ Interrogación' },
    ];
    const SLOT_INTERVAL_MINUTES = 30;
    const baseTimeSlots = [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
        '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
        '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
    ];
    const daysOfWeekSpanish = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    // --- Funciones de Utilidad (Firebase Data) ---
    async function loadDataFirebase(path, defaultValue = {}) {
        try {
            const snapshot = await get(child(ref(database), path));
            if (snapshot.exists()) {
                return snapshot.val();
            } else {
                console.log(`No data available at path: ${path}. Returning default.`);
                return defaultValue;
            }
        } catch (error) {
            console.error(`Error loading data from Firebase path ${path}:`, error);
            showFeedback(servicesAdminFeedback, `Error cargando datos: ${error.message}`, 'error'); // Generic feedback
            return defaultValue;
        }
    }

    async function saveDataFirebase(path, data) {
        try {
            await set(ref(database, path), data);
            console.log(`Data saved to Firebase path ${path}:`, data);
        } catch (error) {
            console.error(`Error saving data to Firebase path ${path}:`, error);
            throw error; // Re-throw to be caught by caller for specific feedback
        }
    }
    async function updateDataFirebase(path, data) {
        try {
            await firebaseUpdate(ref(database, path), data);
            console.log(`Data updated at Firebase path ${path}:`, data);
        } catch (error) {
            console.error(`Error updating data at Firebase path ${path}:`, error);
            throw error;
        }
    }

    async function removeDataFirebase(path) {
        try {
            await remove(ref(database, path));
            console.log(`Data removed from Firebase path ${path}`);
        } catch (error) {
            console.error(`Error removing data from Firebase path ${path}:`, error);
            throw error;
        }
    }


    // --- Funciones de Utilidad (Generales - sin cambios mayores) ---
    function formatDateDMY(dateStringYMD) { if (!dateStringYMD || !/^\d{4}-\d{2}-\d{2}$/.test(dateStringYMD)) return dateStringYMD; try { const [year, month, day] = dateStringYMD.split('-'); return `${day}/${month}/${year}`; } catch (e) { console.warn("Could not format date:", dateStringYMD, e); return dateStringYMD; } }
    function showFeedback(element, message, type = 'success', duration = 3500) { if (!element) return; element.textContent = message; element.className = `feedback-message ${type}`; element.style.display = (type === 'clear' || !message) ? 'none' : 'inline-flex'; if (duration > 0 && type !== 'clear') { setTimeout(() => { if (element.textContent === message) { element.textContent = ''; element.className = 'feedback-message'; element.style.display = 'none'; } }, duration); } else if (type === 'clear') { element.textContent = ''; element.className = 'feedback-message'; element.style.display = 'none'; } }
    function timeToMinutes(timeStr) { if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null; try { const [hours, minutes] = timeStr.split(':').map(Number); if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null; return hours * 60 + minutes; } catch (e) { console.warn("Could not convert time to minutes:", timeStr, e); return null; } }
    function minutesToTime(totalMinutes) { if (totalMinutes === null || totalMinutes < 0 || isNaN(totalMinutes)) return null; const h = Math.floor(totalMinutes / 60) % 24; const m = totalMinutes % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
    function generateUniqueId(prefix = 'item_') { return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 9); } // Firebase can generate its own push keys, but this can be used for object keys if needed.
    function formatPriceAdmin(value) { const number = Number(value); if (isNaN(number) || value === null || value === undefined || number < 0) return '0'; return number.toString(); }
    function formatPriceDisplay(value) { const number = Number(value); if (isNaN(number) || number <= 0) return 'Gratis'; return `$${number.toLocaleString('es-CL')}`; }
    function formatDuration(minutes) { if (isNaN(minutes) || minutes <= 0) return 'N/A'; return `${minutes} min`; }


    // --- Lógica de Autenticación con Firebase ---
    function handleLogin(event) {
        event.preventDefault();
        const emailInput = document.getElementById('email'); // Changed from username
        const passwordInput = document.getElementById('password');
        if (!emailInput || !passwordInput) return;

        const email = emailInput.value;
        const password = passwordInput.value;

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Signed in
                const user = userCredential.user;
                console.log("Admin logged in:", user.uid);
                // showAdminPanel() will be called by onAuthStateChanged
                if (loginError) loginError.style.display = 'none';
                if (loginForm) loginForm.reset();
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                console.error("Login failed:", errorCode, errorMessage);
                if (loginError) {
                    loginError.textContent = "Correo o contraseña incorrectos. Intenta de nuevo.";
                    loginError.style.display = 'block';
                }
            });
    }

    function handleLogout() {
        signOut(auth).then(() => {
            console.log("Admin logged out");
            // showLoginSection() will be called by onAuthStateChanged
        }).catch((error) => {
            console.error("Logout failed:", error);
            showFeedback(appointmentsFeedback, `Error al cerrar sesión: ${error.message}`, 'error');
        });
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            console.log("Auth state changed: User signed in", user.uid);
            showAdminPanel();
        } else {
            // User is signed out
            console.log("Auth state changed: User signed out");
            showLoginSection();
        }
    });


    function showAdminPanel() {
        if (loginSection) loginSection.classList.remove('active');
        if (adminPanel) adminPanel.classList.add('active');
        loadInitialData();
    }

    function showLoginSection() {
        if (adminPanel) adminPanel.classList.remove('active');
        if (loginSection) loginSection.classList.add('active');
        // Clear dynamic content
        if (appointmentsListContainer) appointmentsListContainer.innerHTML = '';
        if (appointmentsFeedback) showFeedback(appointmentsFeedback, '', 'clear');
        if (weeklyScheduleContainer) weeklyScheduleContainer.innerHTML = '';
        if (scheduleSaveFeedback) showFeedback(scheduleSaveFeedback, '', 'clear');
        if (availabilityTimeSlotsContainer) availabilityTimeSlotsContainer.innerHTML = '<p class="placeholder">Selecciona una fecha para ver y modificar los horarios.</p>';
        if (servicesAdminListContainer) servicesAdminListContainer.innerHTML = '';
        if (servicesAdminFeedback) showFeedback(servicesAdminFeedback, '', 'clear');
        if (availabilityDateInput) availabilityDateInput.value = '';
    }

    // No need for checkLoginStatus() anymore, onAuthStateChanged handles it.

    // --- Carga Inicial de Datos del Panel ---
    async function loadInitialData() {
        [appointmentsFeedback, scheduleSaveFeedback, servicesAdminFeedback].forEach(el => showFeedback(el, '', 'clear'));
        if (appointmentsListContainer) await loadAppointments();
        if (weeklyScheduleContainer) await loadStandardScheduleUI();
        if (servicesAdminListContainer) await loadServicesAdminUI();
        if (availabilityDateInput) await setupAvailabilityCalendar(); // Made async

        const activeTabButton = document.querySelector('.tab-button.active');
        if (activeTabButton) {
            const targetTabId = activeTabButton.dataset.tab;
            const targetContent = document.getElementById(`${targetTabId}-tab`);
            tabContents.forEach(content => content.classList.remove('active'));
            if (targetContent) targetContent.classList.add('active');
        } else if (tabButtons.length > 0) { handleTabClick({ currentTarget: tabButtons[0] }); }
    }


    // --- Lógica de Pestañas (Tabs) ---
    function handleTabClick(event) {
        if (!event || !event.currentTarget || !event.currentTarget.dataset.tab) return;
        const clickedTab = event.currentTarget; const targetTabId = clickedTab.dataset.tab;
        if (clickedTab.classList.contains('active')) return;
        tabContents.forEach(content => content.classList.remove('active'));
        tabButtons.forEach(button => button.classList.remove('active'));
        const targetContent = document.getElementById(`${targetTabId}-tab`);
        if (targetContent) targetContent.classList.add('active');
        clickedTab.classList.add('active');
        [appointmentsFeedback, scheduleSaveFeedback, servicesAdminFeedback].forEach(el => showFeedback(el, '', 'clear'));
    }

    // --- Lógica de Citas (Appointments) ---
    async function loadAppointments() {
        if (!appointmentsListContainer) return;
        appointmentsListContainer.innerHTML = '<p class="placeholder">Cargando citas...</p>';
        const appointmentsData = await loadDataFirebase(APPOINTMENTS_PATH, {});
        const allServicesData = await loadDataFirebase(SERVICES_PATH, {});

        // Convert Firebase objects to arrays
        const appointments = appointmentsData ? Object.values(appointmentsData) : [];
        const allServices = allServicesData ? Object.values(allServicesData) : [];


        appointmentsListContainer.innerHTML = '';
        if (appointments.length === 0) { appointmentsListContainer.innerHTML = '<p class="placeholder">No hay citas registradas.</p>'; return; }

        appointments.sort((a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1; if (a.status !== 'pending' && b.status === 'pending') return 1;
            const dtA = new Date(`${a.date || '1970-01-01'}T${a.time || '00:00'}`); const dtB = new Date(`${b.date || '1970-01-01'}T${b.time || '00:00'}`);
            if (isNaN(dtA.getTime())) return 1; if (isNaN(dtB.getTime())) return -1; return dtA - dtB;
        });

        appointments.forEach(appt => {
            const item = document.createElement('div'); item.classList.add('appointment-item'); item.dataset.id = appt.id;
            const status = appt.status || 'pending'; const statusClass = `status-${status}`;
            const clientEmail = appt.email ? `<p><strong>Email:</strong> ${appt.email}</p>` : '';
            let requestedDate = 'N/A'; if (appt.requestedAt) { try { requestedDate = new Date(appt.requestedAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { console.warn(e)} }
            const serviceInfo = allServices.find(s => s.id === appt.serviceId);
            const serviceDisplayName = serviceInfo ? serviceInfo.name : (appt.service || 'Servicio Desconocido');
            const isOtherService = (appt.service === 'Otro' || (serviceInfo && serviceInfo.name.toLowerCase().includes('otro')));

            item.innerHTML = `
                <div class="appointment-details">
                    <p><strong>Fecha:</strong> ${formatDateDMY(appt.date)} ${appt.time || 'N/A'}</p>
                    <p><strong>Cliente:</strong> ${appt.name || 'N/A'}</p>
                    <p><strong>Teléfono:</strong> ${appt.phone || 'N/A'}</p> ${clientEmail}
                    <p><strong>Servicio:</strong> ${serviceDisplayName}</p>
                    ${isOtherService && appt.otherDetails ? `<p><strong>Detalle Otro:</strong> ${appt.otherDetails}</p>` : ''}
                    <p><strong>Solicitado:</strong> ${requestedDate}</p>
                    <p><strong>Estado:</strong> <span class="appointment-status ${statusClass}">${status}</span></p>
                </div>
                <div class="appointment-actions">
                    ${(status !== 'confirmed') ? `<button class="admin-button success confirm-button" data-id="${appt.id}">Confirmar</button>` : ''}
                    ${(status !== 'rejected' && status !== 'cancelled') ? `<button class="admin-button danger reject-button" data-id="${appt.id}">Rechazar</button>` : ''}
                    <button class="admin-button danger delete-button" data-id="${appt.id}">Eliminar</button>
                </div>`;
            appointmentsListContainer.appendChild(item);
        });

        appointmentsListContainer.querySelectorAll('.confirm-button').forEach(btn => btn.addEventListener('click', () => updateAppointmentStatus(btn.dataset.id, 'confirmed')));
        appointmentsListContainer.querySelectorAll('.reject-button').forEach(btn => btn.addEventListener('click', () => updateAppointmentStatus(btn.dataset.id, 'rejected')));
        appointmentsListContainer.querySelectorAll('.delete-button').forEach(btn => btn.addEventListener('click', () => handleDeleteAppointment(btn.dataset.id)));
    }

    async function updateAppointmentStatus(id, newStatus) {
        const appointmentPath = `${APPOINTMENTS_PATH}/${id}`;
        try {
            const snapshot = await get(child(ref(database), appointmentPath));
            if (snapshot.exists()) {
                const appt = snapshot.val();
                if (appt.status !== newStatus) {
                    await updateDataFirebase(appointmentPath, { status: newStatus });
                    const action = newStatus === 'confirmed' ? 'confirmada' : 'rechazada';
                    showFeedback(appointmentsFeedback, `Cita de ${appt.name || '?'} ${action}.`, newStatus === 'confirmed' ? 'success' : 'error', 5000);
                    await loadAppointments(); // Reload list
                    const affectedDate = appt.date;
                    const availTabActive = document.getElementById('availability-tab')?.classList.contains('active');
                    if (availTabActive && availabilityDateInput?.value === affectedDate) {
                        await loadAvailabilityForDate(affectedDate);
                    }
                }
            } else {
                showFeedback(appointmentsFeedback, "Error: Cita no encontrada.", 'error', 5000);
            }
        } catch (error) {
            console.error("Error updating appointment status:", error);
            showFeedback(appointmentsFeedback, `Error: ${error.message}`, 'error', 5000);
        }
    }

    async function handleDeleteAppointment(id) {
        const appointmentPath = `${APPOINTMENTS_PATH}/${id}`;
        try {
            const snapshot = await get(child(ref(database), appointmentPath));
            if (!snapshot.exists()) {
                showFeedback(appointmentsFeedback, "Error: Cita no encontrada.", 'error', 5000);
                return;
            }
            const appt = snapshot.val();
            const confirmText = `¿Seguro ELIMINAR cita de ${appt.name || '?'} (${formatDateDMY(appt.date)} ${appt.time || 'N/A'})?\n\n¡NO SE PUEDE DESHACER!`;

            if (window.confirm(confirmText)) {
                await removeDataFirebase(appointmentPath);
                showFeedback(appointmentsFeedback, `Cita de ${appt.name || '?'} eliminada.`, 'success', 5000);
                await loadAppointments();
                const affectedDate = appt.date;
                const availTabActive = document.getElementById('availability-tab')?.classList.contains('active');
                if (availTabActive && availabilityDateInput?.value === affectedDate) {
                    await loadAvailabilityForDate(affectedDate);
                }
            } else {
                showFeedback(appointmentsFeedback, 'Eliminación cancelada.', '', 3000);
            }
        } catch (error) {
            console.error("Error deleting appointment:", error);
            showFeedback(appointmentsFeedback, `Error al eliminar: ${error.message}`, 'error', 5000);
        }
    }


    // --- Lógica Horario Estándar ---
    async function loadStandardScheduleUI() {
        if (!weeklyScheduleContainer) return;
        weeklyScheduleContainer.innerHTML = '<p class="placeholder">Cargando horario...</p>';
        const schedule = await loadDataFirebase(STANDARD_SCHEDULE_PATH, {});

        weeklyScheduleContainer.innerHTML = ''; // Clear placeholder
        daysOfWeekSpanish.forEach((dayName, i) => {
            const dayIndexStr = String(i); // Firebase keys are strings
            const def = { open: i !== 0, morningOpen: i !== 0, morningStart: '09:00', morningEnd: '14:00', afternoonOpen: i !== 0, afternoonStart: '15:00', afternoonEnd: '18:00' };
            const saved = schedule[dayIndexStr] || {}; // Use string index
            const day = {
                open: saved.open !== undefined ? saved.open : def.open,
                morningOpen: saved.morningOpen !== undefined ? saved.morningOpen : (saved.open !== undefined ? saved.open : def.morningOpen),
                morningStart: saved.morningStart || def.morningStart,
                morningEnd: saved.morningEnd || def.morningEnd,
                afternoonOpen: saved.afternoonOpen !== undefined ? saved.afternoonOpen : (saved.open !== undefined ? saved.open : def.afternoonOpen),
                afternoonStart: saved.afternoonStart || def.afternoonStart,
                afternoonEnd: saved.afternoonEnd || def.afternoonEnd
            };
            const fs = document.createElement('fieldset'); fs.classList.add('daily-schedule-group');
            const oId = `o${i}`, mOId = `mo${i}`, mSId = `ms${i}`, mEId = `me${i}`, aOId = `ao${i}`, aSId = `as${i}`, aEId = `ae${i}`;
            fs.innerHTML = `<legend>${dayName}</legend><div class="day-controls"><label class="day-open-toggle" for="${oId}"><input type="checkbox" id="${oId}" name="o_${i}" ${day.open ? 'checked' : ''}> Abierto</label><div class="time-range-inputs"><div class="time-input-group"><label class="period-toggle-label" for="${mOId}"><input type="checkbox" id="${mOId}" name="mO_${i}" ${day.morningOpen ? 'checked' : ''}> Mañana</label><div class="time-input-group-controls"><input type="time" id="${mSId}" name="mS_${i}" value="${day.morningStart || ''}" step="1800"><span>-</span><input type="time" id="${mEId}" name="mE_${i}" value="${day.morningEnd || ''}" step="1800"></div></div><div class="time-input-group"><label class="period-toggle-label" for="${aOId}"><input type="checkbox" id="${aOId}" name="aO_${i}" ${day.afternoonOpen ? 'checked' : ''}> Tarde</label><div class="time-input-group-controls"><input type="time" id="${aSId}" name="aS_${i}" value="${day.afternoonStart || ''}" step="1800"><span>-</span><input type="time" id="${aEId}" name="aE_${i}" value="${day.afternoonEnd || ''}" step="1800"></div></div></div></div>`;
            weeklyScheduleContainer.appendChild(fs);
        });
    }

    async function handleSaveStandardSchedule(event) {
        event.preventDefault(); if (!standardScheduleForm || !scheduleSaveFeedback) return;
        const newSchedule = {}; let valid = true; let err = null; let errEl = null;
        for (let i = 0; i < 7; i++) {
            const dayN = daysOfWeekSpanish[i]; const o = standardScheduleForm.querySelector(`input[name="o_${i}"]`)?.checked ?? false; const mO = standardScheduleForm.querySelector(`input[name="mO_${i}"]`)?.checked ?? false; const aO = standardScheduleForm.querySelector(`input[name="aO_${i}"]`)?.checked ?? false; const mS = standardScheduleForm.querySelector(`input[name="mS_${i}"]`)?.value || null; const mE = standardScheduleForm.querySelector(`input[name="mE_${i}"]`)?.value || null; const aS = standardScheduleForm.querySelector(`input[name="aS_${i}"]`)?.value || null; const aE = standardScheduleForm.querySelector(`input[name="aE_${i}"]`)?.value || null;
            newSchedule[i] = { open: o, morningOpen: o && mO, morningStart: mS, morningEnd: mE, afternoonOpen: o && aO, afternoonStart: aS, afternoonEnd: aE };
            if (o) { const mSt = timeToMinutes(mS), mEt = timeToMinutes(mE), aSt = timeToMinutes(aS), aEt = timeToMinutes(aE); if (!mO && !aO) { err = `${dayN}: Habilite Mañana o Tarde.`; valid = false; errEl = standardScheduleForm.querySelector(`input[name="mO_${i}"]`); break; } if (mO) { if (!mS || !mE) { err = `${dayN} (M): Faltan horas.`; errEl = standardScheduleForm.querySelector(`input[name="mS_${i}"]`); valid = false; break; } if (mEt <= mSt) { err = `${dayN} (M): Fin <= Inicio.`; errEl = standardScheduleForm.querySelector(`input[name="mE_${i}"]`); valid = false; break; } } if (aO) { if (!aS || !aE) { err = `${dayN} (T): Faltan horas.`; errEl = standardScheduleForm.querySelector(`input[name="aS_${i}"]`); valid = false; break; } if (aEt <= aSt) { err = `${dayN} (T): Fin <= Inicio.`; errEl = standardScheduleForm.querySelector(`input[name="aE_${i}"]`); valid = false; break; } } if (mO && aO && mE && aS) { if (aSt < mEt) { err = `${dayN}: Inicio tarde < Fin mañana.`; errEl = standardScheduleForm.querySelector(`input[name="aS_${i}"]`); valid = false; break; } } }
        }
        if (valid) {
            try {
                await saveDataFirebase(STANDARD_SCHEDULE_PATH, newSchedule);
                showFeedback(scheduleSaveFeedback, 'Horario guardado en Firebase.', 'success');
            } catch (error) {
                showFeedback(scheduleSaveFeedback, `Error guardando horario: ${error.message}`, 'error', 6000);
            }
        } else {
            showFeedback(scheduleSaveFeedback, err || 'Error horario.', 'error', 6000);
            if (errEl) { errEl.focus(); errEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }
    }

    // --- Lógica de Excepciones/Disponibilidad (Admin View) ---
    async function setupAvailabilityCalendar() {
        if (!availabilityDateInput) return; const today = new Date(); const todayStr = today.toISOString().split('T')[0];
        availabilityDateInput.min = todayStr; const currentVal = availabilityDateInput.value;
        if (currentVal && currentVal >= todayStr) { await loadAvailabilityForDate(currentVal); }
        else { availabilityDateInput.value = todayStr; await loadAvailabilityForDate(todayStr); }

        availabilityDateInput.addEventListener('change', async (e) => {
            const selected = e.target.value;
            if (selected && selected >= todayStr) { await loadAvailabilityForDate(selected); }
            else { if (availabilityTimeSlotsContainer) { availabilityTimeSlotsContainer.innerHTML = '<p class="placeholder">Selecciona fecha válida (hoy o futura).</p>'; } }
        });
    }

    async function loadAvailabilityForDate(dateString) {
        if (!availabilityTimeSlotsContainer) return; availabilityTimeSlotsContainer.innerHTML = '<p class="placeholder">Cargando...</p>';
        if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) { availabilityTimeSlotsContainer.innerHTML = '<p class="placeholder">Fecha inválida.</p>'; return; }

        const date = new Date(`${dateString}T00:00:00`); const dayOfWeek = date.getDay();
        const scheduleData = await loadDataFirebase(STANDARD_SCHEDULE_PATH, {});
        const dayStd = scheduleData[dayOfWeek] || { open: false, morningOpen: false, afternoonOpen: false };

        const exceptionsData = await loadDataFirebase(BLOCKED_SLOTS_PATH, {});
        const explicitBlocks = (exceptionsData && exceptionsData[dateString]) ? exceptionsData[dateString] : []; // Firebase stores arrays directly

        const apptsData = await loadDataFirebase(APPOINTMENTS_PATH, {});
        const servicesData = await loadDataFirebase(SERVICES_PATH, {});
        const appts = apptsData ? Object.values(apptsData) : [];
        const services = servicesData ? Object.values(servicesData) : [];

        const bookedDetails = appts.filter(a => a.date === dateString && (a.status === 'confirmed' || a.status === 'pending')).map(a => { const svc = services.find(s => s.id === a.serviceId); const dur = svc ? (svc.duration || 60) : 60; return { time: a.time, duration: dur }; }).filter(a => a.time);

        availabilityTimeSlotsContainer.innerHTML = ''; // Clear loading
        let hasSlots = false;
        baseTimeSlots.forEach(time => {
            hasSlots = true; const timeMin = timeToMinutes(time); if (timeMin === null) return;
            let isStd = false; let isExplicit = explicitBlocks.includes(time); let isBooked = false; let bookReason = "";
            for (const bk of bookedDetails) { const bkStart = timeToMinutes(bk.time); if (bkStart === null) continue; const bkEnd = bkStart + bk.duration; if (timeMin >= bkStart && timeMin < bkEnd) { isBooked = true; bookReason = (timeMin === bkStart) ? '(Cita-Ini)' : '(Cita-Cont)'; break; } }
            if (dayStd.open) { const mSt = timeToMinutes(dayStd.morningStart), mEt = timeToMinutes(dayStd.morningEnd), aSt = timeToMinutes(dayStd.afternoonStart), aEt = timeToMinutes(dayStd.afternoonEnd); const fitM = (dayStd.morningOpen && mSt !== null && mEt !== null && timeMin >= mSt && timeMin < mEt); const fitA = (dayStd.afternoonOpen && aSt !== null && aEt !== null && timeMin >= aSt && timeMin < aEt); if (fitM || fitA) isStd = true; }
            let statusCls = 'blocked'; let disabled = false; let title = `Hora ${time}`;
            if (isBooked) { statusCls = 'blocked'; disabled = true; title += ` ${bookReason}`; }
            else if (isExplicit) { statusCls = 'blocked'; disabled = false; title += ' (Bloq. Manual)'; }
            else if (isStd) { statusCls = 'available'; disabled = false; title += ' (Disponible)'; }
            else { statusCls = 'blocked'; disabled = false; title += ' (Cerrado Horario)'; }
            const btn = document.createElement('button'); btn.type = 'button'; btn.classList.add('availability-slot', statusCls); btn.textContent = time; btn.dataset.time = time; btn.dataset.date = dateString; btn.disabled = disabled; btn.title = title; btn.setAttribute('aria-label', title); btn.setAttribute('aria-pressed', statusCls === 'blocked');
            if (!disabled) { btn.addEventListener('click', toggleSlotException); } availabilityTimeSlotsContainer.appendChild(btn);
        });
        if (!hasSlots) { availabilityTimeSlotsContainer.innerHTML = '<p class="placeholder">No hay horarios base.</p>'; }
    }

    async function toggleSlotException(event) {
        const btn = event.currentTarget; const date = btn.dataset.date; const time = btn.dataset.time; if (!date || !time) return;

        const exceptionsPath = `${BLOCKED_SLOTS_PATH}/${date}`;
        try {
            const snapshot = await get(child(ref(database), exceptionsPath));
            let currentDayExceptions = snapshot.exists() ? snapshot.val() : [];
            if (!Array.isArray(currentDayExceptions)) currentDayExceptions = []; // Ensure it's an array

            const isBlocked = currentDayExceptions.includes(time);

            if (isBlocked) {
                currentDayExceptions = currentDayExceptions.filter(t => t !== time);
                console.log(`Excepción ELIMINADA: ${date} ${time}`);
            } else {
                if (!currentDayExceptions.includes(time)) {
                    currentDayExceptions.push(time);
                    currentDayExceptions.sort(); // Keep it sorted
                }
                console.log(`Excepción AÑADIDA: ${date} ${time}`);
            }

            if (currentDayExceptions.length === 0) {
                await removeDataFirebase(exceptionsPath); // Remove the date node if no exceptions
            } else {
                await saveDataFirebase(exceptionsPath, currentDayExceptions);
            }
            await loadAvailabilityForDate(date); // Reload UI
        } catch (error) {
            console.error("Error toggling slot exception:", error);
            showFeedback(servicesAdminFeedback, `Error al modificar bloqueo: ${error.message}`, 'error');
        }
    }


    // --- Lógica de Gestión de Servicios (Admin) ---
    async function loadServicesAdminUI() {
        if (!servicesAdminListContainer || !servicesAdminFeedback) return;
        servicesAdminListContainer.innerHTML = '<p class="placeholder">Cargando servicios...</p>';
        showFeedback(servicesAdminFeedback, '', 'clear');

        const servicesData = await loadDataFirebase(SERVICES_PATH, {});
        const services = servicesData ? Object.values(servicesData) : []; // Convert to array

        servicesAdminListContainer.innerHTML = ''; // Clear placeholder
        if (services.length === 0) { servicesAdminListContainer.innerHTML = '<p class="placeholder">No hay servicios definidos.</p>'; return; }
        services.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        services.forEach(service => {
            const el = document.createElement('div'); el.classList.add('service-admin-item'); el.dataset.id = service.id; if (!service.active) el.classList.add('inactive');
            el.innerHTML = `
                <div class="service-details-display">
                    <span class="service-display-icon" aria-hidden="true">${service.icon || ''}</span>
                    <strong class="service-name">${service.name || 'N/A'}</strong>
                    <span class="service-info">(${formatDuration(service.duration || 0)}, ${formatPriceDisplay(service.price || 0)})</span>
                    <span class="service-status ${service.active ? 'status-active' : 'status-inactive'}">${service.active ? 'Activo' : 'Inactivo'}</span>
                </div>
                <div class="service-actions">
                    <button type="button" class="admin-button edit-service-btn" data-id="${service.id}">Editar</button>
                    <button type="button" class="admin-button ${service.active ? 'warning' : 'success'} toggle-active-btn" data-id="${service.id}">${service.active ? 'Desactivar' : 'Activar'}</button>
                    <button type="button" class="admin-button danger delete-service-btn" data-id="${service.id}">Eliminar</button>
                </div>`;
            servicesAdminListContainer.appendChild(el);
        });
        servicesAdminListContainer.querySelectorAll('.edit-service-btn').forEach(b => b.addEventListener('click', (e) => handleEditService(e.currentTarget.dataset.id)));
        servicesAdminListContainer.querySelectorAll('.toggle-active-btn').forEach(b => b.addEventListener('click', (e) => handleToggleActiveService(e.currentTarget.dataset.id)));
        servicesAdminListContainer.querySelectorAll('.delete-service-btn').forEach(b => b.addEventListener('click', (e) => handleDeleteService(e.currentTarget.dataset.id)));
    }

    async function handleEditService(id) {
        const el = servicesAdminListContainer.querySelector(`.service-admin-item[data-id="${id}"]`);
        if (!el || el.classList.contains('editing')) return;
        const editing = servicesAdminListContainer.querySelector('.editing'); if (editing) { showFeedback(servicesAdminFeedback, 'Termina edición actual.', 'error'); return; }
        if (addNewServiceButton) addNewServiceButton.disabled = true;

        const servicePath = `${SERVICES_PATH}/${id}`;
        const snapshot = await get(child(ref(database), servicePath));
        if (!snapshot.exists()) {
            showFeedback(servicesAdminFeedback, 'Error: Servicio no encontrado para editar.', 'error');
            if (addNewServiceButton) addNewServiceButton.disabled = false;
            return;
        }
        const service = snapshot.val();

        const icons = suggestedIcons.map(i => `<option value="${i.value}" ${service.icon === i.value ? 'selected' : ''}>${i.text}</option>`).join('');
        el.classList.add('editing');
        el.innerHTML = `
            <div class="service-details-edit">
                <div class="form-group"> <label for="edit-name-${id}">Nombre:</label> <input type="text" id="edit-name-${id}" value="${service.name || ''}" required> </div>
                <div class="form-group inline"> <label for="edit-icon-${id}">Icono:</label> <select id="edit-icon-${id}" class="service-icon-select">${icons}</select> </div>
                <div class="form-group inline"> <label for="edit-duration-${id}">Duración (min):</label> <input type="number" id="edit-duration-${id}" value="${formatPriceAdmin(service.duration)}" min="${SLOT_INTERVAL_MINUTES}" step="${SLOT_INTERVAL_MINUTES}" required> </div>
                <div class="form-group inline"> <label for="edit-price-${id}">Precio ($):</label> <input type="number" id="edit-price-${id}" value="${formatPriceAdmin(service.price)}" min="0" step="500" required> </div>
                <div class="form-group inline checkbox"> <input type="checkbox" id="edit-active-${id}" ${service.active ? 'checked' : ''}> <label for="edit-active-${id}">Activo</label> </div>
            </div>
            <div class="service-actions edit-mode">
                <button type="button" class="admin-button success save-edit-btn" data-id="${id}">Guardar</button>
                <button type="button" class="admin-button cancel-edit-btn" data-id="${id}">Cancelar</button>
            </div>`;
        el.querySelector('.save-edit-btn').addEventListener('click', (e) => handleSaveService(e.currentTarget.dataset.id));
        el.querySelector('.cancel-edit-btn').addEventListener('click', (e) => handleCancelEdit(e.currentTarget.dataset.id)); // No ID needed for cancel, just reload UI
        el.querySelector(`#edit-name-${id}`).focus();
    }

    async function handleSaveService(id) {
        const el = servicesAdminListContainer.querySelector(`.service-admin-item[data-id="${id}"]`); if (!el) return;
        const nameIn = el.querySelector(`#edit-name-${id}`); const iconSel = el.querySelector(`#edit-icon-${id}`); const durIn = el.querySelector(`#edit-duration-${id}`); const priceIn = el.querySelector(`#edit-price-${id}`); const activeIn = el.querySelector(`#edit-active-${id}`);
        let ok = true; let errs = []; const name = nameIn.value.trim(); const icon = iconSel.value; const dur = parseInt(durIn.value, 10); const price = parseInt(priceIn.value, 10); const active = activeIn.checked;
        if (!name) { ok = false; errs.push("Nombre vacío."); nameIn.style.borderColor = 'var(--error-alt-color)'; } else { nameIn.style.borderColor = ''; }
        if (isNaN(dur) || dur <= 0 || dur % SLOT_INTERVAL_MINUTES !== 0) { ok = false; errs.push(`Duración múltiplo de ${SLOT_INTERVAL_MINUTES}.`); durIn.style.borderColor = 'var(--error-alt-color)'; } else { durIn.style.borderColor = ''; }
        if (isNaN(price) || price < 0) { ok = false; errs.push("Precio inválido."); priceIn.style.borderColor = 'var(--error-alt-color)'; } else { priceIn.style.borderColor = ''; }
        if (!ok) { showFeedback(servicesAdminFeedback, `Error: ${errs.join(' ')}`, 'error', 5000); return; }

        const servicePath = `${SERVICES_PATH}/${id}`;
        const updatedServiceData = { id, name, icon, duration: dur, price, active }; // Ensure ID is part of the object being saved

        try {
            await saveDataFirebase(servicePath, updatedServiceData); // Overwrite the specific service by its ID path
            showFeedback(servicesAdminFeedback, `Servicio "${name}" actualizado.`, 'success');
        } catch (error) {
            showFeedback(servicesAdminFeedback, `Error al actualizar: ${error.message}`, 'error');
        } finally {
            if (addNewServiceButton) addNewServiceButton.disabled = false;
            await loadServicesAdminUI();
        }
    }

    async function handleCancelEdit() { // No ID needed, just reloads UI
        if (addNewServiceButton) addNewServiceButton.disabled = false;
        await loadServicesAdminUI();
        showFeedback(servicesAdminFeedback, 'Edición cancelada.', '', 3000);
    }

    async function handleToggleActiveService(id) {
        const servicePath = `${SERVICES_PATH}/${id}`;
        try {
            const snapshot = await get(child(ref(database), servicePath));
            if (snapshot.exists()) {
                const service = snapshot.val();
                const newActiveState = !service.active;
                await updateDataFirebase(servicePath, { active: newActiveState });
                showFeedback(servicesAdminFeedback, `Servicio "${service.name}" ${newActiveState ? 'activado' : 'desactivado'}.`, 'success');
                await loadServicesAdminUI();
            } else {
                showFeedback(servicesAdminFeedback, `Error: Servicio no encontrado.`, 'error');
            }
        } catch (error) {
            showFeedback(servicesAdminFeedback, `Error al cambiar estado: ${error.message}`, 'error');
        }
    }

    async function handleDeleteService(id) {
        const servicePath = `${SERVICES_PATH}/${id}`;
        try {
            const snapshot = await get(child(ref(database), servicePath));
            if (!snapshot.exists()) {
                showFeedback(servicesAdminFeedback, `Error: Servicio no encontrado.`, 'error'); return;
            }
            const svc = snapshot.val();
            if (window.confirm(`¿Seguro ELIMINAR "${svc.name}"?\n\nNo se podrá deshacer.`)) {
                await removeDataFirebase(servicePath);
                showFeedback(servicesAdminFeedback, `Servicio "${svc.name}" eliminado.`, 'success');
                await loadServicesAdminUI();
            } else {
                showFeedback(servicesAdminFeedback, 'Eliminación cancelada.', '', 3000);
            }
        } catch (error) {
            showFeedback(servicesAdminFeedback, `Error al eliminar: ${error.message}`, 'error');
        }
    }

    function handleAddNewService() {
        if (servicesAdminListContainer.querySelector('.new-service-item') || servicesAdminListContainer.querySelector('.editing')) { showFeedback(servicesAdminFeedback, 'Guarda o cancela edición actual.', 'error'); return; }
        if (addNewServiceButton) addNewServiceButton.disabled = true;
        const icons = suggestedIcons.map(i => `<option value="${i.value}">${i.text}</option>`).join('');
        const el = document.createElement('div'); el.classList.add('service-admin-item', 'new-service-item', 'editing');
        el.innerHTML = `
            <div class="service-details-edit">
                 <div class="form-group"> <label for="new-name">Nombre:</label> <input type="text" id="new-name" placeholder="Ej: Corte Premium" required> </div>
                 <div class="form-group inline"> <label for="new-icon">Icono:</label> <select id="new-icon" class="service-icon-select">${icons}</select> </div>
                 <div class="form-group inline"> <label for="new-duration">Duración (min):</label> <input type="number" id="new-duration" value="45" min="${SLOT_INTERVAL_MINUTES}" step="${SLOT_INTERVAL_MINUTES}" required> </div>
                 <div class="form-group inline"> <label for="new-price">Precio ($):</label> <input type="number" id="new-price" value="20000" min="0" step="500" required> </div>
                 <div class="form-group inline checkbox"> <input type="checkbox" id="new-active" checked> <label for="new-active">Activo</label> </div>
            </div>
            <div class="service-actions edit-mode"> <button type="button" class="admin-button success save-new-btn">Guardar Nuevo</button> <button type="button" class="admin-button cancel-new-btn">Cancelar</button> </div>`;
        servicesAdminListContainer.prepend(el); el.querySelector('#new-name').focus();
        el.querySelector('.save-new-btn').addEventListener('click', handleSaveNewService);
        el.querySelector('.cancel-new-btn').addEventListener('click', handleCancelNewService);
    }

    async function handleSaveNewService() {
        const el = servicesAdminListContainer.querySelector('.new-service-item'); if (!el) return;
        const nameIn = el.querySelector(`#new-name`); const iconSel = el.querySelector(`#new-icon`); const durIn = el.querySelector(`#new-duration`); const priceIn = el.querySelector(`#new-price`); const activeIn = el.querySelector(`#new-active`);
        let ok = true; let errs = []; const name = nameIn.value.trim(); const icon = iconSel.value; const dur = parseInt(durIn.value, 10); const price = parseInt(priceIn.value, 10); const active = activeIn.checked;
        if (!name) { ok = false; errs.push("Nombre vacío."); nameIn.style.borderColor = 'var(--error-alt-color)'; } else { nameIn.style.borderColor = ''; }
        if (isNaN(dur) || dur <= 0 || dur % SLOT_INTERVAL_MINUTES !== 0) { ok = false; errs.push(`Duración múltiplo de ${SLOT_INTERVAL_MINUTES}.`); durIn.style.borderColor = 'var(--error-alt-color)'; } else { durIn.style.borderColor = ''; }
        if (isNaN(price) || price < 0) { ok = false; errs.push("Precio inválido."); priceIn.style.borderColor = 'var(--error-alt-color)'; } else { priceIn.style.borderColor = ''; }
        if (!ok) { showFeedback(servicesAdminFeedback, `Error: ${errs.join(' ')}`, 'error', 5000); return; }

        const newServiceId = generateUniqueId('svc_'); // Or use Firebase push().key for auto-generated keys
        const newSvc = { id: newServiceId, name, icon, duration: dur, price, active };
        const newServicePath = `${SERVICES_PATH}/${newServiceId}`;

        try {
            await saveDataFirebase(newServicePath, newSvc);
            showFeedback(servicesAdminFeedback, `Nuevo servicio "${name}" añadido.`, 'success');
        } catch (error) {
            showFeedback(servicesAdminFeedback, `Error al añadir: ${error.message}`, 'error');
        } finally {
            if (addNewServiceButton) addNewServiceButton.disabled = false;
            await loadServicesAdminUI();
        }
    }

    async function handleCancelNewService() {
        const el = servicesAdminListContainer.querySelector('.new-service-item'); if (el) el.remove();
        if (addNewServiceButton) addNewServiceButton.disabled = false;
        showFeedback(servicesAdminFeedback, 'Añadir cancelado.', '', 3000);
    }


    // --- Inicialización y Event Listeners ---
    function initializeAdminPanel() {
        if (loginForm) loginForm.addEventListener('submit', handleLogin);
        if (logoutButton) logoutButton.addEventListener('click', handleLogout);
        tabButtons.forEach(button => button.addEventListener('click', handleTabClick));
        if (standardScheduleForm) standardScheduleForm.addEventListener('submit', handleSaveStandardSchedule);
        if (addNewServiceButton) addNewServiceButton.addEventListener('click', handleAddNewService);
        // onAuthStateChanged handles the initial check, so no explicit call to checkLoginStatus() needed.
    }

    // --- Go! ---
    // Ensure Firebase services are loaded before initializing the panel
    if (window.firebaseServices) {
        initializeAdminPanel();
    } else {
        // Fallback or error if Firebase SDK didn't load, though it should be available from admin.html
        console.error("Firebase services not available. Admin panel might not work correctly.");
        const loginErrorEl = document.getElementById('login-error');
        if (loginErrorEl) {
            loginErrorEl.textContent = "Error al cargar Firebase. Intenta recargar la página.";
            loginErrorEl.style.display = 'block';
        }
    }

}); // Fin DOMContentLoaded
