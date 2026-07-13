const CAR_SLOTS = 6;
const BIKE_SLOTS = 6;

const RATES = {
    Car: 50,
    Bike: 20
};

let data = {
    parked: [],
    queue: [],
    history: [],
    revenue: 0
};


// ===============================
// HELPER FUNCTIONS
// ===============================

const $ = id => document.getElementById(id);

const normalize = s =>
    s.trim().toUpperCase().replace(/\s+/g, ' ');

const formatCurrency = value =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(Number(value || 0));

// Format timestamp to 'DD/MM/YYYY, hh:mm AM/PM'
function pad(n) { return n < 10 ? '0' + n : n; }
function formatTimestamp(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '-';
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = pad(d.getMinutes());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12; hours = hours ? hours : 12;
    return `${day}/${month}/${year}, ${pad(hours)}:${minutes} ${ampm}`;
}

// Format timestamp to 'hh:mm AM/PM'
function formatTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '-';
    let hours = d.getHours();
    const minutes = pad(d.getMinutes());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12; hours = hours ? hours : 12;
    return `${pad(hours)}:${minutes} ${ampm}`;
}

function toast(msg) {

    let t = $('toast');

    if (!t) return;

    t.className = 'toast';
    t.textContent = msg;

    setTimeout(() => {
        t.className = '';
    }, 2600);
}


// ===============================
// PARKING SLOT FUNCTIONS
// ===============================

function slotsFor(type) {

    const numberOfSlots =
        type === 'Bike' ? BIKE_SLOTS : CAR_SLOTS;

    const prefix =
        type === 'Bike' ? 'B' : 'C';

    return Array.from(
        { length: numberOfSlots },
        (_, i) =>
            `${prefix}${String(i + 1).padStart(2, '0')}`
    );
}


function freeSlots(type) {

    return slotsFor(type).filter(slotNumber => {

        return !data.parked.some(vehicle => {

            return String(vehicle.slot || '')
                .trim()
                .toUpperCase() ===
                String(slotNumber)
                    .trim()
                    .toUpperCase();

        });

    });
}


// ===============================
// BACKEND API FUNCTION
// ===============================

async function api(url, options = {}) {

    const response = await fetch(url, {

        headers: {
            'Content-Type': 'application/json'
        },

        ...options

    });


    /*
       Read response as text first.

       This prevents:
       Unexpected token '<', "<!doctype..." is not valid JSON
    */

    const text = await response.text();

    let body;

    try {

        body = JSON.parse(text);

    } catch (error) {

        console.error(
            'Backend returned non-JSON response:',
            text
        );

        throw new Error(
            `Backend returned invalid response (HTTP ${response.status})`
        );
    }


    if (!response.ok) {

        throw new Error(
            body.message ||
            body.error ||
            'Request failed'
        );

    }

    return body;
}


// ===============================
// LOAD DATA FROM FLASK BACKEND
// ===============================

async function loadState() {

    try {

        data = await api('/api/state');

        /*
           Safety checks in case an array
           is missing from backend response
        */

        data.parked = Array.isArray(data.parked)
            ? data.parked
            : [];

        data.queue = Array.isArray(data.queue)
            ? data.queue
            : [];

        data.history = Array.isArray(data.history)
            ? data.history
            : [];

        data.revenue = Number(data.revenue || 0);


        console.log('Backend state received:', data);
        console.log('Parked vehicles:', data.parked);


        render();

    } catch (error) {

        toast('Backend error: ' + error.message);

        console.error(
            'Failed to load backend state:',
            error
        );

    }
}


// ===============================
// RENDER COMPLETE UI
// ===============================

function getFilteredHistory() {
    const searchInput = $('historySearch');
    const query = normalize(searchInput ? searchInput.value : '');

    if (!query) {
        return data.history.slice().reverse();
    }

    return data.history
        .filter(vehicle =>
            String(vehicle.vehicleNo || '')
                .toUpperCase()
                .includes(query)
        )
        .slice()
        .reverse();
}

