const express = require('express');
const configuracionController = require('../controllers/configuracion.controller');
const authenticate = require('../middlewares/auth.middleware');
const { requireRole, ROLES } = require('../middlewares/roles.middleware');

const router = express.Router();

// GET /api/configuracion — público (el microservicio de impresión lo consume)
router.get('/', configuracionController.getConfiguracion);

// PUT /api/configuracion — solo administrador
router.put('/', authenticate, requireRole(ROLES.ADMINISTRADOR), configuracionController.updateConfiguracion);

module.exports = router;
