const mongoose = require('mongoose');

const CatalogItemSchema = new mongoose.Schema({
    tenantId: { 
        type: String, 
        required: true,
        index: true 
    },
    nombre: { 
        type: String, 
        required: true 
    }, // Ej: "Baño Completo Raza Grande"
    modulo: { 
        type: String, 
        enum: ['veterinaria', 'spa', 'shop'], 
        required: true 
    }, // Para saber a qué módulo pertenece
    precio: { 
        type: Number, 
        required: true 
    }, // Ej: 25.00
    duracionMinutos: { 
        type: Number,
        default: 30
    }, // AQUÍ ESTÁ LA MAGIA: El dueño define si dura 60, 90 o 120 min.
    impuestoAplicable: {
        type: Boolean,
        default: true // Si es veterinaria será false (0% IVA), si es Spa será true.
    },
    activo: { 
        type: Boolean, 
        default: true 
    }
}, { timestamps: true });

module.exports = mongoose.model('CatalogItem', CatalogItemSchema);