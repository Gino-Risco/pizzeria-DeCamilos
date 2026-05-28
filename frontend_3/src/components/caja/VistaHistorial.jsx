import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Unlock, Download } from 'lucide-react';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { cajaService } from '@/services/caja.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const parseFecha = (rawDate) => {
    if (!rawDate) return new Date();
    const str = String(rawDate);
    const tieneZona = str.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(str);
    return new Date(tieneZona ? str : str + 'Z');
};

export const VistaHistorial = React.memo(({ onIrADashboard }) => {
    const queryClient = useQueryClient();
    const [showAperturaModal, setShowAperturaModal] = useState(false);

    // Paginación
    const [paginaActual, setPaginaActual] = useState(1);
    const filasPorPagina = 8;

    const { data: historial = [], isLoading } = useQuery({
        queryKey: ['caja-historial'],
        queryFn: () => cajaService.getHistorialCajas(),
    });

    const hayCajaAbierta = historial.some((c) => c.estado === 'abierta');

    const { data: fondoSugerido, isLoading: fondoLoading } = useQuery({
        queryKey: ['caja-fondo-sugerido'],
        queryFn: () => cajaService.obtenerFondoSugerido(),
        enabled: hayCajaAbierta === false,
        staleTime: 0,
    });

    const abrirCajaMutation = useMutation({
        mutationFn: (data) => cajaService.abrirCaja(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['caja-historial'] });
            queryClient.invalidateQueries({ queryKey: ['caja-estado'] });
            queryClient.invalidateQueries({ queryKey: ['caja-fondo-sugerido'] });
            setShowAperturaModal(false);
            Swal.fire({ icon: 'success', title: 'Turno Abierto', timer: 1500, showConfirmButton: false });
            onIrADashboard();
        },
        onError: (error) =>
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.response?.data?.error?.message || 'Error al abrir caja',
            }),
    });

    // MEJORA: EXPORTACIÓN EN FORMATO XLSX NATIVO CON ANCHOS AUTO-AJUSTADOS
    const handleExportarTurnosExcel = () => {
        if (!historial || historial.length === 0) {
            Swal.fire('Vacío', 'No hay turnos para exportar', 'info');
            return;
        }

        const dataToExport = historial.map((caja) => {
            const fecha = parseFecha(caja.created_at).toLocaleDateString('es-PE');
            const cajero = caja.usuario_nombre || '-';
            const fondo = parseFloat(caja.monto_inicial || 0);
            const ventas = parseFloat(caja.total_ventas || 0);
            const real = parseFloat(caja.monto_final_real || 0);
            const estado = caja.estado.toUpperCase();
            const obs = caja.observaciones || '-';

            return {
                'Fecha Apertura': fecha,
                'Cajero': cajero,
                'Fondo Inicial (S/)': fondo,
                'Ventas (S/)': ventas,
                'Monto Real Final (S/)': real,
                'Estado': estado,
                'Observaciones': obs
            };
        });

        // Crear Libro y Hoja de Cálculo
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial de Turnos');

        // Autoajustar columnas
        const colsWidth = Object.keys(dataToExport[0] || {}).map(key => {
            let maxLen = key.length;
            dataToExport.forEach(row => {
                const cellValue = String(row[key] || '');
                if (cellValue.length > maxLen) maxLen = cellValue.length;
            });
            return { wch: maxLen + 3 };
        });
        worksheet['!cols'] = colsWidth;

        // Generar descarga
        XLSX.writeFile(workbook, `Historial_Turnos_${new Date().getTime()}.xlsx`);
    };

    const handleVerReporte = (caja) => {
        const f = (val) => parseFloat(val || 0).toFixed(2);

        const fondo = f(caja.monto_inicial);
        const ventasGlobales = f(caja.total_ventas);
        const ventasEfectivo = f(caja.total_efectivo);
        const ventasTarjeta = f(caja.total_tarjeta);
        const ventasDigital = f(caja.total_otro);
        const ingresos = f(caja.total_ingresos);
        const egresos = f(parseFloat(caja.total_gastos || 0) + parseFloat(caja.total_retiros || 0));
        const esperadoFisico = f(caja.monto_final_esperado);
        const realFisico = caja.estado === 'cerrada' ? f(caja.monto_final_real) : null;
        const dif = parseFloat(caja.diferencia || 0);
        const fondoManana = f(caja.fondo_reservado_proximo);
        const retiroDueno = f(caja.monto_retirado_dueno);
        const turnoStr = String(caja.turno || 'N/A').toUpperCase();

        const colorDiferencia = dif < 0 ? '#ef4444' : dif > 0 ? '#10b981' : '#64748b';
        const textoDiferencia = dif < 0 ? '⚠️ FALTANTE' : dif > 0 ? '✓ SOBRANTE' : '✓ CUADRE PERFECTO';

        const htmlFormal = `
            <div style="font-family: 'Inter', system-ui, sans-serif; text-align: left; color: #334155; font-size: 13px; padding: 5px;">
                <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px;">
                    <h2 style="margin: 0; font-size: 18px; color: #0f172a; display: flex; justify-content: space-between; align-items: center;">
                        Turno ${turnoStr}
                        <span style="font-size: 11px; padding: 4px 10px; border-radius: 999px; font-weight: bold;
                            background: ${caja.estado === 'abierta' ? '#dcfce7' : '#f1f5f9'};
                            color: ${caja.estado === 'abierta' ? '#166534' : '#475569'};">
                            ${caja.estado.toUpperCase()}
                        </span>
                    </h2>
                    <p style="margin: 4px 0 0; color: #64748b;">Responsable: <strong>${caja.usuario_nombre}</strong></p>
                    <p style="margin: 2px 0 0; color: #64748b;">
                        Apertura: ${parseFecha(caja.created_at).toLocaleDateString('es-PE')}
                    </p>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
                        <h3 style="margin: 0 0 8px; font-size: 11px; color: #64748b; text-transform: uppercase;">📊 Ventas Totales</h3>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Efectivo:</span> <span style="font-weight: 500;">S/ ${ventasEfectivo}</span></div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Tarjeta:</span> <span style="font-weight: 500;">S/ ${ventasTarjeta}</span></div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px;"><span>Digital:</span> <span style="font-weight: 500;">S/ ${ventasDigital}</span></div>
                        <div style="display: flex; justify-content: space-between; margin-top: 4px; font-weight: bold; color: #0f172a;"><span>Total:</span> <span>S/ ${ventasGlobales}</span></div>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
                        <h3 style="margin: 0 0 8px; font-size: 11px; color: #64748b; text-transform: uppercase;">💰 Distribución</h3>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;"><span>Fondo próximo turno:</span> <span style="font-weight: 500;">S/ ${fondoManana}</span></div>
                        <div style="display: flex; justify-content: space-between; font-weight: bold; color: #0f172a;"><span>Retiro del Dueño:</span> <span>S/ ${retiroDueno}</span></div>
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
                    <h3 style="margin: 0 0 8px; font-size: 11px; color: #64748b; text-transform: uppercase;">💵 Control de Gaveta (Físico)</h3>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Fondo Inicial:</span> <span style="font-weight: 500;">S/ ${fondo}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>+ Ventas Efectivo:</span> <span style="color: #2563eb; font-weight: 500;">S/ ${ventasEfectivo}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>+ Ingresos Extras:</span> <span style="color: #16a34a; font-weight: 500;">S/ ${ingresos}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px;"><span>- Egresos Extras:</span> <span style="color: #dc2626; font-weight: 500;">S/ ${egresos}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Saldo Esperado:</span> <span>S/ ${esperadoFisico}</span></div>
                    ${
                    realFisico !== null
                        ? `<div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                        <span>Real Contado:</span>
                                        <span style="font-weight: bold; color: #0f172a;">S/ ${realFisico}</span>
                                       </div>`
                        : `<div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #94a3b8;">
                                        <span>Real Contado:</span>
                                        <span>Turno aún activo</span>
                                       </div>`
                    }
                    ${caja.estado === 'cerrada'
                        ? `<div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
                                        <span style="font-weight: bold; color: #0f172a;">Diferencia:</span>
                                        <span style="font-weight: bold; color: ${colorDiferencia};">${textoDiferencia} (S/ ${Math.abs(dif).toFixed(2)})</span>
                                       </div>`
                        : ''
                    }
                </div>
                ${caja.observaciones
                    ? `<div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px; color: #92400e; font-size: 12px;">
                                <strong>Observaciones:</strong> ${caja.observaciones}
                               </div>`
                    : ''
                }
            </div>
        `;

        Swal.fire({
            html: htmlFormal,
            showCancelButton: true,
            confirmButtonText: 'Cerrar Panel',
            cancelButtonText: '🖨️ Imprimir Reporte',
            confirmButtonColor: '#f1f5f9',
            cancelButtonColor: '#3b82f6',
            reverseButtons: true,
            width: '520px',
            customClass: {
                confirmButton: '!text-slate-700 !font-semibold',
                cancelButton: '!font-semibold',
                htmlContainer: '!m-0 !p-0',
            },
        }).then((result) => {
            if (result.dismiss === Swal.DismissReason.cancel) {
                const ventanaImpresion = window.open('', '_blank', 'width=600,height=800');
                ventanaImpresion.document.write(`
                    <html>
                    <head>
                        <title>Imprimir Reporte</title>
                        <style>
                            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                            body { font-family: 'Inter', system-ui, sans-serif; margin: 0; padding: 20px; }
                            @media print { @page { margin: 10mm; } body { padding: 0; } }
                        </style>
                    </head>
                    <body>
                        ${htmlFormal}
                        <script>
                            setTimeout(() => {
                                window.print();
                                window.onafterprint = function() { window.close(); }
                            }, 300);
                        </script>
                    </body>
                    </html>
                `);
                ventanaImpresion.document.close();
            }
        });
    };

    // LÓGICA DE PAGINACIÓN CLIENT-SIDE
    const totalFilas = historial?.length || 0;
    const totalPaginas = Math.ceil(totalFilas / filasPorPagina) || 1;
    const indexUltimoItem = paginaActual * filasPorPagina;
    const indexPrimerItem = indexUltimoItem - filasPorPagina;
    const historialPaginado = historial?.slice(indexPrimerItem, indexUltimoItem) || [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 font-sans">Gestión de Turnos</h1>
                    <p className="text-gray-500 mt-1">Control histórico de aperturas y cierres</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 font-medium"
                        onClick={handleExportarTurnosExcel}
                    >
                        <Download className="h-4 w-4 mr-2" /> Exportar Excel
                    </Button>
                    <Button
                        onClick={() => (hayCajaAbierta ? onIrADashboard() : setShowAperturaModal(true))}
                        className={hayCajaAbierta ? 'bg-blue-600 hover:bg-blue-700 font-medium' : 'bg-green-600 hover:bg-green-700 font-medium'}
                    >
                        {hayCajaAbierta ? 'Ir al Turno Activo' : 'Abrir Nuevo Turno'}
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                    ) : historial.length === 0 ? (
                        <p className="text-gray-500 text-center py-12">No hay turnos registrados aún</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-200 text-gray-700 uppercase font-bold">
                                    <tr>
                                        <th className="px-8 py-4">Fecha Apertura</th>
                                        <th className="px-6 py-4">Cajero</th>
                                        <th className="px-6 py-4 text-right">Fondo Inicial</th>
                                        <th className="px-6 py-4 text-center">Estado</th>
                                        <th className="px-6 py-4 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {historialPaginado.map((caja) => (
                                        <tr key={caja.id} className="hover:bg-gray-50">
                                            <td className="px-8 py-4 font-medium">
                                                {parseFecha(caja.created_at).toLocaleDateString('es-PE')}
                                            </td>
                                            <td className="px-6 py-4">{caja.usuario_nombre}</td>
                                            <td className="px-6 py-4 text-right">
                                                S/ {parseFloat(caja.monto_inicial).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <Badge
                                                    className={
                                                        caja.estado === 'abierta'
                                                            ? 'bg-emerald-100 text-emerald-700 border-none font-semibold'
                                                            : 'bg-slate-100 text-slate-600 border-none font-semibold'
                                                    }
                                                >
                                                    {caja.estado === 'abierta' ? '🟢 ABIERTA' : '🔴 CERRADA'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <Button
                                                    size="sm"
                                                    variant={caja.estado === 'abierta' ? 'default' : 'outline'}
                                                    onClick={() =>
                                                        caja.estado === 'abierta'
                                                            ? onIrADashboard()
                                                            : handleVerReporte(caja)
                                                    }
                                                    className="font-medium"
                                                >
                                                    {caja.estado === 'abierta' ? 'Gestionar' : 'Ver Reporte'}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* MEJORA SOLICITADA: CONTROLES DE PAGINACIÓN */}
                            {totalPaginas > 1 && (
                                <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
                                    <div className="flex flex-1 justify-between sm:hidden">
                                        <Button
                                            variant="outline"
                                            onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
                                            disabled={paginaActual === 1}
                                        >
                                            Anterior
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => setPaginaActual((p) => Math.min(p + 1, totalPaginas))}
                                            disabled={paginaActual === totalPaginas}
                                        >
                                            Siguiente
                                        </Button>
                                    </div>
                                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-sm text-gray-700">
                                                Mostrando <span className="font-medium">{indexPrimerItem + 1}</span> a{' '}
                                                <span className="font-medium">{Math.min(indexUltimoItem, totalFilas)}</span> de{' '}
                                                <span className="font-medium">{totalFilas}</span> turnos
                                            </p>
                                        </div>
                                        <div>
                                            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm gap-1" aria-label="Pagination">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
                                                    disabled={paginaActual === 1}
                                                >
                                                    Anterior
                                                </Button>
                                                {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((pag) => (
                                                    <Button
                                                        key={pag}
                                                        variant={paginaActual === pag ? 'default' : 'outline'}
                                                        size="sm"
                                                        className="w-8 h-8 p-0"
                                                        onClick={() => setPaginaActual(pag)}
                                                    >
                                                        {pag}
                                                    </Button>
                                                ))}
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setPaginaActual((p) => Math.min(p + 1, totalPaginas))}
                                                    disabled={paginaActual === totalPaginas}
                                                >
                                                    Siguiente
                                                </Button>
                                            </nav>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* MODAL: ABRIR NUEVA CAJA */}
            <Dialog open={showAperturaModal} onOpenChange={setShowAperturaModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Unlock className="h-5 w-5 text-blue-600" /> Abrir Nueva Caja
                        </DialogTitle>
                    </DialogHeader>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const fd = new FormData(e.target);
                            abrirCajaMutation.mutate({
                                monto_inicial: parseFloat(fd.get('monto_inicial')),
                                observaciones: fd.get('observaciones'),
                            });
                        }}
                        className="space-y-4"
                    >
                        <p className="text-sm text-gray-600">
                            Registra el fondo inicial físico en la gaveta para comenzar las operaciones.
                        </p>
                        {fondoLoading ? (
                            <div className="flex justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <Label htmlFor="monto_inicial">Fondo Inicial (S/)</Label>
                                    <Input
                                        key={fondoSugerido}
                                        id="monto_inicial"
                                        name="monto_inicial"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        readOnly={fondoSugerido > 0}
                                        defaultValue={fondoSugerido !== null && fondoSugerido !== undefined ? fondoSugerido : ''}
                                        placeholder="0.00"
                                        required
                                        className={`mt-1 ${fondoSugerido > 0 ? 'bg-gray-100 cursor-not-allowed text-gray-500 font-bold' : ''}`}
                                    />
                                    {fondoSugerido > 0 ? (
                                        <p className="text-xs text-blue-600 mt-1 flex items-center gap-1 font-medium">
                                            <Unlock className="h-3 w-3" /> ✓ Fondo bloqueado: Proviene del cierre anterior
                                        </p>
                                    ) : (
                                        <p className="text-xs text-gray-400 mt-1">
                                            Ingresa el efectivo inicial para este turno.
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="observaciones">Observaciones (opcional)</Label>
                                    <Input id="observaciones" name="observaciones" placeholder="Ej: Turno mañana" className="mt-1" />
                                </div>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowAperturaModal(false)}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                                        disabled={abrirCajaMutation.isPending}
                                    >
                                        {abrirCajaMutation.isPending ? 'Abriendo...' : 'Abrir Caja'}
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
});
