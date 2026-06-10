const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


const dbUrl = process.env.MYSQL_URL;

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'contraseña', 
    database: 'deporplaza'
};

/// --- 1. Login (Actualizado con Encriptación) ---
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const connection = await mysql.createConnection(dbUrl);
        // Ahora solo buscamos por correo
        const [rows] = await connection.execute('SELECT id, nombre, email, password, rol FROM usuarios WHERE email = ?', [email]);
        await connection.end();
        
        if (rows.length > 0) {
            // Comparamos la contraseña escrita con la encriptada en la BD
            const contrasenaValida = await bcrypt.compare(password, rows[0].password);
            
            if (contrasenaValida) {
                // Por seguridad, quitamos el password de los datos que enviamos al frontend
                const { password: pwd, ...userSinPassword } = rows[0]; 
                res.json({ success: true, user: userSinPassword });
            } else {
                res.json({ success: false, message: 'Contraseña incorrecta' });
            }
        } else {
            res.json({ success: false, message: 'Usuario no encontrado' });
        }
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// 2. Registro de nuevo usuario
app.post('/api/registro', async (req, res) => {
    try {
        // Añadimos 'telefono' a los datos que recibimos
        const { nombre, email, password, telefono } = req.body; 
        const connection = await mysql.createConnection(dbUrl);
        
        const [existentes] = await connection.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existentes.length > 0) {
            await connection.end();
            return res.json({ success: false, message: 'Este correo ya está registrado.' });
        }

        const saltos = 10;
        const passwordEncriptada = await bcrypt.hash(password, saltos);

        // Agregamos la columna 'telefono' al INSERT
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
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});
// 3. Obtener disponibilidad (Canchas y Reservas de una fecha)
app.get('/api/disponibilidad/:fecha', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbUrl);
        const [canchas] = await connection.execute('SELECT * FROM canchas');
        const [reservas] = await connection.execute('SELECT cancha_id, hora_inicio FROM reservas WHERE fecha = ? AND estado = "confirmada"', [req.params.fecha]);
        await connection.end();
        res.json({ canchas, reservas });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// 4. Crear Reserva
app.post('/api/reservar', async (req, res) => {
    try {
        const { usuario_id, cancha_id, fecha, hora_inicio, metodo_pago } = req.body;
        const connection = await mysql.createConnection(dbUrl);
        await connection.execute(
            'INSERT INTO reservas (usuario_id, cancha_id, fecha, hora_inicio, metodo_pago) VALUES (?, ?, ?, ?, ?)',
            [usuario_id, cancha_id, fecha, hora_inicio, metodo_pago]
        );
        await connection.end();
        res.json({ success: true });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

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
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// 6. Cancelar reserva desde el perfil del usuario
app.post('/api/reservas/:id/cancelar', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbUrl);
        await connection.execute('UPDATE reservas SET estado = "cancelada" WHERE id = ?', [req.params.id]);
        await connection.end();
        res.json({ success: true });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// --- ENDPOINTS DE ADMINISTRADOR ---

// Obtener TODAS las reservas globales
app.get('/api/admin/reservas', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbUrl);
        const [rows] = await connection.execute(`
            SELECT r.id, r.fecha, r.hora_inicio, r.estado, r.metodo_pago, 
                   u.nombre as usuario, u.email, c.nombre as cancha
            FROM reservas r
            JOIN usuarios u ON r.usuario_id = u.id
            JOIN canchas c ON r.cancha_id = c.id
            ORDER BY r.fecha DESC, r.hora_inicio DESC
        `);
        await connection.end();
        res.json(rows);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// Cancelar una reserva
app.post('/api/admin/reservas/:id/cancelar', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbUrl);
        await connection.execute('UPDATE reservas SET estado = "cancelada" WHERE id = ?', [req.params.id]);
        await connection.end();
        res.json({ success: true });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// --- ENDPOINTS DE PERFIL DE USUARIO ---

// 1. Obtener datos completos del perfil
app.get('/api/perfil/:id', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbUrl);
        const [rows] = await connection.execute('SELECT nombre, email, telefono, direccion FROM usuarios WHERE id = ?', [req.params.id]);
        await connection.end();
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ error: 'Usuario no encontrado' });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});

// 2. Actualizar un dato específico del perfil
app.put('/api/perfil/:id', async (req, res) => {
    try {
        const { campo, valor } = req.body;
        // Validamos que solo puedan editar estos campos por seguridad
        const camposPermitidos = ['nombre', 'email', 'telefono', 'direccion'];
        if (!camposPermitidos.includes(campo)) {
            return res.status(400).json({ success: false, message: 'Campo inválido' });
        }

        const connection = await mysql.createConnection(dbUrl);
        // Actualizamos dinámicamente el campo solicitado
        await connection.execute(`UPDATE usuarios SET ${campo} = ? WHERE id = ?`, [valor, req.params.id]);
        await connection.end();
        
        res.json({ success: true });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
});




// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`¡Servidor corriendo exitosamente en el puerto ${PORT}!`);
    console.log(`Abre tu navegador en: http://localhost:${PORT}`);
});
