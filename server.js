require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

// Importamos las rutas del Webhook que creaste
const whatsappRoutes = require('./src/routes/whatsappRoutes'); 

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware para que el servidor entienda formato JSON
app.use(express.json());

// ==========================================
// RUTA RAÍZ (LA SOLUCIÓN PARA META)
// ==========================================
app.get('/', (req, res) => {
    res.status(200).send('Política de Privacidad y Términos de Servicio del SaaS MascotasIADev.');
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