function renderHistoryTable() {
    if (!$('historyTable')) {
        return;
    }

    const filteredHistory = getFilteredHistory();

    if ($('historyCount')) {
        $('historyCount').textContent = filteredHistory.length;
    }

    $('historyTable').innerHTML = filteredHistory.length
        ? filteredHistory.map(vehicle => `

            <tr>

                <td>
                    <strong>
                        ${vehicle.vehicleNo}
                    </strong>
                </td>

                <td>
                    ${vehicle.type}
                </td>

                <td>
                    ${vehicle.slot}
                </td>

                <td>
                    ${
                            vehicle.entry
                                ? formatTimestamp(vehicle.entry)
                                : '-'
                    }
                </td>

                <td>
                    ${ vehicle.exit ? formatTimestamp(vehicle.exit) : '-' }
                </td>

                <td>
                    ${vehicle.minutes} min (${Number(vehicle.hours).toFixed(2)} hr)
                </td>

                <td>
                    <strong>
                        ₹${Number(vehicle.charge).toFixed(2)}
                    </strong>
                </td>

            </tr>

        `).join('')
        : `

            <tr>

                <td
                    colspan="7"
                    class="empty"
                >
                    No matching parking history
                </td>

            </tr>

        `;
}

function render() {

    const carFree = freeSlots('Car');
    const bikeFree = freeSlots('Bike');

    const free = [
        ...carFree,
        ...bikeFree
    ];


    // -------------------------------
    // DASHBOARD COUNTERS
    // -------------------------------

    if ($('available')) {
        $('available').textContent = free.length;
    }

    if ($('revenue')) {
        $('revenue').textContent = formatCurrency(data.revenue);
    }

    if ($('occupied')) {
        $('occupied').textContent = data.parked.length;
    }

    if ($('waiting')) {
        $('waiting').textContent = data.queue.length;
    }

    if ($('queueBadge')) {
        $('queueBadge').textContent = data.queue.length;
    }

    const totalSlots = CAR_SLOTS + BIKE_SLOTS;
    const occupiedCount = data.parked.length;
    const availableCount = totalSlots - occupiedCount;
    const occupancyPercent = totalSlots
        ? Math.round((occupiedCount / totalSlots) * 100)
        : 0;

    if ($('heroOccupancy')) {
        $('heroOccupancy').textContent = `${occupancyPercent}%`;
    }

    if ($('heroActive')) {
        $('heroActive').textContent = occupiedCount;
    }

    if ($('metricAvailable')) {
        $('metricAvailable').textContent = availableCount;
    }

    if ($('metricAvailablePill')) {
        $('metricAvailablePill').textContent = availableCount;
    }

    if ($('metricQueued')) {
        $('metricQueued').textContent = data.queue.length;
    }

    if ($('heroRevenue')) {
        $('heroRevenue').textContent = formatCurrency(data.revenue);
    }

    if ($('carOccupancyLabel')) {
        $('carOccupancyLabel').textContent = `${CAR_SLOTS - carFree.length} / ${CAR_SLOTS}`;
    }

    if ($('bikeOccupancyLabel')) {
        $('bikeOccupancyLabel').textContent = `${BIKE_SLOTS - bikeFree.length} / ${BIKE_SLOTS}`;
    }

    if ($('carBarFill')) {
        $('carBarFill').style.width = `${Math.round(((CAR_SLOTS - carFree.length) / CAR_SLOTS) * 100)}%`;
    }

    if ($('bikeBarFill')) {
        $('bikeBarFill').style.width = `${Math.round(((BIKE_SLOTS - bikeFree.length) / BIKE_SLOTS) * 100)}%`;
    }


    // -------------------------------
    // CAR COUNTERS
    // -------------------------------

    if ($('carAvailable')) {
        $('carAvailable').textContent = carFree.length;
    }

    if ($('carOccupied')) {
        $('carOccupied').textContent =
            CAR_SLOTS - carFree.length;
    }

    if ($('carTotal')) {
        $('carTotal').textContent = CAR_SLOTS;
    }


    // -------------------------------
    // BIKE COUNTERS
    // -------------------------------

    if ($('bikeAvailable')) {
        $('bikeAvailable').textContent = bikeFree.length;
    }

    if ($('bikeOccupied')) {
        $('bikeOccupied').textContent =
            BIKE_SLOTS - bikeFree.length;
    }

    if ($('bikeTotal')) {
        $('bikeTotal').textContent = BIKE_SLOTS;
    }


    // -------------------------------
    // LIVE COUNTERS
    // -------------------------------

    document
        .querySelectorAll('.live-available')
        .forEach(element => {

            element.textContent = availableCount;

        });


    document
        .querySelectorAll('.live-occupied')
        .forEach(element => {

            element.textContent = data.parked.length;

        });


    // ===============================
    // PARKING SLOTS UI
    // ===============================

    const slotsContainer = $('slots');

    if (slotsContainer) {

        const carSlotsHTML = slotsFor('Car')
            .map(slotNumber => {

                const vehicle = data.parked.find(v =>

                    String(v.slot || '')
                        .trim()
                        .toUpperCase() ===

                    String(slotNumber)
                        .trim()
                        .toUpperCase()

                );


                return `

                    <div class="
                        slot
                        car-slot
                        ${vehicle ? 'occupied' : ''}
                    ">

                        <span class="slot-vehicle">
                            🚗
                        </span>

                        <strong>
                            ${slotNumber}
                        </strong>

                        <small>
                            ${
                                vehicle
                                    ? vehicle.vehicleNo
                                    : 'AVAILABLE'
                            }
                        </small>

                    </div>

                `;

            })
            .join('');


        const bikeSlotsHTML = slotsFor('Bike')
            .map(slotNumber => {

                const vehicle = data.parked.find(v =>

                    String(v.slot || '')
                        .trim()
                        .toUpperCase() ===

                    String(slotNumber)
                        .trim()
                        .toUpperCase()

                );


                return `

                    <div class="
                        slot
                        bike-slot
                        ${vehicle ? 'occupied' : ''}
                    ">

                        <span class="slot-vehicle">
                            🏍️
                        </span>

                        <strong>
                            ${slotNumber}
                        </strong>

                        <small>
                            ${
                                vehicle
                                    ? vehicle.vehicleNo
                                    : 'AVAILABLE'
                            }
                        </small>

                    </div>

                `;

            })
            .join('');


        slotsContainer.innerHTML = `

            <div class="slot-zone">

                <div class="zone-title">

                    <span>🚗</span>

                    <div>

                        <strong>
                            Car Parking
                        </strong>

                        <small>
                            ${carFree.length}
                            of
                            ${CAR_SLOTS}
                            available
                        </small>

                    </div>

                </div>


                <div class="zone-grid">

                    ${carSlotsHTML}

                </div>

            </div>


            <div class="slot-zone">

                <div class="zone-title">

                    <span>🏍️</span>

                    <div>

                        <strong>
                            Bike Parking
                        </strong>

                        <small>
                            ${bikeFree.length}
                            of
                            ${BIKE_SLOTS}
                            available
                        </small>

                    </div>

                </div>


                <div class="zone-grid">

                    ${bikeSlotsHTML}

                </div>

            </div>

        `;

    }


    // ===============================
    // PARKING HISTORY TABLE
    // ===============================

    renderHistoryTable();


    // ===============================
    // CURRENTLY PARKED VEHICLES
    // ===============================

    if ($('parkedTable')) {

        $('parkedTable').innerHTML =
            data.parked.length

                ? data.parked
                    .map(vehicle => `

                        <tr>

                            <td>
                                <strong>
                                    ${vehicle.vehicleNo}
                                </strong>
                            </td>

                            <td>
                                ${vehicle.type}
                            </td>

                            <td>
                                ${vehicle.mobile}
                            </td>

                            <td>
                                ${vehicle.slot}
                            </td>

                            <td>
                                ${
                                        vehicle.entry
                                            ? formatTimestamp(vehicle.entry)
                                            : '-'
                                }
                            </td>

                        </tr>

                    `)
                    .join('')

                : `

                    <tr>

                        <td
                            colspan="5"
                            class="empty"
                        >
                            No vehicles currently parked
                        </td>

                    </tr>

                `;

    }


    // ===============================
    // VALET QUEUE
    // ===============================

    if ($('queueList')) {

        $('queueList').innerHTML =
            data.queue.length

                ? data.queue
                    .map((vehicle, index) => `

                        <div class="queueitem">

                            <span class="qnum">
                                ${index + 1}
                            </span>

                            <div>

                                <strong>
                                    ${vehicle.vehicleNo}
                                </strong>

                                <small>

                                    ${vehicle.type}
                                    ·
                                    ${vehicle.mobile}
                                    ·
                                    Waiting since
                                    ${ vehicle.entry ? formatTime(vehicle.entry) : '-' }

                                </small>

                            </div>

                        </div>

                    `)
                    .join('')

                : `

                    <div class="empty">
                        🎉 No vehicles waiting.
                        Queue is clear.
                    </div>

                `;

    }

}


