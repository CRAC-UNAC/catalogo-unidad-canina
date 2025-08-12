// Middleware para verificar JWT
function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
  jwt.verify(
    token,
    process.env.JWT_SECRET || 'secreto_predeterminado',
    (err, user) => {
      if (err) return res.status(403).json({ error: 'Token inválido' });
      req.usuario = user;
      next();
    },
  );
}
// --- Importaciones y configuración base ---
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');

const pool = require('./config/db');
const multer = require('multer');
const fs = require('fs'); // Para funciones síncronas como existsSync, mkdirSync
const fsp = require('fs').promises; // Para funciones asíncronas como unlink
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// Verificación de conexión a la base de datos
pool.on('connect', () => {
  console.log('✅ Conectado a la base de datos PostgreSQL'); //
});

pool.on('error', (err) => {
  console.error('❌ Error en la conexión a la base de datos PostgreSQL', err); //
});

// --- Configuración de Multer para guardar imágenes en img2 ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destPath = path.join(__dirname, 'img2');
    console.log(`[Multer] Intentando guardar en: ${destPath}`); // Log añadido
    // Asegúrate de que el directorio existe
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
      console.log(`[Multer] Directorio creado: ${destPath}`); // Log añadido
    }
    cb(null, destPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const newFileName = file.fieldname + '-' + uniqueSuffix + ext;
    console.log(`[Multer] Nombre de archivo generado: ${newFileName}`); // Log añadido
    cb(null, newFileName);
  },
});

// <<<<<<<<<<<<<<<< ¡DEBES AÑADIR LA SIGUIENTE LÍNEA AQUÍ! >>>>>>>>>>>>>>>>>>
const upload = multer({ storage: storage }); // <-- ¡AÑADE ESTA LÍNEA EXACTAMENTE AQUÍ!
// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

// Endpoint para crear noticia (protegido con JWT)
app.post(
  '/api/noticias',
  verificarToken, // Usando verificarToken
  upload.single('imagen'),
  async (req, res) => {
    try {
      const { titulo, contenido } = req.body;
      const imagen = req.file ? req.file.filename : null;

      if (!titulo || !contenido || !imagen) {
        return res.status(400).json({ error: 'Faltan datos obligatorios.' });
      }

      // Eliminar la noticia más antigua si ya hay 5
      const noticias = await pool.query(
        'SELECT id FROM noticias ORDER BY fecha_creacion DESC',
      );
      if (noticias.rows.length >= 5) {
        const idAntigua = noticias.rows[noticias.rows.length - 1].id;
        // Eliminar imagen física
        const imgRes = await pool.query(
          'SELECT imagen FROM noticias WHERE id = $1',
          [idAntigua],
        );
        if (imgRes.rows[0]?.imagen) {
          const imgPath = path.join(__dirname, 'img2', imgRes.rows[0].imagen);
          // Usar fs.promises.unlink para async/await
          await fs.unlink(imgPath).catch((unlinkError) => {
            console.warn(
              'No se pudo eliminar la imagen antigua:',
              unlinkError.message,
            );
          });
        }
        await pool.query('DELETE FROM noticias WHERE id = $1', [idAntigua]);
      }

      // Insertar nueva noticia
      await pool.query(
        'INSERT INTO noticias (titulo, contenido, imagen) VALUES ($1, $2, $3)',
        [titulo, contenido, imagen],
      );
      res.status(201).json({ mensaje: 'Noticia creada correctamente.' });
    } catch (error) {
      console.error('Error al crear noticia:', error);
      res.status(500).json({ error: 'Error al crear noticia.' });
    }
  },
);

// Endpoint para obtener noticias (máximo 5, más recientes) (protegido)
app.get('/api/noticias', verificarToken, async (req, res) => {
  // Usando verificarToken
  try {
    const result = await pool.query(
      'SELECT id, titulo, contenido, imagen, fecha_creacion FROM noticias ORDER BY fecha_creacion DESC LIMIT 5',
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener noticias.' });
  }
});

// Servir imágenes de noticias
app.use('/backend/img2', express.static(path.join(__dirname, 'img2')));

// 🗂 Servir archivos estáticos de la carpeta /admin
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// 🔁 Ruta de prueba (protegida)
app.get('/api/test-db', verificarToken, async (req, res) => {
  // Usando verificarToken
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ horaServidor: result.rows[0].now });
  } catch (error) {
    console.error('Error en /api/test-db:', error);
    res.status(500).json({ error: 'Error al conectar con PostgreSQL' });
  }
});

