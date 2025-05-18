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
    const baseTimeSlots = [ // Horarios base que el administrador puede gestionar
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


    // --- Funciones de Utilidad (Generales) ---
    function formatDateDMY(dateStringYMD) { if (!dateStringYMD || !/^\d{4}-\d{2}-\d{2}$/.test(dateStringYMD)) return dateStringYMD; try { const [year, month, day] = dateStringYMD.split('-'); return `${day}/${month}/${year}`; } catch (e) { console.warn("Could not format date:", dateStringYMD, e); return dateStringYMD; } }
    function showFeedback(element, message, type = 'success', duration = 3500) { if (!element) return; element.textContent = message; element.className = `feedback-message ${type}`; element.style.display = (type === 'clear' || !message) ? 'none' : 'inline-flex'; if (duration > 0 && type !== 'clear') { setTimeout(() => { if (element.textContent === message) { element.textContent = ''; element.className = 'feedback-message'; element.style.display = 'none'; } }, duration); } else if (type === 'clear') { element.textContent = ''; element.className = 'feedback-message'; element.style.display = 'none'; } }
    function timeToMinutes(timeStr) { if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null; try { const [hours, minutes] = timeStr.split(':').map(Number); if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null; return hours * 60 + minutes; } catch (e) { console.warn("Could not convert time to minutes:", timeStr, e); return null; } }
    function minutesToTime(totalMinutes) { if (totalMinutes === null || totalMinutes < 0 || isNaN(totalMinutes)) return null; const h = Math.floor(totalMinutes / 60) % 24; const m = totalMinutes % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
    function generateUniqueId(prefix = 'item_') { return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 9); }
    function formatPriceAdmin(value) { const number = Number(value); if (isNaN(number) || value === null || value === undefined || number < 0) return '0'; return number.toString(); }
    function formatPriceDisplay(value) { const number = Number(value); if (isNaN(number) || number <= 0) return 'Gratis'; return `$${number.toLocaleString('es-CL')}`; }
    function formatDuration(minutes) { if (isNaN(minutes) || minutes <= 0) return 'N/A'; return `${minutes} min`; }


    // --- Lógica de Autenticación con Firebase ---
    function handleLogin(event) {
        event.preventDefault();
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        if (!emailInput || !passwordInput) return;

        const email = emailInput.value;
        const password = passwordInput.value;

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                console.log("Admin logged in:", user.uid);
                if (loginError) loginError.style.display = 'none';
                if (loginForm) loginForm.reset();
                // showAdminPanel() es llamado por onAuthStateChanged
            })
            .catch((error) => {
                console.error("Login failed:", error.code, error.message);
                if (loginError) {
                    loginError.textContent = "Correo o contraseña incorrectos. Intenta de nuevo.";
                    loginError.style.display = 'block';
                }
            });
    }

    function handleLogout() {
        signOut(auth).then(() => {
            console.log("Admin logged out");
            // showLoginSection() es llamado por onAuthStateChanged
        }).catch((error) => {
            console.error("Logout failed:", error);
            showFeedback(appointmentsFeedback, `Error al cerrar sesión: ${error.message}`, 'error');
        });
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Auth state changed: User signed in", user.uid);
            showAdminPanel();
        } else {
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
        // Limpiar contenido dinámico para evitar mostrar datos antiguos brevemente al re-loguear
        if (appointmentsListContainer) appointmentsListContainer.innerHTML = '';
        if (weeklyScheduleContainer) weeklyScheduleContainer.innerHTML = '';
        if (availabilityTimeSlotsContainer) availabilityTimeSlotsContainer.innerHTML = '<p class="placeholder">Selecciona una fecha para ver y modificar los horarios.</p>';
        if (servicesAdminListContainer) servicesAdminListContainer.innerHTML = '';
        if (availabilityDateInput) availabilityDateInput.value = '';
        [appointmentsFeedback, scheduleSaveFeedback, servicesAdminFeedback].forEach(el => showFeedback(el, '', 'clear'));
    }

    // --- Carga Inicial de Datos del Panel ---
    async function loadInitialData() {
        // Limpiar mensajes de feedback al cargar cualquier pestaña o al iniciar.
        [appointmentsFeedback, scheduleSaveFeedback, servicesAdminFeedback].forEach(el => showFeedback(el, '', 'clear'));

        // Cargar datos para la pestaña activa o la primera por defecto
        const activeTabButton = document.querySelector('.tab-button.active');
        let initialTabId = 'appointments'; // Default tab
        if (activeTabButton) {
            initialTabId = activeTabButton.dataset.tab;
        } else if (tabButtons.length > 0) {
            initialTabId = tabButtons[0].dataset.tab;
            tabButtons[0].classList.add('active'); // Activa la primera si ninguna lo está
        }

        tabContents.forEach(content => content.classList.remove('active'));
        const targetContent = document.getElementById(`${initialTabId}-tab`);
        if (targetContent) targetContent.classList.add('active');


        // Cargar datos comunes o necesarios para todas las pestañas si los hubiera
        // Cargar datos específicos de la pestaña inicial
        switch (initialTabId) {
            case 'appointments':
                if (appointmentsListContainer) await loadAppointments();
                break;
            case 'standard-schedule':
                if (weeklyScheduleContainer) await loadStandardScheduleUI();
                break;
            case 'availability':
                if (availabilityDateInput) await setupAvailabilityCalendar();
                break;
            case 'services':
                if (servicesAdminListContainer) await loadServicesAdminUI();
                break;
        }
        // Cargar el resto en segundo plano o bajo demanda para mejorar la percepción de velocidad inicial
        if (initialTabId !== 'appointments' && appointmentsListContainer) await loadAppointments();
        if (initialTabId !== 'standard-schedule' && weeklyScheduleContainer) await loadStandardScheduleUI();
        if (initialTabId !== 'availability' && availabilityDateInput) await setupAvailabilityCalendar();
        if (initialTabId !== 'services' && servicesAdminListContainer) await loadServicesAdminUI();
    }


    // --- Lógica de Pestañas (Tabs) ---
    function handleTabClick(event) {
        if (!event || !event.currentTarget || !event.currentTarget.dataset.tab) return;
        const clickedTab = event.currentTarget; const targetTabId = clickedTab.dataset.tab;
        if (clickedTab.classList.contains('active')) return; // Ya está activa

        tabContents.forEach(content => content.classList.remove('active'));
        tabButtons.forEach(button => button.classList.remove('active'));

        const targetContent = document.getElementById(`${targetTabId}-tab`);
        if (targetContent) targetContent.classList.add('active');
        clickedTab.classList.add('active');

        // Limpiar mensajes de feedback al cambiar de pestaña
        [appointmentsFeedback, scheduleSaveFeedback, servicesAdminFeedback].forEach(el => showFeedback(el, '', 'clear'));

        // Opcional: Cargar datos específicos de la pestaña si no se cargaron inicialmente
        // (ya se cargan todos en loadInitialData, pero podría ser más selectivo aquí)
        // switch (targetTabId) {
        //     case 'appointments': if (!appointmentsListContainer.hasChildNodes() || appointmentsListContainer.querySelector('.placeholder')) await loadAppointments(); break;
        //     // ... y así para otras pestañas si fuera necesario
        // }
    }

    // --- Lógica de Citas (Appointments) ---
    async function loadAppointments() {
        if (!appointmentsListContainer) return;
        appointmentsListContainer.innerHTML = '<p class="placeholder">Cargando citas...</p>';
        const appointmentsData = await loadDataFirebase(APPOINTMENTS_PATH, {});
        const allServicesData = await loadDataFirebase(SERVICES_PATH, {});

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
                    const action = newStatus === 'confirmed' ? 'confirmada' : (newStatus === 'rejected' ? 'rechazada' : newStatus);
                    showFeedback(appointmentsFeedback, `Cita de ${appt.name || '?'} ${action}.`, newStatus === 'confirmed' ? 'success' : 'error', 5000);
                    await loadAppointments(); // Recargar lista de citas
                    // Si la pestaña de disponibilidad está activa y es la fecha afectada, recargarla
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
            showFeedback(appointmentsFeedback, `Error actualizando estado: ${error.message}`, 'error', 5000);
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
            const confirmText = `¿Seguro ELIMINAR cita de ${appt.name || '?'} (${formatDateDMY(appt.date)} ${appt.time || 'N/A'})?\n\n¡Esta acción NO SE PUEDE DESHACER!`;

            if (window.confirm(confirmText)) {
                await removeDataFirebase(appointmentPath);
                showFeedback(appointmentsFeedback, `Cita de ${appt.name || '?'} eliminada permanentemente.`, 'success', 5000);
                await loadAppointments(); // Recargar lista de citas
                // Si la pestaña de disponibilidad está activa y es la fecha afectada, recargarla
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
            showFeedback(appointmentsFeedback, `Error al eliminar cita: ${error.message}`, 'error', 5000);
        }
    }


    // --- Lógica Horario Estándar ---
    async function loadStandardScheduleUI() {
        if (!weeklyScheduleContainer) return;
        weeklyScheduleContainer.innerHTML = '<p class="placeholder">Cargando configuración del horario estándar...</p>';
        const schedule = await loadDataFirebase(STANDARD_SCHEDULE_PATH, {});

        weeklyScheduleContainer.innerHTML = ''; // Limpiar placeholder
        daysOfWeekSpanish.forEach((dayName, i) => {
            const dayIndexStr = String(i); // Firebase keys son strings
            // Valores por defecto: Domingo cerrado, resto abierto mañana y tarde.
            const def = {
                open: i !== 0, // Domingo (0) cerrado por defecto
                morningOpen: i !== 0,
                morningStart: '09:00',
                morningEnd: '14:00',
                afternoonOpen: i !== 0,
                afternoonStart: '15:00',
                afternoonEnd: '18:00'
            };
            const saved = schedule[dayIndexStr] || {};
            // Aplicar valores guardados sobre los por defecto.
            // Si saved.open es undefined, usa def.open. Si saved.morningOpen es undefined, usa (saved.open si existe, sino def.morningOpen)
            const daySettings = {
                open: saved.open !== undefined ? saved.open : def.open,
                morningOpen: saved.morningOpen !== undefined ? saved.morningOpen : (saved.open !== undefined ? saved.open : def.morningOpen),
                morningStart: saved.morningStart || def.morningStart,
                morningEnd: saved.morningEnd || def.morningEnd,
                afternoonOpen: saved.afternoonOpen !== undefined ? saved.afternoonOpen : (saved.open !== undefined ? saved.open : def.afternoonOpen),
                afternoonStart: saved.afternoonStart || def.afternoonStart,
                afternoonEnd: saved.afternoonEnd || def.afternoonEnd
            };

            const fieldsetElement = document.createElement('fieldset');
            fieldsetElement.classList.add('daily-schedule-group');
            const openId = `day-open-${i}`, morningOpenId = `morning-open-${i}`, morningStartId = `morning-start-${i}`, morningEndId = `morning-end-${i}`,
                  afternoonOpenId = `afternoon-open-${i}`, afternoonStartId = `afternoon-start-${i}`, afternoonEndId = `afternoon-end-${i}`;

            fieldsetElement.innerHTML = `
                <legend>${dayName}</legend>
                <div class="day-controls">
                    <label class="day-open-toggle" for="${openId}">
                        <input type="checkbox" id="${openId}" name="day_open_${i}" ${daySettings.open ? 'checked' : ''}> Abierto todo el día
                    </label>
                    <div class="time-range-inputs">
                        <div class="time-input-group">
                            <label class="period-toggle-label" for="${morningOpenId}">
                                <input type="checkbox" id="${morningOpenId}" name="morning_open_${i}" ${daySettings.morningOpen ? 'checked' : ''}> Mañana
                            </label>
                            <div class="time-input-group-controls">
                                <input type="time" id="${morningStartId}" name="morning_start_${i}" value="${daySettings.morningStart}" step="1800">
                                <span>-</span>
                                <input type="time" id="${morningEndId}" name="morning_end_${i}" value="${daySettings.morningEnd}" step="1800">
                            </div>
                        </div>
                        <div class="time-input-group">
                            <label class="period-toggle-label" for="${afternoonOpenId}">
                                <input type="checkbox" id="${afternoonOpenId}" name="afternoon_open_${i}" ${daySettings.afternoonOpen ? 'checked' : ''}> Tarde
                            </label>
                            <div class="time-input-group-controls">
                                <input type="time" id="${afternoonStartId}" name="afternoon_start_${i}" value="${daySettings.afternoonStart}" step="1800">
                                <span>-</span>
                                <input type="time" id="${afternoonEndId}" name="afternoon_end_${i}" value="${daySettings.afternoonEnd}" step="1800">
                            </div>
                        </div>
                    </div>
                </div>`;
            weeklyScheduleContainer.appendChild(fieldsetElement);
        });
    }

    async function handleSaveStandardSchedule(event) {
        event.preventDefault();
        if (!standardScheduleForm || !scheduleSaveFeedback) return;
        showFeedback(scheduleSaveFeedback, 'Guardando...', 'success', 0); // Indicar proceso

        const newSchedule = {};
        let formIsValid = true;
        let firstErrorElement = null;
        let errorMessage = '';

        for (let i = 0; i < 7; i++) {
            const dayNameStr = daysOfWeekSpanish[i];
            const isOpen = standardScheduleForm.querySelector(`input[name="day_open_${i}"]`)?.checked ?? false;
            const isMorningOpen = standardScheduleForm.querySelector(`input[name="morning_open_${i}"]`)?.checked ?? false;
            const isAfternoonOpen = standardScheduleForm.querySelector(`input[name="afternoon_open_${i}"]`)?.checked ?? false;
            const morningStartTime = standardScheduleForm.querySelector(`input[name="morning_start_${i}"]`)?.value || null;
            const morningEndTime = standardScheduleForm.querySelector(`input[name="morning_end_${i}"]`)?.value || null;
            const afternoonStartTime = standardScheduleForm.querySelector(`input[name="afternoon_start_${i}"]`)?.value || null;
            const afternoonEndTime = standardScheduleForm.querySelector(`input[name="afternoon_end_${i}"]`)?.value || null;

            newSchedule[i] = {
                open: isOpen,
                morningOpen: isOpen && isMorningOpen, // Solo puede estar abierto si el día está abierto
                morningStart: morningStartTime,
                morningEnd: morningEndTime,
                afternoonOpen: isOpen && isAfternoonOpen, // Solo puede estar abierto si el día está abierto
                afternoonStart: afternoonStartTime,
                afternoonEnd: afternoonEndTime
            };

            if (isOpen) { // Validaciones solo si el día está marcado como abierto
                if (!isMorningOpen && !isAfternoonOpen) {
                    formIsValid = false; errorMessage = `${dayNameStr}: Debe habilitar al menos un período (Mañana o Tarde) si el día está abierto.`;
                    firstErrorElement = standardScheduleForm.querySelector(`input[name="morning_open_${i}"]`); break;
                }
                if (isMorningOpen) {
                    if (!morningStartTime || !morningEndTime) {
                        formIsValid = false; errorMessage = `${dayNameStr} (Mañana): Debe definir hora de inicio y fin.`;
                        firstErrorElement = standardScheduleForm.querySelector(`input[name="morning_start_${i}"]`); break;
                    }
                    if (timeToMinutes(morningEndTime) <= timeToMinutes(morningStartTime)) {
                        formIsValid = false; errorMessage = `${dayNameStr} (Mañana): La hora de fin debe ser posterior a la de inicio.`;
                        firstErrorElement = standardScheduleForm.querySelector(`input[name="morning_end_${i}"]`); break;
                    }
                }
                if (isAfternoonOpen) {
                    if (!afternoonStartTime || !afternoonEndTime) {
                        formIsValid = false; errorMessage = `${dayNameStr} (Tarde): Debe definir hora de inicio y fin.`;
                        firstErrorElement = standardScheduleForm.querySelector(`input[name="afternoon_start_${i}"]`); break;
                    }
                    if (timeToMinutes(afternoonEndTime) <= timeToMinutes(afternoonStartTime)) {
                        formIsValid = false; errorMessage = `${dayNameStr} (Tarde): La hora de fin debe ser posterior a la de inicio.`;
                        firstErrorElement = standardScheduleForm.querySelector(`input[name="afternoon_end_${i}"]`); break;
                    }
                }
                if (isMorningOpen && isAfternoonOpen && morningEndTime && afternoonStartTime) {
                    if (timeToMinutes(afternoonStartTime) < timeToMinutes(morningEndTime)) {
                        formIsValid = false; errorMessage = `${dayNameStr}: El inicio del período de tarde no puede ser anterior al fin del período de mañana.`;
                        firstErrorElement = standardScheduleForm.querySelector(`input[name="afternoon_start_${i}"]`); break;
                    }
                }
            }
        } // Fin del bucle for

        if (formIsValid) {
            try {
                await saveDataFirebase(STANDARD_SCHEDULE_PATH, newSchedule);
                showFeedback(scheduleSaveFeedback, 'Horario estándar guardado exitosamente en Firebase.', 'success');
                // **MEJORA**: Si la pestaña de excepciones está activa, recargar la disponibilidad
                const availTabActive = document.getElementById('availability-tab')?.classList.contains('active');
                const currentAvailDate = availabilityDateInput?.value;
                if (availTabActive && currentAvailDate) {
                    await loadAvailabilityForDate(currentAvailDate);
                }
            } catch (error) {
                showFeedback(scheduleSaveFeedback, `Error al guardar el horario: ${error.message}`, 'error', 6000);
            }
        } else {
            showFeedback(scheduleSaveFeedback, errorMessage || 'Hay errores en el formulario del horario.', 'error', 6000);
            if (firstErrorElement) {
                firstErrorElement.focus();
                firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    // --- Lógica de Excepciones/Disponibilidad (Admin View) ---
    async function setupAvailabilityCalendar() {
        if (!availabilityDateInput) return;
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        availabilityDateInput.min = todayStr; // No se pueden seleccionar fechas pasadas

        const currentVal = availabilityDateInput.value;
        if (currentVal && currentVal >= todayStr) {
            await loadAvailabilityForDate(currentVal);
        } else {
            availabilityDateInput.value = todayStr; // Seleccionar hoy por defecto
            await loadAvailabilityForDate(todayStr);
        }

        availabilityDateInput.addEventListener('change', async (e) => {
            const selectedDate = e.target.value;
            if (selectedDate && selectedDate >= todayStr) {
                await loadAvailabilityForDate(selectedDate);
            } else if (selectedDate < todayStr) {
                if (availabilityTimeSlotsContainer) { availabilityTimeSlotsContainer.innerHTML = '<p class="placeholder">No se pueden modificar fechas pasadas.</p>'; }
                availabilityDateInput.value = todayStr; // Revertir a hoy si se selecciona una fecha pasada inválida
                await loadAvailabilityForDate(todayStr);
            } else {
                 if (availabilityTimeSlotsContainer) { availabilityTimeSlotsContainer.innerHTML = '<p class="placeholder">Selecciona una fecha válida (hoy o futura).</p>'; }
            }
        });
    }

    async function loadAvailabilityForDate(dateString) {
        if (!availabilityTimeSlotsContainer) return;
        availabilityTimeSlotsContainer.innerHTML = '<p class="placeholder">Cargando disponibilidad para el ' + formatDateDMY(dateString) + '...</p>';

        if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            availabilityTimeSlotsContainer.innerHTML = '<p class="placeholder">Formato de fecha inválido.</p>';
            return;
        }

        const selectedDateObj = new Date(`${dateString}T00:00:00`); // Asegurar que es a medianoche local
        const dayOfWeek = selectedDateObj.getDay();

        // Cargar todos los datos necesarios en paralelo
        const [scheduleData, exceptionsData, apptsData, servicesData] = await Promise.all([
            loadDataFirebase(STANDARD_SCHEDULE_PATH, {}),
            loadDataFirebase(BLOCKED_SLOTS_PATH, {}),
            loadDataFirebase(APPOINTMENTS_PATH, {}),
            loadDataFirebase(SERVICES_PATH, {})
        ]);

        const dayStandardSettings = scheduleData[dayOfWeek] || { open: false, morningOpen: false, afternoonOpen: false };
        const explicitlyBlockedSlots = (exceptionsData && exceptionsData[dateString]) ? exceptionsData[dateString] : []; // Firebase guarda arrays directamente si existen
        const allAppointmentsArray = apptsData ? Object.values(apptsData) : [];
        const allServicesArray = servicesData ? Object.values(servicesData) : [];

        const appointmentsOnSelectedDate = allAppointmentsArray
            .filter(appt => appt.date === dateString && (appt.status === 'confirmed' || appt.status === 'pending'))
            .map(appt => {
                const serviceDetails = allServicesArray.find(s => s.id === appt.serviceId);
                const duration = serviceDetails ? (serviceDetails.duration || 60) : 60; // Default a 60 min si no se encuentra
                return { time: appt.time, duration: duration };
            })
            .filter(appt => appt.time); // Asegurar que la cita tiene hora

        availabilityTimeSlotsContainer.innerHTML = ''; // Limpiar placeholder/contenido anterior
        let hasAnySlotsToShow = false;

        baseTimeSlots.forEach(slotTime => {
            hasAnySlotsToShow = true;
            const slotTimeInMinutes = timeToMinutes(slotTime);
            if (slotTimeInMinutes === null) return; // Skip si el formato de slotTime es inválido

            let isBooked = false;
            let bookingReason = "";
            for (const bookedAppt of appointmentsOnSelectedDate) {
                const bookedStartTimeInMinutes = timeToMinutes(bookedAppt.time);
                if (bookedStartTimeInMinutes === null) continue;
                const bookedEndTimeInMinutes = bookedStartTimeInMinutes + bookedAppt.duration;
                // Un slot base está "ocupado" si su inicio cae dentro de una cita existente.
                if (slotTimeInMinutes >= bookedStartTimeInMinutes && slotTimeInMinutes < bookedEndTimeInMinutes) {
                    isBooked = true;
                    bookingReason = (slotTimeInMinutes === bookedStartTimeInMinutes) ? '(Inicio Cita)' : '(Continuación Cita)';
                    break;
                }
            }

            const isExplicitlyBlocked = explicitlyBlockedSlots.includes(slotTime);

            let isOpenByStandardSchedule = false;
            if (dayStandardSettings.open) {
                const morningStartTimeMin = timeToMinutes(dayStandardSettings.morningStart);
                const morningEndTimeMin = timeToMinutes(dayStandardSettings.morningEnd);
                const afternoonStartTimeMin = timeToMinutes(dayStandardSettings.afternoonStart);
                const afternoonEndTimeMin = timeToMinutes(dayStandardSettings.afternoonEnd);

                const isInMorningPeriod = (dayStandardSettings.morningOpen && morningStartTimeMin !== null && morningEndTimeMin !== null &&
                                           slotTimeInMinutes >= morningStartTimeMin && slotTimeInMinutes < morningEndTimeMin);
                const isInAfternoonPeriod = (dayStandardSettings.afternoonOpen && afternoonStartTimeMin !== null && afternoonEndTimeMin !== null &&
                                             slotTimeInMinutes >= afternoonStartTimeMin && slotTimeInMinutes < afternoonEndTimeMin);
                if (isInMorningPeriod || isInAfternoonPeriod) {
                    isOpenByStandardSchedule = true;
                }
            }

            let slotStatusClass = 'blocked'; // Por defecto, un slot está bloqueado (cerrado)
            let isDisabledByBooking = false;
            let slotTitle = `Horario ${slotTime}`;

            if (isBooked) {
                slotStatusClass = 'blocked'; // Mantener 'blocked' visualmente, pero deshabilitado
                isDisabledByBooking = true;
                slotTitle += ` ${bookingReason}`;
            } else if (isExplicitlyBlocked) {
                slotStatusClass = 'blocked'; // Bloqueado manualmente, no deshabilitado para permitir desbloqueo
                slotTitle += ' (Bloqueado Manualmente)';
            } else if (isOpenByStandardSchedule) {
                slotStatusClass = 'available'; // Disponible según horario estándar
                slotTitle += ' (Disponible por Horario)';
            } else {
                // Si no está reservado, ni bloqueado explícitamente, ni abierto por horario estándar,
                // entonces está cerrado por horario estándar.
                slotStatusClass = 'blocked';
                slotTitle += ' (Cerrado por Horario Estándar)';
            }

            const slotButton = document.createElement('button');
            slotButton.type = 'button';
            slotButton.classList.add('availability-slot', slotStatusClass);
            slotButton.textContent = slotTime;
            slotButton.dataset.time = slotTime;
            slotButton.dataset.date = dateString; // Guardar la fecha en el botón
            slotButton.disabled = isDisabledByBooking; // Solo las citas deshabilitan el botón
            slotButton.title = slotTitle;
            slotButton.setAttribute('aria-label', slotTitle);
            slotButton.setAttribute('aria-pressed', slotStatusClass === 'blocked' && !isDisabledByBooking); // Para accesibilidad

            if (!isDisabledByBooking) { // Si no está deshabilitado por una reserva, se puede clickear
                slotButton.addEventListener('click', toggleSlotException);
            }
            availabilityTimeSlotsContainer.appendChild(slotButton);
        });

        if (!hasAnySlotsToShow) {
            availabilityTimeSlotsContainer.innerHTML = '<p class="placeholder">No hay horarios base definidos para operar.</p>';
        }
    }


    async function toggleSlotException(event) {
        const clickedButton = event.currentTarget;
        const dateToModify = clickedButton.dataset.date;
        const timeToToggle = clickedButton.dataset.time;

        if (!dateToModify || !timeToToggle) {
            console.error("Error: Fecha u hora no definidas en el botón de slot.");
            showFeedback(servicesAdminFeedback, "Error interno al procesar el slot.", 'error'); // Usar un feedback más genérico o específico de la pestaña
            return;
        }

        const exceptionsPathForDate = `${BLOCKED_SLOTS_PATH}/${dateToModify}`;
        try {
            const snapshot = await get(child(ref(database), exceptionsPathForDate));
            let currentDayExceptionsArray = snapshot.exists() ? snapshot.val() : [];
            if (!Array.isArray(currentDayExceptionsArray)) { // Asegurar que es un array
                currentDayExceptionsArray = [];
            }

            const isCurrentlyBlocked = currentDayExceptionsArray.includes(timeToToggle);

            if (isCurrentlyBlocked) { // Si está bloqueado, se desbloquea (elimina de la lista)
                currentDayExceptionsArray = currentDayExceptionsArray.filter(t => t !== timeToToggle);
                console.log(`Excepción ELIMINADA (slot desbloqueado): ${dateToModify} ${timeToToggle}`);
            } else { // Si no está bloqueado (o sea, estaba 'available' o 'cerrado por horario'), se bloquea (añade a la lista)
                if (!currentDayExceptionsArray.includes(timeToToggle)) {
                    currentDayExceptionsArray.push(timeToToggle);
                    currentDayExceptionsArray.sort(); // Mantener ordenado (opcional, pero bueno para consistencia)
                }
                console.log(`Excepción AÑADIDA (slot bloqueado): ${dateToModify} ${timeToToggle}`);
            }

            // Guardar en Firebase
            if (currentDayExceptionsArray.length === 0) {
                // Si no quedan excepciones para este día, eliminar el nodo completo de la fecha para limpiar la BD
                await removeDataFirebase(exceptionsPathForDate);
            } else {
                await saveDataFirebase(exceptionsPathForDate, currentDayExceptionsArray);
            }

            // Recargar la UI de disponibilidad para la fecha modificada
            await loadAvailabilityForDate(dateToModify);
            showFeedback(scheduleSaveFeedback, `Disponibilidad para ${timeToToggle} el ${formatDateDMY(dateToModify)} actualizada.`, 'success', 3000);


        } catch (error) {
            console.error("Error al modificar la excepción del slot:", error);
            showFeedback(scheduleSaveFeedback, `Error al modificar bloqueo: ${error.message}`, 'error');
        }
    }


    // --- Lógica de Gestión de Servicios (Admin) ---
    async function loadServicesAdminUI() {
        if (!servicesAdminListContainer || !servicesAdminFeedback) return;
        servicesAdminListContainer.innerHTML = '<p class="placeholder">Cargando servicios...</p>';
        showFeedback(servicesAdminFeedback, '', 'clear');

        const servicesData = await loadDataFirebase(SERVICES_PATH, {});
        const services = servicesData ? Object.values(servicesData) : [];

        servicesAdminListContainer.innerHTML = '';
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
        const serviceItemElement = servicesAdminListContainer.querySelector(`.service-admin-item[data-id="${id}"]`);
        if (!serviceItemElement || serviceItemElement.classList.contains('editing')) return;

        const currentlyEditing = servicesAdminListContainer.querySelector('.service-admin-item.editing');
        if (currentlyEditing) {
            showFeedback(servicesAdminFeedback, 'Por favor, termina o cancela la edición actual antes de editar otro servicio.', 'error', 4000);
            return;
        }
        if (addNewServiceButton) addNewServiceButton.disabled = true; // Deshabilitar "Añadir Nuevo" mientras se edita

        const servicePath = `${SERVICES_PATH}/${id}`;
        const snapshot = await get(child(ref(database), servicePath));
        if (!snapshot.exists()) {
            showFeedback(servicesAdminFeedback, 'Error: Servicio no encontrado para editar.', 'error');
            if (addNewServiceButton) addNewServiceButton.disabled = false;
            return;
        }
        const service = snapshot.val();

        const iconOptionsHTML = suggestedIcons.map(icon => `<option value="${icon.value}" ${service.icon === icon.value ? 'selected' : ''}>${icon.text}</option>`).join('');
        serviceItemElement.classList.add('editing');
        serviceItemElement.innerHTML = `
            <div class="service-details-edit">
                <div class="form-group"> <label for="edit-name-${id}">Nombre:</label> <input type="text" id="edit-name-${id}" value="${service.name || ''}" required> </div>
                <div class="form-group inline"> <label for="edit-icon-${id}">Icono:</label> <select id="edit-icon-${id}" class="service-icon-select">${iconOptionsHTML}</select> </div>
                <div class="form-group inline"> <label for="edit-duration-${id}">Duración (min):</label> <input type="number" id="edit-duration-${id}" value="${formatPriceAdmin(service.duration)}" min="${SLOT_INTERVAL_MINUTES}" step="${SLOT_INTERVAL_MINUTES}" required> </div>
                <div class="form-group inline"> <label for="edit-price-${id}">Precio ($):</label> <input type="number" id="edit-price-${id}" value="${formatPriceAdmin(service.price)}" min="0" step="500" required> </div>
                <div class="form-group inline checkbox"> <input type="checkbox" id="edit-active-${id}" ${service.active ? 'checked' : ''}> <label for="edit-active-${id}">Servicio Activo</label> </div>
            </div>
            <div class="service-actions edit-mode">
                <button type="button" class="admin-button success save-edit-btn" data-id="${id}">Guardar Cambios</button>
                <button type="button" class="admin-button cancel-edit-btn" data-id="${id}">Cancelar Edición</button>
            </div>`;
        serviceItemElement.querySelector('.save-edit-btn').addEventListener('click', (e) => handleSaveService(e.currentTarget.dataset.id));
        serviceItemElement.querySelector('.cancel-edit-btn').addEventListener('click', handleCancelEdit); // No necesita ID, solo recarga UI
        const nameInputForFocus = serviceItemElement.querySelector(`#edit-name-${id}`);
        if (nameInputForFocus) nameInputForFocus.focus();
    }

    async function handleSaveService(id) {
        const serviceItemElement = servicesAdminListContainer.querySelector(`.service-admin-item[data-id="${id}"]`);
        if (!serviceItemElement) return;

        const nameInput = serviceItemElement.querySelector(`#edit-name-${id}`);
        const iconSelect = serviceItemElement.querySelector(`#edit-icon-${id}`);
        const durationInput = serviceItemElement.querySelector(`#edit-duration-${id}`);
        const priceInput = serviceItemElement.querySelector(`#edit-price-${id}`);
        const activeCheckbox = serviceItemElement.querySelector(`#edit-active-${id}`);

        let isValid = true; let errorMessages = [];
        const serviceName = nameInput.value.trim();
        const serviceIcon = iconSelect.value;
        const serviceDuration = parseInt(durationInput.value, 10);
        const servicePrice = parseInt(priceInput.value, 10);
        const isActive = activeCheckbox.checked;

        if (!serviceName) { isValid = false; errorMessages.push("El nombre del servicio no puede estar vacío."); nameInput.style.borderColor = 'var(--error-alt-color)'; } else { nameInput.style.borderColor = ''; }
        if (isNaN(serviceDuration) || serviceDuration <= 0 || serviceDuration % SLOT_INTERVAL_MINUTES !== 0) { isValid = false; errorMessages.push(`La duración debe ser un número positivo múltiplo de ${SLOT_INTERVAL_MINUTES}.`); durationInput.style.borderColor = 'var(--error-alt-color)'; } else { durationInput.style.borderColor = ''; }
        if (isNaN(servicePrice) || servicePrice < 0) { isValid = false; errorMessages.push("El precio debe ser un número positivo o cero."); priceInput.style.borderColor = 'var(--error-alt-color)'; } else { priceInput.style.borderColor = ''; }

        if (!isValid) {
            showFeedback(servicesAdminFeedback, `Error en el formulario: ${errorMessages.join(' ')}`, 'error', 5000);
            return;
        }

        const servicePath = `${SERVICES_PATH}/${id}`;
        // Asegurarse que el ID original se mantiene en el objeto guardado
        const updatedServiceData = { id: id, name: serviceName, icon: serviceIcon, duration: serviceDuration, price: servicePrice, active: isActive };

        try {
            await saveDataFirebase(servicePath, updatedServiceData); // Usar saveDataFirebase para sobrescribir el objeto completo en esa ruta
            showFeedback(servicesAdminFeedback, `Servicio "${serviceName}" actualizado correctamente.`, 'success');
        } catch (error) {
            showFeedback(servicesAdminFeedback, `Error al actualizar el servicio: ${error.message}`, 'error');
        } finally {
            if (addNewServiceButton) addNewServiceButton.disabled = false; // Rehabilitar "Añadir Nuevo"
            await loadServicesAdminUI(); // Recargar la lista para mostrar los cambios
        }
    }

    async function handleCancelEdit() {
        if (addNewServiceButton) addNewServiceButton.disabled = false;
        await loadServicesAdminUI(); // Simplemente recarga la lista para descartar el formulario de edición
        showFeedback(servicesAdminFeedback, 'Edición cancelada por el usuario.', '', 3000);
    }

    async function handleToggleActiveService(id) {
        const servicePath = `${SERVICES_PATH}/${id}`;
        try {
            const snapshot = await get(child(ref(database), servicePath));
            if (snapshot.exists()) {
                const service = snapshot.val();
                const newActiveState = !service.active;
                await updateDataFirebase(servicePath, { active: newActiveState });
                showFeedback(servicesAdminFeedback, `Servicio "${service.name}" ahora está ${newActiveState ? 'ACTIVO' : 'INACTIVO'}.`, 'success');
                await loadServicesAdminUI();
            } else {
                showFeedback(servicesAdminFeedback, `Error: Servicio con ID ${id} no encontrado.`, 'error');
            }
        } catch (error) {
            showFeedback(servicesAdminFeedback, `Error al cambiar estado del servicio: ${error.message}`, 'error');
        }
    }

    async function handleDeleteService(id) {
        const servicePath = `${SERVICES_PATH}/${id}`;
        try {
            const snapshot = await get(child(ref(database), servicePath));
            if (!snapshot.exists()) {
                showFeedback(servicesAdminFeedback, `Error: Servicio con ID ${id} no encontrado.`, 'error'); return;
            }
            const service = snapshot.val();
            if (window.confirm(`¿Está seguro de que desea ELIMINAR el servicio "${service.name}"?\n\nEsta acción no se puede deshacer.`)) {
                await removeDataFirebase(servicePath);
                showFeedback(servicesAdminFeedback, `Servicio "${service.name}" eliminado permanentemente.`, 'success');
                await loadServicesAdminUI();
            } else {
                showFeedback(servicesAdminFeedback, 'Eliminación del servicio cancelada.', '', 3000);
            }
        } catch (error) {
            showFeedback(servicesAdminFeedback, `Error al eliminar el servicio: ${error.message}`, 'error');
        }
    }

    function handleAddNewService() {
        // Verificar si ya se está añadiendo o editando un servicio
        if (servicesAdminListContainer.querySelector('.new-service-item') || servicesAdminListContainer.querySelector('.service-admin-item.editing')) {
            showFeedback(servicesAdminFeedback, 'Por favor, guarda o cancela la adición/edición actual antes de añadir un nuevo servicio.', 'error', 4000);
            return;
        }
        if (addNewServiceButton) addNewServiceButton.disabled = true; // Deshabilitar botón mientras se añade

        const iconOptionsHTML = suggestedIcons.map(icon => `<option value="${icon.value}">${icon.text}</option>`).join('');
        const newItemElement = document.createElement('div');
        newItemElement.classList.add('service-admin-item', 'new-service-item', 'editing'); // 'editing' para aplicar estilos de formulario
        newItemElement.innerHTML = `
            <div class="service-details-edit">
                 <div class="form-group"> <label for="new-service-name">Nombre del Servicio:</label> <input type="text" id="new-service-name" placeholder="Ej: Corte Clásico Caballero" required> </div>
                 <div class="form-group inline"> <label for="new-service-icon">Icono:</label> <select id="new-service-icon" class="service-icon-select">${iconOptionsHTML}</select> </div>
                 <div class="form-group inline"> <label for="new-service-duration">Duración (minutos):</label> <input type="number" id="new-service-duration" value="30" min="${SLOT_INTERVAL_MINUTES}" step="${SLOT_INTERVAL_MINUTES}" required> </div>
                 <div class="form-group inline"> <label for="new-service-price">Precio ($):</label> <input type="number" id="new-service-price" value="10000" min="0" step="500" required> </div>
                 <div class="form-group inline checkbox"> <input type="checkbox" id="new-service-active" checked> <label for="new-service-active">Servicio Activo</label> </div>
            </div>
            <div class="service-actions edit-mode">
                <button type="button" class="admin-button success save-new-service-btn">Guardar Nuevo Servicio</button>
                <button type="button" class="admin-button cancel-new-service-btn">Cancelar Adición</button>
            </div>`;
        servicesAdminListContainer.prepend(newItemElement); // Añadir al principio de la lista
        const nameInputForFocus = newItemElement.querySelector('#new-service-name');
        if (nameInputForFocus) nameInputForFocus.focus();

        newItemElement.querySelector('.save-new-service-btn').addEventListener('click', handleSaveNewService);
        newItemElement.querySelector('.cancel-new-service-btn').addEventListener('click', handleCancelNewService);
    }

    async function handleSaveNewService() {
        const newItemElement = servicesAdminListContainer.querySelector('.new-service-item');
        if (!newItemElement) return;

        const nameInput = newItemElement.querySelector(`#new-service-name`);
        const iconSelect = newItemElement.querySelector(`#new-service-icon`);
        const durationInput = newItemElement.querySelector(`#new-service-duration`);
        const priceInput = newItemElement.querySelector(`#new-service-price`);
        const activeCheckbox = newItemElement.querySelector(`#new-service-active`);

        let isValid = true; let errorMessages = [];
        const serviceName = nameInput.value.trim();
        const serviceIcon = iconSelect.value;
        const serviceDuration = parseInt(durationInput.value, 10);
        const servicePrice = parseInt(priceInput.value, 10);
        const isActive = activeCheckbox.checked;

        if (!serviceName) { isValid = false; errorMessages.push("El nombre del servicio es obligatorio."); nameInput.style.borderColor = 'var(--error-alt-color)'; } else { nameInput.style.borderColor = ''; }
        if (isNaN(serviceDuration) || serviceDuration <= 0 || serviceDuration % SLOT_INTERVAL_MINUTES !== 0) { isValid = false; errorMessages.push(`La duración debe ser un número positivo múltiplo de ${SLOT_INTERVAL_MINUTES}.`); durationInput.style.borderColor = 'var(--error-alt-color)'; } else { durationInput.style.borderColor = ''; }
        if (isNaN(servicePrice) || servicePrice < 0) { isValid = false; errorMessages.push("El precio debe ser un número positivo o cero."); priceInput.style.borderColor = 'var(--error-alt-color)'; } else { priceInput.style.borderColor = ''; }

        if (!isValid) {
            showFeedback(servicesAdminFeedback, `Error en el formulario: ${errorMessages.join(' ')}`, 'error', 5000);
            return;
        }

        const newServiceId = generateUniqueId('svc_'); // Generar un ID único para el nuevo servicio
        const newServiceData = { id: newServiceId, name: serviceName, icon: serviceIcon, duration: serviceDuration, price: servicePrice, active: isActive };
        const newServicePath = `${SERVICES_PATH}/${newServiceId}`;

        try {
            await saveDataFirebase(newServicePath, newServiceData);
            showFeedback(servicesAdminFeedback, `Nuevo servicio "${serviceName}" añadido exitosamente.`, 'success');
        } catch (error) {
            showFeedback(servicesAdminFeedback, `Error al añadir el nuevo servicio: ${error.message}`, 'error');
        } finally {
            if (addNewServiceButton) addNewServiceButton.disabled = false; // Rehabilitar botón
            await loadServicesAdminUI(); // Recargar la lista para mostrar el nuevo servicio y quitar el formulario
        }
    }

    async function handleCancelNewService() {
        const newItemElement = servicesAdminListContainer.querySelector('.new-service-item');
        if (newItemElement) newItemElement.remove(); // Quitar el formulario de la UI
        if (addNewServiceButton) addNewServiceButton.disabled = false; // Rehabilitar botón
        showFeedback(servicesAdminFeedback, 'Adición de nuevo servicio cancelada.', '', 3000);
    }


    // --- Inicialización y Event Listeners ---
    function initializeAdminPanel() {
        if (loginForm) loginForm.addEventListener('submit', handleLogin);
        if (logoutButton) logoutButton.addEventListener('click', handleLogout);
        tabButtons.forEach(button => button.addEventListener('click', handleTabClick));
        if (standardScheduleForm) standardScheduleForm.addEventListener('submit', handleSaveStandardSchedule);
        if (addNewServiceButton) addNewServiceButton.addEventListener('click', handleAddNewService);
        // onAuthStateChanged maneja la revisión inicial del estado de login.
    }

    // --- Go! ---
    if (window.firebaseServices) {
        initializeAdminPanel();
    } else {
        console.error("Firebase services not available. Admin panel might not work correctly.");
        const loginErrorEl = document.getElementById('login-error');
        if (loginErrorEl) {
            loginErrorEl.textContent = "Error crítico: No se pudieron cargar los servicios de Firebase. Intenta recargar la página.";
            loginErrorEl.style.display = 'block';
        }
    }

}); // Fin DOMContentLoaded