// ===============================
// HISTORY SEARCH
// ===============================

if ($('historySearch')) {

    $('historySearch').addEventListener('input', renderHistoryTable);

}


// ===============================
// SIDEBAR NAVIGATION
// ===============================

document
    .querySelectorAll('.nav')
    .forEach(button => {

        button.onclick = () => {

            document
                .querySelectorAll('.nav, .page')
                .forEach(element => {

                    element.classList.remove('active');

                });


            button.classList.add('active');


            const page = $(button.dataset.page);

            if (page) {
                page.classList.add('active');
            }


            const titles = {

                dashboard: 'Parking Dashboard',

                entry: 'New Vehicle Entry',

                exit: 'Vehicle Exit',

                slotsPage: 'Parking Slots',

                history: 'Parking History',

                queue: 'Valet Waiting Queue'

            };


            if ($('pageTitle')) {

                $('pageTitle').textContent =
                    titles[button.dataset.page] || '';

            }

        };

    });


// ===============================
// VEHICLE ENTRY
// ===============================

if ($('entryForm')) {

    $('entryForm').onsubmit = async event => {

        event.preventDefault();


        try {

            const vehicleNumber =
                normalize($('vehicleNo').value);


            const result = await api(
                '/api/vehicle-entry',
                {

                    method: 'POST',

                    body: JSON.stringify({

                        vehicleNo: vehicleNumber,

                        type: $('vehicleType').value,

                        mobile: $('mobile').value

                    })

                }
            );


            if (result.queued) {
                showModal(
                    '⌛',
                    'Queued for Parking',
                    `<strong>${vehicleNumber}</strong> has been added to the valet queue. The system will assign a slot automatically as soon as one becomes available.`
                );
            } else {
                showModal(
                    '✅',
                    'Slot Assigned',
                    `<strong>${vehicleNumber}</strong> is parked in <b>${result.slot}</b>. Track the current status on the dashboard.`
                );
            }


            event.target.reset();


            document
                .querySelectorAll('.vehicle-card')
                .forEach(card => {

                    card.classList.toggle(
                        'selected',
                        card.dataset.type === 'Car'
                    );

                });


            if ($('vehicleType')) {
                $('vehicleType').value = 'Car';
            }


            /*
               Reload latest data from MySQL
               through Flask backend.
            */

            await loadState();


        } catch (error) {

            toast(error.message);

            console.error(
                'Vehicle entry failed:',
                error
            );

        }

    };

}