// 📝 Ruta de registro (protegida)
app.post('/api/registro', verificarToken, async (req, res) => {
  // Usando verificarToken
  const { nombre, correo, usuario, clave, codigo } = req.body;

  if (!nombre || !correo || !usuario || !clave || !codigo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios.' });
  }

  // ✅ Verificar código especial
  if (codigo !== 'CRAC') {
    // Código especial corregido si era 'UNAC'
    return res.status(400).json({ error: 'Código especial incorrecto' });
  }

  try {
    // Verificar si el usuario o correo ya existen
    const yaExiste = await pool.query(
      'SELECT * FROM usuarios_admin WHERE usuario = $1 OR correo = $2',
      [usuario, correo],
    );

    if (yaExiste.rows.length > 0) {
      return res.status(409).json({ error: 'Usuario o correo ya registrado.' });
    }

    // 🔐 Encriptar la contraseña
    const claveEncriptada = await bcrypt.hash(clave, 10);

    // Insertar en la base de datos
    await pool.query(
      'INSERT INTO usuarios_admin (nombre_completo, correo, usuario, clave) VALUES ($1, $2, $3, $4)',
      [nombre, correo, usuario, claveEncriptada],
    );

    res.status(201).json({ mensaje: 'Usuario registrado exitosamente.' });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// 🔐 Ruta para login
app.post('/api/login', async (req, res) => {
  const { usuario, clave } = req.body;

  try {
    const resultado = await pool.query(
      'SELECT * FROM usuarios_admin WHERE usuario = $1',
      [usuario],
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const usuarioBD = resultado.rows[0];
    const claveCoincide = await bcrypt.compare(clave, usuarioBD.clave);

    if (!claveCoincide) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // Generar token JWT
    const token = jwt.sign(
      {
        id: usuarioBD.id,
        usuario: usuarioBD.usuario,
        nombre: usuarioBD.nombre_completo,
        correo: usuarioBD.correo,
      },
      process.env.JWT_SECRET || 'secreto_predeterminado',
      { expiresIn: '2h' },
    );

    res.json({ mensaje: 'Inicio de sesión exitoso', token });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Funciones auxiliares para crear tablas si no existen
const crearTablaSiNoExiste = async (nombreTabla, campos) => {
  // Cambiado 'columnas' a 'campos' para coincidir con el uso
  try {
    // Ajustar a sintaxis PostgreSQL: AUTO_INCREMENT es SERIAL, ON UPDATE CURRENT_TIMESTAMP no existe directamente
    let querySQL = `CREATE TABLE IF NOT EXISTS ${nombreTabla} (
      id SERIAL PRIMARY KEY,
      usuario_id INT,
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,`; // Ajustado para PostgreSQL

    // AGREGAR CAMPOS DINAMICAMENTE
    campos.forEach((campo) => {
      if (campo.name === 'imagen') {
        querySQL += ` ${campo.name} VARCHAR(255),`;
      } else if (campo.type === 'number') {
        querySQL += ` ${campo.name} NUMERIC(10,2),`; // NUMERIC para decimales
      } else {
        querySQL += ` ${campo.name} TEXT,`;
      }
    });

    // Eliminar la última coma y cerrar la definición de columnas
    querySQL = querySQL.slice(0, -1); // Elimina la última coma
    querySQL += `, FOREIGN KEY (usuario_id) REFERENCES usuarios_admin(id))`; // Referencia a usuarios_admin

    await pool.query(querySQL);
    console.log(`✅ Tabla ${nombreTabla} creada o ya existe.`);
  } catch (error) {
    console.error(`❌ Error al crear tabla ${nombreTabla}:`, error);
    throw error; // Propagar el error para que la inicialización del servidor falle si una tabla no se puede crear
  }
};

// FUNCION GENERICA PARA GUARDAR FICHAS

// FUNCION GENERICA PARA CREAR TABLAS DE FICHAS
const guardarFicha = async (req, res, nombreTabla, campos) => {
  // Cambiado: Obtener un cliente del pool para manejar la transacción
  console.log('[guardarFicha] Iniciando proceso para tabla:', nombreTabla); // Log añadido
  const client = await pool.connect(); //

  try {
    // Iniciando la transacción
    await client.query('BEGIN'); //

    // Preparar datos
    const datos = {};
    campos.forEach((campo) => {
      if (campo.name !== 'imagen') {
        datos[campo.name] = req.body[campo.name] || null;
      }
    });

    // Manejar imagen si existe
    if (req.file) {
      datos.imagen = req.file.filename;
    }

    console.log(
      '[guardarFicha] req.file procesado:',
      req.file ? req.file.path : 'No hay archivo',
    ); // Log añadido

    // Agregar usuario_id desde req.usuario (establecido por verificarToken/authenticateToken)
    // Asegúrate de que tu middleware de autenticación establece req.usuario
    datos.usuario_id = req.usuario.id; // // <--- CORRECCIÓN AQUÍ

    // Construir query dinámicamente
    const columnas = Object.keys(datos);
    const valores = Object.values(datos);
    // Cambiado: Usar marcadores de posición $1, $2, etc. para PostgreSQL
    const placeholders = columnas.map((_, index) => `$${index + 1}`).join(', '); // <--- CORRECCIÓN AQUÍ

    const sql = `INSERT INTO ${nombreTabla} (${columnas.join(', ')}) VALUES (${placeholders})`;

    // Cambiado: Usar client.query para ejecutar la consulta
    await client.query(sql, valores); //

    // Confirmar la transacción
    await client.query('COMMIT'); //

    res.status(201).json({
      success: true,
      mensaje: 'Ficha guardada exitosamente',
      // 'id: result.insertId' se eliminó porque es específico de MySQL y no necesario aquí
    });
  } catch (error) {
    // Revertir la transacción en caso de error
    await client.query('ROLLBACK'); //
    console.error(
      '[guardarFicha] Error en DB o proceso, intentando eliminar archivo:',
      req.file ? req.file.path : 'No hay archivo',
      'Error:',
      error,
    ); // Log modificado

    // Eliminar archivo si hubo error
    if (req.file) {
      try {
        // req.file.path ya contiene la ruta completa del archivo subido por Multer
        await fsp.unlink(req.file.path); // <-- CAMBIA ESTO a 'fsp.unlink'
      } catch (unlinkError) {
        console.error(
          '[guardarFicha] Error eliminando archivo post-fallo DB:',
          unlinkError,
        ); // Log añadido
      }
    }

    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      mensaje: 'No se pudo guardar la ficha',
    });
  } finally {
    // Liberar el cliente de la conexión de vuelta al pool
    client.release(); //
  }
};

// CONFIGURACIÒN DE CAMPOS (IMPORTADO DEL FRONTEND)
const camposConfig = {
  // Canes Biológicos
  canes_antidrogas: [
    { name: 'razas_requeridas', type: 'text' },
    { name: 'edad_requerida', type: 'number' },
    { name: 'caracteristicas_requeridas', type: 'text' },
    { name: 'documentos_identidad', type: 'text' },
    { name: 'requerimiento_veterinario', type: 'number' },
    { name: 'imagen', type: 'file' },
  ],
  canes_control_orden: [
    { name: 'razas_requeridas', type: 'text' },
    { name: 'edad_requerida', type: 'number' },
    { name: 'caracteristicas_requeridas', type: 'text' },
    { name: 'documentos_identidad', type: 'text' },
    { name: 'requerimiento_veterinario', type: 'number' },
    { name: 'imagen', type: 'file' },
  ],
  canes_busqueda: [
    // Nombre del objeto cambiado a 'canes_busqueda' para que coincida con la ruta
    { name: 'razas_requeridas', type: 'text' },
    { name: 'edad_requerida', type: 'number' },
    { name: 'caracteristicas_requeridas', type: 'text' },
    { name: 'documentos_identidad', type: 'text' },
    { name: 'requerimiento_veterinario', type: 'number' },
    { name: 'imagen', type: 'file' },
  ],
  canes_rel_publicas: [
    // Nombre del objeto cambiado a 'canes_rel_publicas' para que coincida con la ruta
    { name: 'razas_requeridas', type: 'text' },
    { name: 'edad_requerida', type: 'number' },
    { name: 'caracteristicas_requeridas', type: 'text' },
    { name: 'documentos_identidad', type: 'text' },
    { name: 'requerimiento_veterinario', type: 'number' },
    { name: 'imagen', type: 'file' },
  ],

  canes_terapia: [
    { name: 'razas_requeridas', type: 'text' },
    { name: 'edad_requerida', type: 'number' },
    { name: 'caracteristicas_requeridas', type: 'text' },
    { name: 'documentos_identidad', type: 'text' },
    { name: 'requerimiento_veterinario', type: 'number' },
    { name: 'imagen', type: 'file' },
  ],

  // Vehículos - Camiones
  camiones: [
    { name: 'capacidad_carga_eje_delantero', type: 'number' },
    { name: 'capacidad_carga_eje_trasero', type: 'number' },
    { name: 'capacidad_carga', type: 'number' },
    { name: 'peso_bruto', type: 'number' },
    { name: 'peso_vacio', type: 'number' },
    { name: 'neumaticos', type: 'text' },
    { name: 'sistema_inyeccion', type: 'text' },
    { name: 'norma_control_emisiones', type: 'text' },
    { name: 'potencia_maxima', type: 'text' },
    { name: 'torque_maximo', type: 'text' },
    { name: 'cilindraje', type: 'text' },
    { name: 'transmision_tipo', type: 'text' },
    { name: 'numero_velocidades', type: 'text' },
    { name: 'eje_delantero', type: 'text' },
    { name: 'eje_trasero', type: 'text' },
    { name: 'suspension_delantera', type: 'text' },
    { name: 'suspension_trasera', type: 'text' },
    { name: 'direccion', type: 'text' },
    { name: 'frenos_servicio', type: 'text' },
    { name: 'sistema_control', type: 'text' },
    { name: 'frenos_estacionamiento', type: 'text' },
    { name: 'frenos_motor', type: 'text' },
    { name: 'imagen', type: 'file' },
  ],

  // Vehículos - Camionetas
  vehiculos_camionetas: [
    { name: 'alto_total_mm', type: 'number' },
    { name: 'ancho_total_mm', type: 'number' },
    { name: 'distancia_ejes_mm', type: 'number' },
    { name: 'largo_total_mm', type: 'number' },
    { name: 'direccion_tipo', type: 'text' },
    { name: 'sensores_presion_llantas', type: 'text' },
    { name: 'aire_acondicionado', type: 'text' },
    { name: 'radio_pantalla', type: 'text' },
    { name: 'volante_multifuncion', type: 'text' },
    { name: 'alarma_fabrica', type: 'text' },
    { name: 'asientos_ecocuero', type: 'text' },
    { name: 'barra_tiro', type: 'text' },
    { name: 'neblineros_delanteros', type: 'text' },
    { name: 'recubrimiento_balde', type: 'text' },
    { name: 'roll_bar', type: 'text' },
    { name: 'velocidad_crucero', type: 'text' },
    { name: 'vidrios_retrovisores_electricos', type: 'text' },
    { name: 'color', type: 'text' },
    { name: 'num_pasajeros', type: 'number' },
    { name: 'fabricante', type: 'text' },
    { name: 'frenos_delanteros', type: 'text' },
    { name: 'frenos_tipo', type: 'text' },
    { name: 'frenos_posteriores', type: 'text' },
    { name: 'garantia', type: 'text' },
    { name: 'marchas', type: 'text' },
    { name: 'inmo_tipo', type: 'text' },
    { name: 'inmo_traccion', type: 'text' },
    { name: 'marca', type: 'text' },
    { name: 'modelo', type: 'text' },
    { name: 'motor_tipo', type: 'text' },
    { name: 'motor_potencia', type: 'text' },
    { name: 'motor_cilindrada', type: 'text' },
    { name: 'motor_combustible', type: 'text' },
    { name: 'motor_valvulas', type: 'text' },
    { name: 'motor_torque', type: 'text' },
    { name: 'seguridad', type: 'text' },
    { name: 'suspension_amortiguadores', type: 'text' },
    { name: 'suspension_neumatico', type: 'text' },
    { name: 'suspension_posterior', type: 'text' },
    { name: 'suspension_delantera', type: 'text' },
    { name: 'imagen', type: 'file' },
  ],

  // Vehículos - Furgonetas (mismos campos que camionetas)
  vehiculos_furgonetas: [
    { name: 'alto_total_mm', type: 'number' },
    { name: 'ancho_total_mm', type: 'number' },
    { name: 'distancia_ejes_mm', type: 'number' },
    { name: 'largo_total_mm', type: 'number' },
    { name: 'direccion_tipo', type: 'text' },
    { name: 'sensores_presion_llantas', type: 'text' },
    { name: 'aire_acondicionado', type: 'text' },
    { name: 'radio_pantalla', type: 'text' },
    { name: 'volante_multifuncion', type: 'text' },
    { name: 'alarma_fabrica', type: 'text' },
    { name: 'asientos_ecocuero', type: 'text' },
    { name: 'barra_tiro', type: 'text' },
    { name: 'neblineros_delanteros', type: 'text' },
    { name: 'recubrimiento_balde', type: 'text' },
    { name: 'roll_bar', type: 'text' },
    { name: 'velocidad_crucero', type: 'text' },
    { name: 'vidrios_retrovisores_electricos', type: 'text' },
    { name: 'color', type: 'text' },
    { name: 'num_pasajeros', type: 'number' },
    { name: 'fabricante', type: 'text' },
    { name: 'frenos_delanteros', type: 'text' },
    { name: 'frenos_tipo', type: 'text' },
    { name: 'frenos_posteriores', type: 'text' },
    { name: 'garantia', type: 'text' },
    { name: 'marchas', type: 'text' },
    { name: 'inmo_tipo', type: 'text' },
    { name: 'inmo_traccion', type: 'text' },
    { name: 'marca', type: 'text' },
    { name: 'modelo', type: 'text' },
    { name: 'motor_tipo', type: 'text' },
    { name: 'motor_potencia', type: 'text' },
    { name: 'motor_cilindrada', type: 'text' },
    { name: 'motor_combustible', type: 'text' },
    { name: 'motor_valvulas', type: 'text' },
    { name: 'motor_torque', type: 'text' },
    { name: 'seguridad', type: 'text' },
    { name: 'suspension_amortiguadores', type: 'text' },
    { name: 'suspension_neumatico', type: 'text' },
    { name: 'suspension_posterior', type: 'text' },
    { name: 'suspension_delantera', type: 'text' },
    { name: 'imagen', type: 'file' },
  ],

  // Muebles de Oficina
  muebles_oficina: [
    { name: 'material', type: 'text' },
    { name: 'dimensiones', type: 'text' },
    { name: 'color', type: 'text' },
    { name: 'peso', type: 'text' },
    { name: 'garantia', type: 'text' },
    { name: 'imagen', type: 'file' },
  ],
  // Muebles de Dormitorio (añadido basado en la ruta app.post)
  muebles_dormitorio: [
    { name: 'material', type: 'text' },
    { name: 'dimensiones', type: 'text' },
    { name: 'color', type: 'text' },
    { name: 'peso', type: 'text' },
    { name: 'garantia', type: 'text' },
    { name: 'imagen', type: 'file' },
  ],

  // Computadores de Escritorio
  computadores_escritorio: [
    { name: 'marca', type: 'text' },
    { name: 'certificados', type: 'text' },
    { name: 'chasis_tamano', type: 'text' },
    { name: 'chasis_color', type: 'text' },
    { name: 'equipo', type: 'text' },
    { name: 'fabricante', type: 'text' },
    { name: 'fuente_energia', type: 'text' },
    { name: 'memoria_ram', type: 'text' },
    { name: 'modelo', type: 'text' },
    { name: 'modelo_procesador', type: 'text' },
    { name: 'monitor_entradas_video', type: 'text' },
    { name: 'monitor_tamano', type: 'text' },
    { name: 'monitor_tipo_pantalla', type: 'text' },
    { name: 'motherboard_ranuras_ram_ddr4', type: 'text' },
    { name: 'motherboard_chipset', type: 'text' },
    { name: 'motherboard_memoria_ram_expandible', type: 'text' },
    { name: 'motherboard_puertos_funcionales', type: 'text' },
    { name: 'motherboard_red_lan', type: 'text' },
    { name: 'motherboard_seguridad', type: 'text' },
    { name: 'mouse_interfaz_tipo', type: 'text' },
    { name: 'nota_1', type: 'text' },
    { name: 'procesador', type: 'text' },
    { name: 'procesador_frecuencia_turbo_max', type: 'text' },
    { name: 'procesador_memoria_cache', type: 'text' },
    { name: 'procesador_numero_hilos_subprocesos', type: 'text' },
    { name: 'procesador_numero_nucleos', type: 'text' },
    { name: 'sistema_operativo_software_licenciado', type: 'text' },
    { name: 'teclado_interfaz_idioma', type: 'text' },
    { name: 'teclado_tamano', type: 'text' },
    { name: 'unidad_estado_solido', type: 'text' },
    { name: 'imagen', type: 'file' },
  ],

  // Campos para Laptops
  laptops: [
    { name: 'accesorios_adaptador_video', type: 'text' },
    { name: 'accesorios_cargador_bateria', type: 'text' },
    { name: 'accesorios_maletin_mochila', type: 'text' },
    { name: 'almacenamiento_cantidad', type: 'text' },
    { name: 'almacenamiento_capacidad_minimo', type: 'text' },
    { name: 'auriculares_microfono', type: 'text' },
    { name: 'bateria_fuente_alimentacion', type: 'text' },
    { name: 'baterias_duracion_minima', type: 'text' },
    { name: 'camara_web', type: 'text' },
    { name: 'certificados', type: 'text' },
    { name: 'computador_marca', type: 'text' },
    { name: 'computador_modelo', type: 'text' },
    { name: 'equipo', type: 'text' },
    { name: 'frecuencia_turbo_maximo', type: 'text' },
    { name: 'mouse_externo_interfaz_tipo', type: 'text' },
    { name: 'procesador_marca', type: 'text' },
    { name: 'memoria_ram_expandible_minima', type: 'text' },
    { name: 'procesador_modelo', type: 'text' },
    { name: 'motherboard_ranuras_ram_ddr4', type: 'text' },
    { name: 'motherboard_chipset', type: 'text' },
    { name: 'motherboard_conectividad', type: 'text' },
    { name: 'motherboard_memoria_ram_instalada', type: 'text' },
    { name: 'motherboard_puertos_funcionales', type: 'text' },
    { name: 'motherboard_seguridad', type: 'text' },
    { name: 'mouse_tactil', type: 'text' },
    { name: 'parlantes', type: 'text' },
    { name: 'procesador_frecuencia_base_minimo', type: 'text' },
    { name: 'procesador_memoria_cache_minimo', type: 'text' },
    { name: 'procesador_numero_hilos_subprocesos_minimo', type: 'text' },
    { name: 'procesador_numero_nucleos_minimo', type: 'text' },
    { name: 'sistema_operativo_software_licenciado', type: 'text' },
    { name: 'tamano_pantalla', type: 'text' },
    { name: 'tarjeta_video_procesador_grafico_gpu', type: 'text' },
    { name: 'teclado', type: 'text' },
    { name: 'teclado_idioma', type: 'text' },
    { name: 'tipo_pantalla', type: 'text' },
    { name: 'imagen', type: 'file' },
  ],

  // Base para Impresoras Multifunción Tinta Continua
  impresoras_multifuncion: [
    { name: 'bandejas_alimentacion', type: 'text' },

    { name: 'cantidad_usuarios', type: 'text' },
    { name: 'ciclo_trabajo_maximo_paginas_mensual', type: 'text' },
    { name: 'ciclo_recomendado_efectivo_mensual', type: 'text' },
    { name: 'colores_impresion', type: 'text' },
    { name: 'consumo_energetico_en_operacion', type: 'text' },
    { name: 'cpc', type: 'text' },
    { name: 'fabricante', type: 'text' },
    { name: 'impresion_duplex', type: 'text' },
    { name: 'marca', type: 'text' },
    { name: 'modelo', type: 'text' },
    { name: 'network', type: 'text' },
    { name: 'resolucion_impresion', type: 'text' },
    { name: 'sistemas_operativos_compatibles', type: 'text' },
    { name: 'scan_duplex', type: 'text' },
    { name: 'suministro_inicial_por_color', type: 'text' },
    { name: 'tamano_papel_soportados', type: 'text' },
    { name: 'tecnologia_impresion', type: 'text' },
    { name: 'tiempo_garantia_tecnica', type: 'text' },
    { name: 'vae', type: 'text' },
    { name: 'velocidad_impresion', type: 'text' },
    { name: 'imagen', type: 'file' },
  ],

  // Campos para Scanners
  scanners: [
    { name: 'capacidad_adf_hojas', type: 'text' },
    { name: 'ciclo_trabajo_maximo_imagenes_diario', type: 'text' },
    { name: 'conectividad', type: 'text' },
    { name: 'consumo_energetico_en_operacion', type: 'text' },
    { name: 'cpc', type: 'text' },
    { name: 'escanear_duplex', type: 'text' },
    { name: 'fabricante', type: 'text' },
    { name: 'marca', type: 'text' },
    { name: 'modelo', type: 'text' },
    { name: 'resolucion_escanear', type: 'text' },
    { name: 'sistemas_operativos_compatibles', type: 'text' },
    { name: 'software_captura', type: 'text' },
    { name: 'tamano_papel_soportados', type: 'text' },
    { name: 'tiempo_garantia_tecnica', type: 'text' },
    { name: 'vae', type: 'text' },
    { name: 'velocidad_escanear_duplex', type: 'text' },
    { name: 'velocidad_escanear_simple', type: 'text' },
    { name: 'imagen', type: 'file' },
  ],

  //Campos para Fuentes de Poder
  fuentes_poder: [
    // Nombre del objeto cambiado a 'fuentes_poder'
    { name: 'marca', type: 'text' },
    { name: 'modelo', type: 'text' },
    { name: 'potencia', type: 'text' },
    { name: 'tipo_conectores', type: 'text' },
    { name: 'eficiencia', type: 'text' },
    { name: 'garantia', type: 'text' },
    { name: 'imagen', type: 'file' },
  ],

  // Campos para Cámaras Web
  camaras_web: [
    { name: 'marca', type: 'text' },
    { name: 'modelo', type: 'text' },
    { name: 'resolucion_video', type: 'text' },
    { name: 'tipo_conexion', type: 'text' },
    { name: 'compatibilidad_so', type: 'text' },
    { name: 'microfono_integrado', type: 'text' },
    { name: 'garantia', type: 'text' },
    { name: 'imagen', type: 'file' },
  ],

  //Campos para Microfonos
  microfonos: [
    { name: 'marca', type: 'text' },
    { name: 'modelo', type: 'text' },
    { name: 'tipo_conexion', type: 'text' },
    { name: 'compatibilidad_so', type: 'text' },
    { name: 'sensibilidad', type: 'text' },
    { name: 'garantia', type: 'text' },
    { name: 'imagen', type: 'file' },
  ],

  // Campos para Proyectores
  proyectores: [
    { name: 'marca', type: 'text' },
    { name: 'modelo', type: 'text' },
    { name: 'resolucion_native', type: 'text' },
    { name: 'brillo_lumenes_ansi', type: 'text' },
    { name: 'contraste', type: 'text' },
    { name: 'tipo_conexion', type: 'text' },
    { name: 'compatibilidad_so', type: 'text' },
    { name: 'garantia', type: 'text' },
    { name: 'imagen', type: 'file' },
  ],
  // Puedes agregar más configuraciones aquí según necesites
};

// ============================================
// RUTAS PARA FICHAS - CANES BIOLÓGICOS
// ============================================

app.post(
  '/api/fichas/canes/antidrogas',
  verificarToken,
  (req, res, next) => {
    console.log('[Backend] Procesando subida de imagen con Multer...'); // Log añadido
    upload.single('imagen')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        console.error('[Backend] Error de Multer:', err); // Log añadido
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'El archivo es demasiado grande. Máximo 5MB permitido.',
          });
        }
        return res.status(400).json({
          success: false,
          error: `Error de subida (Multer): ${err.message}`,
        });
      } else if (err) {
        console.error('[Backend] Error desconocido al subir imagen:', err); // Log añadido
        return res.status(500).json({
          success: false,
          error: `Error interno al subir imagen: ${err.message}`,
        });
      } else {
        console.log('[Backend] Multer completado, pasando a guardarFicha.'); // Log añadido
        next(); // Si no hay errores en Multer, pasa al siguiente middleware/controlador
      }
    });
  },
  (req, res) =>
    guardarFicha(req, res, 'canes_antidrogas', camposConfig.canes_antidrogas),
);

