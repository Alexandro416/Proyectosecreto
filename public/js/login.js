function toggleForms() {
    document.getElementById('login-section').classList.toggle('hidden');
    document.getElementById('register-section').classList.toggle('hidden');
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = data.user.rol === 'admin' ? 'admin.html' : 'sedes.html';
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
    }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('reg-nombre').value;
    const email = document.getElementById('reg-email').value;
    const telefono = document.getElementById('reg-telefono').value;
    const password = document.getElementById('reg-password').value;
    
    try {
        const response = await fetch('/api/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, telefono, password }) 
        });
        const data = await response.json();
        
        if (data.success) {
            alert('¡Cuenta creada con éxito!');
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = 'sedes.html';
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error:', error);
    }
});