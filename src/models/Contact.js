const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true, unique: true },
    name: { type: String }, // Nombre que el usuario tiene en WhatsApp
    tenantId: { type: String, default: 'veterinaria_demo' }, // Identificador del Spa/Veterinaria
    lastInteraction: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Contact', contactSchema);