const express = require('express');
const router = express.Router();
const iaController = require('../controllers/ia.controller');

// Definimos la ruta del chatbot (sin middleware de seguridad por ahora para poder probar)
router.post('/chat', iaController.chatBot);

module.exports = router;