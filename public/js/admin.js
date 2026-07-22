document.addEventListener('DOMContentLoaded', () => {
    cargarReservasAdmin();
});

async function cargarReservasAdmin() {
    try {
        const res = await fetch('/api/admin/reservas');
        const reservas = await res.json();
        
        let pendientes = 0, confirmadas = 0;
        const tbody = document.getElementById('admin-table-body');
        tbody.innerHTML = '';

        reservas.forEach(r => {
            // Contadores para las tarjetas
            if(r.estado === 'pendiente') pendientes++;
            if(r.estado === 'confirmada') confirmadas++;

            const tr = document.createElement('tr');
            
            // Botones de acción dinámicos
            let actionButtons = '';
            if (r.estado === 'pendiente') {
                actionButtons = `
                    <button class="action-btn btn-approve" onclick="aprobarReserva(${r.id})">✔ Aprobar</button>
                    <button class="action-btn btn-cancel" onclick="cancelarReserva(${r.id})">✖ Rechazar</button>
                `;
            } else if (r.estado === 'confirmada') {
                actionButtons = `<button class="action-btn btn-cancel" onclick="cancelarReserva(${r.id})">✖ Cancelar</button>`;
            } else {
                actionButtons = `<span style="color:#999;">Sin acción</span>`;
            }

            tr.innerHTML = `
                <td>#${r.id}</td>
                <td><strong>${r.usuario}</strong><br><span style="font-size:12px; color:#777;">${r.email}</span></td>
                <td>${r.cancha}</td>
                <td>${new Date(r.fecha).toLocaleDateString()} <br> <span style="color:#007bff; font-weight:bold;">${r.hora_inicio.substring(0,5)}</span></td>
                <td>${r.metodo_pago === 'qr' ? 'QR / Yape' : 'Tarjeta'}</td>
                <td><span class="badge ${r.estado}">${r.estado.toUpperCase()}</span></td>
                <td>${actionButtons}</td>
            `;
            tbody.appendChild(tr);
        });

        // Actualizar las tarjetas del dashboard
        document.getElementById('tot-reservas').innerText = reservas.length;
        document.getElementById('tot-pendientes').innerText = pendientes;
        document.getElementById('tot-confirmadas').innerText = confirmadas;

    } catch (error) {
        console.error('Error cargando admin:', error);
    }
}

async function aprobarReserva(id) {
    if(!confirm("¿Aprobar esta reserva y marcarla como pagada?")) return;
    try {
        await fetch(`/api/admin/reservas/${id}/confirmar`, { method: 'POST' });
        cargarReservasAdmin();
    } catch (error) { console.error('Error:', error); }
}

async function cancelarReserva(id) {
    if(!confirm("¿Seguro que deseas cancelar esta reserva?")) return;
    try {
        await fetch(`/api/admin/reservas/${id}/cancelar`, { method: 'POST' });
        cargarReservasAdmin();
    } catch (error) { console.error('Error:', error); }
}

function cerrarSesion() {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}