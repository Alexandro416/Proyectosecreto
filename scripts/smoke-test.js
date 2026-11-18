// Prueba de humo de la API de DeporPlaza (Node.js 18 o superior).
// Uso: BASE_URL=http://localhost:3000 node scripts/smoke-test.js
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const FECHA = '2030-01-15';
const EMAIL = `ci-${Date.now()}@test.com`;
const CLAVE = 'clave-de-prueba';

function verificar(condicion, mensaje) {
  if (!condicion) {
    console.error(`✘ ${mensaje}`);
    process.exit(1);
  }
  console.log(`✔ ${mensaje}`);
}

async function post(ruta, cuerpo) {
  const r = await fetch(BASE + ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo)
  });
  return { status: r.status, datos: await r.json() };
}

async function main() {
  const pagina = await fetch(`${BASE}/login.html`);
  verificar(pagina.status === 200, 'La página de login se sirve (200)');

  let r = await fetch(`${BASE}/api/disponibilidad/${FECHA}`);
  let datos = await r.json();
  verificar(r.status === 200 && datos.canchas.length === 9,
    'Disponibilidad devuelve las 9 canchas');

  let res = await post('/api/registro',
    { nombre: 'Usuario CI', email: EMAIL, password: CLAVE });
  verificar(res.datos.success === true && res.datos.user.id,
    'Registro de usuario nuevo');
  const usuarioId = res.datos.user.id;

  res = await post('/api/login', { email: EMAIL, password: CLAVE });
  verificar(res.datos.success === true, 'Login con la contraseña correcta');

  res = await post('/api/login', { email: EMAIL, password: 'incorrecta' });
  verificar(res.datos.success === false,
    'Login rechaza la contraseña incorrecta');

  res = await post('/api/reservar', {
    usuario_id: usuarioId, cancha_id: 1, fecha: FECHA,
    hora_inicio: '15:00:00', metodo_pago: 'qr'
  });
  verificar(res.status === 200, 'Reserva pagada con QR (estado pendiente)');

  r = await fetch(`${BASE}/api/disponibilidad/${FECHA}`);
  datos = await r.json();
  const bloqueada = datos.reservas.some(
    x => x.cancha_id === 1 && x.hora_inicio === '15:00:00');
  verificar(bloqueada, 'La cancha reservada queda bloqueada');

  console.log('Prueba de humo completada');
}

main().catch(e => {
  console.error('✘ Error inesperado:', e.message);
  process.exit(1);
});
