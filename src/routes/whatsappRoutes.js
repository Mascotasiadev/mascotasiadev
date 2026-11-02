// src/routes/whatsappRoutes.js
const express = require('express');
const router = express.Router();

// Ruta GET: Sirve única y exclusivamente para que Meta verifique nuestro servidor
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Comparamos el token que manda Meta con el que guardamos en el .env
    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
            console.log('✅ Webhook verificado exitosamente por Meta');
            res.status(200).send(challenge);
        } else {
            console.log('❌ Error de verificación de Webhook');
            res.sendStatus(403);
        }
    }
});

// Ruta POST: Aquí entrarán todos los mensajes de texto, audios o fotos de los clientes
router.post('/webhook', (req, res) => {
    const body = req.body;
    
    // Imprimimos el mensaje en la terminal para verlo
    console.log('📩 Nuevo evento de WhatsApp:', JSON.stringify(body, null, 2));
    
    // Regla de oro de Meta: Siempre responder 200 OK inmediatamente, o bloquearán el número
    res.sendStatus(200); 
});

module.exports = router;