app.post(
  '/api/fichas/canes/busqueda',
  verificarToken, // Corregido: Usando verificarToken
  upload.single('imagen'),
  (req, res) =>
    guardarFicha(
      req,
      res,
      'canes_busqueda', // Nombre de la tabla corregido
      camposConfig.canes_busqueda, // Nombre del objeto de config corregido
    ),
);

app.post(
  '/api/fichas/canes/rel-publicas',
  verificarToken, // Corregido: Usando verificarToken
  upload.single('imagen'),
  (req, res) =>
    guardarFicha(
      req,
      res,
      'canes_rel_publicas', // Nombre de la tabla corregido
      camposConfig.canes_rel_publicas, // Nombre del objeto de config corregido
    ),
);

app.post(
  '/api/fichas/canes/terapia',
  verificarToken, // Corregido: Usando verificarToken
  upload.single('imagen'),
  (req, res) =>
    guardarFicha(
      req,
      res,
      'canes_terapia', // Nombre de la tabla corregido
      camposConfig.canes_terapia, // Nombre del objeto de config corregido
    ),
);

// ============================================
// RUTAS PARA FICHAS - VEHÍCULOS
// ============================================

app.post(
  '/api/fichas/vehiculos/camiones',
  verificarToken, // Corregido: Usando verificarToken
  upload.single('imagen'),
  (req, res) =>
    guardarFicha(
      req,
      res,
      'camiones', // Nombre de la tabla corregido (era vehiculos_camiones en camposConfig)
      camposConfig.camiones,
    ),
);

