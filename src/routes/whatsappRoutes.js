const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');

// --- CEREBRO DE INTELIGENCIA ARTIFICIAL (Comercial / B2B Adaptativo) ---
async function generarRespuestaConIA(waName, msgBody) {
    const modelos = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-1.5-flash'];
    
    // Prompt comercial adaptativo para dueños de negocios de mascotas
    const prompt = `Eres el director comercial experto de "MascotasIADev", un software SaaS de inteligencia artificial diseñado para automatizar la atención y aumentar las ventas de veterinarias, spas, pet shops y hoteles de mascotas.
    El usuario que te escribe se llama ${waName}. 
    
    Tu objetivo al responderle a este dueño de negocio es:
    1. Explicarle con entusiasmo y de forma muy persuasiva (máximo 2 párrafos cortos) qué valor le aporta el sistema: actúa como un recepcionista virtual inteligente que trabaja 24/7, responde dudas, agenda citas automáticamente y asegura que ningún cliente se quede sin atender, ahorrándole costos y dándole control de su tiempo.
    2. Como no sabes exactamente si tiene una veterinaria, un pet shop o un spa, mantén los ejemplos generales (negocios de mascotas).
    3. **Termina siempre con una pregunta estratégica orientada a conocer su negocio y avanzar en la venta**, por ejemplo preguntándole: "Cuéntame, ¿qué tipo de negocio de mascotas tienes (veterinaria, spa, pet shop) y cuántas personas atienden al día?"

    Mensaje del cliente: "${msgBody}"`;

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
            continue; 
        }
    }
    
    return `¡Hola ${waName}! MascotasIADev automatiza tu negocio de mascotas con IA para que vendas más y ahorres tiempo 24/7 🐾. ¿Qué tipo de negocio tienes (veterinaria, spa o pet shop)?`;
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

                    // 2. Cerebro: Consultar IA con enfoque comercial adaptativo
                    const respuestaFinal = await generarRespuestaConIA(waName, msg_body);
                    console.log("🧠 Respuesta IA comercial generada con éxito");

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