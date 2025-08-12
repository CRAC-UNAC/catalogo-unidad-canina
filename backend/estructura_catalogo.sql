-- Tabla central de todas las fichas técnicas
CREATE TABLE fichas_tecnicas (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    categoria TEXT NOT NULL,
    descripcion TEXT,
    imagen_url TEXT,
    fecha_ingreso DATE DEFAULT CURRENT_DATE,
    estado TEXT DEFAULT 'activo',
    observaciones TEXT
);

-- Detalles específicos para canes
CREATE TABLE ficha_canina (
    id SERIAL PRIMARY KEY,
    ficha_id INTEGER UNIQUE REFERENCES fichas_tecnicas(id) ON DELETE CASCADE,
    raza TEXT,
    edad INTEGER,
    sexo TEXT,
    especialidad TEXT,
    unidad TEXT
);

-- Detalles específicos para vehículos
CREATE TABLE ficha_vehiculo (
    id SERIAL PRIMARY KEY,
    ficha_id INTEGER UNIQUE REFERENCES fichas_tecnicas(id) ON DELETE CASCADE,
    placa TEXT,
    marca TEXT,
    modelo TEXT,
    tipo_combustible TEXT,
    año INTEGER
);

-- Detalles específicos para activos tecnológicos
CREATE TABLE ficha_tecnologia (
    id SERIAL PRIMARY KEY,
    ficha_id INTEGER UNIQUE REFERENCES fichas_tecnicas(id) ON DELETE CASCADE,
    tipo_equipo TEXT,
    marca TEXT,
    modelo TEXT,
    serie TEXT
);