app.post(
  '/api/fichas/vehiculos/camionetas',
  verificarToken, // Corregido: Usando verificarToken
  upload.single('imagen'),
  (req, res) =>
    guardarFicha(
      req,
      res,
      'vehiculos_camionetas',
      camposConfig.vehiculos_camionetas,
    ),
);

app.post(
  '/api/fichas/vehiculos/furgonetas',
  verificarToken, // Corregido: Usando verificarToken
  upload.single('imagen'),
  (req, res) =>
    guardarFicha(
      req,
      res,
      'vehiculos_furgonetas',
      camposConfig.vehiculos_furgonetas,
    ),
);

// ============================================
// RUTAS PARA FICHAS - MUEBLES
// ============================================

app.post(
  '/api/fichas/muebles/oficina',
  verificarToken, // Corregido: Usando verificarToken
  upload.single('imagen'),
  (req, res) =>
    guardarFicha(req, res, 'muebles_oficina', camposConfig.muebles_oficina),
);

app.post(
  '/api/fichas/muebles/dormitorio',
  verificarToken, // Corregido: Usando verificarToken
  upload.single('imagen'),
  (req, res) =>
    guardarFicha(
      req,
      res,
      'muebles_dormitorio',
      camposConfig.muebles_dormitorio,
    ),
);

