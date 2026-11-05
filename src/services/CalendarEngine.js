/**
 * Motor Matemático de Disponibilidad y Agenda (CalendarEngine)
 * Gestiona duraciones dinámicas, espacios muertos y bloqueos de agenda.
 */
const mongoose = require('mongoose');

class CalendarEngineService {
    
    // ==========================================================
    // 1. CÁLCULO DINÁMICO DE DURACIÓN (SEGÚN REGLAS DEL MÓDULO)
    // ==========================================================
    static calcularDuracionMinutos(modulo, detalles) {
        // Reglas para Veterinaria (Módulo C)
        if (modulo === 'veterinaria') {
            const tipo = detalles.toLowerCase();
            if (tipo.includes('vacuna') || tipo.includes('desparasita')) return 15;
            if (tipo.includes('control') || tipo.includes('rutina')) return 30;
            return 45; // Consulta general o valoración por defecto
        }
        
        // Reglas para Pet Spa / Grooming (Módulo B)
        if (modulo === 'spa') {
            const razaOPeso = detalles.toLowerCase();
            if (razaOPeso.includes('grande') || razaOPeso.includes('deslanado') || razaOPeso.includes('husky')) return 90;
            if (razaOPeso.includes('mediano')) return 60;
            return 45; // Raza pequeña o baño básico por defecto
        }
        
        return 30; // Tiempo estándar de contingencia
    }

    // ==========================================================
    // 2. DETECCIÓN DE ESPACIOS DISPONIBLES (CRUCE DE HORARIOS)
    // ==========================================================
    static async consultarDisponibilidad(tenantId, fechaString, duracionNecesaria, horarioApertura = 9, horarioCierre = 18) {
        // fechaString debe ingresar en formato YYYY-MM-DD
        const [anio, mes, dia] = fechaString.split('-');
        
        // Construimos la ventana de tiempo operativa del negocio
        const inicioDia = new Date(anio, mes - 1, dia, horarioApertura, 0, 0);
        const finDia = new Date(anio, mes - 1, dia, horarioCierre, 0, 0);
        
        let citasExistentes = [];
        
        // ⚠️ En el siguiente paso conectaremos esto al modelo Appointment
        try {
            if (mongoose.models.Appointment) {
                const Appointment = mongoose.model('Appointment');
                citasExistentes = await Appointment.find({ 
                    tenantId, 
                    fechaInicio: { $gte: inicioDia, $lt: finDia },
                    estado: { $ne: 'Cancelada' }
                }).lean();
            }
        } catch (error) {
            console.log("⚠️ Modelo Appointment aún no registrado, operando con agenda en blanco.");
        }

        let slotsDisponibles = [];
        let horaActual = new Date(inicioDia);

        // Algoritmo de búsqueda de huecos (avanzando en bloques de 30 minutos)
        while (horaActual < finDia) {
            let finPosibleSlot = new Date(horaActual.getTime() + duracionNecesaria * 60000);
            
            // Si el servicio termina antes de la hora de cierre
            if (finPosibleSlot <= finDia) {
                // Verificar si este bloque choca con alguna cita guardada en MongoDB
                let hayChoque = citasExistentes.some(cita => {
                    return (horaActual < cita.fechaFin && finPosibleSlot > cita.fechaInicio);
                });

                if (!hayChoque) {
                    // Formatear hora (ej. "09:30" o "14:00")
                    let horaTexto = horaActual.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });
                    slotsDisponibles.push(horaTexto);
                }
            }
            // Avanzar el escáner 30 minutos para buscar el siguiente hueco
            horaActual = new Date(horaActual.getTime() + 30 * 60000);
        }

        return slotsDisponibles;
    }
}

module.exports = CalendarEngineService;