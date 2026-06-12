const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
require('dotenv').config();


const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
// ----------------------------------------------------------------

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
        const { nombre, email, password, telefono } = req.body;
        const connection = await mysql.createConnection(dbUrl);
        
        const [existentes] = await connection.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existentes.length > 0) {
            await connection.end();
            return res.json({ success: false, message: 'Este correo ya está registrado.' });
        }

        const saltos = 10;
        const passwordEncriptada = await bcrypt.hash(password, saltos);

        const [resultado] = await connection.execute(
            'INSERT INTO usuarios (nombre, email, password, telefono, rol) VALUES (?, ?, ?, ?, "cliente")',
            [nombre, email, passwordEncriptada, telefono]
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
        const [reservas] = await connection.execute('SELECT cancha_id, hora_inicio FROM reservas WHERE fecha = ? AND estado = "confirmada"', [req.params.fecha]);
        await connection.end();
        res.json({ canchas, reservas });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Crear Reserva + Enviar Correo
app.post('/api/reservar', async (req, res) => {
    try {
        const { usuario_id, cancha_id, fecha, hora_inicio, metodo_pago } = req.body;
        const connection = await mysql.createConnection(dbUrl);
        
        await connection.execute(
            'INSERT INTO reservas (usuario_id, cancha_id, fecha, hora_inicio, metodo_pago) VALUES (?, ?, ?, ?, ?)',
            [usuario_id, cancha_id, fecha, hora_inicio, metodo_pago]
        );

        const [userData] = await connection.execute('SELECT nombre, email FROM usuarios WHERE id = ?', [usuario_id]);
        const [canchaData] = await connection.execute('SELECT nombre FROM canchas WHERE id = ?', [cancha_id]);
        await connection.end();

        if (userData.length > 0 && process.env.EMAIL_USER) {
            const mailOptions = {
                from: `"Depor Plaza ⚽" <${process.env.EMAIL_USER}>`,
                to: userData[0].email,
                subject: '¡Tu reserva está confirmada! 🎉',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 10px;">
                        <h2 style="color: #1b5e20;">¡Hola, ${userData[0].nombre}!</h2>
                        <p>Tu reserva ha sido registrada exitosamente:</p>
                        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                            <p>⚽ <strong>Cancha:</strong> ${canchaData[0].nombre}</p>
                            <p>📅 <strong>Fecha:</strong> ${fecha}</p>
                            <p>🕒 <strong>Hora:</strong> ${hora_inicio.substring(0,5)}</p>
                        </div>
                    </div>
                `
            };
            transporter.sendMail(mailOptions).catch(console.error);
        }

        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});


// --- 3. PERFIL DEL USUARIO ---

// Obtener reservas del usuario (ESTA ERA LA QUE FALTABA)
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
        const [rows] = await connection.execute('SELECT nombre, email, telefono, direccion FROM usuarios WHERE id = ?', [req.params.id]);
        await connection.end();
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ error: 'Usuario no encontrado' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Editar datos del perfil
app.put('/api/perfil/:id', async (req, res) => {
    try {
        const { campo, valor } = req.body;
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


// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`¡Servidor corriendo exitosamente en el puerto ${PORT}!`);
});