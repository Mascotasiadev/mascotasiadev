const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact'); // Importa el modelo de Base de Datos

// 1. Verificación del Webhook (Para cuando Meta revisa el puente)
router.get('/webhook', (req, res) => {
    const verify_token = process.env.WHATSAPP_VERIFY_TOKEN;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === verify_token) {
            console.log('🟢 Webhook verificado correctamente por Meta.');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.status(200).send("🟢 El buzón del Webhook está vivo y escuchando en /api/whatsapp/webhook");
    }
});

// 2. Recepción y Procesamiento de Mensajes
router.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
        try {
            // Verificar que el payload tenga un mensaje válido
            if (body.entry && 
                body.entry[0].changes && 
                body.entry[0].changes[0] && 
                body.entry[0].changes[0].value.messages && 
                body.entry[0].changes[0].value.messages[0]) {
                
                const value = body.entry[0].changes[0].value;
                const phone_number_id = value.metadata.phone_number_id;
                const message = value.messages[0];
                const from = message.from; // Celular del cliente
                
                // Extraer el nombre de perfil de WhatsApp si existe
                const waName = value.contacts && value.contacts[0] ? value.contacts[0].profile.name : 'Cliente';

                // Solo procesamos si el cliente envió un texto plano
                if (message.type === 'text') {
                    const msg_body = message.text.body;
                    
                    console.log(`📨 Mensaje de cliente (${from}): ${msg_body}`);

                    // --- INICIO BLOQUE MEMORIA (MongoDB) ---
                    try {
                        await Contact.findOneAndUpdate(
                            { phoneNumber: from }, // Busca por número
                            { 
                                name: waName, 
                                lastInteraction: new Date() 
                            }, // Actualiza el nombre y la hora
                            { upsert: true, new: true } // Si no existe, lo crea
                        );
                        console.log(`💾 Contacto ${waName} (${from}) guardado/actualizado en MongoDB.`);
                    } catch (dbError) {
                        console.error("❌ Error guardando en MongoDB:", dbError);
                    }
                    // --- FIN BLOQUE MEMORIA ---

                    // --- INICIO BLOQUE RESPUESTA (WhatsApp v25.0) ---
                    const response = await fetch(`https://graph.facebook.com/v25.0/${phone_number_id}/messages`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            messaging_product: 'whatsapp',
                            to: from,
                            text: { body: `¡Hola ${waName}! Ya te guardé en mi base de datos 🧠. Recibí: "${msg_body}"` }
                        })
                    });

                    if (response.ok) {
                        console.log("✅ Respuesta enviada a WhatsApp con éxito");
                    } else {
                        const errorData = await response.json();
                        console.error("❌ Error enviando mensaje a WhatsApp:", JSON.stringify(errorData, null, 2));
                    }
                    // --- FIN BLOQUE RESPUESTA ---

                } else {
                    console.log("🔔 [EVENTO] El mensaje no es de texto plano (imagen, audio, estado, etc).");
                }
            }
        } catch (error) {
            console.error("❌ Error procesando el webhook:", error);
        }
        
        // SIEMPRE hay que devolver un 200 OK a Meta inmediatamente, sin importar qué pase
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

module.exports = router;