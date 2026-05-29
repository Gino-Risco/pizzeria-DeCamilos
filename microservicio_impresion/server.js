const express = require('express');
const cors = require('cors');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');

const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

// ────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DINÁMICA
// Se carga desde el backend al arrancar y se recarga bajo demanda.
// Tiene valores por defecto para que el microservicio funcione
// aunque el backend no esté disponible en ese momento.
// ────────────────────────────────────────────────────────────────
let config = {
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

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

const cargarConfig = async () => {
    try {
        const res = await fetch(`${BACKEND_URL}/api/configuracion`);
        const data = await res.json();
        if (data.success && data.data) {
            config = { ...config, ...data.data };
            console.log(`✅ Configuración cargada: ${config.nombre_restaurante}`);
        }
    } catch (e) {
        console.warn('⚠️  No se pudo cargar la config del backend, usando valores por defecto.');
    }
};

// Cargar config al arrancar
cargarConfig();

// ────────────────────────────────────────────────────────────────
// UTILIDADES
// ────────────────────────────────────────────────────────────────

const limpiarTexto = (texto) => {
    if (!texto) return '';
    return texto
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
        .replace(/[^\x20-\x7E]/g, '');
};

const alinear = (izq, der, ancho = 48) => {
    let strIzq = izq.toString();
    let strDer = der.toString();
    if (strIzq.length + strDer.length > ancho)
        strIzq = strIzq.substring(0, ancho - strDer.length - 2) + '..';
    const espacios = ancho - strIzq.length - strDer.length;
    return strIzq + ' '.repeat(espacios > 0 ? espacios : 0) + strDer;
};

const conectarImpresora = () => {
    const device = new escpos.USB();
    const printer = new escpos.Printer(device);
    return { device, printer };
};

// Cabecera dinámica — usa config cargada desde la BD
const imprimirCabecera = (printer) => {
    printer
        .font('a').align('ct')
        .size(1, 1).style('b').text(limpiarTexto(config.nombre_restaurante)).style('normal')
        .size(0, 0)
        .text(limpiarTexto(config.ruc ? `RUC: ${config.ruc}` : ''))
        .text(limpiarTexto(config.direccion || ''))
        .text(limpiarTexto(config.telefono ? `Delivery: ${config.telefono}` : ''))
        .text('================================================');
};

// ────────────────────────────────────────────────────────────────
// ENDPOINT: Recargar configuración sin reiniciar el microservicio
//   POST /api/recargar-config
// Lo llama el frontend justo después de guardar la configuración.
// ────────────────────────────────────────────────────────────────
app.post('/api/recargar-config', async (req, res) => {
    await cargarConfig();
    res.json({ success: true, message: 'Configuración recargada', config: {
        nombre_restaurante: config.nombre_restaurante,
        ruc: config.ruc,
        direccion: config.direccion,
        telefono: config.telefono,
        qr_yape_url: config.qr_yape_url,
        qr_yape_contenido: config.qr_yape_contenido ? '***' : null,
    }});
});

// ────────────────────────────────────────────────────────────────
// 1. TICKET DE COCINA  →  POST /api/imprimir/cocina
// ────────────────────────────────────────────────────────────────
app.post('/api/imprimir/cocina', (req, res) => {
    const { orden, detalles } = req.body;

    if (!orden || !detalles) {
        return res.status(400).json({ error: 'Faltan datos: orden y detalles son requeridos' });
    }

    const esLlevar = !orden.mesa_id;
    const tituloCocina = esLlevar
        ? `PARA LLEVAR: ${orden.nombre_cliente || 'SIN NOMBRE'}`
        : `COCINA - Mesa ${orden.mesa_numero}`;

    try {
        const { device, printer } = conectarImpresora();

        device.open(function (error) {
            if (error) return res.status(500).json({ error: 'Impresora apagada o desconectada' });

            printer
                .align('ct').font('a')
                .size(1, 1).style('b').text(limpiarTexto('** COMANDA COCINA **'))
                .size(0, 0).style('normal')
                .text('================================================')
                .size(1, 1).style('b').text(limpiarTexto(tituloCocina))
                .size(0, 0).style('normal')
                .text('================================================')
                .align('lt')
                .text(limpiarTexto(`Comanda: #${orden.numero_comanda || 'S/N'}`))
                .text(limpiarTexto(`Hora:    ${new Date().toLocaleTimeString('es-PE', { hour12: false })}`))
                .text('------------------------------------------------');

            detalles.forEach(d => {
                let linea = `${d.cantidad}x ${d.es_menu ? 'MENU: ' : ''}${d.producto_nombre}`;
                printer.size(0, 0).style('b').text(limpiarTexto(linea)).style('normal');
                if (d.es_menu && d.entrada_incluida)
                    printer.text(limpiarTexto(`   -> Entrada: ${d.entrada_incluida.nombre}`));
                if (d.observaciones && d.observaciones.trim() !== '')
                    printer.style('b').text(limpiarTexto(`   *** NOTA: ${d.observaciones.toUpperCase()} ***`)).style('normal');
                printer.text('------------------------------------------------');
            });

            printer.align('ct').text(limpiarTexto('** FIN DE COMANDA **')).feed(3).cut().close();
            res.json({ success: true, message: 'Ticket de cocina impreso' });
        });
    } catch (e) {
        console.error('Error impresora cocina:', e);
        res.status(500).json({ error: 'Fallo de hardware USB. Verifica que la impresora esté conectada.' });
    }
});

// ────────────────────────────────────────────────────────────────
// 2. TICKET DE CAJA (pre-cuenta y comprobante final)
//    →  POST /api/imprimir/caja
// ────────────────────────────────────────────────────────────────
app.post('/api/imprimir/caja', (req, res) => {
    const { orden, esPreCuenta } = req.body;

    if (!orden) {
        return res.status(400).json({ error: 'Faltan datos: orden es requerida' });
    }

    try {
        const { device, printer } = conectarImpresora();

        device.open(function (error) {
            if (error) return res.status(500).json({ error: 'Impresora desconectada' });

            // ── Cálculos matemáticos ──────────────────────────────────
            const detallesFiltrados = (orden.detalles || []).filter(d => !d.es_incluido_menu);
            const subtotalBruto = parseFloat(
                orden.subtotal ||
                detallesFiltrados.reduce((s, d) => s + parseFloat(d.subtotal || 0), 0)
            );
            const descuento = parseFloat(orden.descuento_total || 0);
            const totalNeto = Math.max(0, subtotalBruto - descuento);
            const subtotalSinIgv = totalNeto / 1.18;
            const igvCalculado = totalNeto - subtotalSinIgv;

            const fechaLimpia = new Date().toLocaleString('es-PE', {
                hour12: false, year: 'numeric', month: '2-digit',
                day: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            const identificador = !orden.mesa_id
                ? `CLIENTE: ${orden.nombre_cliente || 'Para Llevar'}`
                : `Mesa:    ${orden.mesa_numero}`;

            // ── Encabezado ────────────────────────────────────────────
            imprimirCabecera(printer);
            printer
                .align('ct')
                .style('b').text(esPreCuenta ? '*** PRE-CUENTA ***' : 'COMPROBANTE DE PAGO').style('normal')
                .text('================================================')
                .align('lt')
                .text(limpiarTexto(`Comanda: #${orden.numero_comanda?.split('-')[2] || orden.numero_comanda || 'S/N'}`))
                .text(limpiarTexto(identificador))
                .text(limpiarTexto(`Fecha:   ${fechaLimpia}`))
                .text('------------------------------------------------');

            // ── Detalle de productos ──────────────────────────────────
            detallesFiltrados.forEach(d => {
                const nombreLinea = `${d.cantidad}x ${d.producto_nombre}`;
                const precioStr = `S/ ${parseFloat(d.subtotal || 0).toFixed(2)}`;
                printer.text(limpiarTexto(alinear(nombreLinea, precioStr)));
            });

            // ── Totales ───────────────────────────────────────────────
            printer.text('------------------------------------------------');
            printer.text(limpiarTexto(alinear('SUBTOTAL BRUTO:', `S/ ${subtotalBruto.toFixed(2)}`)));
            if (descuento > 0)
                printer.text(limpiarTexto(alinear('DESCUENTO:', `- S/ ${descuento.toFixed(2)}`)));
            printer.text('------------------------------------------------');
            printer.text(limpiarTexto(alinear('OP. GRAVADA:', `S/ ${subtotalSinIgv.toFixed(2)}`)));
            printer.text(limpiarTexto(alinear('IGV (18%):', `S/ ${igvCalculado.toFixed(2)}`)));
            printer.size(0, 0).style('b').text(limpiarTexto(alinear('TOTAL:', `S/ ${totalNeto.toFixed(2)}`))).style('normal');

            // ── Pago (solo en ticket final) ───────────────────────────
            if (!esPreCuenta && orden.metodo_pago) {
                printer.text('------------------------------------------------');
                printer.text(limpiarTexto(alinear(
                    `PAGADO (${orden.metodo_pago.toUpperCase()}):`,
                    `S/ ${parseFloat(orden.monto_pagado || totalNeto).toFixed(2)}`
                )));
                const vuelto = Math.max(0, parseFloat(orden.monto_pagado || 0) - totalNeto);
                if (vuelto > 0)
                    printer.text(limpiarTexto(alinear('VUELTO:', `S/ ${vuelto.toFixed(2)}`)));
            }

            // ── Pie ───────────────────────────────────────────────────
            printer.align('ct');
            printer.text('================================================');
            if (esPreCuenta) {
                printer.text(limpiarTexto('ESTE DOCUMENTO NO ES'));
                printer.text(limpiarTexto('UN COMPROBANTE DE PAGO'));
                printer.text('================================================');
                printer.feed(3).cut().close();
                res.json({ success: true, message: 'Pre-cuenta impresa' });
            } else {
                // ── QR de Yape (solo si está configurado) ─────────────
                if (config.qr_yape_contenido) {
                    printer
                        .text('')
                        .align('ct')
                        .text(limpiarTexto('Paga con YAPE:'))
                        .qrimage(config.qr_yape_contenido, { type: 'png', mode: 'dM', size: 4 }, function () {
                            printer
                                .text('')
                                .text('================================================')
                                .text(limpiarTexto(config.mensaje_ticket || '¡Gracias por su preferencia!'))
                                .text('================================================')
                                .feed(3).cut().close();
                            res.json({ success: true, message: 'Comprobante impreso con QR Yape' });
                        });
                } else {
                    printer
                        .text(limpiarTexto(config.mensaje_ticket || '¡Gracias por su preferencia!'))
                        .text('================================================')
                        .feed(3).cut().close();
                    res.json({ success: true, message: 'Comprobante impreso' });
                }
            }
        });
    } catch (e) {
        console.error('Error impresora caja:', e);
        res.status(500).json({ error: 'Fallo hardware. Verifica que la impresora esté conectada.' });
    }
});

// ────────────────────────────────────────────────────────────────
// 3. REPORTE DE CIERRE DE CAJA
//    →  POST /api/imprimir/reporte-cierre
// ────────────────────────────────────────────────────────────────
app.post('/api/imprimir/reporte-cierre', (req, res) => {
    const { cierre } = req.body;

    if (!cierre) {
        return res.status(400).json({ error: 'Faltan datos: cierre es requerido' });
    }

    try {
        const { device, printer } = conectarImpresora();

        device.open(function (error) {
            if (error) return res.status(500).json({ error: 'Impresora desconectada' });

            const fondo          = parseFloat(cierre.monto_inicial        || 0);
            const ventasGlobal   = parseFloat(cierre.total_ventas         || 0);
            const ventasEfectivo = parseFloat(cierre.total_efectivo        || 0);
            const ventasTarjeta  = parseFloat(cierre.total_tarjeta         || 0);
            const ventasDigital  = parseFloat(cierre.total_otro            || 0);
            const ingresos       = parseFloat(cierre.total_ingresos        || 0);
            const egresos        = parseFloat(cierre.total_gastos || 0) + parseFloat(cierre.total_retiros || 0);
            const esperado       = parseFloat(cierre.monto_final_esperado  || 0);
            const realFisico     = parseFloat(cierre.monto_final_real      || 0);
            const dif            = parseFloat(cierre.diferencia            || 0);
            const fondoManana    = parseFloat(cierre.fondo_reservado_proximo || 0);
            const retiroDueno    = parseFloat(cierre.monto_retirado_dueno  || 0);
            const turno          = String(cierre.turno || 'N/A').toUpperCase();
            const cajero         = cierre.usuario_nombre || cierre.cajero_nombre || 'Usuario';
            const fecha          = new Date().toLocaleString('es-PE');

            // ── Encabezado ────────────────────────────────────────────
            imprimirCabecera(printer);
            printer
                .align('ct').style('b')
                .text(limpiarTexto('*** REPORTE DE CIERRE ***')).style('normal')
                .text(limpiarTexto(`Turno: ${turno}`))
                .text('================================================')
                .align('lt')
                .text(limpiarTexto(`Fecha:  ${fecha}`))
                .text(limpiarTexto(`Cajero: ${cajero}`))
                .text('------------------------------------------------');

            // ── 1. Control de Ventas ──────────────────────────────────
            printer.style('b').text('1. CONTROL DE VENTAS (TOTAL)').style('normal');
            printer.text(limpiarTexto(alinear('Efectivo:',    `S/ ${ventasEfectivo.toFixed(2)}`)));
            printer.text(limpiarTexto(alinear('Tarjeta:',     `S/ ${ventasTarjeta.toFixed(2)}`)));
            printer.text(limpiarTexto(alinear('Yape/Plin:',   `S/ ${ventasDigital.toFixed(2)}`)));
            printer.text('................................................');
            printer.style('b').text(limpiarTexto(alinear('TOTAL VENTAS:', `S/ ${ventasGlobal.toFixed(2)}`))).style('normal');

            printer.text('------------------------------------------------');

            // ── 2. Control de Gaveta ─────────────────────────────────
            printer.style('b').text('2. CONTROL DE GAVETA (FISICO)').style('normal');
            printer.text(limpiarTexto(alinear('Fondo Inicial:',     `S/ ${fondo.toFixed(2)}`)));
            printer.text(limpiarTexto(alinear('+ Ventas Efectivo:', `S/ ${ventasEfectivo.toFixed(2)}`)));
            printer.text(limpiarTexto(alinear('+ Ingresos Extras:', `S/ ${ingresos.toFixed(2)}`)));
            printer.text(limpiarTexto(alinear('- Egresos Extras:',  `S/ ${egresos.toFixed(2)}`)));
            printer.text('................................................');
            printer.text(limpiarTexto(alinear('SALDO ESPERADO:', `S/ ${esperado.toFixed(2)}`)));
            printer.text(limpiarTexto(alinear('SALDO CONTADO:',  `S/ ${realFisico.toFixed(2)}`)));
            printer.text('................................................');
            const difStr = `${dif >= 0 ? '+' : ''}${dif.toFixed(2)}`;
            printer.style('b').text(limpiarTexto(alinear('DIFERENCIA:', `S/ ${difStr}`))).style('normal');
            printer.text(limpiarTexto(dif < 0 ? '*** FALTANTE EN CAJA ***' : dif > 0 ? 'SOBRANTE EN CAJA' : 'CUADRE PERFECTO'));

            printer.text('------------------------------------------------');

            // ── 3. Distribución ───────────────────────────────────────
            printer.style('b').text('3. DISTRIBUCION DEL EFECTIVO').style('normal');
            printer.text(limpiarTexto(alinear('Fondo p/ Manana:', `S/ ${fondoManana.toFixed(2)}`)));
            printer.text(limpiarTexto(alinear('Retiro Dueno:',    `S/ ${retiroDueno.toFixed(2)}`)));

            if (cierre.observaciones) {
                printer.text('------------------------------------------------');
                printer.text(limpiarTexto(`Obs: ${cierre.observaciones}`));
            }

            printer.align('ct').text('================================================').feed(3).cut().close();
            res.json({ success: true, message: 'Reporte de cierre impreso' });
        });
    } catch (e) {
        console.error('Error impresora reporte-cierre:', e);
        res.status(500).json({ error: 'Fallo hardware. Verifica que la impresora esté conectada.' });
    }
});

// ────────────────────────────────────────────────────────────────
// 4. REIMPRESIÓN DE TICKET (desde Historial de Ventas)
//    →  POST /api/imprimir/reimpresion
// ────────────────────────────────────────────────────────────────
app.post('/api/imprimir/reimpresion', (req, res) => {
    const { venta } = req.body;

    if (!venta) {
        return res.status(400).json({ error: 'Faltan datos: venta es requerida' });
    }

    try {
        const { device, printer } = conectarImpresora();

        device.open(function (error) {
            if (error) return res.status(500).json({ error: 'Impresora desconectada' });

            const detallesFiltrados = (venta.detalles || []).filter(d => !d.es_incluido_menu);
            const subtotalBruto = parseFloat(venta.subtotal || 0);
            const descuento     = parseFloat(venta.descuento || 0);
            const totalNeto     = parseFloat(venta.total || 0);
            const identificador = venta.mesa_id
                ? `Mesa: ${venta.mesa_numero}`
                : `CLIENTE: ${venta.nombre_cliente || 'Para Llevar'}`;
            const fecha = new Date(venta.created_at).toLocaleString('es-PE', { hour12: false });

            imprimirCabecera(printer);
            printer
                .align('ct').style('b').text('*** COPIA DE TICKET ***').style('normal')
                .text('================================================')
                .align('lt')
                .text(limpiarTexto(`Ticket: #${venta.numero_ticket || venta.id}`))
                .text(limpiarTexto(identificador))
                .text(limpiarTexto(`Fecha:  ${fecha}`))
                .text('------------------------------------------------');

            detallesFiltrados.forEach(d => {
                const precio = parseFloat(d.subtotal || (d.precio * d.cantidad) || 0);
                printer.text(limpiarTexto(alinear(`${d.cantidad}x ${d.producto_nombre}`, `S/ ${precio.toFixed(2)}`)));
            });

            printer.text('------------------------------------------------');
            printer.text(limpiarTexto(alinear('SUBTOTAL:', `S/ ${subtotalBruto.toFixed(2)}`)));
            if (descuento > 0)
                printer.text(limpiarTexto(alinear('DESCUENTO:', `- S/ ${descuento.toFixed(2)}`)));
            printer.style('b').text(limpiarTexto(alinear('TOTAL:', `S/ ${totalNeto.toFixed(2)}`))).style('normal');
            printer.text('------------------------------------------------');
            printer.text(limpiarTexto(alinear(`PAGADO (${(venta.metodo_pago || 'EFECTIVO').toUpperCase()}):`, `S/ ${parseFloat(venta.monto_pagado || 0).toFixed(2)}`)));
            const vuelto = Math.max(0, parseFloat(venta.monto_pagado || 0) - totalNeto);
            if (vuelto > 0)
                printer.text(limpiarTexto(alinear('VUELTO:', `S/ ${vuelto.toFixed(2)}`)));

            printer.align('ct').text('================================================');
            if (venta.metodo_pago === 'yape' && config.qr_yape_contenido) {
                printer
                    .text(limpiarTexto('Paga con YAPE:'))
                    .qrimage(config.qr_yape_contenido, { type: 'png', mode: 'dM', size: 4 }, function () {
                        printer
                            .text('')
                            .text('================================================')
                            .text(limpiarTexto(config.mensaje_ticket || '¡Gracias por su preferencia!'))
                            .text('================================================')
                            .feed(3).cut().close();
                        res.json({ success: true, message: 'Reimpresion enviada' });
                    });
            } else {
                printer.text(limpiarTexto(config.mensaje_ticket || '¡Gracias por su preferencia!'));
                printer.text('================================================');
                printer.feed(3).cut().close();
                res.json({ success: true, message: 'Reimpresion enviada' });
            }
        });
    } catch (e) {
        console.error('Error impresora reimpresion:', e);
        res.status(500).json({ error: 'Fallo hardware. Verifica que la impresora esté conectada.' });
    }
});

// ────────────────────────────────────────────────────────────────
// HEALTHCHECK  →  GET /api/estado
// ────────────────────────────────────────────────────────────────
app.get('/api/estado', (_req, res) => {
    try {
        const devices = escpos.USB.findPrinter();
        res.json({ ok: true, impresoras_detectadas: devices.length });
    } catch (e) {
        res.json({ ok: true, impresoras_detectadas: 0, aviso: 'No se pudo listar dispositivos USB' });
    }
});

// ────────────────────────────────────────────────────────────────
// ARRANQUE
// ────────────────────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🚀 Microservicio de impresión D' CAMILOS corriendo en http://localhost:${PORT}`);
    console.log('📋 Endpoints disponibles:');
    console.log(`   POST http://localhost:${PORT}/api/imprimir/cocina`);
    console.log(`   POST http://localhost:${PORT}/api/imprimir/caja`);
    console.log(`   POST http://localhost:${PORT}/api/imprimir/reporte-cierre`);
    console.log(`   POST http://localhost:${PORT}/api/imprimir/reimpresion`);
    console.log(`   POST http://localhost:${PORT}/api/recargar-config`);
    console.log(`   GET  http://localhost:${PORT}/api/estado`);
});