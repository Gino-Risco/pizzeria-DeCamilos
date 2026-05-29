const { query, TABLE } = require('../config/database');

// Valores por defecto — siempre existe la fila id=1
const DEFAULTS = {
  nombre_restaurante: "D' CAMILOS",
  ruc: '20123456789',
  direccion: 'Jr. Belen 185 - Esperanza Parte Baja',
  telefono: '942 685 506',
  logo_url: null,
  qr_yape_numero: null,
  qr_yape_url: null,
  qr_yape_contenido: null,
  mensaje_ticket: '¡Gracias por su preferencia!',
};

/**
 * Obtiene la configuración del sistema.
 * Si no existe la fila, la crea con los valores por defecto.
 */
async function getConfiguracion() {
  const result = await query(
    `SELECT * FROM ${TABLE.CONFIGURACION} WHERE id = 1`
  );

  if (result.rows.length === 0) {
    // Crear fila inicial con defaults
    const created = await query(
      `INSERT INTO ${TABLE.CONFIGURACION}
         (id, nombre_restaurante, ruc, direccion, telefono, logo_url, qr_yape_numero, qr_yape_url, qr_yape_contenido, mensaje_ticket)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        DEFAULTS.nombre_restaurante,
        DEFAULTS.ruc,
        DEFAULTS.direccion,
        DEFAULTS.telefono,
        DEFAULTS.logo_url,
        DEFAULTS.qr_yape_numero,
        DEFAULTS.qr_yape_url,
        DEFAULTS.qr_yape_contenido,
        DEFAULTS.mensaje_ticket,
      ]
    );
    return created.rows[0];
  }

  return result.rows[0];
}

/**
 * Actualiza la configuración del sistema.
 * Solo se actualizan los campos enviados (PATCH-style).
 */
async function updateConfiguracion(data) {
  // Asegurar que la fila existe
  await getConfiguracion();

  const camposPermitidos = [
    'nombre_restaurante',
    'ruc',
    'direccion',
    'telefono',
    'logo_url',
    'qr_yape_numero',
    'qr_yape_url',
    'qr_yape_contenido',
    'mensaje_ticket',
  ];

  const fields = [];
  const values = [];
  let idx = 1;

  camposPermitidos.forEach((campo) => {
    if (data[campo] !== undefined) {
      fields.push(`${campo} = $${idx}`);
      values.push(data[campo]);
      idx++;
    }
  });

  if (fields.length === 0) {
    return getConfiguracion();
  }

  values.push(1); // WHERE id = 1
  const result = await query(
    `UPDATE ${TABLE.CONFIGURACION}
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${idx}
     RETURNING *`,
    values
  );

  return result.rows[0];
}

module.exports = { getConfiguracion, updateConfiguracion };
