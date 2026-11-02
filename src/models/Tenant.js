// src/models/Tenant.js
const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  nombreNegocio: { type: String, required: true },
  telefonoWhatsApp: { type: String, required: true, unique: true }, // El número que conectarán a la API
  
  // Banderas de Funciones (Feature Flags) para activar módulos según lo que compren
  modulosActivos: {
    petshop: { type: Boolean, default: false }, // Activa el catálogo de productos
    petspa: { type: Boolean, default: false },  // Activa agendamiento por tiempos
    veterinaria: { type: Boolean, default: false } // Activa el triage y campañas profilácticas
  },
  
  // Control financiero para tu Súper Admin
  estadoSuscripcion: { type: String, default: 'activa', enum: ['activa', 'pendiente', 'cancelada'] },
  fechaCorte: { type: Date }

}, { timestamps: true });

module.exports = mongoose.model('Tenant', tenantSchema);