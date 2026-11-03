const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const Lead = require('../models/Lead');

// 1. Obtener todos los Leads (prospectos) de una veterinaria específica
router.get('/leads/:tenantId', async (req, res) => {
    try {
        // Busca los leads de ese negocio y los ordena del más nuevo al más viejo
        const leads = await Lead.find({ tenantId: req.params.tenantId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: leads.length, data: leads });
    } catch (error) {
        console.error("Error al obtener leads:", error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

// 2. Obtener todos los Contactos (historial de chats) de una veterinaria
router.get('/contacts/:tenantId', async (req, res) => {
    try {
        // Busca los contactos ordenados por la última vez que escribieron
        const contacts = await Contact.find({ tenantId: req.params.tenantId }).sort({ lastInteraction: -1 });
        res.status(200).json({ success: true, count: contacts.length, data: contacts });
    } catch (error) {
        console.error("Error al obtener contactos:", error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

module.exports = router;