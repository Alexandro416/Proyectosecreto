const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// URL de conexión a la base de datos MySQL (Railway)
const dbUrl = process.env.MYSQL_URL;

// Configuración del correo (NodeMailer)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

// --- 1. AUTENTICACIÓN ---

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const connection = await mysql.createConnection(dbUrl);
        const [rows] = await connection.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
        await connection.end();

        if (rows.length > 0) {
            // Comparación de la contraseña ingresada con la encriptada
            const contrasenaValida = await bcrypt.compare(password, rows[0].password);
            if (contrasenaValida) {
                const { password: pwd, ...userSinPassword } = rows[0];
                res.json({ success: true, user: userSinPassword });
            } else {
                res.json({ success: false, message: 'Contraseña incorrecta' });
            }
        } else {
            res.json({ success: false, message: 'Usuario no encontrado' });
        }
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Registro
app.post('/api/registro', async (req, res) => {
    try {
        // Se omiten teléfono y dirección porque no existen en el modelo de base de datos actual
        const { nombre, email, password } = req.body;
        const connection = await mysql.createConnection(dbUrl);

        const [existentes] = await connection.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existentes.length > 0) {
            await connection.end();
            return res.json({ success: false, message: 'Este correo ya está registrado.' });
        }

        const saltos = 10;
        const passwordEncriptada = await bcrypt.hash(password, saltos);

        const [resultado] = await connection.execute(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, "cliente")',
            [nombre, email, passwordEncriptada]
        );

        const [nuevoUsuario] = await connection.execute(
            'SELECT id, nombre, email, rol FROM usuarios WHERE id = ?',
            [resultado.insertId]
        );

        await connection.end();
        res.json({ success: true, user: nuevoUsuario[0] });
    } catch (error) { res.status(500).json({ error: error.message }); }
});


// --- 2. RESERVAS Y CANCHAS ---

// Obtener disponibilidad
app.get('/api/disponibilidad/:fecha', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbUrl);
        const [canchas] = await connection.execute('SELECT * FROM canchas');
        // AHORA BLOQUEA CANCHAS CONFIRMADAS Y PENDIENTES
        const [reservas] = await connection.execute('SELECT cancha_id, hora_inicio FROM reservas WHERE fecha = ? AND estado IN ("confirmada", "pendiente")', [req.params.fecha]);
        await connection.end();
        res.json({ canchas, reservas });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Crear Reserva + Enviar Correo
app.post('/api/reservar', async (req, res) => {
    try {
        const { usuario_id, cancha_id, fecha, hora_inicio, metodo_pago } = req.body;
        const connection = await mysql.createConnection(dbUrl);

        // LÓGICA: Si es QR, queda pendiente. Si es tarjeta, se confirma de frente.
        const estado_inicial = (metodo_pago === 'qr') ? 'pendiente' : 'confirmada';

        await connection.execute(
            'INSERT INTO reservas (usuario_id, cancha_id, fecha, hora_inicio, metodo_pago, estado) VALUES (?, ?, ?, ?, ?, ?)',
            [usuario_id, cancha_id, fecha, hora_inicio, metodo_pago, estado_inicial]
        );
        const [userData] = await connection.execute('SELECT nombre, email FROM usuarios WHERE id = ?', [usuario_id]);
        const [canchaData] = await connection.execute('SELECT nombre FROM canchas WHERE id = ?', [cancha_id]);
        await connection.end();

        // Solo enviamos el correo si se pagó con tarjeta (confirmada)
        if (estado_inicial === 'confirmada' && userData.length > 0 && process.env.EMAIL_USER) {
            const mailOptions = {
                from: `"Depor Plaza ⚽" <${process.env.EMAIL_USER}>`,
                to: userData[0].email,
                subject: '¡Tu reserva está confirmada! 🎉',
                html: `<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                        <h2 style="color: #1b5e20;">¡Hola, ${userData[0].nombre}!</h2>
                        <p>Tu reserva ha sido registrada exitosamente:</p>
                        <p>⚽ Cancha: ${canchaData[0].nombre} <br> 📅 Fecha: ${fecha} <br> 🕒 Hora: ${hora_inicio.substring(0, 5)}</p>
                    </div>`
            };
            transporter.sendMail(mailOptions).catch(console.error);
        }
        res.json({ success: true, estado: estado_inicial });
    } catch (error) { res.status(500).json({ error: error.message }); }
});


// --- 3. PERFIL DEL USUARIO ---

// Obtener reservas del usuario 
app.get('/api/mis-reservas/:id', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbUrl);
        const [rows] = await connection.execute(`
            SELECT r.id, r.fecha, r.hora_inicio, r.estado, c.nombre, c.tipo, c.precio 
            FROM reservas r JOIN canchas c ON r.cancha_id = c.id 
            WHERE r.usuario_id = ? ORDER BY r.fecha DESC, r.hora_inicio DESC
        `, [req.params.id]);
        await connection.end();
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Cancelar reserva desde el perfil
app.post('/api/reservas/:id/cancelar', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbUrl);
        await connection.execute('UPDATE reservas SET estado = "cancelada" WHERE id = ?', [req.params.id]);
        await connection.end();
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Obtener datos del perfil
app.get('/api/perfil/:id', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbUrl);
        // Filtrado para que solo pida datos que sí existen en la tabla
        const [rows] = await connection.execute('SELECT nombre, email FROM usuarios WHERE id = ?', [req.params.id]);
        await connection.end();
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ error: 'Usuario no encontrado' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Editar datos del perfil
app.put('/api/perfil/:id', async (req, res) => {
    try {
        const { campo, valor } = req.body;
        // Evitar que el frontend intente actualizar campos que no existen
        if (campo === 'telefono' || campo === 'direccion') {
            return res.json({ success: true, message: 'Campo ignorado de forma segura' });
        }
        
        const connection = await mysql.createConnection(dbUrl);
        await connection.execute(`UPDATE usuarios SET ${campo} = ? WHERE id = ?`, [valor, req.params.id]);
        await connection.end();
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});


// --- 4. PANEL ADMINISTRADOR ---

// Obtener todas las reservas (Admin)
app.get('/api/admin/reservas', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbUrl);
        const [rows] = await connection.execute(`
            SELECT r.id, r.fecha, r.hora_inicio, r.estado, r.metodo_pago, 
                   u.nombre as usuario, u.email, c.nombre as cancha
            FROM reservas r JOIN usuarios u ON r.usuario_id = u.id JOIN canchas c ON r.cancha_id = c.id
            ORDER BY r.fecha DESC, r.hora_inicio DESC
        `);
        await connection.end();
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Cancelar reserva (Admin)
app.post('/api/admin/reservas/:id/cancelar', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbUrl);
        await connection.execute('UPDATE reservas SET estado = "cancelada" WHERE id = ?', [req.params.id]);
        await connection.end();
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Aprobar reserva (Admin)
app.post('/api/admin/reservas/:id/confirmar', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbUrl);
        await connection.execute('UPDATE reservas SET estado = "confirmada" WHERE id = ?', [req.params.id]);
        await connection.end();
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});


// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`¡Servidor corriendo exitosamente en el puerto ${PORT}!`);
}
