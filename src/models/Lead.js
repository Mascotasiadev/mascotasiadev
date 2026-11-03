const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    tenantId: { type: String, required: true }, // 👈 A qué veterinaria le pertenece este lead
    phoneNumber: { type: String, required: true },
    name: { type: String, default: 'Cliente' },
    businessType: { type: String, default: 'No especificado' },
    summary: { type: String, default: 'Solicita información' },
    status: { type: String, default: 'Pendiente' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Lead', leadSchema);