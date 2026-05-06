/**
 * URL base del microservicio de impresión térmica USB.
 * Se configura en el archivo .env del frontend:
 *   VITE_PRINT_SERVER_URL=http://192.168.1.55:3001
 *
 * ⚠️  IMPORTANTE PARA IMPRESIÓN DESDE MÓVIL:
 *   No usar "localhost" aquí. Debe ser la IP local de la PC
 *   donde está conectada la impresora (ej: 192.168.1.55).
 *   Así los móviles y otras PCs en la red pueden alcanzar el servidor.
 */
export const PRINT_SERVER_URL = import.meta.env.VITE_PRINT_SERVER_URL || 'http://localhost:3001';

/**
 * Envía una orden de impresión al microservicio USB.
 * @param {string} endpoint  - '/api/imprimir/cocina' | '/api/imprimir/caja' | etc.
 * @param {object} body      - Cuerpo JSON a enviar
 * @returns {Promise<boolean>} true si fue exitoso, false si no hay impresora
 */
export const enviarImpresion = async (endpoint, body) => {
    try {
        const response = await fetch(`${PRINT_SERVER_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (response.ok) {
            console.log(`✅ Impresión enviada → ${endpoint}`);
            return true;
        } else {
            const err = await response.json().catch(() => ({}));
            console.warn(`⚠️  Microservicio respondió error en ${endpoint}:`, err);
            return false;
        }
    } catch (error) {
        console.info(`ℹ️  Sin impresora USB: no se pudo conectar con ${PRINT_SERVER_URL}${endpoint}`);
        return false;
    }
};
