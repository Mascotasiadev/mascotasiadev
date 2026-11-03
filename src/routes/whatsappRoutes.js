const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');

// --- CEREBRO DE INTELIGENCIA ARTIFICIAL (Patrón robusto de Forestadent) ---
async function generarRespuestaConIA(waName, msgBody) {
    const modelos = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-1.5-flash'];
    const prompt = `Eres un amable, profesional y experto recepcionista virtual de un Spa y Veterinaria de Mascotas llamado MascotasIADev. 
    El cliente con el que hablas se llama ${waName}. 
    Responde de manera concisa (máximo 2 párrafos cortos), cálida y usando algún emoji relacionado con mascotas al siguiente mensaje del cliente: "${msgBody}"`;

    for (const modelo of modelos) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${process.env.GEMINI_API_KEY}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: [{ parts: [{ text: prompt }] }] 
                })
            });
            const data = await response.json();
            
            if (data.error) continue; 
            
            if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                return data.candidates[0].content.parts[0].text.trim();
            }
        } catch (error) { 
            continue; // Si falla un modelo, intenta automáticamente con el siguiente
        }
    }
    
    // Respuesta de respaldo si todos los modelos fallan
    return `¡Hola ${waName}! En este momento nuestros sistemas están ocupados, ¿puedes escribirme en un minuto? 🐾`;
}

// --- 1. VERIFICACIÓN DEL WEBHOOK (Meta) ---
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

// --- 2. RECEPCIÓN Y PROCESAMIENTO DE MENSAJES ---
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

                    // 1. Memoria: Guardar o actualizar en MongoDB Atlas
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

                    // 2. Cerebro: Consultar IA con respaldo de modelos múltiples
                    const respuestaFinal = await generarRespuestaConIA(waName, msg_body);
                    console.log("🧠 Respuesta IA generada con éxito");

                    // 3. Respuesta: Enviar de vuelta a WhatsApp vía Graph API v25.0
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
                }
            }
        } catch (error) {
            console.error("❌ Error procesando el webhook:", error);
        }
        
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

module.exports = router;