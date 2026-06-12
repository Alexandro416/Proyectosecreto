const user = JSON.parse(localStorage.getItem('user'));
if (user) {
    document.getElementById('link-login').style.display = 'none';
    document.getElementById('link-perfil').style.display = 'inline';
    document.getElementById('link-logout').style.display = 'inline';
    if(user.rol === 'admin') document.getElementById('link-perfil').href = 'admin.html';
}

function irAReservar() {
    if (user) window.location.href = 'sedes.html';
    else window.location.href = 'login.html';
}