const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'contraseña', 
    database: 'deporplaza'
};

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT id, nombre, email, rol FROM usuarios WHERE email = ? AND password = ?', [email, password]);
        await connection.end();
        
        if (rows.length > 0) res.json({ success: true, user: rows[0] });
        else res.json({ success: false, message: 'Credenciales incorrectas' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/registro', async (req, res) => {
    try {
        const { nombre, email, password } = req.body;
        const connection = await mysql.createConnection(dbConfig);
        
        // 1. Verificar si el correo ya existe
        const [existentes] = await connection.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existentes.length > 0) {
            await connection.end();
            return res.json({ success: false, message: 'Este correo ya está registrado.' });
        }

        // 2. Insertar el nuevo usuario (por defecto será 'cliente')
        const [resultado] = await connection.execute(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, "cliente")',
            [nombre, email, password]
        );

        // 3. Obtener los datos del usuario recién creado para iniciar sesión automáticamente
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

// Obtener disponibilidad
app.get('/api/disponibilidad/:fecha', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [canchas] = await connection.execute('SELECT * FROM canchas');
        const [reservas] = await connection.execute('SELECT cancha_id, hora_inicio FROM reservas WHERE fecha = ? AND estado = "confirmada"', [req.params.fecha]);
        await connection.end();
        res.json({ canchas, reservas });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Crear Reserva
app.post('/api/reservar', async (req, res) => {
    try {
        const { usuario_id, cancha_id, fecha, hora_inicio, metodo_pago } = req.body;
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute(
            'INSERT INTO reservas (usuario_id, cancha_id, fecha, hora_inicio, metodo_pago) VALUES (?, ?, ?, ?, ?)',
            [usuario_id, cancha_id, fecha, hora_inicio, metodo_pago]
        );
        await connection.end();
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Obtener reservas del usuario (Perfil)
app.get('/api/mis-reservas/:id', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(`
            SELECT r.fecha, r.hora_inicio, c.nombre, c.precio 
            FROM reservas r JOIN canchas c ON r.cancha_id = c.id 
            WHERE r.usuario_id = ? ORDER BY r.fecha DESC, r.hora_inicio DESC
        `, [req.params.id]);
        await connection.end();
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(3000, () => console.log('Servidor en http://localhost:3000'));