function cerrarSesion() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}