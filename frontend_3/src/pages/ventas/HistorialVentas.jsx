import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Trash2, Search, Calendar, Ban, ChevronLeft, ChevronRight, Download, Printer, Filter, ChevronDown } from 'lucide-react';
import Swal from 'sweetalert2';
import { ventasService } from '@/services/ventas.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { enviarImpresion } from '@/utils/printServer';
import { getConfiguracion } from '@/services/configuracion.service';

export const HistorialVentas = () => {
  const queryClient = useQueryClient();

  const { data: systemConfig } = useQuery({
    queryKey: ['configuracion'],
    queryFn: getConfiguracion,
    staleTime: 60000,
  });

  // --- ESTADOS DE BÚSQUEDA Y FILTROS ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCajero, setSelectedCajero] = useState('Todos'); // Nuevo estado para el filtro

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: ventas, isLoading } = useQuery({
    queryKey: ['historial-ventas'],
    queryFn: async () => await ventasService.getAll(),
  });

  const anularMutation = useMutation({
    mutationFn: async ({ id, motivo }) => {
      return await ventasService.anular(id, motivo);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['historial-ventas']);
      Swal.fire({
        icon: 'success',
        title: 'Venta Anulada',
        text: 'El saldo ha sido retornado a caja correctamente.',
        timer: 2000,
        showConfirmButton: false,
      });
    },
    onError: (error) => {
      Swal.fire({
        icon: 'error',
        title: 'Error de Permisos',
        text: error.response?.data?.message || 'Hubo un error al intentar anular la venta.',
      });
    },
  });

  const handleAnular = (venta) => {
    Swal.fire({
      title: `Anular Venta #${venta.numero_comanda?.split('-')[2] || venta.id}`,
      html: `¿Estás seguro de anular esta venta por <strong>S/ ${venta.total}</strong>?<br/>Esta acción generará un movimiento de salida en la caja.`,
      icon: 'warning',
      input: 'text',
      inputLabel: 'Motivo de la anulación (Obligatorio)',
      inputPlaceholder: 'Ej. Error en método de pago, cliente canceló...',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, Anular Venta',
      cancelButtonText: 'Cancelar',
      preConfirm: (motivo) => {
        if (!motivo) {
          Swal.showValidationMessage('Debes ingresar un motivo para auditoría');
        }
        return motivo;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        anularMutation.mutate({ id: venta.id, motivo: result.value });
      }
    });
  };

  const handleExportarExcel = () => {
    if (!ventasFiltradas || ventasFiltradas.length === 0) {
      Swal.fire('Vacio', 'No hay datos para exportar', 'info');
      return;
    }

    const cabeceras = ['Fecha', 'Comanda', 'Mesa/Cliente', 'Cajero', 'Metodo Pago', 'Total (S/)', 'Estado'];

    const filas = ventasFiltradas.map(v => {
      const fecha = new Date(v.created_at).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const comanda = v.numero_comanda?.split('-')[2] || v.id;
      const estado = v.activo ? 'Pagado' : 'Anulado';
      const cajero = v.cajero_nombre?.replace(/,/g, '');
      const mesa = v.mesa_numero?.toString().replace(/,/g, '');

      return `"${fecha}","${comanda}","${mesa}","${cajero}","${v.metodo_pago}","${v.total}","${estado}"`;
    });

    const csvContent = "\uFEFF" + cabeceras.join(',') + '\n' + filas.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Reporte_Ventas_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImprimirPDF = () => {
    window.print();
  };

  // Nueva función para ver el detalle/ticket de una venta pasada
  const handleVerDetalle = async (id) => {
    try {
      Swal.fire({
        title: 'Cargando detalle...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
      });

      const venta = await ventasService.getById(id); //

      const detallesHtml = venta.detalles.map(d => `
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
          <span>${d.cantidad}x ${d.producto_nombre}</span>
          <span>S/ ${parseFloat(d.precio * d.cantidad).toFixed(2)}</span>
        </div>
      `).join('');

      Swal.fire({
        title: `Venta #${venta.numero_comanda?.split('-')[2] || venta.id}`,
        html: `
          <div style="text-align: left; font-family: monospace; border-top: 1px dashed #ccc; padding-top: 10px;">
            <p><strong>Cajero:</strong> ${venta.cajero_nombre}</p>
            <p><strong>Mesa:</strong> ${venta.mesa_numero}</p>
            <p><strong>Fecha:</strong> ${new Date(venta.created_at).toLocaleString()}</p>
            <div style="border-top: 1px dashed #ccc; margin: 10px 0; padding-top: 10px;">
              ${detallesHtml}
            </div>
            <div style="border-top: 1px dashed #ccc; margin-top: 10px; padding-top: 10px; font-weight: bold;">
              <div style="display: flex; justify-content: space-between;">
                <span>SUBTOTAL:</span> <span>S/ ${parseFloat(venta.subtotal).toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: #e67e22;">
                <span>DESCUENTO:</span> <span>- S/ ${parseFloat(venta.descuento).toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 1.2em; color: #2980b9;">
                <span>TOTAL:</span> <span>S/ ${parseFloat(venta.total).toFixed(2)}</span>
              </div>
            </div>
          </div>
        `,
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#34495e'
      });
    } catch (error) {
      Swal.fire('Error', 'No se pudo cargar el detalle de la venta', 'error');
    }
  };

  const handleReimprimir = async (id) => {
    try {
      Swal.fire({ title: 'Generando ticket...', didOpen: () => Swal.showLoading() });

      const venta = await ventasService.getById(id);

      const identificador = venta.mesa_id
        ? `Mesa: ${venta.mesa_numero}`
        : `CLIENTE: ${venta.nombre_cliente || 'Para Llevar'}`;

      const detallesFiltrados = (venta.detalles || []).filter(d => !d.es_incluido_menu);
      const subtotalBruto = parseFloat(venta.subtotal || 0);
      const descuento     = parseFloat(venta.descuento || 0);
      const totalNeto     = parseFloat(venta.total || 0);

      // IGV extraído del total final
      const subtotalSinIgv = totalNeto / 1.18;
      const igvCalculado = totalNeto - subtotalSinIgv;

      // Cargar config actual de forma asíncrona si no está cargada
      let activeConfig = systemConfig;
      if (!activeConfig) {
        try {
          activeConfig = await getConfiguracion();
        } catch {
          activeConfig = {
            nombre_restaurante: "D' CAMILOS",
            ruc: "20123456789",
            direccion: "Jr. Belen 185 - Esperanza Parte Baja",
            telefono: "942 685 506",
            mensaje_ticket: "¡Gracias por su preferencia!"
          };
        }
      }

      // Generar html para SweetAlert2
      const htmlDetalles = detallesFiltrados.map(d => `
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span>${d.cantidad}x ${d.producto_nombre}</span>
          <span>S/ ${parseFloat(d.subtotal || (d.precio * d.cantidad) || 0).toFixed(2)}</span>
        </div>
      `).join('') || '<div style="color:#888;text-align:center;">Sin productos</div>';

      let pieHtml = '';
      if ((venta.metodo_pago === 'yape' || (venta.metodo_pago === 'mixto' && venta.metodo_digital === 'yape')) && activeConfig.qr_yape_url) {
        pieHtml = `
          <div style="text-align:center;margin:15px 0;padding:10px;border:1px border-dashed #c084fc;background-color:#faf5ff;border-radius:12px;">
            <p style="color:#7e22ce;font-weight:bold;font-size:10px;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">📱 Paga con YAPE:</p>
            <img src="${activeConfig.qr_yape_url}" style="max-width:120px;height:auto;margin:0 auto;border-radius:8px;display:block;" />
          </div>
        `;
      }
      pieHtml += `
        <div style="text-align:center;margin-top:10px;font-style:italic;font-weight:bold;color:#1f2937;font-size:12px;">
          "${activeConfig.mensaje_ticket || '¡Gracias por su preferencia!'}"
        </div>
      `;

      const swalHtml = `
        <div style="text-align:left;font-family:monospace;font-size:12px;color:#374151;line-height:1.5;padding:15px;background:#fff;border-radius:12px;box-shadow:inset 0 0 10px rgba(0,0,0,0.05);border:1px solid #e5e7eb;">
          <div style="text-align:center;margin-bottom:12px;border-bottom:1px dashed #ccc;padding-bottom:12px;">
            <span style="display:inline-block;border:1px solid #d1d5db;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:bold;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">*** COPIA DE TICKET ***</span><br/>
            <strong style="font-size:14px;color:#111827;text-transform:uppercase;letter-spacing:0.5px;">${activeConfig.nombre_restaurante || "D' CAMILOS"}</strong><br/>
            ${activeConfig.ruc ? `<span style="color:#4b5563;">RUC: ${activeConfig.ruc}</span><br/>` : ''}
            <span style="color:#6b7280;">${activeConfig.direccion || ''}</span><br/>
            ${activeConfig.telefono ? `<span style="color:#6b7280;">Delivery: ${activeConfig.telefono}</span>` : ''}
          </div>
          <div style="margin-bottom:8px;color:#4b5563;">
            <strong>TICKET #${venta.numero_ticket || venta.id}</strong><br/>
            <strong>${identificador}</strong><br/>
            Fecha: ${new Date(venta.created_at).toLocaleString()}<br/>
          </div>
          <div style="border-top:1px dashed #ccc;border-bottom:1px dashed #ccc;padding:8px 0;margin:8px 0;color:#1f2937;">
            ${htmlDetalles}
          </div>
          <div style="text-align:right;margin-bottom:8px;color:#4b5563;">
            <div style="display:flex;justify-content:space-between;"><span>SUBTOTAL BRUTO:</span><span>S/ ${subtotalBruto.toFixed(2)}</span></div>
            ${descuento > 0 ? `<div style="display:flex;justify-content:space-between;color:#ea580c;font-weight:bold;"><span>DESCUENTO:</span><span>- S/ ${descuento.toFixed(2)}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;"><span>OP. GRAVADA:</span><span>S/ ${subtotalSinIgv.toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>IGV (18%):</span><span>S/ ${igvCalculado.toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;color:#111827;margin-top:4px;border-top:1px solid #eee;padding-top:4px;"><span>TOTAL A PAGAR:</span><span>S/ ${totalNeto.toFixed(2)}</span></div>
          </div>
          <div style="border-top:1px dashed #ccc;padding-top:8px;margin-top:8px;color:#4b5563;font-size:11px;background-color:#f9fafb;padding:8px;border-radius:8px;">
            <div style="display:flex;justify-content:space-between;"><span>Método de Pago:</span><strong style="color:#111827;">${venta.metodo_pago?.toUpperCase() || 'EFECTIVO'}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span>Monto Recibido:</span><span>S/ ${parseFloat(venta.monto_pagado || 0).toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;font-weight:bold;color:#16a34a;margin-top:2px;"><span>Vuelto:</span><span>S/ ${parseFloat(venta.vuelto || 0).toFixed(2)}</span></div>
          </div>
          <div style="border-top:1px dashed #ccc;margin-top:10px;padding-top:10px;">
            ${pieHtml}
          </div>
        </div>
      `;

      Swal.fire({
        title: '🧾 Reimpresión de Ticket',
        html: swalHtml,
        confirmButtonText: '🖨️ Imprimir en Térmica',
        showCancelButton: true,
        cancelButtonText: 'Cerrar',
        confirmButtonColor: '#22c55e',
      }).then(async (result) => {
        if (result.isConfirmed) {
          const ok = await enviarImpresion('/api/imprimir/reimpresion', { venta });
          if (ok) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '✅ Enviado a impresora', timer: 2000, showConfirmButton: false });
          } else {
            Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Sin impresora USB detectada', timer: 2500, showConfirmButton: false });
          }
        }
      });
    } catch (error) {
      Swal.fire('Error', 'No se pudo generar el ticket', 'error');
    }
  };

  // --- LÓGICA INTELIGENTE DE FILTRADO MÚLTIPLE ---

  // 1. Extraer lista única de cajeros para el menú desplegable
  const cajerosUnicos = Array.from(new Set(ventas?.map(v => v.cajero_nombre))).filter(Boolean);

  // 2. Aplicar ambos filtros: Buscador de texto + Selector de Caja/Cajero
  const ventasFiltradas = ventas?.filter(venta => {
    const matchesSearch = venta.numero_comanda?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      venta.mesa_numero?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      venta.cajero_nombre?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCajero = selectedCajero === 'Todos' || venta.cajero_nombre === selectedCajero;

    return matchesSearch && matchesCajero;
  }) || [];

  // 3. Regresar a página 1 si se cambia algún filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCajero]);

  const totalPages = Math.ceil(ventasFiltradas.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = ventasFiltradas.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="space-y-6 print:m-0 print:space-y-2">
      <div className="print:hidden">
        <h1 className="text-3xl font-bold text-gray-900">Historial de Ventas</h1>
        <p className="text-gray-500 mt-1">Auditoría de ventas realizadas y anulaciones</p>
      </div>

      <Card className="print:shadow-none print:border-none">
        <CardHeader className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 pb-4 print:hidden">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Registro de Operaciones
          </CardTitle>

          {/* --- CONTROLES DE FILTRO Y EXPORTACIÓN --- */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">

            {/* NUEVO: Selector de Caja / Cajero */}
            <div className="relative w-full sm:w-auto flex items-center">
              <Filter className="absolute left-3 h-4 w-4 text-gray-500" />
              <select
                value={selectedCajero}
                onChange={(e) => setSelectedCajero(e.target.value)}
                className="h-9 w-full sm:w-48 pl-9 pr-8 rounded-md border border-gray-300 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
              >
                <option value="Todos">Todas las cajas</option>
                {cajerosUnicos.map((cajero, index) => (
                  <option key={index} value={cajero}>{cajero}</option>
                ))}
              </select>
              {/* Flechita personalizada para el select */}
              <ChevronDown className="absolute right-3 h-4 w-4 text-gray-500 pointer-events-none" />
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar comanda o mesa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-full sm:w-auto flex items-center gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                onClick={handleExportarExcel}
              >
                <Download className="h-4 w-4" /> Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-full sm:w-auto flex items-center gap-2 text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={handleImprimirPDF}
              >
                <Printer className="h-4 w-4" /> PDF
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="hidden print:block text-center mb-4">
          <h2 className="text-2xl font-bold">Reporte de Ventas {selectedCajero !== 'Todos' ? `- Caja: ${selectedCajero}` : ''}</h2>
          <p className="text-gray-500">Fecha de generación: {new Date().toLocaleString('es-PE')}</p>
          <hr className="my-2 border-gray-300" />
        </div>

        <CardContent className="print:p-0">

          {isLoading ? (
            <div className="flex justify-center py-12 print:hidden">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="overflow-x-auto rounded-t-lg border-x border-t border-gray-200 print:border-none print:overflow-visible">
                <table className="w-full text-sm text-left text-gray-600 print:text-[10px]">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b print:bg-gray-100">
                    <tr>
                      <th className="px-6 py-4 print:px-2 print:py-1">Fecha y Hora</th>
                      <th className="px-6 py-4 print:px-2 print:py-1">Comanda</th>
                      <th className="px-6 py-4 print:px-2 print:py-1">Mesa / Cliente</th>
                      <th className="px-6 py-4 print:px-2 print:py-1">Cajero</th>
                      <th className="px-6 py-4 print:px-2 print:py-1">Método</th>
                      <th className="px-6 py-4 print:px-2 print:py-1 text-right">Total</th>
                      <th className="px-6 py-4 print:px-2 print:py-1 text-center">Estado</th>
                      <th className="px-6 py-4 print:hidden text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.length > 0 ? (
                      currentItems.map((venta) => (
                        <tr key={venta.id} className={`bg-white border-b hover:bg-gray-50 print:border-gray-300 ${!venta.activo ? 'opacity-70 bg-red-50 print:bg-red-50' : ''}`}>
                          <td className="px-6 py-4 print:px-2 print:py-1 font-medium text-gray-900 whitespace-nowrap">
                            {new Date(venta.created_at).toLocaleString('es-PE', {
                              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4 print:px-2 print:py-1 font-mono">{venta.numero_comanda?.split('-')[2] || venta.id}</td>
                          <td className="px-6 py-4 print:px-2 print:py-1">{venta.mesa_numero}</td>
                          <td className="px-6 py-4 print:px-2 print:py-1">{venta.cajero_nombre}</td>
                          <td className="px-6 py-4 print:px-2 print:py-1 capitalize">{venta.metodo_pago}</td>
                          <td className="px-6 py-4 print:px-2 print:py-1 text-right font-bold text-gray-900">
                            S/ {parseFloat(venta.total).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 print:px-2 print:py-1 text-center">
                            {venta.activo ? (
                              <span className="text-green-600 font-medium">Pagado</span>
                            ) : (
                              <span className="text-red-600 font-medium">Anulado</span>
                            )}
                          </td>
                          <td className="px-6 py-4 print:hidden flex justify-center gap-2">
                            {/* VER DETALLE */}
                            <Button
                              variant="outline" size="sm" className="h-8 w-8 p-0 border-blue-200 hover:bg-blue-50"
                              onClick={() => handleVerDetalle(venta.id)}
                            >
                              <FileText className="h-4 w-4 text-blue-600" />
                            </Button>

                            {/* REIMPRIMIR (Nuevo) */}
                            <Button
                              variant="outline" size="sm" className="h-8 w-8 p-0 border-emerald-200 hover:bg-emerald-50"
                              title="Reimprimir Ticket"
                              onClick={() => handleReimprimir(venta.id)}
                            >
                              <Printer className="h-4 w-4 text-emerald-600" />
                            </Button>

                            {/* ANULAR */}
                            {venta.activo && (
                              <Button
                                variant="outline" size="sm" className="h-8 w-8 p-0 border-red-200 hover:bg-red-50"
                                onClick={() => handleAnular(venta)}
                                disabled={anularMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                          No se encontraron registros de ventas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border border-t-0 border-gray-200 rounded-b-lg bg-gray-50 print:hidden">
                  <span className="text-sm text-gray-700">
                    Mostrando del <span className="font-semibold">{indexOfFirstItem + 1}</span> al{' '}
                    <span className="font-semibold">
                      {Math.min(indexOfLastItem, ventasFiltradas.length)}
                    </span>{' '}
                    de <span className="font-semibold">{ventasFiltradas.length}</span> registros
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="h-8 flex items-center gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </Button>

                    <div className="text-sm font-medium px-4 py-1.5 bg-white border border-gray-200 rounded-md">
                      Página {currentPage} de {totalPages}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="h-8 flex items-center gap-1"
                    >
                      Siguiente <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};