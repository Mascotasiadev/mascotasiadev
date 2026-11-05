const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Lead = require('../models/Lead');
const Contact = require('../models/Contact');
const Tenant = require('../models/Tenant');
const PromptAssemblerService = require('../services/PromptAssembler');

// Inicializamos el SDK oficial y estable
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
// 2. RECEPCIÓN DE MENSAJES DE WHATSAPP (CON MOTOR MODULAR)
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
                        const from = message.from;
                        const msgBody = message.text ? message.text.body : null;
                        const phoneNumberId = value.metadata.phone_number_id;

                        if (msgBody) {
                            // Procesamos con nuestra función centralizada
                            const resultado = await procesarMensajeAgente({
                                tenantId: phoneNumberId,
                                fromPhone: from,
                                text: msgBody
                            });

                            await enviarMensajeWhatsApp(phoneNumberId, from, resultado.respuestaLimpia);
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
// 3. SIMULADOR DIRECTO SIN META (PARA PRUEBAS SIN RETRASOS)
// ====================================================
router.post('/simulate', async (req, res) => {
    try {
        const { tenantId, fromPhone, text } = req.body;
        if (!text) {
            return res.status(400).json({ success: false, message: 'Falta el texto del mensaje' });
        }

        const inicio = Date.now();
        const resultado = await procesarMensajeAgente({
            tenantId: tenantId || '1433813413148961',
            fromPhone: fromPhone || '593999999999',
            text
        });
        const latenciaMs = Date.now() - inicio;

        res.status(200).json({
            success: true,
            latencyMs: `${latenciaMs} ms`,
            tenantName: resultado.tenantName,
            reply: resultado.respuestaLimpia,
            leadCapturado: resultado.leadCapturado
        });
    } catch (error) {
        console.error('❌ Error en simulador:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ====================================================
// 4. NÚCLEO COGNITIVO COMPARTIDO (WHATSAPP + SIMULADOR)
// ====================================================
async function procesarMensajeAgente({ tenantId, fromPhone, text }) {
    // A. Buscar Tenant en MongoDB (usando .lean() para mayor velocidad de lectura)
    let tenant = await Tenant.findOne({ tenantId }).lean();
    if (!tenant) {
        tenant = {
            tenantId,
            nombreNegocio: "Clínica & Spa Demo",
            pais: "EC",
            ciudad: "Quito",
            activo: true,
            modulos: { vet: true, spa: true, shop: true }
        };
    }

    // B. Corte automático si no ha pagado
    if (tenant.activo === false) {
        return {
            tenantName: tenant.nombreNegocio,
            respuestaLimpia: "Hola. En este momento nuestros canales automáticos de atención se encuentran temporalmente inactivos. Un asesor se comunicará contigo pronto.",
            leadCapturado: null
        };
    }

    // C. Obtener memoria conversacional (máximo 8 mensajes)
    let contacto = await Contact.findOne({ phoneNumber: fromPhone, tenantId });
    if (!contacto) {
        contacto = new Contact({ phoneNumber: fromPhone, tenantId, history: [] });
    }

    contacto.history.push({ role: 'user', content: text });
    if (contacto.history.length > 8) {
        contacto.history = contacto.history.slice(contacto.history.length - 8);
    }

    // D. Ensamblar instrucciones específicas según Feature Flags del negocio
    const systemInstruction = PromptAssemblerService.buildSystemInstruction(tenant);

    // E. Llamar a Gemini con Bucle de Modelos (Sistema de Rescate/Fallback)
    let respuestaIA = "¡Hola! Gracias por escribirnos. En breve te atendemos.";
    let exito = false;
    
    // Lista de modelos oficiales y estables. Si falla el primero, salta al segundo de inmediato.
    const modelosSeguros = ['gemini-3.8-flash', 'gemini-3.5-flash'];

    const contentsForGemini = contacto.history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
    }));

    for (const nombreModelo of modelosSeguros) {
        try {
            const model = genAI.getGenerativeModel({
                model: nombreModelo,
                systemInstruction: systemInstruction,
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 350
                }
            });

            const result = await model.generateContent({ contents: contentsForGemini });
            const response = await result.response;
            
            if (response && response.text()) {
                respuestaIA = response.text();
                exito = true;
                break; // Rompe el bucle si contestó bien
            }
        } catch (geminiError) {
            console.warn(`⚠️ Intento fallido con ${nombreModelo}:`, geminiError.message);
            continue; // Si falla, intenta silenciosamente con el siguiente modelo de la lista
        }
    }

    // Si todos los modelos fallan por caída de Google
    if (!exito) {
        respuestaIA = "Hola, en este momento experimentamos un alto volumen de consultas. Hemos recibido tu mensaje y un asesor te atenderá enseguida.";
    }

    // F. Guardar en historial
    contacto.history.push({ role: 'model', content: respuestaIA });
    await contacto.save();

    // G. Interceptor de Leads y Urgencias Médicas (Zero-Latency)
    let leadCapturado = null;
    if (respuestaIA.includes('[NUEVO_LEAD|')) {
        try {
            const partes = respuestaIA.match(/\[NUEVO_LEAD\|([^\|]+)\|([^\|]+)\|([^\]]+)\]/);
            if (partes) {
                leadCapturado = await Lead.create({
                    tenantId,
                    phoneNumber: fromPhone,
                    name: partes[1].trim(),
                    businessType: partes[2].trim(),
                    summary: partes[3].trim(),
                    status: partes[2].toUpperCase().includes('URGENCIA') ? '🚨 URGENCIA' : 'Pendiente'
                });
            }
        } catch (leadErr) {
            console.error('❌ Error guardando lead:', leadErr);
        }
        // Limpiamos la etiqueta para que el cliente final no la vea
        respuestaIA = respuestaIA.replace(/\[NUEVO_LEAD\|[^\]]+\]/g, '').trim();
    }

    return {
        tenantName: tenant.nombreNegocio,
        respuestaLimpia: respuestaIA,
        leadCapturado
    };
}

// ====================================================
// 5. FUNCIÓN AUXILIAR DE ENVÍO A META
// ====================================================
async function enviarMensajeWhatsApp(phoneNumberId, to, text) {
    const fetch = (await import('node-fetch')).default;
    const TOKEN_META = process.env.WHATSAPP_TOKEN; 
    if (!TOKEN_META) return;

    try {
        const url = `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`;
        await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN_META}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: { body: text }
            })
        });
    } catch (error) {
        console.error('❌ Error enviando mensaje a WhatsApp:', error);
    }
}

module.exports = router;