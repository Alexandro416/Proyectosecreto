const user = JSON.parse(localStorage.getItem('user'));
if(!user || user.rol !== 'admin') {
    alert('Acceso denegado.');
    window.location.href = 'login.html';
}
document.getElementById('admin-name').innerText = `👤 ${user.nombre}`;

async function cargarReservas() {
    try {
        const res = await fetch('/api/admin/reservas');
        const reservas = await res.json();
        const tbody = document.getElementById('tabla-reservas');
        tbody.innerHTML = '';

        reservas.forEach(r => {
            const fechaFormat = new Date(r.fecha).toLocaleDateString();
            const estadoHtml = r.estado === 'confirmada' 
                ? '<span class="badge bg-verde">Confirmada</span>' 
                : '<span class="badge bg-rojo">Cancelada</span>';
            
            const botonAccion = r.estado === 'confirmada'
                ? `<button class="btn-cancelar" onclick="cancelarReserva(${r.id})">Cancelar</button>`
                : '-';

            tbody.innerHTML += `
                <tr>
                    <td>${fechaFormat}</td>
                    <td>${r.hora_inicio.substring(0,5)}</td>
                    <td>${r.usuario}<br><small style="color:#64748b;">${r.email}</small></td>
                    <td>${r.cancha}</td>
                    <td>${r.metodo_pago === 'qr' ? 'QR / Yape' : 'Tarjeta'}</td>
                    <td>${estadoHtml}</td>
                    <td>${botonAccion}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Error cargando reservas:', error);
    }
}

async function cancelarReserva(id) {
    if(confirm('¿Estás seguro de cancelar esta reserva? El espacio quedará libre en la grilla.')) {
        await fetch(`/api/admin/reservas/${id}/cancelar`, { method: 'POST' });
        cargarReservas();
    }
}

cargarReservas();