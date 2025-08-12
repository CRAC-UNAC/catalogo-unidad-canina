document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formRegistro');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = form.nombre.value.trim();
    const correo = form.correo.value.trim();
    const usuario = form.usuario.value.trim();
    const clave = form.clave.value;
    const confirmar = form.confirmar.value;

    // Validar campos vacíos
    if (!nombre || !correo || !usuario || !clave || !confirmar) {
      alert('Todos los campos son obligatorios.');
      return;
    }

    // Validar contraseñas iguales
    if (clave !== confirmar) {
      alert('Las contraseñas no coinciden.');
      return;
    }

    // Validar dominio de correo institucional
    const dominioValido = '@policia.gob.ec';
    if (!correo.endsWith(dominioValido)) {
      alert('El correo debe ser institucional (@policia.gob.ec)');
      return;
    }

    // Mostrar modal para código institucional
    window.formDatosPendientes = { nombre, correo, usuario, clave };
    document.getElementById('modalCodigo').style.display = 'flex';
    document.getElementById('inputCodigoModal').focus();
  });

  // Lógica del modal
  document.getElementById('btnEnviarCodigo').onclick = async function () {
    const codigo = document.getElementById('inputCodigoModal').value.trim();
    if (!codigo) {
      document.getElementById('errorCodigoModal').textContent =
        'Ingrese el código institucional.';
      return;
    }
    // Validar código en frontend (opcional, puedes quitar si solo quieres validar en backend)
    if (codigo !== 'UNAC') {
      document.getElementById('errorCodigoModal').textContent =
        'Código institucional incorrecto.';
      return;
    }
    document.getElementById('errorCodigoModal').textContent = '';

    // Enviar al backend
    const { nombre, correo, usuario, clave } = window.formDatosPendientes;
    try {
      const respuesta = await fetch('http://localhost:3001/api/registro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nombre, correo, usuario, clave, codigo }),
      });

      const data = await respuesta.json();
      if (respuesta.ok) {
        alert('Usuario registrado con éxito');
        window.location.href = 'login.html';
      } else {
        document.getElementById('errorCodigoModal').textContent =
          data.error || 'Error en el registro';
      }
    } catch (error) {
      document.getElementById('errorCodigoModal').textContent =
        'Error al conectar con el servidor.';
    }
  };
});

