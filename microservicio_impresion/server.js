const express = require('express');
const cors = require('cors');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');

const app = express();
app.use(cors());
app.use(express.json());

// Limpiar tildes y caracteres raros
const limpiarTexto = (texto) => {
    if (!texto) return "";
    return texto.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ñ/g, "n").replace(/Ñ/g, "N").replace(/[^\x20-\x7E]/g, "");
};

// 🖨️ Endpoint para Imprimir Ticket de Cocina
app.post('/api/imprimir/cocina', (req, res) => {
    const { orden, detalles } = req.body;
    const esLlevar = !orden.mesa_id;
    const tituloCocina = esLlevar ? `PARA LLEVAR: ${orden.nombre_cliente || 'SIN NOMBRE'}` : `COCINA - Mesa ${orden.mesa_numero}`;
    
    try {
        const device  = new escpos.USB();
        const printer = new escpos.Printer(device);

        device.open(function(error){
            if(error) return res.status(500).json({ error: "Impresora apagada o desconectada" });

            printer
                .align('ct').font('a').size(1, 1).style('b').text(limpiarTexto(tituloCocina))
                .size(0, 0).style('normal').text('------------------------------------------------')
                .align('lt')
                .text(limpiarTexto(`Comanda: #${orden.numero_comanda || 'S/N'}`))
                .text(limpiarTexto(`Hora:    ${new Date().toLocaleTimeString('es-PE', { hour12: false })}`))
                .text('------------------------------------------------');

            detalles.forEach(d => {
                let linea = `${d.cantidad}x ${d.es_menu ? 'MENU: ' : ''}${d.producto_nombre}`;
                printer.size(0, 0).style('b').text(limpiarTexto(linea)).style('normal');
                if (d.observaciones && d.observaciones.trim() !== "") {
                    printer.style('b').text(limpiarTexto(`   NOTA: ${d.observaciones.toUpperCase()}`)).style('normal');
                }
                printer.text('------------------------------------------------');
            });

            printer.feed(2).cut().close();
            res.json({ success: true, message: "Ticket de cocina impreso" });
        });
    } catch (e) {
        res.status(500).json({ error: "Fallo de hardware USB" });
    }
});

// 🧾 Endpoint para Imprimir Comprobante de Caja
app.post('/api/imprimir/caja', (req, res) => {
    const { orden, esPreCuenta } = req.body;
    
    const alinear = (izq, der) => {
        const anchoMaximo = 48; 
        let strIzq = izq.toString();
        let strDer = der.toString();
        if (strIzq.length + strDer.length > anchoMaximo) strIzq = strIzq.substring(0, anchoMaximo - strDer.length - 2) + '..';
        const espaciosFaltantes = anchoMaximo - strIzq.length - strDer.length;
        return strIzq + ' '.repeat(espaciosFaltantes > 0 ? espaciosFaltantes : 0) + strDer;
    };

    try {
        const device  = new escpos.USB();
        const printer = new escpos.Printer(device);

        device.open(function(error){
            if(error) return res.status(500).json({ error: "Impresora desconectada" });

            const subtotalBruto = parseFloat(orden.subtotal || orden.detalles.reduce((s, d) => s + parseFloat(d.subtotal), 0));
            const descuento = parseFloat(orden.descuento_total || 0);
            const totalNeto = Math.max(0, subtotalBruto - descuento);
            const subtotalSinIgv = totalNeto / 1.18;
            const igvCalculado = totalNeto - subtotalSinIgv;

            const fechaLimpia = new Date().toLocaleString('es-PE', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            const identificador = !orden.mesa_id ? `CLIENTE:  ${orden.nombre_cliente || 'Para Llevar'}` : `Mesa:     ${orden.mesa_numero}`;

            printer
                .font('a').align('ct')
                .size(1, 1).style('b').text(limpiarTexto("D' CAMILOS")).style('normal')
                .size(0, 0).text(limpiarTexto('PIZZERIA - RESTAURANT'))
                .text('Jiron Belen 185 - Esperanza Parte Baja')
                .text('Delivery: 0942685506')
                .text('------------------------------------------------')
                .style('b').text(esPreCuenta ? '*** PRE-CUENTA ***' : 'COMPROBANTE DE PAGO').style('normal')
                .text('------------------------------------------------')
                .align('lt')
                .text(`Comanda:  #${orden.numero_comanda?.split('-')[2] || orden.numero_comanda || 'S/N'}`)
                .text(limpiarTexto(identificador))
                .text(`Fecha:    ${fechaLimpia}`)
                .text('------------------------------------------------');

            orden.detalles.forEach(d => {
                if (d.es_incluido_menu) return; 
                let nombreLinea = `${d.cantidad}x ${d.producto_nombre}`;
                let precioStr = `S/ ${parseFloat(d.subtotal).toFixed(2)}`;
                printer.text(limpiarTexto(alinear(nombreLinea, precioStr)));
            });

            printer.text('------------------------------------------------');
            printer.text(alinear('SUBTOTAL:', `S/ ${subtotalBruto.toFixed(2)}`));
            if (descuento > 0) printer.text(alinear('DESCUENTO:', `- S/ ${descuento.toFixed(2)}`));
            printer.text(alinear('TOTAL:', `S/ ${totalNeto.toFixed(2)}`));

            if (!esPreCuenta && orden.metodo_pago) {
                printer.text('------------------------------------------------');
                printer.text(alinear(`PAGADO (${orden.metodo_pago.toUpperCase()}):`, `S/ ${parseFloat(orden.monto_pagado || totalNeto).toFixed(2)}`));
            }

            printer.align('ct').text('------------------------------------------------');
            printer.text(esPreCuenta ? 'ESTE DOCUMENTO NO ES\nUN COMPROBANTE DE PAGO' : 'GRACIAS POR SU PREFERENCIA');
            
            printer.feed(3).cut().close();
            res.json({ success: true, message: "Ticket impreso" });
        });
    } catch (e) {
        res.status(500).json({ error: "Fallo hardware" });
    }
});

const PORT = 4001;
app.listen(PORT, () => {
    console.log(`🚀 Impresión D' Camilos corriendo en http://localhost:${PORT}`);
});