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
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// ==========================================
// POST: RECEPCIÓN Y RESPUESTA DE MENSAJES
// ==========================================
router.post('/webhook', async (req, res) => {
    const body = req.body;

    // Validamos que sea un evento de WhatsApp
    if (body.object) {
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
            
            const phone_number_id = process.env.WHATSAPP_PHONE_ID;
            const api_token = process.env.WHATSAPP_API_TOKEN;
            const from = body.entry[0].changes[0].value.messages[0].from; // Número del cliente
            const msg_body = body.entry[0].changes[0].value.messages[0].text.body; // Texto que envió el cliente

            console.log(`📨 Mensaje recibido de ${from}: ${msg_body}`);

            // Construimos el mensaje de respuesta
            try {
                const response = await fetch(`https://graph.facebook.com/v17.0/${phone_number_id}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${api_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        to: from,
                        text: { body: `¡Hola! Soy el sistema automatizado del SaaS MascotasIADev 🐾. He recibido tu mensaje: "${msg_body}"` }
                    })
                });

                if(response.ok) {
                    console.log('✅ Respuesta automática enviada con éxito');
                } else {
                    console.error('❌ Error de Meta al enviar respuesta:', await response.text());
                }
            } catch (error) {
                console.error('❌ Error interno al intentar enviar el mensaje:', error);
            }
        }
        
        // Siempre debemos devolver un 200 a Meta para que no reintente el envío
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

module.exports = router;