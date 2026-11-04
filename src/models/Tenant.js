const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
    tenantId: { type: String, required: true, unique: true }, // 👈 El phone_number_id de Meta
    nombreNegocio: { type: String, required: true },
    pais: { type: String, enum: ['EC', 'CO'], default: 'EC' }, // 🇪🇨 Ecuador o 🇨🇴 Colombia
    ciudad: { type: String, default: 'No especificada' },
    modulos: {
        vet: { type: Boolean, default: false },
        spa: { type: Boolean, default: false },
        shop: { type: Boolean, default: false }
    },
    erp: { type: String, default: 'Excel / CSV Manual' },
    activo: { type: Boolean, default: true }, // 👈 Interruptor maestro de cobro (Corte de servicio)
    fechaCreacion: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tenant', tenantSchema);