// ===============================
// VEHICLE LOOKUP FOR EXIT
// ===============================

if ($('exitForm')) {

    $('exitForm').onsubmit = async event => {

        event.preventDefault();


        try {

            const vehicleNumber =
                normalize($('exitNo').value);


            const result = await api(

                '/api/vehicle-lookup',

                {

                    method: 'POST',

                    body: JSON.stringify({

                        vehicleNo: vehicleNumber

                    })

                }

            );


            const vehicle = result.vehicle;
            const backendHours = Number(vehicle.hours).toFixed(2);
            const backendCharge = Number(vehicle.charge).toFixed(2);

            $('exitResult').innerHTML = `

                <div class="receipt" id="currentReceipt">

                    <h3>
                        Parking Receipt
                    </h3>

                    <div class="receiptrow">
                        <span>Vehicle</span>
                        <b>${vehicle.vehicleNo}</b>
                    </div>

                    <div class="receiptrow">
                        <span>Slot</span>
                        <b>${vehicle.slot}</b>
                    </div>

                    <div class="receiptrow">
                        <span>Duration</span>
                        <b>${vehicle.minutes} min (${backendHours} hr)</b>
                    </div>

                    <div class="receiptrow">
                        <span>Rate</span>
                        <b>₹${vehicle.rate}/hour</b>
                    </div>

                    <div class="receiptrow">
                        <span>Total</span>
                        <span class="charge">₹${backendCharge}</span>
                    </div>

                    <div class="actions">
                        <button class="primary" onclick="completeExit('${vehicle.vehicleNo}')">Complete Exit & Free Slot</button>
                        <button class="secondary" onclick="printReceipt('#currentReceipt')">🖨️ Print</button>
                        <button class="secondary" onclick="downloadReceiptPDF('#currentReceipt','receipt_${vehicle.vehicleNo}.pdf')">⬇️ Download PDF</button>
                    </div>

                </div>

            `;


        } catch (error) {

            $('exitResult').innerHTML = `

                <div class="receipt">

                    ❌ ${error.message}

                </div>

            `;

        }

    };

}