// ============================================
// RUTAS PARA FICHAS - TECNOLOGÍA
// ============================================

app.post(
  '/api/fichas/computadores/escritorio',
  verificarToken, // Corregido: Usando verificarToken
  upload.single('imagen'),
  (req, res) =>
    guardarFicha(
      req,
      res,
      'computadores_escritorio',
      camposConfig.computadores_escritorio,
    ),
);

app.post(
  '/api/fichas/computadores/laptops',
  verificarToken, // Corregido: Usando verificarToken
  upload.single('imagen'),
  (req, res) => guardarFicha(req, res, 'laptops', camposConfig.laptops),
);

app.post(
  '/api/fichas/impresoras/multifuncion',
  verificarToken, // Corregido: Usando verificarToken
  upload.single('imagen'),
  (req, res) =>
    guardarFicha(
      req,
      res,
      'impresoras_multifuncion',
      camposConfig.impresoras_multifuncion,
    ),
);

app.post(
  '/api/fichas/perifericos/scanners',
  verificarToken, // Corregido: Usando verificarToken
  upload.single('imagen'),
  (req, res) => guardarFicha(req, res, 'scanners', camposConfig.scanners),
);

app.post(
  '/api/fichas/perifericos/fuentes-poder',
  verificarToken, // Corregido: Usando verificarToken
  upload.single('imagen'),
  (req, res) =>
    guardarFicha(req, res, 'fuentes_poder', camposConfig.fuentes_poder), // Corregido: Usando 'fuentes_poder' como nombre de tabla y config
);

