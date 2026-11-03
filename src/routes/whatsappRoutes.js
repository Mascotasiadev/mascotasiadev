const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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
            if (body.entry && 
                body.entry[0].changes && 
                body.entry[0].changes[0] && 
                body.entry[0].changes[0].value.messages && 
                body.entry[0].changes[0].value.messages[0]) {
                
                const value = body.entry[0].changes[0].value;
                const phone_number_id = value.metadata.phone_number_id;
                const message = value.messages[0];
                const from = message.from; 
                
                const waName = value.contacts && value.contacts[0] ? value.contacts[0].profile.name : 'Cliente';

                if (message.type === 'text') {
                    const msg_body = message.text.body;
                    console.log(`📨 Mensaje de cliente (${from}): ${msg_body}`);

                    // --- INICIO BLOQUE MEMORIA (MongoDB) ---
                    try {
                        await Contact.findOneAndUpdate(
                            { phoneNumber: from }, 
                            { name: waName, lastInteraction: new Date() }, 
                            { upsert: true, new: true } 
                        );
                        console.log(`💾 Contacto ${waName} (${from}) guardado en MongoDB.`);
                    } catch (dbError) {
                        console.error("❌ Error guardando en MongoDB:", dbError);
                    }
                    // --- FIN BLOQUE MEMORIA ---

                    // --- INICIO BLOQUE IA (GEMINI) ---
                    let respuestaFinal = "";
                    try {
                        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                        const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });
                        
                        const prompt = `Eres un amable, profesional y experto recepcionista virtual de un Spa y Veterinaria de Mascotas llamado MascotasIADev. 
                        El cliente con el que hablas se llama ${waName}. 
                        Responde de manera concisa (máximo 2 párrafos cortos), cálida y usando algún emoji relacionado con mascotas al siguiente mensaje del cliente: "${msg_body}"`;
                        
                        const result = await model.generateContent(prompt);
                        respuestaFinal = result.response.text();
                        console.log("🧠 IA Gemini respondió:", respuestaFinal);
                    } catch (iaError) {
                        console.error("❌ Error con Gemini:", iaError);
                        respuestaFinal = `¡Hola ${waName}! En este momento mi sistema está procesando mucha información, ¿puedes escribirme en un minuto? 🐾`;
                    }
                    // --- FIN BLOQUE IA ---

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
                            text: { body: respuestaFinal }
                        })
                    });

                    if (response.ok) {
                        console.log("✅ Respuesta enviada a WhatsApp con éxito");
                    } else {
                        const errorData = await response.json();
                        console.error("❌ Error enviando mensaje a WhatsApp:", JSON.stringify(errorData, null, 2));
                    }
                    // --- FIN BLOQUE RESPUESTA ---

                }
            }
        } catch (error) {
            console.error("❌ Error procesando el webhook:", error);
        }
        
        // Siempre responder 200 a Meta
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

module.exports = router;