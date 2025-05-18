document.addEventListener('DOMContentLoaded', function() {

    // --- Firebase Services (from global scope) ---
    const {
        database, ref, set, get, child
    } = window.firebaseServices || {}; // Add a fallback if firebaseServices is not loaded

    // --- Constantes ---
    // Firebase DB Paths
    const APPOINTMENTS_PATH = 'appointments';
    const BLOCKED_SLOTS_PATH = 'blockedSlots';
    const STANDARD_SCHEDULE_PATH = 'standardSchedule';
    const SERVICES_PATH = 'services';

    const MAX_BOOKING_DAYS_AHEAD = 14;
    const SLOT_INTERVAL_MINUTES = 30;

    // --- Selección de Elementos del DOM ---
    const bookingForm = document.getElementById('booking-form');
    const confirmationMessageContainer = document.getElementById('confirmation-message');
    const confirmationTextSpan = document.getElementById('confirmation-text');
    const closeConfirmationButton = document.getElementById('close-confirmation-button');
    const submitButton = bookingForm ? bookingForm.querySelector('button[type="submit"]') : null;
    const currentYearSpan = document.getElementById('current-year');
    const animationContainer = document.getElementById('background-animation-container');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mainNav = document.getElementById('main-nav');
    const navLinks = mainNav ? mainNav.querySelectorAll('a') : [];
    const dayOptionsContainer = document.getElementById('day-options');
    const timeOptionsContainer = document.getElementById('time-options');
    const timeSlotsContainer = document.getElementById('time-slots-container');
    const hiddenDateInput = document.getElementById('selected-date');
    const hiddenTimeInput = document.getElementById('selected-time');
    const prevDayButton = document.getElementById('prev-day');
    const nextDayButton = document.getElementById('next-day');
    const serviceSelect = document.getElementById('service');
    const selectedServicePriceSpan = document.getElementById('selected-service-price');
    const servicesGridContainer = document.querySelector('#services .services-grid');
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');
    const emailInput = document.getElementById('email');
    const termsCheckbox = document.getElementById('terms');
    const otherServiceGroup = document.getElementById('other-service-details-group');
    const otherServiceTextarea = document.getElementById('other-service-details');
    const nameHint = document.getElementById('name-hint');
    const phoneHint = document.getElementById('phone-hint');
    const emailHint = document.getElementById('email-hint');
    const serviceHint = document.getElementById('service-hint');
    const dateHint = document.getElementById('date-hint');
    const timeHint = document.getElementById('time-hint');
    const termsHint = document.getElementById('terms-hint');
    const otherServiceHint = document.getElementById('other-service-hint');

    // --- Configuración ---
    const daysToShowInSelector = 7;
    let currentDaySelectorStartDate = new Date();
    currentDaySelectorStartDate.setHours(0, 0, 0, 0);
    const baseTimeSlots = [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
        '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
        '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
    ];
    const dayScrollAmount = 3;
    const maxBookingDate = new Date();
    maxBookingDate.setDate(maxBookingDate.getDate() + MAX_BOOKING_DAYS_AHEAD - 1);
    maxBookingDate.setHours(23, 59, 59, 999);
    let currentSelectedServiceDuration = null;


    // --- Funciones Auxiliares (Firebase Data) ---
    async function loadDataFirebase(path, defaultValue = {}) {
        if (!database || !ref || !get || !child) { // Check if Firebase services are available
            console.error("Firebase Database services are not available on the public page.");
            displayMessage('Error de conexión con la base de datos. Intenta más tarde.', 'error');
            return defaultValue;
        }
        try {
            const snapshot = await get(child(ref(database), path));
            if (snapshot.exists()) {
                return snapshot.val();
            } else {
                console.log(`No data available at Firebase path: ${path}. Returning default.`);
                return defaultValue;
            }
        } catch (error) {
            console.error(`Error loading data from Firebase path ${path}:`, error);
            // Avoid showing generic feedback for every load error on public page,
            // specific errors handled by calling functions.
            return defaultValue;
        }
    }

    async function saveDataFirebase(path, data) {
         if (!database || !ref || !set) {
            console.error("Firebase Database services for saving are not available.");
            throw new Error("Servicio de base de datos no disponible para guardar.");
        }
        try {
            await set(ref(database, path), data);
            console.log(`Data saved to Firebase path ${path}:`, data);
        } catch (error) {
            console.error(`Error saving data to Firebase path ${path}:`, error);
            throw error;
        }
    }

    // --- Funciones Auxiliares (Generales - sin cambios mayores) ---
    function formatDateToYMD(date) { if (!(date instanceof Date) || isNaN(date.getTime())) return null; const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
    function formatDateDMY(dateStringYMD) { if (!dateStringYMD || !/^\d{4}-\d{2}-\d{2}$/.test(dateStringYMD)) return dateStringYMD; try { const [y, m, d] = dateStringYMD.split('-'); if (parseInt(m, 10) < 1 || parseInt(m, 10) > 12 || parseInt(d, 10) < 1 || parseInt(d, 10) > 31) { return dateStringYMD; } return `${d}/${m}/${y}`; } catch (e) { console.warn("Could not format date D/M/Y:", dateStringYMD, e); return dateStringYMD; } }
    function formatPrice(value) { const number = Number(value); if (isNaN(number) || value === null || value === undefined || number < 0) return '-'; if (number === 0) return 'Gratis'; return `$${number.toLocaleString('es-CL')}`; }
    function timeToMinutes(timeStr) { if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null; try { const parts = timeStr.split(':'); const h = parseInt(parts[0], 10); const m = parseInt(parts[1], 10); if (h < 0 || h > 23 || m < 0 || m > 59) return null; return h * 60 + m; } catch (e) { console.warn("Could not convert time to minutes:", timeStr, e); return null; } }
    function minutesToTime(totalMinutes) { if (totalMinutes === null || totalMinutes < 0 || isNaN(totalMinutes)) return null; const h = Math.floor(totalMinutes / 60) % 24; const m = totalMinutes % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
    function generateUniqueId(prefix = 'appt_') { // Firebase push keys are better for lists. This is for a single object ID.
        // Create a new reference with a unique key
        // This is a placeholder, actual Firebase push key generation is different.
        // For appointments, we'll use Firebase's push mechanism.
        return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }
    function isValidName(name) { if (!name) return false; return name.trim().split(' ').filter(part => part.length > 1).length >= 2; }
    function isValidEmail(email) { if (!email) return false; const emailRegex = new RegExp(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/); return emailRegex.test(String(email).toLowerCase()); }
    function displayHint(hintElement, message, isValid, inputElement = null) { if (!hintElement) return; hintElement.textContent = message; if (message && !isValid) { hintElement.classList.add('visible'); inputElement?.classList.add('invalid'); } else { hintElement.classList.remove('visible'); inputElement?.classList.remove('invalid'); } }

    // --- Cargar Servicios en Booking Page ---
    async function loadBookingPageServices() {
        if (!serviceSelect || !servicesGridContainer) return;
        serviceSelect.innerHTML = '<option value="" disabled selected>Cargando servicios...</option>';
        servicesGridContainer.innerHTML = '<p class="loading-placeholder">Cargando servicios...</p>';

        const servicesData = await loadDataFirebase(SERVICES_PATH, {});
        const allServices = servicesData ? Object.values(servicesData) : [];
        const activeServices = allServices.filter(s => s && s.active);

        if (serviceSelect) {
            const currentSelection = serviceSelect.value;
            serviceSelect.innerHTML = '<option value="" disabled selected>-- Elige un servicio --</option>';
            if (activeServices.length === 0) {
                const option = document.createElement('option');
                option.value = ""; option.textContent = "No hay servicios disponibles"; option.disabled = true;
                serviceSelect.appendChild(option);
            } else {
                activeServices.forEach(service => {
                    const option = document.createElement('option');
                    option.value = service.id; option.textContent = service.name;
                    option.dataset.price = service.price || 0;
                    option.dataset.duration = service.duration || 30;
                    option.dataset.icon = service.icon || '';
                    serviceSelect.appendChild(option);
                });
                if (activeServices.some(s => s.id === currentSelection)) { serviceSelect.value = currentSelection; }
            }
            serviceSelect.dispatchEvent(new Event('change'));
        }

        if (servicesGridContainer) {
            servicesGridContainer.innerHTML = '';
            if (activeServices.length === 0) {
                servicesGridContainer.innerHTML = '<p class="placeholder">No hay servicios para mostrar.</p>';
            } else {
                activeServices.forEach(service => {
                    const serviceItem = document.createElement('div');
                    serviceItem.classList.add('service-item');
                    serviceItem.innerHTML = `
                        <span class="service-icon">${service.icon || '✂️'}</span>
                        <h3>${service.name}</h3>
                        <p>${getServiceDescription(service.id, allServices)}</p>
                        <p class="service-price" data-service-id="${service.id}">${formatPrice(service.price)}</p>
                    `;
                    servicesGridContainer.appendChild(serviceItem);
                });
            }
        }
    }

    function getServiceDescription(serviceId, allServices) {
        const service = allServices.find(s => s.id === serviceId);
        if (service && service.description) return service.description; // If you add a description field
        if (service) {
            // Fallback descriptions based on name (as before)
            if (service.name.toLowerCase().includes('junior')) return "Corte adaptado para los más jóvenes (2 a 12 años).";
            if (service.name.toLowerCase().includes('facial')) return "Renueva tu piel con nuestra limpieza profunda.";
            if (service.name.toLowerCase().includes('afeitada')) return "Experiencia clásica con navaja y toallas calientes.";
            if (service.name.toLowerCase().includes('perfilado') && service.name.toLowerCase().includes('maquina')) return "Define tu barba con precisión usando máquina.";
            if (service.name.toLowerCase().includes('perfilado')) return "Define tu barba con diseño y toallas calientes.";
            if (service.name.toLowerCase().includes('rasurado')) return "Un rasurado perfecto y suave para tu cabeza.";
            if (service.name.toLowerCase().includes('peinado')) return "Dale el toque final a tu look con un peinado profesional.";
        }
        return "Servicio de barbería profesional."; // Generic fallback
    }

    // --- Lógica Selector Día/Hora ---
    async function generateDayOptions() {
        if (!dayOptionsContainer || !hiddenDateInput) return;
        dayOptionsContainer.innerHTML = '<span class="loading-placeholder">Cargando días...</span>';
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const displayDates = [];
        let tempDate = new Date(currentDaySelectorStartDate);
        const standardScheduleData = await loadDataFirebase(STANDARD_SCHEDULE_PATH, {});
        let safetyCount = 0;

        while (displayDates.length < daysToShowInSelector && tempDate <= maxBookingDate && safetyCount < MAX_BOOKING_DAYS_AHEAD * 3) {
            const dayOfWeek = tempDate.getDay();
            const dayStandard = standardScheduleData[dayOfWeek] || { open: dayOfWeek !== 0, morningOpen: dayOfWeek !== 0, afternoonOpen: dayOfWeek !== 0 };
            const isDayEffectivelyOpen = dayStandard.open && (dayStandard.morningOpen || dayStandard.afternoonOpen);

            if (isDayEffectivelyOpen && tempDate >= today && tempDate <= maxBookingDate) {
                displayDates.push(new Date(tempDate));
            }
            tempDate.setDate(tempDate.getDate() + 1);
            safetyCount++;
        }

        dayOptionsContainer.innerHTML = '';
        if (displayDates.length === 0) {
            dayOptionsContainer.innerHTML = `<span class="loading-placeholder">No hay días disponibles${currentDaySelectorStartDate > today ? ' más adelante' : ''}.</span>`;
            displayHint(dateHint, `No hay días disponibles próximamente.`, false);
            if (timeSlotsContainer) timeSlotsContainer.style.display = 'none';
            hiddenDateInput.value = ''; hiddenTimeInput.value = '';
        } else {
            displayHint(dateHint, '', true);
            displayDates.forEach(date => {
                const dayButton = document.createElement('button');
                dayButton.type = 'button'; dayButton.classList.add('day-option');
                const dateString = formatDateToYMD(date); if (!dateString) return;
                dayButton.dataset.date = dateString;
                dayButton.setAttribute('aria-label', `Seleccionar día ${date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`);
                const dayNumber = document.createElement('span'); dayNumber.classList.add('day-number'); dayNumber.textContent = date.getDate();
                const dayName = document.createElement('span'); dayName.classList.add('day-name'); dayName.textContent = date.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
                dayButton.appendChild(dayNumber); dayButton.appendChild(dayName);
                if (hiddenDateInput.value === dateString) { dayButton.classList.add('selected'); dayButton.setAttribute('aria-pressed', 'true'); } else { dayButton.setAttribute('aria-pressed', 'false'); }
                dayButton.addEventListener('click', handleDaySelection);
                dayOptionsContainer.appendChild(dayButton);
            });
        }
        updateDayNavButtons(displayDates.length > 0 ? displayDates[displayDates.length - 1] : null);
    }

    function updateDayNavButtons(lastDateShown) {
        if (!prevDayButton || !nextDayButton) return;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        prevDayButton.disabled = (currentDaySelectorStartDate <= today);
        nextDayButton.disabled = (!lastDateShown || lastDateShown >= maxBookingDate);
    }

    async function handleDaySelection(event) {
        const selectedButton = event.currentTarget;
        if (selectedButton.classList.contains('disabled') || !hiddenDateInput || !dayOptionsContainer) return;
        const newSelectedDate = selectedButton.dataset.date;
        if (hiddenDateInput.value === newSelectedDate) return;

        const previouslySelected = dayOptionsContainer.querySelector('.day-option.selected');
        if (previouslySelected) { previouslySelected.classList.remove('selected'); previouslySelected.setAttribute('aria-pressed', 'false'); }
        selectedButton.classList.add('selected'); selectedButton.setAttribute('aria-pressed', 'true');

        hiddenDateInput.value = newSelectedDate;
        hiddenTimeInput.value = '';
        await displayTimeSlots(newSelectedDate);
        displayHint(dateHint, '', true);
        displayHint(timeHint, 'Selecciona una hora.', false);
        if (timeSlotsContainer) {
            timeSlotsContainer.style.display = 'block';
            timeSlotsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        validateFormAndToggleButton();
    }

    async function displayTimeSlots(selectedDateStr) {
        if (!timeOptionsContainer || !hiddenTimeInput) return;
        timeOptionsContainer.innerHTML = '<span class="loading-placeholder">Cargando horarios...</span>';
        hiddenTimeInput.value = '';

        if (!selectedDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDateStr)) { timeOptionsContainer.innerHTML = '<span class="loading-placeholder">Fecha inválida.</span>'; displayHint(dateHint, 'Fecha inválida.', false); return; }

        const serviceDuration = currentSelectedServiceDuration;
        if (!serviceDuration || serviceDuration <= 0) {
            timeOptionsContainer.innerHTML = '<span class="loading-placeholder">Selecciona un servicio válido primero.</span>';
            displayHint(timeHint, 'Selecciona un servicio para ver horarios.', false);
            return;
        }

        const standardScheduleData = await loadDataFirebase(STANDARD_SCHEDULE_PATH, {});
        const blockedExceptionsData = await loadDataFirebase(BLOCKED_SLOTS_PATH, {});
        const allAppointmentsData = await loadDataFirebase(APPOINTMENTS_PATH, {});
        const allServicesData = await loadDataFirebase(SERVICES_PATH, {});

        const date = new Date(selectedDateStr + 'T00:00:00');
        if (isNaN(date.getTime())) { timeOptionsContainer.innerHTML = '<span class="loading-placeholder">Error fecha.</span>'; displayHint(dateHint, 'Error procesando fecha.', false); return; }
        const dayOfWeek = date.getDay();
        const dayStandard = standardScheduleData[dayOfWeek] || { open: false, morningOpen: false, afternoonOpen: false };
        const explicitlyBlockedTimes = (blockedExceptionsData && blockedExceptionsData[selectedDateStr]) ? blockedExceptionsData[selectedDateStr] : [];
        const allAppointments = allAppointmentsData ? Object.values(allAppointmentsData) : [];
        const allServices = allServicesData ? Object.values(allServicesData) : [];

        const bookedSlotsDetails = allAppointments
            .filter(a => a.date === selectedDateStr && (a.status === 'pending' || a.status === 'confirmed'))
            .map(a => {
                const service = allServices.find(s => s.id === a.serviceId);
                const duration = service ? (service.duration || 60) : 60;
                return { time: a.time, duration: duration };
            })
            .filter(a => a.time);

        const now = new Date(); const todayDateStr = formatDateToYMD(now);
        const isToday = (selectedDateStr === todayDateStr);
        const currentMinutes = isToday ? (now.getHours() * 60 + now.getMinutes()) : -1;
        const bufferMinutes = 5;

        timeOptionsContainer.innerHTML = ''; // Clear loading
        let hasAvailableSlots = false;

        baseTimeSlots.forEach(time => {
            const timeMin = timeToMinutes(time); if (timeMin === null) return;
            let isDisabled = false; let reason = "";

            if (isToday && (timeMin < currentMinutes + bufferMinutes)) { isDisabled = true; reason = "Hora pasada"; }

            if (!isDisabled) {
                for (const booking of bookedSlotsDetails) {
                    const bookingStartMin = timeToMinutes(booking.time); if (bookingStartMin === null) continue;
                    const bookingEndMin = bookingStartMin + booking.duration;
                    const currentSlotStartMin = timeMin;
                    const currentSlotEndMin = timeMin + serviceDuration;
                    if (Math.max(currentSlotStartMin, bookingStartMin) < Math.min(currentSlotEndMin, bookingEndMin)) {
                        isDisabled = true; reason = "Conflicto Cita"; break;
                    }
                }
            }

            if (!isDisabled) {
                let isWithinStandardHours = false; let conflictsWithBlock = false;
                const serviceEndMin = timeMin + serviceDuration;
                if (dayStandard.open) {
                    const mStartMin = timeToMinutes(dayStandard.morningStart); const mEndMin = timeToMinutes(dayStandard.morningEnd);
                    const aStartMin = timeToMinutes(dayStandard.afternoonStart); const aEndMin = timeToMinutes(dayStandard.afternoonEnd);
                    const fitsInMorning = (dayStandard.morningOpen && mStartMin !== null && mEndMin !== null && timeMin >= mStartMin && serviceEndMin <= mEndMin);
                    const fitsInAfternoon = (dayStandard.afternoonOpen && aStartMin !== null && aEndMin !== null && timeMin >= aStartMin && serviceEndMin <= aEndMin);
                    if (fitsInMorning || fitsInAfternoon) isWithinStandardHours = true;
                }
                if (!isWithinStandardHours) { isDisabled = true; reason = "Fuera de horario"; }
                else {
                    for (let offset = 0; offset < serviceDuration; offset += SLOT_INTERVAL_MINUTES) {
                        const checkTimeStr = minutesToTime(timeMin + offset);
                        if (checkTimeStr && explicitlyBlockedTimes.includes(checkTimeStr)) {
                            conflictsWithBlock = true; reason = `Bloqueado (${checkTimeStr})`; break;
                        }
                    }
                    if (conflictsWithBlock) isDisabled = true;
                }
            }

            const timeButton = document.createElement('button');
            timeButton.type = 'button'; timeButton.classList.add('time-slot-option'); timeButton.dataset.time = time; timeButton.textContent = time;
            if (isDisabled) { timeButton.classList.add('disabled'); timeButton.disabled = true; timeButton.title = `No disponible${reason ? ': ' + reason : ''}`; }
            else { timeButton.setAttribute('aria-label', `Seleccionar hora ${time}`); timeButton.addEventListener('click', handleTimeSelection); hasAvailableSlots = true; }
            timeOptionsContainer.appendChild(timeButton);
        });

        if (!hasAvailableSlots) { timeOptionsContainer.innerHTML = '<span class="loading-placeholder">No hay horarios disponibles para este día.</span>'; displayHint(timeHint, 'No hay horarios disponibles.', false); }
        else if (hiddenTimeInput.value === '') { displayHint(timeHint, 'Selecciona una hora.', false); }
        else { displayHint(timeHint, '', true); }
        validateFormAndToggleButton();
    }


    function handleTimeSelection(event) {
        const selectedButton = event.currentTarget;
        if (selectedButton.classList.contains('disabled') || !hiddenTimeInput || !timeOptionsContainer) return;
        const newSelectedTime = selectedButton.dataset.time;

        const previouslySelected = timeOptionsContainer.querySelector('.time-slot-option.selected');
        if (previouslySelected) { previouslySelected.classList.remove('selected'); previouslySelected.setAttribute('aria-pressed', 'false'); }
        selectedButton.classList.add('selected'); selectedButton.setAttribute('aria-pressed', 'true');

        hiddenTimeInput.value = newSelectedTime;
        displayHint(timeHint, '', true);
        validateFormAndToggleButton();
    }

    async function navigateDays(direction) {
        let change = direction * dayScrollAmount; let safetyCounter = 0;
        let newStartDate = new Date(currentDaySelectorStartDate);
        const scheduleData = await loadDataFirebase(STANDARD_SCHEDULE_PATH, {}); // Load schedule for checking
        const today = new Date(); today.setHours(0, 0, 0, 0);

        while (change !== 0 && safetyCounter < MAX_BOOKING_DAYS_AHEAD * 4) {
            const potentialNextDate = new Date(newStartDate); potentialNextDate.setDate(potentialNextDate.getDate() + direction);
            if (direction > 0 && potentialNextDate > maxBookingDate) break; if (direction < 0 && potentialNextDate < today) break;
            newStartDate.setDate(newStartDate.getDate() + direction);
            const dayOfWeek = newStartDate.getDay();
            const dayStd = scheduleData[dayOfWeek] || { open: dayOfWeek !== 0, morningOpen: dayOfWeek !== 0, afternoonOpen: dayOfWeek !== 0 };
            const isEffectivelyOpen = dayStd.open && (dayStd.morningOpen || dayStd.afternoonOpen);
            if (isEffectivelyOpen && newStartDate >= today && newStartDate <= maxBookingDate) { change -= direction; }
            safetyCounter++;
        }
        if (newStartDate < today) newStartDate = new Date(today);
        if (newStartDate > maxBookingDate) {
            let foundValidStart = false; let tempClampDate = new Date(maxBookingDate); let clampSafety = 0;
            while (tempClampDate >= today && !foundValidStart && clampSafety < daysToShowInSelector * 2) {
                const dow = tempClampDate.getDay();
                const dStd = scheduleData[dow] || { open: dow !== 0, morningOpen: dow !== 0, afternoonOpen: dow !== 0 };
                if (dStd.open && (dStd.morningOpen || dStd.afternoonOpen)) { newStartDate = new Date(tempClampDate); foundValidStart = true; }
                tempClampDate.setDate(tempClampDate.getDate() - 1); clampSafety++;
            }
            if (!foundValidStart) newStartDate = new Date(today);
        }

        currentDaySelectorStartDate = newStartDate;
        await generateDayOptions();
        hiddenDateInput.value = ''; hiddenTimeInput.value = '';
        if (timeSlotsContainer) timeSlotsContainer.style.display = 'none';
        displayHint(dateHint, 'Selecciona un día.', false); displayHint(timeHint, '', true);
        validateFormAndToggleButton();
    }


    function setupDayNavigation() {
        if (prevDayButton) prevDayButton.addEventListener('click', () => navigateDays(-1));
        if (nextDayButton) nextDayButton.addEventListener('click', () => navigateDays(1));
    }

    function toggleOtherServiceDetails() {
        if (!serviceSelect || !otherServiceGroup || !otherServiceTextarea) return;
        const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
        const isOtherSelected = selectedOption && selectedOption.text.toLowerCase().includes('otro');

        if (isOtherSelected) {
            otherServiceGroup.style.display = 'block';
            otherServiceTextarea.required = true;
            displayHint(otherServiceHint, otherServiceTextarea.value.trim() ? '' : 'Especifica el servicio.', !otherServiceTextarea.value.trim(), otherServiceTextarea);
        } else {
            otherServiceGroup.style.display = 'none';
            otherServiceTextarea.required = false;
            otherServiceTextarea.value = '';
            displayHint(otherServiceHint, '', true, otherServiceTextarea);
        }
    }

    function validateFormAndToggleButton() {
        if (!bookingForm || !submitButton) return;
        const nameValid = isValidName(nameInput?.value);
        const phoneValid = phoneInput?.checkValidity() ?? false;
        const emailValid = isValidEmail(emailInput?.value);
        const serviceValid = serviceSelect?.value !== '';
        const dateSelected = hiddenDateInput?.value !== '';
        const timeSelected = hiddenTimeInput?.value !== '';
        const termsValid = termsCheckbox?.checked ?? false;
        const otherServiceOption = serviceSelect ? serviceSelect.options[serviceSelect.selectedIndex] : null;
        const isOtherSelected = otherServiceOption && otherServiceOption.text.toLowerCase().includes('otro');
        const otherServiceValid = !isOtherSelected || (otherServiceTextarea?.value.trim().length > 0);

        const isFormValid = nameValid && phoneValid && emailValid && serviceValid && dateSelected && timeSelected && termsValid && otherServiceValid;
        submitButton.disabled = !isFormValid;
    }

    function addRealtimeValidationListeners() {
        if (!bookingForm) return;
        nameInput?.addEventListener('input', () => { const isValid = isValidName(nameInput.value); displayHint(nameHint, isValid ? '' : 'Nombre y apellido.', isValid, nameInput); validateFormAndToggleButton(); });
        phoneInput?.addEventListener('input', () => { const isValid = phoneInput.checkValidity(); displayHint(phoneHint, isValid ? '' : '+569XXXXXXXX', isValid, phoneInput); validateFormAndToggleButton(); });
        emailInput?.addEventListener('input', () => { const isValid = isValidEmail(emailInput.value); displayHint(emailHint, isValid ? '' : 'Email inválido.', isValid, emailInput); validateFormAndToggleButton(); });
        termsCheckbox?.addEventListener('change', () => { const isValid = termsCheckbox.checked; displayHint(termsHint, isValid ? '' : 'Debes aceptar.', isValid); validateFormAndToggleButton(); });
        otherServiceTextarea?.addEventListener('input', () => { if (serviceSelect?.options[serviceSelect.selectedIndex]?.text.toLowerCase().includes('otro')) { const isValid = otherServiceTextarea.value.trim().length > 0; displayHint(otherServiceHint, isValid ? '' : 'Especifica el servicio.', isValid, otherServiceTextarea); validateFormAndToggleButton(); } });
    }

    function updateSelectedServicePrice() {
        if (!serviceSelect || !selectedServicePriceSpan) return;
        const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
        let priceText = '';
        if (selectedOption && selectedOption.value) {
            const price = selectedOption.dataset.price;
            const formatted = formatPrice(price);
            if (formatted !== '-' && formatted !== 'Gratis') { priceText = `(${formatted})`; }
            else if (formatted === 'Gratis') { priceText = '(Gratis)'; }
        }
        selectedServicePriceSpan.textContent = priceText;
    }

    async function handleFormSubmit() {
        if (!bookingForm || !submitButton) return;
        bookingForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            displayMessage('', 'clear');

            let firstInvalidElement = null;
            const nameValid = isValidName(nameInput?.value); if (!nameValid) { displayHint(nameHint, 'Nombre y apellido.', false, nameInput); if (!firstInvalidElement) firstInvalidElement = nameInput; } else { displayHint(nameHint, '', true, nameInput); }
            const phoneValid = phoneInput?.checkValidity() ?? false; if (!phoneValid) { displayHint(phoneHint, '+569XXXXXXXX', false, phoneInput); if (!firstInvalidElement) firstInvalidElement = phoneInput; } else { displayHint(phoneHint, '', true, phoneInput); }
            const emailValid = isValidEmail(emailInput?.value); if (!emailValid) { displayHint(emailHint, 'Email inválido.', false, emailInput); if (!firstInvalidElement) firstInvalidElement = emailInput; } else { displayHint(emailHint, '', true, emailInput); }
            const serviceValid = serviceSelect?.value !== ''; if (!serviceValid) { displayHint(serviceHint, 'Selecciona servicio.', false, serviceSelect); if (!firstInvalidElement) firstInvalidElement = serviceSelect; } else { displayHint(serviceHint, '', true, serviceSelect); }
            const dateSelected = hiddenDateInput?.value !== ''; if (!dateSelected) { displayHint(dateHint, 'Selecciona día.', false); if (!firstInvalidElement) firstInvalidElement = dayOptionsContainer; } else { displayHint(dateHint, '', true); }
            const timeSelected = hiddenTimeInput?.value !== ''; if (!timeSelected && dateSelected) { displayHint(timeHint, 'Selecciona hora.', false); if (!firstInvalidElement) firstInvalidElement = timeOptionsContainer; } else if (timeSelected) { displayHint(timeHint, '', true); }
            const termsValid = termsCheckbox?.checked ?? false; if (!termsValid) { displayHint(termsHint, 'Debes aceptar.', false); if (!firstInvalidElement) firstInvalidElement = termsCheckbox; } else { displayHint(termsHint, '', true); }
            const otherServiceOption = serviceSelect ? serviceSelect.options[serviceSelect.selectedIndex] : null;
            const isOtherSelected = otherServiceOption && otherServiceOption.text.toLowerCase().includes('otro');
            let otherServiceValidSubmit = true;
            if (isOtherSelected) { if (otherServiceTextarea?.value.trim() === '') { otherServiceValidSubmit = false; displayHint(otherServiceHint, 'Especifica el servicio.', false, otherServiceTextarea); if (!firstInvalidElement) firstInvalidElement = otherServiceTextarea; } else { displayHint(otherServiceHint, '', true, otherServiceTextarea); } }
            else { displayHint(otherServiceHint, '', true, otherServiceTextarea); }

            let isSlotStillAvailable = true;
            if (dateSelected && timeSelected) {
                const checkDate = hiddenDateInput.value;
                const checkTime = hiddenTimeInput.value;
                const serviceDuration = currentSelectedServiceDuration;
                if (serviceDuration && serviceDuration > 0) {
                    isSlotStillAvailable = await checkFinalAvailability(checkDate, checkTime, serviceDuration); // Made async
                    if (!isSlotStillAvailable) {
                        displayHint(timeHint, 'Hora ya no disponible. Elige otra.', false);
                        if (!firstInvalidElement) firstInvalidElement = timeOptionsContainer;
                        await displayTimeSlots(checkDate);
                        hiddenTimeInput.value = '';
                        const selectedButton = timeOptionsContainer?.querySelector('.time-slot-option.selected');
                        if (selectedButton) { selectedButton.classList.remove('selected'); selectedButton.setAttribute('aria-pressed', 'false'); }
                    }
                } else {
                    isSlotStillAvailable = false;
                    displayHint(serviceHint, 'Error duración servicio.', false, serviceSelect);
                    if (!firstInvalidElement) firstInvalidElement = serviceSelect;
                }
            }

            if (firstInvalidElement || !isSlotStillAvailable) {
                firstInvalidElement?.focus({ preventScroll: true });
                firstInvalidElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                validateFormAndToggleButton();
                return;
            }

            submitButton.disabled = true; submitButton.textContent = 'Procesando...';

            const name = nameInput.value.trim(); const phone = phoneInput.value.trim(); const emailVal = emailInput.value.trim();
            const serviceId = serviceSelect.value;
            const serviceName = serviceSelect.options[serviceSelect.selectedIndex].text;
            const dateValue = hiddenDateInput.value; const timeValue = hiddenTimeInput.value;
            const otherDetailsValue = (isOtherSelected && otherServiceTextarea) ? otherServiceTextarea.value.trim() : null;

            const appointmentId = generateUniqueId('appt_'); // Or use Firebase push().key if you prefer Firebase to generate the ID.
                                                            // For this example, we generate it client-side to match previous logic.
            const appointmentPath = `${APPOINTMENTS_PATH}/${appointmentId}`;

            try {
                const newAppointment = {
                    id: appointmentId, name, phone, email: emailVal, // ensure email is stored
                    serviceId: serviceId, service: serviceName,
                    date: dateValue, time: timeValue, status: 'pending',
                    requestedAt: new Date().toISOString(), otherDetails: otherDetailsValue
                };
                await saveDataFirebase(appointmentPath, newAppointment);
                console.log('Solicitud guardada en Firebase:', newAppointment);

                const successMessage = `¡Gracias, ${name}! Tu solicitud para '${serviceName}' el ${formatDateDMY(dateValue)} a las ${timeValue} está PENDIENTE de confirmación. Recibirás un correo a ${emailVal} cuando sea aprobada.`;
                displayMessage(successMessage, 'success');

                bookingForm.reset();
                hiddenDateInput.value = ''; hiddenTimeInput.value = ''; currentSelectedServiceDuration = null;
                if (otherServiceTextarea) otherServiceTextarea.value = ''; if (otherServiceGroup) otherServiceGroup.style.display = 'none';
                dayOptionsContainer?.querySelector('.day-option.selected')?.classList.remove('selected');
                timeOptionsContainer?.querySelector('.time-slot-option.selected')?.classList.remove('selected');
                if (timeSlotsContainer) timeSlotsContainer.style.display = 'none';
                if (timeOptionsContainer) timeOptionsContainer.innerHTML = '<span class="loading-placeholder">Selecciona un día para ver horarios.</span>';
                await generateDayOptions();
                updateSelectedServicePrice();
                [nameHint, phoneHint, emailHint, serviceHint, dateHint, timeHint, termsHint, otherServiceHint].forEach(h => displayHint(h, '', true));
                [nameInput, phoneInput, emailInput, serviceSelect, otherServiceTextarea].forEach(inp => inp?.classList.remove('invalid'));

                submitButton.textContent = 'Confirmar Cita';
                validateFormAndToggleButton();
                confirmationMessageContainer?.scrollIntoView({ behavior: 'smooth', block: 'center' });

            } catch (error) {
                console.error("Error guardando cita en Firebase:", error);
                displayMessage(`Error al procesar tu solicitud: ${error.message}. Inténtalo de nuevo.`, 'error');
                submitButton.disabled = false;
                submitButton.textContent = 'Confirmar Cita';
            }
        });
    }

    async function checkFinalAvailability(dateString, timeString, serviceDuration) {
        const timeMin = timeToMinutes(timeString);
        if (timeMin === null || !serviceDuration || serviceDuration <= 0) return false;

        const standardScheduleData = await loadDataFirebase(STANDARD_SCHEDULE_PATH, {});
        const blockedExceptionsData = await loadDataFirebase(BLOCKED_SLOTS_PATH, {});
        const allAppointmentsData = await loadDataFirebase(APPOINTMENTS_PATH, {});
        const allServicesData = await loadDataFirebase(SERVICES_PATH, {});

        const date = new Date(dateString + 'T00:00:00');
        const dayOfWeek = date.getDay();
        const dayStandard = standardScheduleData[dayOfWeek] || { open: false, morningOpen: false, afternoonOpen: false };
        const explicitlyBlockedTimes = (blockedExceptionsData && blockedExceptionsData[dateString]) ? blockedExceptionsData[dateString] : [];
        const allAppointments = allAppointmentsData ? Object.values(allAppointmentsData) : [];
        const allServices = allServicesData ? Object.values(allServicesData) : [];

        const bookedSlotsDetails = allAppointments
            .filter(a => a.date === dateString && (a.status === 'pending' || a.status === 'confirmed'))
            .map(a => {
                const service = allServices.find(s => s.id === a.serviceId);
                const duration = service ? (service.duration || 60) : 60;
                return { time: a.time, duration: duration };
            })
            .filter(a => a.time);

        const now = new Date(); const todayDateStr = formatDateToYMD(now);
        const isToday = (dateString === todayDateStr);
        const currentMinutes = isToday ? (now.getHours() * 60 + now.getMinutes()) : -1;
        const bufferMinutes = 0;

        if (isToday && (timeMin < currentMinutes + bufferMinutes)) return false;

        const currentSlotStartMin = timeMin;
        const currentSlotEndMin = timeMin + serviceDuration;
        for (const booking of bookedSlotsDetails) {
            const bookingStartMin = timeToMinutes(booking.time); if (bookingStartMin === null) continue;
            const bookingEndMin = bookingStartMin + booking.duration;
            if (Math.max(currentSlotStartMin, bookingStartMin) < Math.min(currentSlotEndMin, bookingEndMin)) return false;
        }

        let isWithinStandardHours = false; const serviceEndMin = timeMin + serviceDuration;
        if (dayStandard.open) {
            const mStartMin = timeToMinutes(dayStandard.morningStart); const mEndMin = timeToMinutes(dayStandard.morningEnd);
            const aStartMin = timeToMinutes(dayStandard.afternoonStart); const aEndMin = timeToMinutes(dayStandard.afternoonEnd);
            const fitsInMorning = (dayStandard.morningOpen && mStartMin !== null && mEndMin !== null && timeMin >= mStartMin && serviceEndMin <= mEndMin);
            const fitsInAfternoon = (dayStandard.afternoonOpen && aStartMin !== null && aEndMin !== null && timeMin >= aStartMin && serviceEndMin <= aEndMin);
            if (fitsInMorning || fitsInAfternoon) isWithinStandardHours = true;
        }
        if (!isWithinStandardHours) return false;

        for (let offset = 0; offset < serviceDuration; offset += SLOT_INTERVAL_MINUTES) {
            const checkTimeStr = minutesToTime(timeMin + offset);
            if (checkTimeStr && explicitlyBlockedTimes.includes(checkTimeStr)) return false;
        }
        return true;
    }

    function displayMessage(message, type) {
        if (!confirmationMessageContainer || !confirmationTextSpan || !closeConfirmationButton) return;
        confirmationTextSpan.textContent = message;
        confirmationMessageContainer.className = 'confirmation-message';

        if (type === 'success' || type === 'error') {
            confirmationMessageContainer.classList.add(type);
            confirmationMessageContainer.style.display = 'flex';
            closeConfirmationButton.style.display = (type === 'success') ? 'block' : 'none';
        } else {
            confirmationMessageContainer.style.display = 'none';
        }
    }

    function setupCloseButtonListener() { if (closeConfirmationButton) { closeConfirmationButton.addEventListener('click', () => { displayMessage('', 'clear'); }); } }
    function createFallingIcon() { if (!animationContainer) return; const icons = ['✂️', '💈']; const iconsToCreate = 1; const baseFallDuration = 12000; for (let i = 0; i < iconsToCreate; i++) { try { const iconElement = document.createElement('span'); iconElement.classList.add('falling-icon'); iconElement.textContent = icons[Math.floor(Math.random() * icons.length)]; const randomLeft = Math.random() * 98; const randomFontSize = Math.random() * 18 + 12; const randomDuration = Math.random() * 12000 + baseFallDuration; const randomDelay = Math.random() * 8000; const randomStartOpacity = Math.random() * 0.3 + 0.2; const randomEndOpacity = Math.random() * 0.1; iconElement.style.left = `${randomLeft}%`; iconElement.style.fontSize = `${randomFontSize}px`; iconElement.style.setProperty('--start-opacity', randomStartOpacity.toFixed(2)); iconElement.style.setProperty('--end-opacity', randomEndOpacity.toFixed(2)); iconElement.style.animationDuration = `${randomDuration / 1000}s`; iconElement.style.animationDelay = `${randomDelay / 1000}s`; animationContainer.appendChild(iconElement); const totalLife = randomDuration + randomDelay + 1500; setTimeout(() => { if (iconElement.parentNode === animationContainer) { iconElement.remove(); } }, totalLife); } catch (e) { console.error("Error creating falling icon:", e); } } }
    function setupMobileMenu() { if (!mobileMenuToggle || !mainNav) return; mobileMenuToggle.addEventListener('click', () => { const isActive = mainNav.classList.toggle('active'); mobileMenuToggle.textContent = isActive ? '✕' : '☰'; document.body.style.overflow = isActive ? 'hidden' : ''; mobileMenuToggle.setAttribute('aria-expanded', isActive); }); navLinks.forEach(link => { link.addEventListener('click', () => { if (mainNav.classList.contains('active')) { mainNav.classList.remove('active'); mobileMenuToggle.textContent = '☰'; document.body.style.overflow = ''; mobileMenuToggle.setAttribute('aria-expanded', 'false'); } }); }); document.addEventListener('click', (event) => { const isClickInsideNav = mainNav.contains(event.target); const isClickOnToggle = mobileMenuToggle.contains(event.target); if (!isClickInsideNav && !isClickOnToggle && mainNav.classList.contains('active')) { mainNav.classList.remove('active'); mobileMenuToggle.textContent = '☰'; document.body.style.overflow = ''; mobileMenuToggle.setAttribute('aria-expanded', 'false'); } }); }
    function updateFooterYear() { if (currentYearSpan) { currentYearSpan.textContent = new Date().getFullYear(); } }

    // --- Inicialización ---
    async function initializePage() { // Made async
        updateFooterYear();
        setupMobileMenu();
        setupCloseButtonListener();

        if (!window.firebaseServices) {
            console.error("Firebase services not loaded on public page. Functionality will be limited.");
            displayMessage("Error de conexión. No se pueden cargar los datos de la barbería.", "error");
            if (serviceSelect) serviceSelect.innerHTML = '<option value="" disabled selected>Error al cargar servicios</option>';
            if (servicesGridContainer) servicesGridContainer.innerHTML = '<p class="placeholder">Error al cargar servicios.</p>';
            if (dayOptionsContainer) dayOptionsContainer.innerHTML = '<p class="placeholder">Error al cargar disponibilidad.</p>';
            return; // Stop further initialization if Firebase is not available
        }


        await loadBookingPageServices(); // Made async

        if (bookingForm) {
            await generateDayOptions(); // Made async
            setupDayNavigation();
            addRealtimeValidationListeners();
            await handleFormSubmit(); // Made async

            serviceSelect?.addEventListener('change', async () => { // Made async
                const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
                currentSelectedServiceDuration = selectedOption ? parseInt(selectedOption.dataset.duration, 10) : null;
                updateSelectedServicePrice();
                toggleOtherServiceDetails();
                validateFormAndToggleButton();

                const selectedDate = hiddenDateInput.value;
                if (selectedDate) {
                    hiddenTimeInput.value = '';
                    await displayTimeSlots(selectedDate); // Made async
                } else {
                    if (timeSlotsContainer) timeSlotsContainer.style.display = 'none';
                    if (timeOptionsContainer) timeOptionsContainer.innerHTML = '<span class="loading-placeholder">Selecciona un día para ver horarios.</span>';
                    displayHint(timeHint, '', true);
                }
            });
        }

        let animationIntervalId = null;
        if (animationContainer) {
            createFallingIcon();
            animationIntervalId = setInterval(createFallingIcon, 1200);
            document.addEventListener("visibilitychange", () => {
                if (document.hidden) { if (animationIntervalId) { clearInterval(animationIntervalId); animationIntervalId = null; } }
                else { if (!animationIntervalId) { createFallingIcon(); animationIntervalId = setInterval(createFallingIcon, 1200); } }
            });
        }
    }

    // --- Go! ---
    initializePage();

});
