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
    // Si entras desde el navegador Chrome directo a la ruta, verás esto:
    res.status(200).send('🟢 El buzón del Webhook está vivo y escuchando en /api/whatsapp/webhook');
});

// ==========================================
// POST: RECEPCIÓN Y RESPUESTA DE MENSAJES
// ==========================================
router.post('/webhook', async (req, res) => {
    console.log("🔔 [ENTRÓ AL WEBHOOK OFICIAL]");
    const body = req.body;

    if (body.object) {
        const changes = body.entry?.[0]?.changes?.[0]?.value;
        
        if (changes && changes.messages && changes.messages[0]) {
            const phone_number_id = process.env.WHATSAPP_PHONE_ID || changes.metadata?.phone_number_id;
            const api_token = process.env.WHATSAPP_API_TOKEN;
            const from = changes.messages[0].from; 
            const msg_body = changes.messages[0].text ? changes.messages[0].text.body : "[Mensaje multimedia/botón]"; 

            console.log(`📨 Mensaje de cliente (${from}): ${msg_body}`);
            console.log(`🔑 Estado de llaves en Render -> PHONE_ID: ${phone_number_id ? 'OK' : 'FALTA'} | TOKEN: ${api_token ? 'OK' : 'FALTA'}`);

            try {
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
            } catch (error) {
                console.error('❌ Error interno al conectar con Meta:', error);
            }
        } else if (changes && changes.statuses) {
            console.log(`ℹ️ Confirmación de estado de Meta (entregado/leído) recibida.`);
        }
        return res.sendStatus(200);
    } else {
        return res.sendStatus(404);
    }
});

module.exports = router;