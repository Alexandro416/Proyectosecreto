const user = JSON.parse(localStorage.getItem('user'));
if(!user) window.location.href = 'login.html';

document.getElementById('sidebar-name').innerText = user.nombre;
document.getElementById('sidebar-email').innerText = user.email;
document.getElementById('sidebar-initials').innerText = user.nombre.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();

async function cargarPerfil() {
    try {
        const res = await fetch(`/api/perfil/${user.id}`);
        const data = await res.json();
        
        document.getElementById('val-nombre').innerText = data.nombre;
        document.getElementById('val-email').innerText = data.email;
        document.getElementById('val-telefono').innerText = data.telefono || 'No registrado';
        document.getElementById('val-direccion').innerText = data.direccion || 'No registrada';
    } catch (error) {
        console.error("Error al cargar perfil:", error);
    }
}

async function editarCampo(campoDB, nombreMostrar) {
    const valorActual = document.getElementById(`val-${campoDB}`).innerText;
    const nuevoValor = prompt(`Ingresa tu nuevo ${nombreMostrar}:`, valorActual === 'No registrado' || valorActual === 'No registrada' ? '' : valorActual);
    
    if (nuevoValor !== null && nuevoValor.trim() !== "") {
        try {
            const res = await fetch(`/api/perfil/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campo: campoDB, valor: nuevoValor.trim() })
            });
            
            const data = await res.json();
            if (data.success) {
                document.getElementById(`val-${campoDB}`).innerText = nuevoValor.trim();
                
                if (campoDB === 'nombre' || campoDB === 'email') {
                    user[campoDB] = nuevoValor.trim();
                    localStorage.setItem('user', JSON.stringify(user));
                    if (campoDB === 'nombre') {
                        document.getElementById('sidebar-name').innerText = nuevoValor.trim();
                        document.getElementById('sidebar-initials').innerText = nuevoValor.trim().split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
                    } else {
                        document.getElementById('sidebar-email').innerText = nuevoValor.trim();
                    }
                }
            } else {
                alert("Error al actualizar: " + data.message);
            }
        } catch (error) {
            console.error("Error:", error);
        }
    }
}

cargarPerfil();