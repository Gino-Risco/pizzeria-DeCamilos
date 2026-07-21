/**
 * Formateo centralizado de fechas en zona horaria de Perú.
 *
 * Por qué existe: el backend entrega timestamps correctos (Postgres corre con
 * `SET timezone = 'America/Lima'` y el proceso Node fuerza `TZ=America/Lima`,
 * ver backend_3/src/config/database.js y backend_3/src/server.js), pero si el
 * frontend formatea esas fechas con `toLocaleString`/`toLocaleDateString` sin
 * especificar `timeZone`, el navegador usa la zona horaria del SISTEMA
 * OPERATIVO del dispositivo que abre la pantalla (PC de caja, celular de
 * mesero, etc.), no la de Perú. Si un dispositivo tiene el reloj/zona mal
 * configurado, esa pantalla muestra una hora distinta a las demás.
 *
 * Todas las funciones de aquí fuerzan `timeZone: 'America/Lima'` para que el
 * resultado sea el mismo sin importar el dispositivo.
 */

const TIMEZONE = 'America/Lima';

/**
 * Convierte a Date. Si el valor viene como string sin sufijo de zona
 * (ni 'Z' ni '+HH:MM'/'-HH:MM'), se asume UTC antes de parsear -- así es
 * como el backend entrega los timestamps (ver type-parser en
 * backend_3/src/config/database.js).
 */
const toDate = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  const str = String(valor);
  const tieneZona = str.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(str);
  return new Date(tieneZona ? str : str + 'Z');
};

/** "20/07/2026, 18:34" */
export const formatFechaHora = (valor, opts = {}) => {
  const fecha = toDate(valor);
  if (!fecha) return '';
  return fecha.toLocaleString('es-PE', {
    timeZone: TIMEZONE,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    ...opts,
  });
};

/** "20/07/2026" */
export const formatSoloFecha = (valor, opts = {}) => {
  const fecha = toDate(valor);
  if (!fecha) return '';
  return fecha.toLocaleDateString('es-PE', {
    timeZone: TIMEZONE,
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...opts,
  });
};

/** "18:34" */
export const formatSoloHora = (valor, opts = {}) => {
  const fecha = toDate(valor);
  if (!fecha) return '';
  return fecha.toLocaleTimeString('es-PE', {
    timeZone: TIMEZONE,
    hour: '2-digit', minute: '2-digit', hour12: false,
    ...opts,
  });
};

/**
 * Para columnas `@db.Date` puras (sin componente de hora), como
 * `fecha_emision` de compras o `periodo::date` de reportes.
 * A propósito usa `timeZone: 'UTC'` y NO 'America/Lima': el backend manda
 * '2026-07-20' (solo fecha), y JS parsea ese string como medianoche UTC.
 * Forzar 'America/Lima' aquí correría la fecha un día hacia atrás.
 */
export const formatFechaSoloDia = (valorDate, opts = {}) => {
  if (!valorDate) return '';
  return new Date(valorDate).toLocaleDateString('es-PE', {
    timeZone: 'UTC',
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...opts,
  });
};
