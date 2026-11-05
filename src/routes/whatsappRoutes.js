const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Lead = require('../models/Lead');
const Contact = require('../models/Contact');
const Tenant = require('../models/Tenant');
const PromptAssemblerService = require('../services/PromptAssembler');
// 👇 IMPORTAMOS LAS HERRAMIENTAS DE AGENDA
const { calendarToolsDefinition, ejecutarHerramientaCalendario } = require('../tools/calendar.tools');

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
// 2. RECEPCIÓN DE MENSAJES DE WHATSAPP
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
        console.error('❌ Error en Webhook de WhatsApp:', error);
        res.sendStatus(500);
    }
});

// ====================================================
// 3. SIMULADOR DIRECTO SIN META
// ====================================================
router.post('/simulate', async (req, res) => {
    try {
        const { tenantId, fromPhone, text } = req.body;
        if (!text) return res.status(400).json({ success: false, message: 'Falta texto' });

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
// 4. NÚCLEO COGNITIVO CON FUNCTION CALLING
// ====================================================
async function procesarMensajeAgente({ tenantId, fromPhone, text }) {
    let tenant = await Tenant.findOne({ tenantId }).lean();
    if (!tenant) {
        tenant = { tenantId, nombreNegocio: "Clínica Demo", pais: "EC", activo: true, modulos: { vet: true, spa: true, shop: true } };
    }

    if (tenant.activo === false) {
        return { tenantName: tenant.nombreNegocio, respuestaLimpia: "Nuestros canales automáticos están inactivos por el momento.", leadCapturado: null };
    }

    let contacto = await Contact.findOne({ phoneNumber: fromPhone, tenantId });
    if (!contacto) contacto = new Contact({ phoneNumber: fromPhone, tenantId, history: [] });

    contacto.history.push({ role: 'user', content: text });
    if (contacto.history.length > 8) contacto.history = contacto.history.slice(contacto.history.length - 8);

    const systemInstruction = PromptAssemblerService.buildSystemInstruction(tenant);

    let respuestaIA = "¡Hola! Gracias por escribirnos. En breve te atendemos.";
    let exito = false;
    const modelosSeguros = ['gemini-3.8-flash', 'gemini-3.5-flash'];

    let contentsForGemini = contacto.history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
    }));

    for (const nombreModelo of modelosSeguros) {
        try {
            const model = genAI.getGenerativeModel({
                model: nombreModelo,
                systemInstruction: systemInstruction,
                // 👇 INYECTAMOS LAS HERRAMIENTAS AQUÍ
                tools: [{ functionDeclarations: calendarToolsDefinition }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 350 }
            });

            // Primera llamada a la IA
            const result = await model.generateContent({ contents: contentsForGemini });
            const response = await result.response;
            
            // 👇 VERIFICAMOS SI LA IA DECIDIÓ USAR UNA HERRAMIENTA
            if (response.functionCalls && response.functionCalls().length > 0) {
                const call = response.functionCalls()[0];
                console.log(`🤖 IA solicitó ejecutar herramienta: ${call.name}`);
                
                // Ejecutamos la función en nuestra base de datos
                const toolResult = await ejecutarHerramientaCalendario(call.name, call.args, tenantId, fromPhone);
                
                // Añadimos el proceso al historial temporal de la IA
                contentsForGemini.push({
                    role: 'model',
                    parts: [{ functionCall: { name: call.name, args: call.args } }]
                });
                contentsForGemini.push({
                    role: 'function',
                    parts: [{ functionResponse: { name: call.name, response: toolResult } }]
                });

                // Segunda llamada a la IA con los resultados de la base de datos
                const finalResult = await model.generateContent({ contents: contentsForGemini });
                const finalResponse = await finalResult.response;
                
                if (finalResponse && finalResponse.text()) {
                    respuestaIA = finalResponse.text();
                    exito = true;
                    break;
                }
            } 
            // Si la IA respondió con texto normal
            else if (response && response.text()) {
                respuestaIA = response.text();
                exito = true;
                break;
            }
        } catch (geminiError) {
            console.warn(`⚠️ Intento fallido con ${nombreModelo}:`, geminiError.message);
            continue;
        }
    }

    if (!exito) respuestaIA = "Experimentamos un alto volumen de consultas. Un asesor te atenderá enseguida.";

    contacto.history.push({ role: 'model', content: respuestaIA });
    await contacto.save();

    let leadCapturado = null;
    if (respuestaIA.includes('[NUEVO_LEAD|')) {
        try {
            const partes = respuestaIA.match(/\[NUEVO_LEAD\|([^\|]+)\|([^\|]+)\|([^\]]+)\]/);
            if (partes) {
                leadCapturado = await Lead.create({
                    tenantId, phoneNumber: fromPhone, name: partes[1].trim(), businessType: partes[2].trim(), summary: partes[3].trim(), status: partes[2].toUpperCase().includes('URGENCIA') ? '🚨 URGENCIA' : 'Pendiente'
                });
            }
        } catch (e) { console.error(e); }
        respuestaIA = respuestaIA.replace(/\[NUEVO_LEAD\|[^\]]+\]/g, '').trim();
    }

    return { tenantName: tenant.nombreNegocio, respuestaLimpia: respuestaIA, leadCapturado };
}

async function enviarMensajeWhatsApp(phoneNumberId, to, text) {
    const fetch = (await import('node-fetch')).default;
    if (!process.env.WHATSAPP_TOKEN) return;
    try {
        await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: to, type: 'text', text: { body: text } })
        });
    } catch (e) { console.error(e); }
}

module.exports = router;