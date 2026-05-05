const catchAsync = require('../utils/catchAsync');
const iaService = require('../services/ia.service');
// Importamos tus servicios existentes para usar sus consultas SQL
const cajaService = require('../services/caja.service');
const productosService = require('../services/productos.service');
const mesasService = require('../services/mesas.service');
const ventasService = require('../services/ventas.service');


const chatBot = catchAsync(async (req, res) => {
  const { pregunta, caja_id } = req.body;

  if (!pregunta) {
    return res.status(400).json({ success: false, message: 'La pregunta es requerida' });
  }

  // PASO 1: Detectar qué quiere el usuario
  const intencion = await iaService.detectarIntencion(pregunta);
  console.log(`Intención detectada: ${intencion}`);

  let datosParaIA = {};

  // PASO 2: Tu backend ejecuta la lógica de negocio (Rápido y exacto)
  switch (intencion) {
    case 'ventas_hoy':
      // Usamos tu función existente que arreglamos hoy para las ventas mixtas
      if (!caja_id) throw new Error('Se requiere el ID de la caja abierta');
      const resumenDia = await cajaService.getResumenDelDia(caja_id);
      datosParaIA = {
        total_ingresos: resumenDia.resumen.total_ventas,
        efectivo_en_caja: resumenDia.resumen.saldo_esperado
      };
      break;

    case 'stock_bajo':
      const productos = await productosService.getAllProductos({ control_stock: true });
      const agotados_o_bajos = productos.filter(p => p.stock_actual <= p.stock_minimo);

      datosParaIA = agotados_o_bajos.map(p => ({
        producto: p.nombre,
        // Number() elimina automáticamente los ceros innecesarios
        stock_actual: Number(p.stock_actual),
        stock_minimo: Number(p.stock_minimo),
        // Si tienes un campo de unidad en tu BD, lo pasamos. Si no, asumimos 'unidades'
        unidad_medida: p.unidad_medida || 'unidades'
      }));
      break;
    case 'estado_mesas':
      // REEMPLAZA getAll POR TU FUNCIÓN REAL (ej. getAllMesas o listarMesas)
      const mesas = await mesasService.getAllMesas();

      const ocupadas = mesas.filter(m => m.estado === 'ocupada').length;
      const libres = mesas.filter(m => m.estado === 'disponible' || m.estado === 'libre').length;

      datosParaIA = {
        total_mesas: mesas.length,
        mesas_ocupadas: ocupadas,
        mesas_libres: libres
      };
      break;

    case 'resumen_pagos':
      // ¡Usamos la misma función que alimenta tu pantalla de Caja!
      const caja_id = req.body.caja_id;
      const resumenCaja = await cajaService.getResumenDelDia(caja_id);

      datosParaIA = {
        ventas_efectivo: Number(resumenCaja.resumen.ventas_efectivo || 0),
        ventas_tarjeta: Number(resumenCaja.cards.tarjeta?.monto || 0),
        // Sumamos Yape y Plin si vienen separados
        ventas_digitales: Number(resumenCaja.cards.yape?.monto || 0) + Number(resumenCaja.cards.plin?.monto || 0),
        ingresos_extras: Number(resumenCaja.resumen.ingresos_manuales || 0)
      };
      break;

    case 'top_ventas':
      // Llamamos a una función que crearemos en el paso 3
      const topPlatos = await ventasService.getTopVentas(req.body.caja_id);

      datosParaIA = topPlatos.map((plato, index) => ({
        puesto: index + 1,
        producto: plato.nombre,
        cantidad_vendida: Number(plato.total_vendido)
      }));
      break;

    case 'analisis':
      // Si quiere un análisis general, le podemos mandar un reporte mensual o semanal
      datosParaIA = { nota: "Análisis general solicitado. Datos en desarrollo." };
      break;

    default:
      datosParaIA = { error: "Pregunta fuera del alcance del negocio." };
  }

  // PASO 3: Gemini embellece la respuesta
  const respuestaFinal = await iaService.generarRespuesta(pregunta, datosParaIA);

  res.json({
    success: true,
    data: {
      intencion: intencion,
      respuesta: respuestaFinal
    }
  });
});

module.exports = { chatBot };