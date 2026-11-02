const express = require('express');
const router = express.Router();

// ==========================================
// GET: VERIFICACIÓN DEL WEBHOOK (Meta)
// ==========================================
router.get('/webhook', (req, res) => {
    const verify_token = process.env.WHATSAPP_VERIFY_TOKEN;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === verify_token) {
            console.log('✅ Webhook verificado exitosamente por Meta');
            return res.status(200).send(challenge);
        } else {
            console.log('❌ Falló verificación: El token no coincide');
            return res.sendStatus(403);
        }
    }
    res.status(200).send('🟢 El buzón del Webhook está vivo y escuchando en /api/whatsapp/webhook');
});

// ==========================================
// POST: RECEPCIÓN Y RESPUESTA DE MENSAJES
// ==========================================
router.post('/webhook', async (req, res) => {
    console.log("🔔 [ENTRÓ AL WEBHOOK OFICIAL]");
    
    try {
        const body = req.body;
        
        // Verificamos si es un evento de WhatsApp Business
        if (body.object === 'whatsapp_business_account') {
            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;

            // Extraemos el mensaje de forma segura por si viene anidado diferente
            const message = value?.messages?.[0];

            if (message && message.text) {
                const phone_number_id = process.env.WHATSAPP_PHONE_ID || value?.metadata?.phone_number_id;
                const api_token = process.env.WHATSAPP_API_TOKEN;
                const from = message.from; 
                const msg_body = message.text.body; 

                console.log(`📨 Mensaje de cliente (${from}): ${msg_body}`);
                console.log(`🔑 Estado de llaves -> PHONE_ID: ${phone_number_id ? 'OK' : 'FALTA'} | TOKEN: ${api_token ? 'OK' : 'FALTA'}`);

                const response = await fetch(`https://graph.facebook.com/v21.0/${phone_number_id}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${api_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        to: from,
                        text: { body: `¡Hola! Soy el asistente de MascotasIADev 🐾. Recibí tu mensaje: "${msg_body}"` }
                    })
                });

                const resData = await response.text();
                if (response.ok) {
                    console.log('✅ Respuesta enviada a WhatsApp con éxito:', resData);
                } else {
                    console.error('❌ Meta rechazó el envío de la respuesta:', resData);
                }
            } else {
                console.log("ℹ️ El evento recibido no contiene un mensaje de texto plano (pueden ser estados o multimedia).");
            }
        }
    } catch (err) {
        console.error('❌ Error crítico procesando el Webhook:', err);
    }

    // Siempre respondemos 200 OK inmediatamente a Meta para evitar bloqueos
    return res.sendStatus(200);
});

module.exports = router;