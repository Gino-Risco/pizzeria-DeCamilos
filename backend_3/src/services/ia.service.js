const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
// ==========================================
// 1. DETECTOR DE INTENCIÓN (Rápido y barato)
// ==========================================
async function detectarIntencion(preguntaDelUsuario) {
  const prompt = `
    Eres un clasificador de intenciones para el sistema POS de un restaurante.
    Lee la pregunta del usuario y responde ÚNICAMENTE con una de estas palabras clave, sin texto adicional ni comillas:
    - "ventas_hoy" (Si pregunta cuánto vendió hoy, ganancias del día, etc.)
    - "stock_bajo" (Si pregunta qué productos faltan, qué comprar, etc.)
    - "estado_mesas" (Si pregunta por cuántas mesas están ocupadas, libres, o el movimiento en el salón)
    - "resumen_pagos" (Si pregunta por los métodos de pago, cuánto hay en Yape, Plin, efectivo o tarjeta)
    - "top_ventas" (Si pregunta por los platos más vendidos, productos estrella, o qué sale más)
    - "analisis" (Si hace una pregunta compleja, proyecciones o pide consejos gerenciales)
    - "desconocido" (Si pregunta algo que no tiene nada que ver con el negocio)

    Pregunta: "${preguntaDelUsuario}"
  `;

  try {
    const result = await model.generateContent(prompt);
    // Limpiamos la respuesta para asegurar que solo devuelva la palabra clave
    return result.response.text().trim().toLowerCase();
  } catch (error) {
    console.error("Error al detectar intención:", error);
    return "analisis"; // Fallback por defecto
  }
}

// ==========================================
// 2. COMUNICADOR (Respuestas exactas y sin inventos)
// ==========================================
async function generarRespuesta(pregunta, datosCrudos) {
  const prompt = `
    Eres el Copiloto Gerencial de la Pizzería "D' CAMILOS".
    
    IMPORTANTE:
    - No inventes datos bajo ninguna circunstancia.
    - Usa SOLO la información proporcionada en la sección "Datos".
    - Responde de forma clara, directa y profesional.
    - Si los datos están vacíos, indica que no hay información disponible.
    - REGLA DE CANTIDADES: Si un número es entero, no le pongas decimales (usa 10 en lugar de 10.000).
    - REGLA DE FORMATO DE LISTA: Cuando enumeres productos con stock bajo, usa ESTRICTAMENTE este formato con paréntesis al final:
      * **[Nombre del Producto]**: (Faltan X [unidad_medida] para alcanzar el stock mínimo)
      o si prefieres mostrar el estado actual:
      * **[Nombre del Producto]**: (Stock actual: X [unidad_medida], Mínimo: Y [unidad_medida])
    - REGLA DE FORMATO DE LISTA: Si enumeras un ranking o un resumen, usa este formato:
      Para Stock: * **[Producto]**: (Faltan X [unidad] para el mínimo)
      Para Top Ventas: * **Puesto #[X]**: [Producto] - [Cant] unidades
      Para Pagos: * **[Método]**: S/ [Monto]  

    Datos exactos del sistema:
    ${JSON.stringify(datosCrudos)}

    Pregunta del administrador:
    "${pregunta}"
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error al generar respuesta:", error);
    throw new Error("No pude formatear la respuesta.");
  }
}

module.exports = {
  detectarIntencion,
  generarRespuesta
};