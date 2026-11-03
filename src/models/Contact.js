const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true, unique: true },
    name: { type: String, default: 'Cliente' },
    lastInteraction: { type: Date, default: Date.now },
    history: { type: Array, default: [] } // 👈 ¡Aquí guardaremos la memoria de los chats!
});

module.exports = mongoose.model('Contact', contactSchema);