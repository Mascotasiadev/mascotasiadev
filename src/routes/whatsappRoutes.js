const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const Lead = require('../models/Lead'); // 👈 Importamos nuestro nuevo cajón de prospectos

// --- CEREBRO DE INTELIGENCIA ARTIFICIAL CON CAPTURADOR DE LEADS ---
async function generarRespuestaConIA(waName, msgBody) {
    const modelos = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-1.5-flash'];
    const prompt = `Eres el director comercial experto de "MascotasIADev", un software SaaS de inteligencia artificial para veterinarias, spas y pet shops. 
    El usuario que te escribe se llama ${waName}. 
    
    REGLA 1: Responde de forma muy corta, directa y persuasiva (máximo 1 párrafo breve y una pregunta al final), adaptándote al negocio del que habla.
    REGLA 2 (ESTRICTA): Si el usuario muestra interés en comprar, solicita una demostración (demo), o pide agendar una cita comercial, DEBES agregar obligatoriamente la etiqueta exacta [NUEVO_LEAD] al final de tu respuesta.
    
    Mensaje del cliente: "${msgBody}"`;

    for (const modelo of modelos) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${process.env.GEMINI_API_KEY}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const response = await fetch(url, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const data = await response.json(); 
            
            if (data.error) continue; 
            
            if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                return data.candidates[0].content.parts[0].text.trim();
            }
        } catch (error) { 
            continue; 
        }
    } 
    return `¡Hola ${waName}! MascotasIADev se adapta perfectamente a tu negocio. ¿Te gustaría agendar una demo? [NUEVO_LEAD]`;
}

// --- 1. VERIFICACIÓN DEL WEBHOOK (Meta) ---
router.get('/webhook', (req, res) => {
    const verify_token = process.env.WHATSAPP_VERIFY_TOKEN;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === verify_token) {
        console.log('🟢 Webhook verificado correctamente por Meta.');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// --- 2. RECEPCIÓN Y PROCESAMIENTO DE MENSAJES ---
router.post('/webhook', async (req, res) => {
    res.sendStatus(200); 

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

                    // 1. Guardar o actualizar contacto
                    try {
                        await Contact.findOneAndUpdate(
                            { phoneNumber: from }, 
                            { name: waName, lastInteraction: new Date() }, 
                            { upsert: true, new: true } 
                        );
                    } catch (dbError) {
                        console.error("❌ Error guardando en MongoDB:", dbError);
                    }

                    // 2. Consultar IA
                    let respuestaFinal = await generarRespuestaConIA(waName, msg_body);

                    // 3. CAPTURADOR DE LEADS (La Magia) 👈
                    if (respuestaFinal.includes('[NUEVO_LEAD]')) {
                        // Borramos la etiqueta para que el cliente no la lea en su WhatsApp
                        respuestaFinal = respuestaFinal.replace('[NUEVO_LEAD]', '').trim();
                        
                        try {
                            const nuevoLead = new Lead({
                                phoneNumber: from,
                                name: waName,
                                summary: `Mensaje de interés: "${msg_body}"`
                            });
                            await nuevoLead.save();
                            console.log(`🎉 ¡BINGO! NUEVO LEAD CAPTURADO: ${waName} (${from})`);
                        } catch (leadError) {
                            console.error("❌ Error guardando el Lead:", leadError);
                        }
                    }

                    // 4. Enviar de vuelta a WhatsApp
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

                    if (!response.ok) {
                        const errorData = await response.json();
                        console.error("❌ Error enviando mensaje a WhatsApp:", JSON.stringify(errorData, null, 2));
                    }
                }
            }
        } catch (error) {
            console.error("❌ Error procesando el webhook:", error);
        }
    }
});

module.exports = router;