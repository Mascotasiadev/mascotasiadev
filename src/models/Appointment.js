const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
    tenantId: { 
        type: String, 
        required: true,
        index: true 
    },
    clienteTelefono: { 
        type: String, 
        required: true 
    },
    nombreCliente: { 
        type: String 
    },
    nombreMascota: { 
        type: String 
    },
    servicio: { 
        type: String, 
        required: true 
    }, // Ej: "Baño Raza Grande"
    fechaInicio: { 
        type: Date, 
        required: true 
    }, // Ej: 2026-11-10T10:00:00Z
    fechaFin: { 
        type: Date, 
        required: true 
    },   // Ej: 2026-11-10T12:00:00Z
    estado: { 
        type: String, 
        enum: ['Pendiente', 'Confirmada', 'Completada', 'Cancelada'],
        default: 'Confirmada'
    },
    notasIA: {
        type: String // El bot puede anotar: "El perro es alérgico al champú de avena"
    }
}, { timestamps: true });

module.exports = mongoose.model('Appointment', AppointmentSchema);