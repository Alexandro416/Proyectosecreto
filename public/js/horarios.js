 const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            alert("Por favor, inicia sesión para reservar.");
            window.location.href = 'login.html';
        } else {
            document.getElementById('user-display').innerText = `👤 ${user.nombre}`;
            document.getElementById('modal-user-name').value = user.nombre;
            document.getElementById('modal-user-email').value = user.email;
        }

        const hours = ["15:00:00", "16:00:00", "17:00:00", "18:00:00", "19:00:00", "20:00:00", "21:00:00"];
        let currentDate = new Date();
        let selectedSlot = null;

        document.addEventListener("DOMContentLoaded", () => {
            setupDateControls();
            setupModalControls();
            updateDateDisplay();
            cargarGrillaAPI();
        });

        // --- Lógica de Fechas ---
        function setupDateControls() {
            document.getElementById('btn-prev-day').addEventListener('click', () => changeDate(-1));
            document.getElementById('btn-next-day').addEventListener('click', () => changeDate(1));
            document.getElementById('btn-today').addEventListener('click', () => {
                currentDate = new Date();
                updateDateDisplay();
                cargarGrillaAPI();
            });
        }

        function changeDate(days) {
            currentDate.setDate(currentDate.getDate() + days);
            updateDateDisplay();
            cargarGrillaAPI();
        }

        function updateDateDisplay() {
            const d = String(currentDate.getDate()).padStart(2, '0');
            const m = String(currentDate.getMonth() + 1).padStart(2, '0');
            const y = currentDate.getFullYear();
            document.getElementById('date-display').value = `${d}/${m}/${y}`;
            closeSelectionBar();
        }

        function getDBDateFormat() {
            const y = currentDate.getFullYear();
            const m = String(currentDate.getMonth() + 1).padStart(2, '0');
            const d = String(currentDate.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        function getFormattedModalDate() {
            const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
            return `${currentDate.getDate()} ${months[currentDate.getMonth()]}`;
        }

        // --- Conexión con la Base de Datos (API) ---
        async function cargarGrillaAPI() {
            try {
                const fechaDB = getDBDateFormat();
                const res = await fetch(`/api/disponibilidad/${fechaDB}`);
                const data = await res.json();
                
                renderTableHeader(data.canchas);
                renderTableBody(data.canchas, data.reservas);
            } catch (error) {
                console.error("Error cargando disponibilidad:", error);
            }
        }

        function renderTableHeader(canchas) {
            const headerRow = document.getElementById('table-header');
            headerRow.innerHTML = '<th class="sticky-col">HORA</th>'; 
            
            canchas.forEach(court => {
                const th = document.createElement('th');
                th.innerHTML = `
                    <div class="court-name">${court.nombre}</div>
                    <div class="court-type">${court.tipo}</div>
                `;
                headerRow.appendChild(th);
            });
        }

        function renderTableBody(canchas, reservas) {
            const tbody = document.getElementById('table-body');
            tbody.innerHTML = ""; 

            // Calculamos si la fecha mostrada es anterior a HOY para bloquear todo el pasado
            const todayStr = new Date().toISOString().split('T')[0];
            const isPast = getDBDateFormat() < todayStr;

            hours.forEach((hour, index) => {
                const tr = document.createElement('tr');
                const tdHour = document.createElement('td');
                tdHour.className = 'sticky-col';
                tdHour.textContent = hour.substring(0,5);
                tr.appendChild(tdHour);

                const nextHour = hours[index + 1] ? hours[index + 1].substring(0,5) : String(parseInt(hour) + 1) + ":00";

                canchas.forEach(court => {
                    const td = document.createElement('td');
                    
                    // Buscar si hay una reserva en BD para esta cancha y esta hora
                    const ocupada = reservas.find(r => r.cancha_id === court.id && r.hora_inicio === hour);
                    
                    const isAvailable = !ocupada && !isPast; // Disponible si no está ocupada y no es un día pasado

                    td.className = `cell ${isAvailable ? 'available' : 'occupied'}`;
                    td.textContent = isAvailable ? `S/${court.precio}` : 'Ocupado';
                    
                    if (isAvailable) {
                        td.addEventListener('click', () => handleCellClick(td, court, hour.substring(0,5), nextHour));
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        }

        // --- Lógica de Selección y Modal ---
        function handleCellClick(cellElement, court, startHour, endHour) {
            if (cellElement.classList.contains('selected')) {
                cellElement.classList.remove('selected');
                cellElement.classList.add('available');
                closeSelectionBar();
                return;
            }

            const prevSelected = document.querySelector('.cell.selected');
            if (prevSelected) {
                prevSelected.classList.remove('selected');
                prevSelected.classList.add('available');
            }

            cellElement.classList.remove('available');
            cellElement.classList.add('selected');
            
            document.getElementById('bar-court').textContent = court.nombre;
            document.getElementById('bar-time-val').textContent = `${startHour} - ${endHour}`;
            document.getElementById('bar-price-val').textContent = parseFloat(court.precio).toFixed(2);
            document.getElementById('selection-bar').classList.remove('hidden');

            selectedSlot = { 
                cancha_id: court.id, 
                court_name: court.nombre, 
                hora_inicio: startHour + ":00", // Formato BD
                time_display: `${startHour} - ${endHour}`, 
                price: parseFloat(court.precio).toFixed(2) 
            };
        }

        function closeSelectionBar() {
            document.getElementById('selection-bar').classList.add('hidden');
            const selectedCell = document.querySelector('.cell.selected');
            if (selectedCell) {
                selectedCell.classList.remove('selected');
                selectedCell.classList.add('available');
            }
        }

        function setupModalControls() {
            document.getElementById('btn-close-bar').addEventListener('click', closeSelectionBar);
            
            document.getElementById('btn-open-modal').addEventListener('click', () => {
                document.getElementById('mod-court').textContent = selectedSlot.court_name;
                document.getElementById('mod-date').textContent = getFormattedModalDate();
                document.getElementById('mod-time').textContent = selectedSlot.time_display;
                document.getElementById('mod-price').textContent = selectedSlot.price;
                document.getElementById('booking-modal').classList.remove('hidden');
            });

            const closeModal = () => document.getElementById('booking-modal').classList.add('hidden');
            
            document.getElementById('btn-close-modal').addEventListener('click', closeModal);
            document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);

            // Botón FINAL para enviar a la BD
            document.getElementById('btn-confirm-booking').addEventListener('click', async () => {
                const payload = {
                    usuario_id: user.id,
                    cancha_id: selectedSlot.cancha_id,
                    fecha: getDBDateFormat(),
                    hora_inicio: selectedSlot.hora_inicio,
                    metodo_pago: document.getElementById('metodoPago').value
                };

                try {
                    const res = await fetch('/api/reservar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    
                    if(data.success) {
                        alert('¡Reserva confirmada exitosamente!');
                        closeModal();
                        closeSelectionBar();
                        cargarGrillaAPI(); // Recargar para que aparezca en rojo
                    } else {
                        alert('Error al reservar.');
                    }
                } catch (error) {
                    console.error('Error:', error);
                }
            });
        }