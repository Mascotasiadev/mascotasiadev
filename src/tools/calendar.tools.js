/**
 * Herramientas de Agenda para Gemini (Function Calling)
 * Permite a la IA consultar espacios muertos y agendar directamente en MongoDB.
 */
const CalendarEngineService = require('../services/CalendarEngine');
const Appointment = require('../models/Appointment');
const CatalogItem = require('../models/CatalogItem');

// 1. DEFINICIÓN DE ESTRUCTURA PARA GOOGLE GEMINI
const calendarToolsDefinition = [
    {
        name: "consultar_disponibilidad",
        description: "Consulta las horas disponibles en la agenda del local para una fecha específica.",
        parameters: {
            type: "OBJECT",
            properties: {
                fecha: { type: "STRING", description: "Fecha exacta a consultar en formato YYYY-MM-DD" },
                servicio_solicitado: { type: "STRING", description: "Nombre del servicio, ej: Baño perro grande, Vacuna" }
            },
            required: ["fecha", "servicio_solicitado"]
        }
    },
    {
        name: "agendar_cita_oficial",
        description: "Guarda la cita en la base de datos de forma definitiva y devuelve la confirmación.",
        parameters: {
            type: "OBJECT",
            properties: {
                fecha: { type: "STRING", description: "Fecha en formato YYYY-MM-DD" },
                hora: { type: "STRING", description: "Hora de inicio en formato HH:MM (24 horas)" },
                servicio: { type: "STRING", description: "Nombre del servicio acordado" },
                nombre_dueño: { type: "STRING", description: "Nombre completo o de pila del cliente" },
                nombre_mascota: { type: "STRING", description: "Nombre de la mascota" }
            },
            required: ["fecha", "hora", "servicio", "nombre_dueño", "nombre_mascota"]
        }
    }
];

// 2. EJECUCIÓN LÓGICA CUANDO LA IA DECIDE USAR UNA HERRAMIENTA
async function ejecutarHerramientaCalendario(nombreFuncion, args, tenantId, fromPhone) {
    try {
        if (nombreFuncion === "consultar_disponibilidad") {
            let duracion = 30; // Tiempo por contingencia
            
            // A. Buscar en el catálogo personalizado del comercio
            const item = await CatalogItem.findOne({ tenantId, nombre: { $regex: args.servicio_solicitado, $options: 'i' } });
            
            if (item && item.duracionMinutos) {
                duracion = item.duracionMinutos;
            } else {
                // B. Si no está, usar la matemática predictiva del motor
                duracion = CalendarEngineService.calcularDuracionMinutos('general', args.servicio_solicitado);
            }

            // C. Consultar huecos reales
            const disponibles = await CalendarEngineService.consultarDisponibilidad(tenantId, args.fecha, duracion);
            
            if (disponibles.length === 0) {
                return { estado: "sin_turnos", mensaje: "No hay disponibilidad para esa fecha." };
            }
            return { estado: "disponible", opciones_hora_libre: disponibles, duracion_calculada_minutos: duracion };
        }

        if (nombreFuncion === "agendar_cita_oficial") {
            let duracion = 30;
            const item = await CatalogItem.findOne({ tenantId, nombre: { $regex: args.servicio, $options: 'i' } });
            if (item && item.duracionMinutos) duracion = item.duracionMinutos;

            // Procesar fechas nativas en Node.js
            const [anio, mes, dia] = args.fecha.split('-');
            const [h, m] = args.hora.split(':');
            
            const fechaInicio = new Date(anio, mes - 1, dia, h, m, 0);
            const fechaFin = new Date(fechaInicio.getTime() + duracion * 60000);

            // Guardar en la base de datos de forma real
            const nuevaCita = await Appointment.create({
                tenantId,
                clienteTelefono: fromPhone,
                nombreCliente: args.nombre_dueño,
                nombreMascota: args.nombre_mascota,
                servicio: args.servicio,
                fechaInicio,
                fechaFin,
                estado: 'Confirmada'
            });

            const horaFinTxt = fechaFin.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });
            return { 
                estado: "exito", 
                id_cita_mongodb: nuevaCita._id,
                mensaje: `Cita agendada y guardada correctamente. Ocupará el bloque de ${args.hora} a ${horaFinTxt}.`
            };
        }
    } catch (error) {
        console.error(`❌ Error al ejecutar herramienta ${nombreFuncion}:`, error);
        return { estado: "error", mensaje: "Fallo interno en la base de datos." };
    }
    
    return { estado: "no_encontrada", mensaje: "La herramienta no existe." };
}

module.exports = {
    calendarToolsDefinition,
    ejecutarHerramientaCalendario
};