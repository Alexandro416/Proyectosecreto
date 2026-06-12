const user = JSON.parse(localStorage.getItem('user'));
if(!user) window.location.href = 'login.html';

document.getElementById('user-name').innerText = user.nombre;
document.getElementById('user-email').innerText = user.email;
const iniciales = user.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
document.getElementById('user-initials').innerText = iniciales;

function formatearFecha(fechaIso) {
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const fecha = new Date(fechaIso);
    fecha.setMinutes(fecha.getMinutes() + fecha.getTimezoneOffset()); 
    return `${fecha.getDate()} ${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

async function cargarReservas() {
    try {
        const res = await fetch(`/api/mis-reservas/${user.id}`);
        const reservas = await res.json();
        const contenedor = document.getElementById('lista-reservas');
        
        const activas = reservas.filter(r => r.estado === 'confirmada').length;
        document.getElementById('contador-reservas').innerText = `${activas} reserva(s) activa(s)`;

        if(reservas.length === 0) {
            contenedor.innerHTML = '<p style="color: #6c757d;">No tienes reservas registradas. ¡Anímate a reservar tu primera cancha!</p>';
            return;
        }

        contenedor.innerHTML = '';
        
        reservas.forEach(r => {
            const horaInicioStr = r.hora_inicio.substring(0,5);
            const horaFinNum = parseInt(horaInicioStr.split(':')[0]) + 1;
            const horaFinStr = `${horaFinNum}:00`;
            const fechaFormat = formatearFecha(r.fecha);
            const isConfirmada = r.estado === 'confirmada';
            const badgeClass = isConfirmada ? 'confirmada' : 'cancelada';
            const badgeText = isConfirmada ? 'Confirmada' : 'Cancelada';

            const btnCancelarHTML = isConfirmada 
                ? `<button class="btn-action btn-cancelar" onclick="cancelarReserva(${r.id})">❌ Cancelar</button>` 
                : '';

            contenedor.innerHTML += `
                <div class="res-card">
                    <div class="res-info-container">
                        <div class="res-image"></div>
                        <div class="res-details">
                            <h3>${r.nombre} — ${r.tipo || 'Grass Sintético'} <span class="badge ${badgeClass}">${badgeText}</span></h3>
                            <div class="res-id">#R-00${r.id}</div>
                            <div class="res-meta">
                                <span>📅 ${fechaFormat}</span>
                                <span>🕒 ${horaInicioStr} - ${horaFinStr}</span>
                                <span>📍 Campo de Marte</span>
                            </div>
                        </div>
                    </div>
                    <div class="res-actions">
                        <div class="res-price">S/ ${parseFloat(r.precio).toFixed(2)}</div>
                        <button class="btn-action btn-detalle" onclick="alert('Detalles próximamente')">👁️ Detalle</button>
                        ${btnCancelarHTML}
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Error al cargar:", error);
    }
}

async function cancelarReserva(id) {
    if(confirm("¿Estás seguro que deseas cancelar esta reserva?")) {
        try {
            await fetch(`/api/reservas/${id}/cancelar`, { method: 'POST' });
            cargarReservas();
        } catch(e) {
            console.error(e);
        }
    }
}

cargarReservas();