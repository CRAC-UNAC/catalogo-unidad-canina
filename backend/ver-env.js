require('dotenv').config();

console.log('Archivo .env cargado');

console.log('DB_USER:', process.env.DB_USER || 'No definido');
console.log('DB_HOST:', process.env.DB_HOST || 'No definido');
console.log('DB_NAME:', process.env.DB_NAME || 'No definido');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'CARGADA' : 'No definida');
console.log('DB_PORT:', process.env.DB_PORT || 'No definido');
