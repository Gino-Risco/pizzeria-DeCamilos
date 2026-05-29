const catchAsync = require('../utils/catchAsync');
const configuracionService = require('../services/configuracion.service');

/**
 * GET /api/configuracion
 * Público — lo usa el microservicio de impresión al arrancar
 */
const getConfiguracion = catchAsync(async (req, res) => {
  const config = await configuracionService.getConfiguracion();
  res.json({ success: true, data: config });
});

/**
 * PUT /api/configuracion
 * Protegido — solo administrador
 */
const updateConfiguracion = catchAsync(async (req, res) => {
  const config = await configuracionService.updateConfiguracion(req.body);
  res.json({ success: true, data: config });
});

module.exports = { getConfiguracion, updateConfiguracion };
