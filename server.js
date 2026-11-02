require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

// Importamos las rutas del Webhook
const whatsappRoutes = require('./src/routes/whatsappRoutes'); 

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware para que el servidor entienda formato JSON
app.use(express.json());

// ==========================================
// RUTA RAÍZ (FORMATO HTML PARA APROBACIÓN DE META)
// ==========================================
app.get('/', (req, res) => {
    const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Política de Privacidad</title>
        </head>
        <body>
            <h1>Política de Privacidad y Términos de Servicio</h1>
            <p>Esta es la política de privacidad oficial del SaaS MascotasIADev.</p>
        </body>
        </html>
    `;
    res.status(200).send(html);
});

// ==========================================
// RUTAS DE LA API (WEBHOOK)
// ==========================================
app.use('/api/whatsapp', whatsappRoutes);

// ==========================================
// CONEXIÓN A BASE DE DATOS Y ARRANQUE
// ==========================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Base de datos Multi-Tenant conectada con éxito');
        app.listen(PORT, () => {
            console.log(`🚀 Motor de IA corriendo en el puerto ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Error de conexión:', err);
    });