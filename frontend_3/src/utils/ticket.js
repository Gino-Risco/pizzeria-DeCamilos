import Swal from 'sweetalert2';
import { enviarImpresion } from '@/utils/printServer';
import { formatFechaHora } from '@/utils/formatFecha';

/**
 * Calcula subtotal, descuento, total neto e IGV de una orden/venta.
 * Misma fórmula usada en Cobrar.jsx y Pedidos.jsx.
 */
export const calcularTotalesOrden = (orden) => {
  const detallesFiltrados = (orden.detalles || []).filter(d => !d.es_incluido_menu);
  const subtotalBruto = parseFloat(
    orden.subtotal ??
    detallesFiltrados.reduce((s, d) => s + parseFloat(d.subtotal || 0), 0)
  );
  const descuento = parseFloat(orden.descuento_total || 0);
  const totalNeto = parseFloat(orden.total ?? Math.max(0, subtotalBruto - descuento));
  const subtotalSinIgv = totalNeto / 1.18;
  const igv = totalNeto - subtotalSinIgv;
  return { subtotalBruto, descuento, totalNeto, subtotalSinIgv, igv };
};

/**
 * Construye el HTML del ticket (para el preview de SweetAlert2).
 */
export const construirHtmlTicket = ({ venta, config, esPreCuenta, totales }) => {
  const identificador = !venta.mesa_id
    ? `CLIENTE: ${venta.nombre_cliente || 'Para Llevar'}`
    : `Mesa: ${venta.mesa_numero}`;

  const { subtotalBruto, descuento, totalNeto, subtotalSinIgv, igv } = totales;

  const htmlDetalles = venta.detalles?.filter(d => !d.es_incluido_menu).map(d => `
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
      <span>${d.cantidad}x ${d.producto_nombre}</span>
      <span>S/ ${parseFloat(d.subtotal).toFixed(2)}</span>
    </div>
  `).join('') || '<div style="color:#888;text-align:center;">Sin productos</div>';

  let pieHtml = '';
  if (!esPreCuenta) {
    if ((venta.metodo_pago === 'yape' || (venta.metodo_pago === 'mixto' && venta.metodo_digital === 'yape')) && config.qr_yape_url) {
      pieHtml = `
        <div style="text-align:center;margin:15px 0;padding:10px;border:1px border-dashed #c084fc;background-color:#faf5ff;border-radius:12px;">
          <p style="color:#7e22ce;font-weight:bold;font-size:10px;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">📱 Paga con YAPE:</p>
          <img src="${config.qr_yape_url}" style="max-width:120px;height:auto;margin:0 auto;border-radius:8px;display:block;" />
        </div>
      `;
    }
    pieHtml += `
      <div style="text-align:center;margin-top:10px;font-style:italic;font-weight:bold;color:#1f2937;font-size:12px;">
        "${config.mensaje_ticket || '¡Gracias por su preferencia!'}"
      </div>
    `;
  } else {
    pieHtml = `
      <div style="text-align:center;margin-top:10px;font-weight:bold;color:#b91c1c;border:1px dashed #f87171;padding:8px;border-radius:8px;background-color:#fef2f2;font-size:11px;">
        ESTE DOCUMENTO NO ES<br/>UN COMPROBANTE DE PAGO
      </div>
    `;
  }

  return `
    <div style="text-align:left;font-family:monospace;font-size:12px;color:#374151;line-height:1.5;padding:15px;background:#fff;border-radius:12px;box-shadow:inset 0 0 10px rgba(0,0,0,0.05);border:1px solid #e5e7eb;">
      <div style="text-align:center;margin-bottom:12px;border-bottom:1px dashed #ccc;padding-bottom:12px;">
        <strong style="font-size:14px;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">${config.nombre_restaurante || "D' CAMILOS"}</strong><br/>
        ${config.ruc ? `<span style="color:#4b5563;">RUC: ${config.ruc}</span><br/>` : ''}
        <span style="color:#6b7280;">${config.direccion || ''}</span><br/>
        ${config.telefono ? `<span style="color:#6b7280;">Delivery: ${config.telefono}</span>` : ''}
      </div>
      <div style="margin-bottom:8px;color:#4b5563;">
        <strong>TICKET #${venta.numero_ticket || venta.numero_comanda || 'S/N'}</strong><br/>
        <strong>${identificador}</strong><br/>
        Fecha: ${formatFechaHora(venta.created_at || new Date())}<br/>
      </div>
      <div style="border-top:1px dashed #ccc;border-bottom:1px dashed #ccc;padding:8px 0;margin:8px 0;color:#1f2937;">
        ${htmlDetalles}
      </div>
      <div style="text-align:right;margin-bottom:8px;color:#4b5563;">
        <div style="display:flex;justify-content:space-between;"><span>SUBTOTAL BRUTO:</span><span>S/ ${subtotalBruto.toFixed(2)}</span></div>
        ${descuento > 0 ? `<div style="display:flex;justify-content:space-between;color:#ea580c;font-weight:bold;"><span>DESCUENTO:</span><span>- S/ ${descuento.toFixed(2)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;"><span>OP. GRAVADA:</span><span>S/ ${subtotalSinIgv.toFixed(2)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>IGV (18%):</span><span>S/ ${igv.toFixed(2)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;color:#111827;margin-top:4px;border-top:1px solid #eee;padding-top:4px;"><span>TOTAL A PAGAR:</span><span>S/ ${totalNeto.toFixed(2)}</span></div>
      </div>
      ${!esPreCuenta ? `
      <div style="border-top:1px dashed #ccc;padding-top:8px;margin-top:8px;color:#4b5563;font-size:11px;background-color:#f9fafb;padding:8px;border-radius:8px;">
        <div style="display:flex;justify-content:space-between;"><span>Método de Pago:</span><strong style="color:#111827;">${venta.metodo_pago?.toUpperCase() || 'EFECTIVO'}</strong></div>
        <div style="display:flex;justify-content:space-between;"><span>Monto Recibido:</span><span>S/ ${parseFloat(venta.monto_pagado || 0).toFixed(2)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:bold;color:#16a34a;margin-top:2px;"><span>Vuelto:</span><span>S/ ${parseFloat(venta.vuelto || 0).toFixed(2)}</span></div>
      </div>
      ` : ''}
      <div style="border-top:1px dashed #ccc;margin-top:10px;padding-top:10px;">
        ${pieHtml}
      </div>
    </div>
  `;
};

/**
 * Muestra el preview del ticket (SweetAlert2) y lo envía a imprimir
 * al microservicio de impresión térmica (POST /api/imprimir/caja).
 */
export const mostrarEImprimirTicket = async (venta, esPreCuenta, config) => {
  const totales = calcularTotalesOrden(venta);
  const swalHtml = construirHtmlTicket({ venta, config, esPreCuenta, totales });

  Swal.fire({
    title: esPreCuenta ? '🧾 Pre-Cuenta Generada' : '🧾 Comprobante de Pago',
    html: swalHtml,
    confirmButtonText: '✓ Entendido',
    confirmButtonColor: esPreCuenta ? '#3b82f6' : '#22c55e',
    width: '400px',
  });

  await enviarImpresion('/api/imprimir/caja', { orden: venta, esPreCuenta });
};
