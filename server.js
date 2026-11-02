// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Seguridad y lectura de datos
app.use(cors());
app.use(express.json());

// NUEVO: Importar y usar las rutas de WhatsApp
const whatsappRoutes = require('./src/routes/whatsappRoutes');
app.use('/api/whatsapp', whatsappRoutes);

// Conexión segura a MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🧠 Base de datos Multi-Tenant conectada con éxito'))
  .catch(err => console.error('Error de conexión:', err));

// Ruta de prueba para tu Súper Admin
app.get('/api/health', (req, res) => {
  res.status(200).json({ mensaje: 'Servidor SaaS IA Operativo y Seguro' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Motor de IA corriendo en el puerto ${PORT}`);
});