// ===============================
// COMPLETE VEHICLE EXIT
// ===============================

window.completeExit = async vehicleNumber => {

    try {

        const result = await api(

            '/api/vehicle-exit',

            {

                method: 'POST',

                body: JSON.stringify({

                    vehicleNo: vehicleNumber

                })

            }

        );


        if (result.movedVehicle) {
            showModal(
                '✔️',
                'Exit Completed',
                `${result.movedVehicle} departed and slot <strong>${result.freedSlot}</strong> is now allocated to the next queued vehicle.`
            );
        } else {
            showModal(
                '✔️',
                'Exit Completed',
                `Slot <strong>${result.freedSlot}</strong> is now available for the next arrival.`
            );
        }


        if ($('exitResult')) {
            $('exitResult').innerHTML = '';
        }


        if ($('exitForm')) {
            $('exitForm').reset();
        }


        /*
           Reload updated state after exit.
        */

        await loadState();


    } catch (error) {

        toast(error.message);

        console.error(
            'Vehicle exit failed:',
            error
        );

    }

};


// ===============================
// MODAL
// ===============================

function showModal(icon, title, message) {

    if (!$('modalContent') || !$('modal')) {
        return;
    }

    $('modalContent').innerHTML = `

        <div class="modal-icon">${icon}</div>
        <h2>${title}</h2>
        <p class="modal-message">${message}</p>
        <button class="primary modal-action" onclick="closeModal()">Got it</button>

    `;

    $('modal').classList.add('show');

}


window.closeModal = () => {

    if ($('modal')) {
        $('modal').classList.remove('show');
    }

};


if ($('modal')) {

    $('modal').onclick = event => {

        if (event.target === $('modal')) {

            closeModal();

        }

    };

}


// ===============================
// VEHICLE TYPE SELECTION
// ===============================

document
    .querySelectorAll('.vehicle-card')
    .forEach(card => {

        card.onclick = () => {

            document
                .querySelectorAll('.vehicle-card')
                .forEach(vehicleCard => {

                    vehicleCard.classList.remove('selected');

                });


            card.classList.add('selected');


            if ($('vehicleType')) {

                $('vehicleType').value =
                    card.dataset.type;

            }

        };

    });


// ===============================
// INITIAL LOAD
// ===============================

// Charts and PDF helpers
let occupancyChart = null;
let revenueChart = null;
let typeChart = null;

function initCharts() {
    if (typeof Chart === 'undefined') return;

    const occEl = document.getElementById('occupancyChart');
    const revEl = document.getElementById('revenueChart');
    const typeEl = document.getElementById('typeChart');

    if (occEl && !occupancyChart) {
        occupancyChart = new Chart(occEl.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Cars', 'Bikes', 'Available'],
                datasets: [{
                    data: [],
                    backgroundColor: ['#5d8cff', '#2ee7a7', '#7f8bb3'],
                    borderWidth: 2,
                    borderColor: '#0f1b38',
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                cutout: '68%',
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, color: '#c8d8f5' } },
                    title: { display: true, text: 'Live occupancy snapshot', color: '#d6e3ff', font: { size: 14 } },
                    tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.formattedValue}` } }
                }
            }
        });
    }

    if (revEl && !revenueChart) {
        const gradient = revEl.getContext('2d').createLinearGradient(0, 0, 0, 220);
        gradient.addColorStop(0, 'rgba(93, 140, 255, 0.36)');
        gradient.addColorStop(1, 'rgba(93, 140, 255, 0.08)');

        revenueChart = new Chart(revEl.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Revenue',
                    data: [],
                    borderColor: '#5d8cff',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.32,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#5d8cff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Recent exit revenue', color: '#dce8ff', font: { size: 14 } },
                    tooltip: { callbacks: { label: ctx => `₹${ctx.formattedValue}` } }
                },
                scales: {
                    x: { ticks: { color: '#b7c7ea', maxRotation: 0, autoSkip: true }, grid: { color: 'rgba(255,255,255,0.06)' } },
                    y: { ticks: { color: '#b7c7ea' }, grid: { color: 'rgba(255,255,255,0.06)' }, beginAtZero: true }
                }
            }
        });
    }

    if (typeEl && !typeChart) {
        typeChart = new Chart(typeEl.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Car', 'Bike'],
                datasets: [{
                    label: 'Count',
                    data: [],
                    backgroundColor: ['#5d8cff', '#2ee7a7'],
                    borderRadius: 20,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Current parked mix', color: '#d6e3ff', font: { size: 14 } },
                    tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.formattedValue}` } }
                },
                scales: {
                    x: { ticks: { color: '#b7c7ea' }, grid: { display: false } },
                    y: { ticks: { color: '#b7c7ea', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.06)' }, beginAtZero: true }
                }
            }
        });
    }

}