app.post(
  '/api/fichas/perifericos/camaras-web',
  verificarToken, // Corregido: Usando verificarToken
  upload.single('imagen'),
  (req, res) => guardarFicha(req, res, 'camaras_web', camposConfig.camaras_web),
);

app.post(
  '/api/fichas/perifericos/microfonos',
  verificarToken, // Corregido: Usando verificarToken
  upload.single('imagen'),
  (req, res) => guardarFicha(req, res, 'microfonos', camposConfig.microfonos),
);

app.post(
  '/api/fichas/perifericos/proyectores',
  verificarToken, // Corregido: Usando verificarToken
  upload.single('imagen'),
  (req, res) => guardarFicha(req, res, 'proyectores', camposConfig.proyectores),
);

// ============================================
// RUTAS PARA CONSULTAR FICHAS
// ============================================

// Ruta genérica para obtener fichas por tabla
app.get('/api/fichas/:tabla', verificarToken, async (req, res) => {
  // Corregido: Usando verificarToken
  try {
    const { tabla } = req.params;
    const { page = 1, limit = 10, search = '' } = req.query;

    // Validar que la tabla existe en nuestra configuración
    if (!camposConfig[tabla]) {
      return res.status(400).json({
        success: false,
        error: 'Tabla no válida',
      });
    }

    const offset = (page - 1) * limit;
    let whereClause = '';
    let params = [limit, offset];
    let paramIndex = 3; // Índice para parámetros de búsqueda

    // Agregar búsqueda si se proporciona
    if (search) {
      // Necesitas saber qué columnas son de texto para buscar en ellas.
      // Por simplicidad, se puede buscar en 'id' y 'fecha_creacion' como ejemplo.
      // Para una búsqueda más robusta, deberías iterar sobre camposConfig[tabla] para columnas de tipo 'text'.
      whereClause = `WHERE CAST(id AS TEXT) ILIKE $${paramIndex} OR fecha_creacion::TEXT ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Query para obtener fichas con información del usuario
    const query = `
      SELECT
        f.*,
        u.nombre_completo as usuario_nombre,
        u.correo as usuario_email
      FROM ${tabla} f
      LEFT JOIN usuarios_admin u ON f.usuario_id = u.id
      ${whereClause}
      ORDER BY f.fecha_creacion DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, params);

    // Query para contar total de registros
    const countQuery = `SELECT COUNT(*) FROM ${tabla} ${whereClause}`;
    // Los parámetros para countQuery deben ser independientes si el paramIndex es diferente
    const countParams = search ? [`%${search}%`] : [];
    const countResult = await pool.query(countQuery, countParams);

    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_records: total,
        records_per_page: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Error obteniendo fichas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// Ruta para obtener una ficha específica
app.get('/api/fichas/:tabla/:id', verificarToken, async (req, res) => {
  // Corregido: Usando verificarToken
  try {
    const { tabla, id } = req.params;

    if (!camposConfig[tabla]) {
      return res.status(400).json({
        success: false,
        error: 'Tabla no válida',
      });
    }

    const query = `
      SELECT
        f.*,
        u.nombre_completo as usuario_nombre,
        u.correo as usuario_email
      FROM ${tabla} f
      LEFT JOIN usuarios_admin u ON f.usuario_id = u.id
      WHERE f.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ficha no encontrada',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error obteniendo ficha:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// Ruta para eliminar una ficha por tabla y ID (con eliminación de imagen asociada)
app.delete('/api/fichas/:tabla/:id', verificarToken, async (req, res) => {
  try {
    const { tabla, id } = req.params;

    // Validar si la tabla existe en camposConfig para evitar inyección SQL
    if (!camposConfig[tabla]) {
      return res.status(400).json({ error: 'Tabla no válida.' });
    }

    // Obtener el nombre de la imagen antes de eliminar la ficha
    const resultImagen = await pool.query(
      `SELECT imagen FROM ${tabla} WHERE id = $1`,
      [id],
    );
    const ficha = resultImagen.rows[0];

    await pool.query(`DELETE FROM ${tabla} WHERE id = $1`, [id]);

    // Eliminar la imagen asociada si existe
    if (ficha && ficha.imagen) {
      // ANTIGUA LÍNEA: await fs.unlink(`uploads/fichas/${ficha.imagen}`);
      // LA LÍNEA A CORREGIR ES LA SIGUIENTE:
      await fsp.unlink(path.join(__dirname, 'img2', ficha.imagen)); // <--- LÍNEA CORREGIDA
    }

    res.status(200).json({ mensaje: 'Ficha eliminada exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar ficha:', error);
    res
      .status(500)
      .json({ error: 'Error interno del servidor al eliminar la ficha.' });
  }
});

// ============================================
// RUTA PARA OBTENER ESTADÍSTICAS
// ============================================

app.get('/api/estadisticas', verificarToken, async (req, res) => {
  // Corregido: Usando verificarToken
  try {
    const estadisticas = {};

    // Contar registros en cada tabla
    for (const tabla of Object.keys(camposConfig)) {
      try {
        const result = await pool.query(`SELECT COUNT(*) FROM ${tabla}`);
        estadisticas[tabla] = parseInt(result.rows[0].count);
      } catch (error) {
        // Aquí puedes optar por no registrar el warning si la tabla no existe en la BD aún
        // console.warn(`Error contando registros en ${tabla}:`, error.message);
        estadisticas[tabla] = 0; // Si la tabla no existe, su cuenta es 0
      }
    }

    // Calcular totales por categoría
    const resumen = {
      total_fichas: Object.values(estadisticas).reduce(
        (sum, count) => sum + count,
        0,
      ),
      canes_biologicos:
        (estadisticas.canes_antidrogas || 0) +
        (estadisticas.canes_control_orden || 0) +
        (estadisticas.canes_busqueda || 0) + // Corregido nombre
        (estadisticas.canes_rel_publicas || 0) + // Corregido nombre
        (estadisticas.canes_terapia || 0),
      vehiculos:
        (estadisticas.camiones || 0) + // Corregido nombre
        (estadisticas.vehiculos_camionetas || 0) +
        (estadisticas.vehiculos_furgonetas || 0),
      muebles:
        (estadisticas.muebles_oficina || 0) +
        (estadisticas.muebles_dormitorio || 0),
      tecnologia:
        (estadisticas.computadores_escritorio || 0) +
        (estadisticas.laptops || 0) +
        (estadisticas.impresoras_multifuncion || 0) +
        (estadisticas.scanners || 0) +
        (estadisticas.fuentes_poder || 0) + // Corregido nombre
        (estadisticas.camaras_web || 0) +
        (estadisticas.microfonos || 0) +
        (estadisticas.proyectores || 0),
    };

    res.json({
      success: true,
      data: {
        detallado: estadisticas,
        resumen: resumen,
      },
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
    });
  }
});

// ============================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ============================================

// Middleware para manejar errores de Multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'El archivo es demasiado grande. Máximo 5MB permitido.',
      });
    }
  }

  if (error.message.includes('Solo se permiten archivos de imagen')) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }

  console.error('Error no manejado:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
  });
});

// Middleware para rutas no encontradas
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
  });
});

// ============================================
// INICIALIZACIÓN DEL SERVIDOR
// ============================================

// Función para crear el directorio de subidas si no existe
// Función para asegurar que el directorio de subidas exista
const createUploadsDir = () => {
  const dir = path.join(__dirname, 'uploads', 'fichas');
  try {
    if (!fs.existsSync(dir)) {
      // Usamos fs.mkdirSync para una operación síncrona al inicio
      fs.mkdirSync(dir, { recursive: true }); // <--- ¡CAMBIA ESTA LÍNEA!
      console.log('✅ Directorio de subidas "uploads/fichas" asegurado.');
    } else {
      console.log('✅ Directorio de subidas "uploads/fichas" asegurado.');
    }
  } catch (err) {
    // Si hay un error aquí, es crítico y el servidor no debe iniciar
    console.error('❌ Error al crear el directorio de subidas:', err);
    throw err; // Propaga el error para que el servidor lo maneje al iniciar
  }
};

const iniciarServidor = async () => {
  try {
    // Crear directorio de uploads
    await createUploadsDir();

    // Verificar conexión a la base de datos
    await pool.query('SELECT NOW()');
    console.log('Conexión a PostgreSQL establecida exitosamente'); //

    // Crear tablas dinámicamente al iniciar el servidor
    for (const tableName in camposConfig) {
      if (camposConfig.hasOwnProperty(tableName)) {
        await crearTablaSiNoExiste(tableName, camposConfig[tableName]);
      }
    }

    // Iniciar servidor
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}
╔════════════════════════════════════════════╗
║          SERVIDOR INICIADO EXITOSAMENTE     ║
║                                            ║
║  Puerto: ${PORT}                               ║
║  Base de datos: PostgreSQL                 ║
║  Sistema: Fichas Técnicas - Unidad Canina  ║
║                                            ║
║  Endpoints disponibles:                    ║
║  POST /api/auth/login                      ║
║  POST /api/noticias                        ║
║  GET  /api/noticias                        ║
║  POST /api/registro                        ║
║  GET  /api/test-db                         ║
║  POST /api/fichas/canes/:tipo              ║
║  POST /api/fichas/vehiculos/:tipo          ║
║  POST /api/fichas/muebles/:tipo            ║
║  POST /api/fichas/computadores/:tipo       ║
║  POST /api/fichas/impresoras/:tipo         ║
║  POST /api/fichas/perifericos/:tipo        ║
║  GET  /api/fichas/:tabla                   ║
║  GET  /api/fichas/:tabla/:id               ║
║  DELETE /api/fichas/:tabla/:id             ║
║  GET  /api/estadisticas                    ║
╚════════════════════════════════════════════╝
      `);

      console.log('\n📁 Estructura de archivos requerida:');
      console.log('   uploads/fichas/ (creado automáticamente)');

      console.log('\n🔧 Variables de entorno requeridas:');
      console.log('   NODE_ENV=development');
      console.log('   JWT_SECRET=tu_jwt_secret_aqui');

      console.log('\n🚀 El servidor está listo para recibir peticiones!');
    });
  } catch (error) {
    console.error('Error iniciando el servidor:', error); //
    process.exit(1); //
  }
};

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason); //
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error); //
  process.exit(1); //
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor...');
  await pool.end();
  console.log('✅ Conexiones cerradas exitosamente');
  process.exit(0);
});

// Iniciar el servidor
iniciarServidor();
