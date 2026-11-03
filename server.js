require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 
const path = require('path'); // 👈 NUEVO: Herramienta para leer la carpeta 'public'

// Importamos las rutas
const whatsappRoutes = require('./src/routes/whatsappRoutes'); 
const dashboardRoutes = require('./src/routes/dashboardRoutes'); 

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware para seguridad y formato
app.use(cors()); 
app.use(express.json());

// ====================================================
// 🌐 ALOJAMIENTO DEL PANEL WEB (FRONTEND)
// ====================================================
// Esto expone la carpeta 'public' a internet. 
// Tu panel vivirá en: tusitio.com/dashboard.html
app.use(express.static(path.join(__dirname, 'public')));

// ====================================================
// 🕵️‍♂️ DETECTOR GLOBAL DE TRÁFICO (CAZADOR DE META)
// ====================================================
app.use((req, res, next) => {
    console.log(`📡 [TRÁFICO DETECTADO] Método: ${req.method} | Ruta: ${req.url}`);
    if (req.method === 'POST') {
        console.log(`📦 [CONTENIDO POST]:`, JSON.stringify(req.body, null, 2));
    }
    next();
});

// ====================================================
// RUTA RAÍZ (POLÍTICA DE PRIVACIDAD Y TRAMPA POST)
// ====================================================
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

// Si por error en Meta la URL del Webhook quedó sin "/api/whatsapp/webhook", esto lo atrapará:
app.post('/', (req, res) => {
    console.log('⚠️ ¡ALERTA! Meta está enviando los mensajes a la raíz (/) en lugar de /api/whatsapp/webhook');
    res.sendStatus(200);
});

// ====================================================
// RUTAS DE LA API (WEBHOOK Y PANEL)
// ====================================================
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/dashboard', dashboardRoutes); 

// ====================================================
// MODELO MULTI-TENANT Y SEMILLA AUTOMÁTICA EN MONGODB
// ====================================================
const tenantSchema = new mongoose.Schema({
    nombreNegocio: String,
    tipo: String,
    telefonoWhatsAppId: String,
    activo: { type: Boolean, default: true },
    fechaCreacion: { type: Date, default: Date.now }
});

const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', tenantSchema);

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('✅ Base de datos Multi-Tenant conectada con éxito');
        
        // Forzamos la creación de la base de datos en Atlas creando el primer cliente (Tenant)
        try {
            const existe = await Tenant.findOne({ nombreNegocio: 'Pet Spa Demo' });
            if (!existe) {
                await Tenant.create({
                    nombreNegocio: 'Pet Spa Demo',
                    tipo: 'Pet Spa y Veterinaria',
                    telefonoWhatsAppId: process.env.WHATSAPP_PHONE_ID || 'pendiente'
                });
                console.log('🎉 ¡Primer Tenant creado! La base de datos ya es visible en MongoDB Atlas.');
            } else {
                console.log('🐾 Tenant de prueba verificado en MongoDB Atlas.');
            }
        } catch (dbErr) {
            console.error('❌ Error creando el Tenant inicial:', dbErr);
        }

        app.listen(PORT, () => {
            console.log(`🚀 Motor de IA corriendo en el puerto ${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ Error de conexión:', err);
    });