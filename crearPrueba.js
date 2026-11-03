require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('./src/models/Lead');

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('⏳ Conectando a MongoDB Atlas...');
        
        await Lead.create({
            tenantId: '1433813413148961',
            phoneNumber: '593999999999',
            name: 'Cliente de Prueba (Manual)',
            businessType: 'Peluquería Canina',
            summary: 'Este es un prospecto inyectado manualmente para verificar que el Dashboard visual funciona correctamente.',
            status: 'Pendiente'
        });
        
        console.log('✅ ¡Lead de prueba inyectado exitosamente! Ya puedes revisar tu Dashboard.');
        process.exit();
    })
    .catch(err => {
        console.error('❌ Error de conexión:', err);
        process.exit(1);
    });