function updateCharts() {
    try {
        if (!occupancyChart || !revenueChart || !typeChart) {
            initCharts();
        }

        const carFree = freeSlots('Car');
        const bikeFree = freeSlots('Bike');
        const carOccupied = CAR_SLOTS - carFree.length;
        const bikeOccupied = BIKE_SLOTS - bikeFree.length;
        const total = CAR_SLOTS + BIKE_SLOTS;
        const availableCount = total - data.parked.length;

        if ($('analysisParked')) {
            $('analysisParked').textContent = data.parked.length;
        }

        if ($('analysisRevenue')) {
            $('analysisRevenue').textContent = formatCurrency(data.revenue);
        }

        if ($('analysisQueue')) {
            $('analysisQueue').textContent = data.queue.length;
        }

        const exitHistory = (data.history || [])
            .filter(v => v.exit && Number(v.charge || 0) >= 0)
            .slice()
            .sort((a, b) => new Date(a.exit) - new Date(b.exit));

        const avgMinutes = exitHistory.length
            ? Math.round(exitHistory.reduce((sum, v) => sum + Number(v.minutes || 0), 0) / exitHistory.length)
            : 0;

        if ($('analysisAvgDuration')) {
            $('analysisAvgDuration').textContent = exitHistory.length
                ? `${avgMinutes} min`
                : 'N/A';
        }

        if (occupancyChart) {
            occupancyChart.data.datasets[0].data = [carOccupied, bikeOccupied, availableCount];
            occupancyChart.update();
        }

        if (revenueChart) {
            const recentExits = exitHistory.slice(-10);
            revenueChart.data.labels = recentExits.map(v => formatTime(v.exit));
            revenueChart.data.datasets[0].data = recentExits.map(v => Number(v.charge || 0));
            revenueChart.update();
        }

        if (typeChart) {
            const parkedCar = data.parked.filter(v => v.type === 'Car').length;
            const parkedBike = data.parked.filter(v => v.type === 'Bike').length;
            typeChart.data.datasets[0].data = [parkedCar, parkedBike];
            typeChart.update();
        }

    } catch (e) {
        console.error('Chart update failed', e);
    }
}

window.printReceipt = selector => {
    const el = document.querySelector(selector);
    if (!el) return toast('Nothing to print');
    const w = window.open('', '_blank');
    w.document.write('<html><head><title>Receipt</title><style>body{font-family:Inter,Arial,sans-serif;padding:18px;color:#111} .receipt{max-width:520px;margin:0 auto}</style></head><body>');
    w.document.write(el.outerHTML);
    w.document.write('</body></html>');
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
};

window.downloadReceiptPDF = (selector, filename) => {
    const el = document.querySelector(selector);
    if (!el) return toast('Nothing to export');
    if (typeof html2pdf === 'undefined') return toast('PDF library not loaded');

    const clone = el.cloneNode(true);
    clone.style.width = '100%';
    clone.style.maxWidth = '520px';
    clone.style.padding = '22px';
    clone.style.background = '#ffffff';
    clone.style.color = '#111111';
    clone.style.border = '1px solid #d1d5db';
    clone.style.borderRadius = '18px';
    clone.style.boxSizing = 'border-box';

    clone.querySelectorAll('.receiptrow').forEach(row => {
        row.style.borderBottom = '1px solid #e5e7eb';
    });
    clone.querySelectorAll('.charge').forEach(el => {
        el.style.color = '#06774f';
    });
    clone.querySelectorAll('.actions').forEach(action => action.remove());

    const wrapper = document.createElement('div');
    wrapper.style.padding = '10px';
    wrapper.style.background = '#ffffff';
    wrapper.appendChild(clone);

    const opt = {
        margin: 10,
        filename: filename || 'receipt.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(wrapper).save();
};

// Update charts whenever we re-render
const originalRender = render;
render = function() {
    originalRender();
    updateCharts();
};

loadState();