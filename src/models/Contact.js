const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    tenantId: { type: String, required: true }, // 👈 ID del negocio (Ej. el teléfono de la veterinaria)
    phoneNumber: { type: String, required: true },
    name: { type: String, default: 'Cliente' },
    lastInteraction: { type: Date, default: Date.now },
    history: { type: Array, default: [] }
});

// Índice compuesto: Un cliente es único solo dentro de una misma veterinaria
contactSchema.index({ tenantId: 1, phoneNumber: 1 }, { unique: true });

module.exports = mongoose.model('Contact', contactSchema);