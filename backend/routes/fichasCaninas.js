// routes/fichas.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');

// Multer: guardar imagen en carpeta /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// Ruta común para todas las fichas caninas
router.post('/canes/:tipo', upload.single('imagen'), async (req, res) => {
  const { tipo } = req.params;
  const {
    razas_requeridas,
    edad_requerida,
    caracteristicas_requeridas,
    documentos_identidad,
    requerimiento_veterinario,
  } = req.body;

  const imagen = req.file ? req.file.filename : null;

  try {
    await pool.query(
      `INSERT INTO fichas_canes 
        (tipo_ficha, razas_requeridas, edad_requerida, caracteristicas_requeridas, 
         documentos_identidad, requerimiento_veterinario, imagen) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        tipo,
        razas_requeridas,
        edad_requerida,
        caracteristicas_requeridas,
        documentos_identidad,
        requerimiento_veterinario,
        imagen,
      ],
    );
    res.status(201).json({ mensaje: 'Ficha canina guardada exitosamente.' });
  } catch (error) {
    console.error('Error al guardar ficha:', error);
    res.status(500).json({ error: 'Error al guardar la ficha canina.' });
  }
});

module.exports = router;
