console.log('Iniciando script');

try {
  require('dotenv').config();
  console.log('.env cargado');
  console.log('DB_USER:', process.env.DB_USER);
} catch (e) {
  console.error('Error al cargar dotenv:', e);
}

console.log('Fin del script');
