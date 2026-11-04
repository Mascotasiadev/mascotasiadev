const express = require('express');
const router = express.Router();
const Tenant = require('../models/Tenant');

// 1. OBTENER TODOS LOS CLIENTES (Para llenar tu SuperAdmin)
router.get('/', async (req, res) => {
    try {
        const tenants = await Tenant.find().sort({ fechaCreacion: -1 });
        res.status(200).json({ success: true, data: tenants });
    } catch (error) {
        console.error("Error al obtener tenants:", error);
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

// 2. CREAR UN NUEVO CLIENTE (Desde el modal de SuperAdmin)
router.post('/create', async (req, res) => {
    try {
        const { tenantId, nombreNegocio, pais, ciudad, modulos, erp } = req.body;
        
        const existe = await Tenant.findOne({ tenantId });
        if (existe) {
            return res.status(400).json({ success: false, message: 'Este Tenant ID ya está registrado.' });
        }

        const nuevoTenant = new Tenant({
            tenantId,
            nombreNegocio,
            pais,
            ciudad,
            modulos,
            erp,
            activo: true
        });

        await nuevoTenant.save();
        res.status(201).json({ success: true, message: 'Negocio creado con éxito', data: nuevoTenant });
    } catch (error) {
        console.error("Error al crear tenant:", error);
        res.status(500).json({ success: false, message: 'Error al registrar el negocio' });
    }
});

// 3. CAMBIAR ESTADO O MÓDULOS DE UN CLIENTE (Interruptores en vivo)
router.put('/update/:tenantId', async (req, res) => {
    try {
        const { modulos, activo, erp } = req.body;
        const updateData = {};
        
        if (modulos) updateData.modulos = modulos;
        if (activo !== undefined) updateData.activo = activo;
        if (erp) updateData.erp = erp;

        const tenantActualizado = await Tenant.findOneAndUpdate(
            { tenantId: req.params.tenantId },
            { $set: updateData },
            { new: true }
        );

        if (!tenantActualizado) {
            return res.status(404).json({ success: false, message: 'Negocio no encontrado' });
        }

        res.status(200).json({ success: true, message: 'Actualizado correctamente', data: tenantActualizado });
    } catch (error) {
        console.error("Error al actualizar tenant:", error);
        res.status(500).json({ success: false, message: 'Error al actualizar' });
    }
});

module.exports = router;