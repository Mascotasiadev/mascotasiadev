const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Lead = require('../models/Lead');
const Contact = require('../models/Contact');
const Tenant = require('../models/Tenant'); // 👈 Importamos el modelo Multi-Tenant

// Inicializamos Gemini SDK oficial
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// ====================================================
// 1. VERIFICACIÓN DEL WEBHOOK (META)
// ====================================================
router.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = "mi_token_secreto_123";
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// ====================================================
// 2. RECEPCIÓN DE MENSAJES DE WHATSAPP (EL CEREBRO MULTI-TENANT)
// ====================================================
router.post('/webhook', async (req, res) => {
    try {
        const body = req.body;

        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry) {
                for (const change of entry.changes) {
                    const value = change.value;
                    if (value && value.messages && value.messages.length > 0) {
                        const message = value.messages[0];
                        const from = message.from; // Número del cliente que escribe
                        const msgBody = message.text ? message.text.body : null;
                        const phoneNumberId = value.metadata.phone_number_id; // 👈 El ID de la veterinaria que recibe

                        if (msgBody) {
                            console.log(`📩 Mensaje de ${from} para el Tenant ID: ${phoneNumberId}: "${msgBody}"`);

                            // A. BUSCAR EL NEGOCIO (TENANT) EN MONGODB
                            let tenant = await Tenant.findOne({ tenantId: phoneNumberId });
                            
                            // Si el número no está registrado aún, usamos un perfil por defecto (Ecuador)
                            if (!tenant) {
                                tenant = {
                                    nombreNegocio: "Clínica & Spa Demo",
                                    pais: "EC",
                                    activo: true,
                                    modulos: { vet: true, spa: true, shop: true }
                                };
                            }

                            // B. VALIDADOR DE PAGO (CORTE AUTOMÁTICO)
                            if (tenant.activo === false) {
                                console.log(`⛔ Bot bloqueado por falta de pago para el tenant ${phoneNumberId}`);
                                await enviarMensajeWhatsApp(phoneNumberId, from, "Hola. En este momento nuestros canales automáticos de atención se encuentran temporalmente inactivos. Un asesor se comunicará contigo pronto.");
                                continue;
                            }

                            // C. CONFIGURACIÓN FISCAL Y BANCARIA SEGÚN PAÍS (EC o CO)
                            const esColombia = tenant.pais === 'CO';
                            const moneda = esColombia ? 'COP ($)' : 'USD ($)';
                            const ivaStr = esColombia ? '19%' : '15%';
                            const bancos = esColombia 
                                ? "Transferencia por Nequi/Daviplata al 3028665643 o Bancolombia Ahorros #456-789012-34." 
                                : "Banco Pichincha Cta Corriente #2100456789 o Produbanco #1200987654 (RUC: 1790011223001).";

                            // D. GESTIÓN DE MEMORIA CONVERSACIONAL (MÁXIMO 8 MENSAJES)
                            let contacto = await Contact.findOne({ phoneNumber: from, tenantId: phoneNumberId });
                            if (!contacto) {
                                contacto = new Contact({ phoneNumber: from, tenantId: phoneNumberId, history: [] });
                            }

                            contacto.history.push({ role: 'user', content: msgBody });
                            if (contacto.history.length > 8) {
                                contacto.history = contacto.history.slice(contacto.history.length - 8);
                            }

                            // E. CONSTRUCCIÓN DEL PROMPT INTELIGENTE ADAPTADO AL NEGOCIO
                            const promptSistema = `
                                Eres el agente comercial de IA 24/7 para "${tenant.nombreNegocio}".
                                Operas bajo el régimen fiscal de ${esColombia ? 'Colombia (DIAN)' : 'Ecuador (SRI)'}. 
                                - Moneda: ${moneda}
                                - IVA aplicable a estética y accesorios: ${ivaStr}.
                                - Servicios médicos y medicamentos: Exentos (IVA 0%).
                                - Medios de pago autorizados: ${bancos}

                                Tu objetivo es atender amablemente, cotizar servicios de spa, agendar citas médicas o tomar pedidos de productos en stock, y cerrar la venta pidiendo el comprobante de pago.
                                
                                REGLA DE ORO DE CAPTURA DE LEADS:
                                Si el cliente muestra interés real, da sus datos o pide un servicio, DEBES incluir obligatoriamente al final de tu respuesta una etiqueta oculta con este formato exacto:
                                [NUEVO_LEAD|Nombre del Cliente|Tipo de Servicio o Producto|Resumen breve]
                            `;

                            // F. LLAMADA AL CEREBRO DE GOOGLE GEMINI
                            const contentsForGemini = [
                                { role: 'user', parts: [{ text: promptSistema }] },
                                ...contacto.history.map(h => ({
                                    role: h.role === 'user' ? 'user' : 'model',
                                    parts: [{ text: h.content }]
                                }))
                            ];

                            let respuestaIA = "¡Hola! Gracias por escribirnos. En unos momentos un asesor te atenderá.";
                            
                            try {
                                const response = await ai.models.generateContent({
                                    model: 'gemini-2.5-flash',
                                    contents: contentsForGemini,
                                });
                                if (response && response.text) {
                                    respuestaIA = response.text;
                                }
                            } catch (geminiError) {
                                console.error('❌ Error consumiendo Gemini (Posible límite de cuota):', geminiError.message);
                                respuestaIA = "¡Hola! Estamos experimentando alto tráfico en este momento, pero hemos tomado nota de tu mensaje y te contactaremos en breve.";
                            }

                            // G. GUARDAR RESPUESTA EN LA MEMORIA
                            contacto.history.push({ role: 'model', content: respuestaIA });
                            await contacto.save();

                            // H. INTERCEPTOR DE LEADS (SI LA IA DETECTÓ UN PROSPECTO)
                            if (respuestaIA.includes('[NUEVO_LEAD|')) {
                                try {
                                    const partes = respuestaIA.match(/\[NUEVO_LEAD\|([^\|]+)\|([^\|]+)\|([^\]]+)\]/);
                                    if (partes) {
                                        const nombreLead = partes[1].trim();
                                        const interesLead = partes[2].trim();
                                        const resumenLead = partes[3].trim();

                                        await Lead.create({
                                            tenantId: phoneNumberId,
                                            phoneNumber: from,
                                            name: nombreLead,
                                            businessType: interesLead,
                                            summary: resumenLead,
                                            status: 'Pendiente'
                                        });
                                        console.log(`🎉 [CRM] ¡Lead capturado y guardado para el tenant ${phoneNumberId}: ${nombreLead}!`);
                                    }
                                } catch (leadErr) {
                                    console.error('❌ Error al guardar el lead en MongoDB:', leadErr);
                                }
                                // Limpiamos la etiqueta para que el cliente final de WhatsApp no la vea
                                respuestaIA = respuestaIA.replace(/\[NUEVO_LEAD\|[^\]]+\]/g, '').trim();
                            }

                            // I. ENVIAR RESPUESTA DE VUELTA A WHATSAPP (META API)
                            await enviarMensajeWhatsApp(phoneNumberId, from, respuestaIA);
                        }
                    }
                }
            }
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('❌ Error crítico en el Webhook de WhatsApp:', error);
        res.sendStatus(500);
    }
});

// ====================================================
// 3. FUNCIÓN AUXILIAR PARA ENVIAR MENSAJES A META
// ====================================================
async function enviarMensajeWhatsApp(phoneNumberId, to, text) {
    const fetch = (await import('node-fetch')).default;
    const TOKEN_META = process.env.WHATSAPP_TOKEN; 

    try {
        const url = `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN_META}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging2way: true,
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: { body: text }
            })
        });

        const data = await response.json();
        console.log('📤 Respuesta de envío a Meta:', JSON.stringify(data));
    } catch (error) {
        console.error('❌ Error enviando mensaje a WhatsApp:', error);
    }
}

module.exports = router;