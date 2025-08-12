// === catalogo.js ===
// Este archivo contiene la lógica para mostrar fichas técnicas, realizar búsquedas y generar descargas PDF en el catálogo electrónico.

// Lista simulada de artículos con su información técnica
const articulos = {
  malinois: {
    nombre: "Pastor Belga Malinois",
    imagen: "img/malinois.png", // Asegúrate de tener esta imagen en la carpeta /img
    caracteristicas: [
      "Peso: 30 kg",
      "Altura: 60 cm",
      "Especialidad: Detección de narcóticos",
      "País de origen: Bélgica"
    ]
  },
  golden: {
    nombre: "Golden Retriever",
    imagen: "img/golden.png",
    caracteristicas: [
      "Peso: 35 kg",
      "Altura: 55 cm",
      "Especialidad: Terapia asistida",
      "Carácter: Amigable"
    ]
  },
  camiones: {
    nombre: "Camión Iveco 4x4",
    imagen: "img/camion.png",
    caracteristicas: [
      "Capacidad: 10 toneladas",
      "Combustible: Diésel",
      "Uso: Transporte logístico pesado",
      "Marca: Iveco"
    ]
  },
  camionetas: {
    nombre: "Camioneta Toyota Hilux",
    imagen: "img/hilux.png",
    caracteristicas: [
      "Motor: 2.8L Turbo",
      "Tracción: 4x4",
      "Capacidad: 5 pasajeros",
      "Uso: Transporte operativo"
    ]
  },
  laptops: {
    nombre: "Laptop HP ProBook",
    imagen: "img/laptop.png",
    caracteristicas: [
      "Procesador: Intel i5",
      "RAM: 8 GB",
      "Disco: SSD 512 GB",
      "Sistema: Windows 11"
    ]
  },
  impresoras: {
    nombre: "Impresora Epson L3250",
    imagen: "img/epson.png",
    caracteristicas: [
      "Tipo: Inyección de tinta",
      "Conectividad: Wi-Fi",
      "Velocidad: 33 ppm",
      "Formato: A4"
    ]
  }
};

// === ELEMENTOS DEL DOM ===
const ficha = document.getElementById("ficha");
const tituloFicha = document.getElementById("titulo-ficha");
const imagenFicha = document.getElementById("imagen-ficha");
const caracteristicasFicha = document.getElementById("caracteristicas-ficha");
const resultados = document.getElementById("resultados");
const inputBusqueda = document.getElementById("busqueda");

// === FUNCIÓN PARA MOSTRAR UNA FICHA TÉCNICA ===
function mostrarFicha(id) {
  const articulo = articulos[id];
  if (!articulo) return;

  resultados.style.display = "none";
  ficha.style.display = "block";

  tituloFicha.textContent = articulo.nombre;
  imagenFicha.src = articulo.imagen;
  caracteristicasFicha.innerHTML = "";

  articulo.caracteristicas.forEach(c => {
    const li = document.createElement("li");
    li.textContent = c;
    caracteristicasFicha.appendChild(li);
  });

  // Acción del botón de descarga
  const btn = document.getElementById("btn-descargar");
  btn.onclick = () => generarPDF(articulo);
}

// === EVENTOS DE LOS MENÚS ===
document.querySelectorAll("[data-id]").forEach(item => {
  item.addEventListener("click", () => {
    const id = item.getAttribute("data-id");
    mostrarFicha(id);
  });
});

// === BUSCADOR ===
inputBusqueda.addEventListener("input", () => {
  const termino = inputBusqueda.value.toLowerCase().trim();

  if (termino === "") {
    ficha.style.display = "none";
    resultados.innerHTML = "<p>Busca un artículo o selecciona uno del menú para ver su ficha técnica.</p>";
    resultados.style.display = "block";
    return;
  }

  // Filtrar resultados
  const coincidencias = Object.entries(articulos).filter(([id, art]) =>
    art.nombre.toLowerCase().includes(termino)
  );

  // Mostrar resultados
  resultados.innerHTML = "";
  resultados.style.display = "block";
  ficha.style.display = "none";

  if (coincidencias.length === 0) {
    resultados.innerHTML = "<p>No se encontraron resultados.</p>";
    return;
  }

  coincidencias.forEach(([id, art]) => {
    const tarjeta = document.createElement("div");
    tarjeta.classList.add("tarjeta");
    tarjeta.innerHTML = `
      <img src="${art.imagen}" alt="${art.nombre}" />
      <h3>${art.nombre}</h3>
      <button onclick="mostrarFicha('${id}')">Ver ficha</button>
    `;
    resultados.appendChild(tarjeta);
  });
});

// === GENERAR PDF (simulado por ahora) ===
function generarPDF(articulo) {
  alert(`📄 Aquí se generaría un PDF para: ${articulo.nombre}\nEsto se implementará más adelante con Node.js o librerías.`);
}
