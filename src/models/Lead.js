const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true },
    name: { type: String, default: 'Cliente' },
    businessType: { type: String, default: 'No especificado' }, // Ejemplo: Veterinaria, Spa, Petshop
    summary: { type: String, default: 'Solicita información' },  // Lo que la IA detecte que quiere
    status: { type: String, default: 'Pendiente' },             // Para saber si ya lo llamaron o no
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Lead', leadSchema);