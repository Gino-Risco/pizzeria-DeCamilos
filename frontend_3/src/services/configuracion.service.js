import { api } from './api';

const MICROSERVICIO_URL = 'http://localhost:3001';

/**
 * Obtiene la configuración del sistema desde el backend.
 */
export const getConfiguracion = async () => {
  const response = await api.get('/configuracion');
  return response.data.data;
};

/**
 * Actualiza la configuración del sistema (solo administrador).
 */
export const updateConfiguracion = async (data) => {
  const response = await api.put('/configuracion', data);
  return response.data.data;
};

/**
 * Notifica al microservicio de impresión local que recargue la configuración.
 * No lanza error si el microservicio no está disponible (puede estar apagado).
 */
export const recargarConfigImpresora = async () => {
  try {
    const response = await fetch(`${MICROSERVICIO_URL}/api/recargar-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await response.json();
  } catch {
    // El microservicio puede no estar corriendo en este momento — no es un error crítico
    return { success: false, message: 'Microservicio no disponible' };
  }
};
