import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Printer, Plus, Minus, Calculator, Wallet, ArrowLeft, Download } from 'lucide-react';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { cajaService } from '@/services/caja.service';
import { enviarImpresion } from '@/utils/printServer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MovimientoModal } from './MovimientoModal';
import { ArqueoModal } from './ArqueoModal';
import { CierreModal } from './CierreModal';
import { formatFechaHora, formatSoloFecha, formatSoloHora } from '@/utils/formatFecha';

const UMBRAL_DIFERENCIA_ALERTA = 50; // S/ 50

export const VistaDashboard = React.memo(({ onVolver }) => {
    const queryClient = useQueryClient();

    const [showMovimientoModal, setShowMovimientoModal] = useState(false);
    const [showCierreModal, setShowCierreModal] = useState(false);
    const [showArqueoModal, setShowArqueoModal] = useState(false);

    const [tipoMovimiento, setTipoMovimiento] = useState('ingreso');
    const [filtroMovimientos, setFiltroMovimientos] = useState({ tipo: 'todos' });

    // FIX #1 — Rastrear localmente si se realizó al menos un arqueo en este turno.
    const [huboArqueo, setHuboArqueo] = useState(false);

    // Paginación de Movimientos
    const [paginaActual, setPaginaActual] = useState(1);
    const filasPorPagina = 10;

    // Resetear paginación cuando cambia el filtro
    useEffect(() => {
        setPaginaActual(1);
    }, [filtroMovimientos]);

    // ── QUERIES ──────────────────────────────────────────────────────────────

    const { data: estadoCaja, isLoading: cajaLoading } = useQuery({
        queryKey: ['caja-estado'],
        queryFn: () => cajaService.verificarCajaAbierta(),
        staleTime: 30000,
    });

    const cajaAbierta = estadoCaja?.caja;
    const hayCajaAbierta = estadoCaja?.caja_abierta;

    const { data: resumen, isLoading: resumenLoading } = useQuery({
        queryKey: ['caja-resumen', cajaAbierta?.id],
        queryFn: () => {
            if (!cajaAbierta?.id) return null;
            return cajaService.getResumenDelDia();
        },
        enabled: !!cajaAbierta?.id,
        staleTime: 5000,
    });

    const { data: movimientos, isLoading: movimientosLoading } = useQuery({
        queryKey: ['caja-movimientos', cajaAbierta?.id, filtroMovimientos],
        queryFn: async () => {
            if (!cajaAbierta?.id) return [];
            const result = await cajaService.getMovimientosDelDia(cajaAbierta.id, filtroMovimientos);
            
            const tieneApertura = result.some(m => m.tipo === 'apertura');
            if (!tieneApertura && (filtroMovimientos.tipo === 'todos' || filtroMovimientos.tipo === 'apertura')) {
                const aperturaVirtual = {
                    id: 'apertura-virtual',
                    caja_id: cajaAbierta.id,
                    tipo: 'apertura',
                    descripcion: 'Apertura de caja',
                    monto: parseFloat(cajaAbierta.monto_inicial || 0),
                    created_at: cajaAbierta.created_at,
                    usuario_nombre: cajaAbierta.usuario_nombre || 'Cajero'
                };
                return [...result, aperturaVirtual];
            }
            
            return result;
        },
        enabled: !!cajaAbierta?.id,
        staleTime: 5000,
    });

    // ── MUTATIONS ────────────────────────────────────────────────────────────

    const registrarMovimientoMutation = useMutation({
        mutationFn: (data) =>
            cajaService.registrarMovimiento({
                caja_id: cajaAbierta.id,
                tipo: tipoMovimiento === 'ingreso' ? 'ingreso' : 'gasto',
                monto: parseFloat(data.monto),
                descripcion: data.concepto,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['caja-resumen'] });
            queryClient.invalidateQueries({ queryKey: ['caja-movimientos'] });
            setShowMovimientoModal(false);
            Swal.fire({ icon: 'success', title: 'Movimiento registrado', timer: 1500, showConfirmButton: false });
        },
        onError: (error) => {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al registrar' });
        },
    });

    const registrarArqueoMutation = useMutation({
        mutationFn: (data) => cajaService.registrarArqueoParcial(cajaAbierta.id, data),
        onSuccess: (data) => {
            setHuboArqueo(true);
            setShowArqueoModal(false);
            const dif = parseFloat(data.arqueo.diferencia);
            Swal.fire({
                icon: dif === 0 ? 'success' : 'warning',
                title: 'Arqueo Registrado',
                html: `Diferencia: <b>S/ ${dif.toFixed(2)}</b><br/>${dif < 0 ? '⚠️ Faltante en caja' : dif > 0 ? '✓ Sobrante en caja' : '✓ Cuadre perfecto'}`,
            });
        },
        onError: (error) => {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al registrar arqueo' });
        },
    });

    const cerrarCajaMutation = useMutation({
        mutationFn: (data) =>
            cajaService.cerrarCaja(cajaAbierta.id, {
                turno: data.turno,
                total_efectivo: resumen?.cards?.efectivo?.monto || 0,
                total_tarjeta: resumen?.cards?.tarjeta?.monto || 0,
                total_otro: (resumen?.cards?.yape?.monto || 0) + (resumen?.cards?.plin?.monto || 0),
                monto_final_real: parseFloat(data.monto_real),
                fondo_reservado_proximo: parseFloat(data.fondo_reservado_proximo || 0),
                observaciones: data.observaciones,
            }),
        onSuccess: (response) => {
            const cierre = response.cierre;

            queryClient.invalidateQueries({ queryKey: ['caja-estado'] });
            queryClient.invalidateQueries({ queryKey: ['caja-resumen'] });
            queryClient.invalidateQueries({ queryKey: ['caja-historial'] });
            queryClient.invalidateQueries({ queryKey: ['caja-fondo-sugerido'] });

            setShowCierreModal(false);
            cierre.turno = cierre.turno || 'manana';

            imprimirReporteCierre(cierre);

            Swal.fire({
                icon: 'success',
                title: 'Caja cerrada',
                text: `Diferencia: S/ ${parseFloat(cierre.diferencia).toFixed(2)}`,
                timer: 2000,
                showConfirmButton: false,
            });

            setHuboArqueo(false); // Resetear para el próximo turno
            onVolver();
        },
        onError: (error) => {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al cerrar' });
        },
    });

    // ── HANDLERS ─────────────────────────────────────────────────────────────

    const handleRegistrarMovimiento = (data) => {
        if (!data.concepto || !data.monto) {
            Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'Completa concepto y monto' });
            return;
        }
        if (parseFloat(data.monto) <= 0) {
            Swal.fire({ icon: 'warning', title: 'Monto inválido', text: 'El monto debe ser mayor a 0' });
            return;
        }
        registrarMovimientoMutation.mutate(data);
    };

    const handleRegistrarArqueo = (data) => {
        registrarArqueoMutation.mutate(data);
    };

    const handleCerrarCaja = async (data) => {
        if (!data.monto_real || parseFloat(data.monto_real) < 0) {
            Swal.fire({ icon: 'warning', title: 'Monto requerido', text: 'Ingresa el monto real contado en caja' });
            return;
        }

        if (!huboArqueo) {
            Swal.fire({
                icon: 'warning',
                title: 'Arqueo requerido',
                text: 'Debes realizar al menos un Corte / Arqueo antes de cerrar el turno.',
                confirmButtonText: 'Entendido',
            });
            return;
        }

        const montoReal = parseFloat(data.monto_real);
        const fondoProximo = parseFloat(data.fondo_reservado_proximo || 0);

        if (fondoProximo > montoReal) {
            Swal.fire({
                icon: 'error',
                title: 'Distribución inválida',
                text: `El fondo para mañana (S/ ${fondoProximo.toFixed(2)}) no puede ser mayor al monto real contado (S/ ${montoReal.toFixed(2)}).`,
            });
            return;
        }

        const saldoEsperado = parseFloat(resumen?.resumen?.saldo_esperado || 0);
        const diferencia = Math.abs(montoReal - saldoEsperado);
        if (diferencia > UMBRAL_DIFERENCIA_ALERTA) {
            const result = await Swal.fire({
                icon: 'warning',
                title: `⚠️ Diferencia alta: S/ ${diferencia.toFixed(2)}`,
                html: `El sistema esperaba <b>S/ ${saldoEsperado.toFixed(2)}</b> y estás cerrando con <b>S/ ${montoReal.toFixed(2)}</b>.<br/><br/>¿Estás seguro de que el monto ingresado es correcto?`,
                showCancelButton: true,
                confirmButtonText: 'Sí, cerrar igual',
                cancelButtonText: 'Revisar monto',
                confirmButtonColor: '#f97316',
                cancelButtonColor: '#6b7280',
            });
            if (!result.isConfirmed) return;
        }

        await queryClient.invalidateQueries({ queryKey: ['caja-resumen'] });

        cerrarCajaMutation.mutate(data);
    };

    // MEJORA SOLICITADA: EXCEL NATIVO EN FORMATO XLSX CON ANCHOS AUTO-AJUSTADOS
    const handleExportarExcel = () => {
        if (!movimientos || movimientos.length === 0) {
            Swal.fire('Vacío', 'No hay movimientos para exportar', 'info');
            return;
        }

        const filtroNombre = filtroMovimientos.tipo !== 'todos' ? `_${filtroMovimientos.tipo}` : '';

        // Formatear la lista de movimientos para el XLSX
        const dataToExport = movimientos.map((mov) => {
            const tipoMostrado = mov.tipo === 'retiro' && mov.monto < 0 ? 'ingreso' : mov.tipo;
            const descripcion = mov.descripcion || (mov.numero_ticket ? `Venta #${mov.numero_ticket}` : '-');
            const metodo = mov.metodo_pago_venta || '-';
            const monto = Math.abs(mov.monto);
            const signo = ['venta', 'ingreso', 'apertura'].includes(tipoMostrado) ? '' : '-';

            return {
                'Fecha': formatSoloFecha(mov.created_at),
                'Hora': formatSoloHora(mov.created_at),
                'Tipo': tipoMostrado.toUpperCase(),
                'Descripción': descripcion,
                'Método de Pago': metodo.toUpperCase(),
                'Monto (S/)': parseFloat(`${signo}${monto}`),
                'Usuario': mov.usuario_nombre || '-'
            };
        });

        // Crear Libro y Hoja de Cálculo
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Movimientos');

        // Autoajustar anchos de columnas basándose en el contenido más largo
        const colsWidth = Object.keys(dataToExport[0] || {}).map(key => {
            let maxLen = key.length;
            dataToExport.forEach(row => {
                const cellValue = String(row[key] || '');
                if (cellValue.length > maxLen) maxLen = cellValue.length;
            });
            return { wch: maxLen + 3 }; // Colchón de 3 caracteres
        });
        worksheet['!cols'] = colsWidth;

        // Generar descarga del archivo XLSX
        XLSX.writeFile(workbook, `Movimientos_Caja${filtroNombre}_${new Date().getTime()}.xlsx`);
    };

    const handleImprimirPDF = () => {
        window.print();
    };

    const imprimirReporteCierre = async (cierre) => {
        const fondo = parseFloat(cierre.monto_inicial || 0);
        const ventasGlobales = parseFloat(cierre.total_ventas || 0);
        const ventasEfectivo = parseFloat(cierre.total_efectivo || 0);
        const ventasTarjeta = parseFloat(cierre.total_tarjeta || 0);
        const ventasDigital = parseFloat(cierre.total_otro || 0);
        const ingresos = parseFloat(cierre.total_ingresos || 0);
        const egresos = parseFloat(cierre.total_gastos || 0) + parseFloat(cierre.total_retiros || 0);
        const esperadoFisico = parseFloat(cierre.monto_final_esperado || 0);
        const realFisico = parseFloat(cierre.monto_final_real || 0);
        const dif = parseFloat(cierre.diferencia || 0);
        const fondoManana = parseFloat(cierre.fondo_reservado_proximo || 0);
        const retiroDueno = parseFloat(cierre.monto_retirado_dueno || 0);
        const turnoStr = String(cierre.turno || 'N/A').toUpperCase();
        const cajeroNombre = cierre.usuario_nombre || cierre.cajero_nombre || cajaAbierta?.usuario_nombre || 'Usuario';

        const contenido = `
══════════════════════════
   REPORTE DE CIERRE
   Turno: ${turnoStr}
══════════════════════════
Fecha: ${formatFechaHora(cierre.created_at)}
Cajero: ${cajeroNombre}
──────────────────────────
📊 1. CONTROL DE VENTAS (TOTAL)
──────────────────────────
Efectivo:           S/ ${ventasEfectivo.toFixed(2)}
Tarjeta:            S/ ${ventasTarjeta.toFixed(2)}
Yape/Plin:          S/ ${ventasDigital.toFixed(2)}
--------------------------
TOTAL VENTAS DÍA:   S/ ${ventasGlobales.toFixed(2)}

──────────────────────────
💵 2. CONTROL DE GAVETA (FÍSICO)
──────────────────────────
Fondo Inicial:      S/ ${fondo.toFixed(2)}
+ Ventas Efectivo:  S/ ${ventasEfectivo.toFixed(2)}
+ Ingresos Extras:  S/ ${ingresos.toFixed(2)}
- Egresos Extras:   S/ ${egresos.toFixed(2)}
--------------------------
SALDO ESPERADO:     S/ ${esperadoFisico.toFixed(2)}
SALDO REAL CONTADO: S/ ${realFisico.toFixed(2)}
--------------------------
DIFERENCIA:         S/ ${dif.toFixed(2)}
${dif < 0 ? '⚠️ FALTANTE' : dif > 0 ? '✓ SOBRANTE' : '✓ CUADRE PERFECTO'}

──────────────────────────
💰 3. DISTRIBUCIÓN DEL EFECTIVO
──────────────────────────
Fondo p/ Mañana:    S/ ${fondoManana.toFixed(2)}
Retiro Dueño:       S/ ${retiroDueno.toFixed(2)}
──────────────────────────
${cierre.observaciones ? `Obs: ${cierre.observaciones}` : ''}
══════════════════════════
        `.trim();

        console.log(contenido);

        Swal.fire({
            title: '🧾 Reporte de Cierre',
            html: `<pre style="text-align:left;font-family:monospace;font-size:11px;white-space:pre-wrap;">${contenido}</pre>`,
            confirmButtonText: '✓ Entendido',
            width: '450px',
        });

        await enviarImpresion('/api/imprimir/reporte-cierre', { cierre });
    };

    const formatMonto = (monto) => `S/ ${parseFloat(monto || 0).toFixed(2)}`;

    // ── RENDER PRINCIPAL ─────────────────────────────────────────────────────

    if (cajaLoading || resumenLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!hayCajaAbierta || !cajaAbierta) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <p className="text-gray-500 font-medium">No se detectó un turno activo de caja.</p>
                <Button onClick={onVolver}>Volver al Historial</Button>
            </div>
        );
    }

    // LÓGICA DE PAGINACIÓN CLIENT-SIDE
    const totalFilas = movimientos?.length || 0;
    const totalPaginas = Math.ceil(totalFilas / filasPorPagina) || 1;
    const indexUltimoItem = paginaActual * filasPorPagina;
    const indexPrimerItem = indexUltimoItem - filasPorPagina;
    const movimientosPaginados = movimientos?.slice(indexPrimerItem, indexUltimoItem) || [];

    return (
        <div className="space-y-6 print:m-0 print:space-y-4">
            {/* Cabecera */}
            <div className="flex items-center justify-between print:hidden">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 font-sans">Caja</h1>
                    <p className="text-gray-500 mt-1">
                        Turno: {cajaAbierta.usuario_nombre} • Apertura:{' '}
                        {formatSoloHora(cajaAbierta.created_at)}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Badge className="bg-green-600">🟢 ABIERTA</Badge>
                    <Button variant="outline" onClick={onVolver}>
                        <ArrowLeft className="h-5 w-5 mr-2" /> Volver al Historial
                    </Button>
                </div>
            </div>

            {/* Cards de resumen por método de pago */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 print:hidden">
                {Object.values(resumen?.cards || {}).map((card) => (
                    <Card key={card.label} className={card.label === 'Total' ? 'border-2 border-blue-500 bg-blue-50' : ''}>
                        <CardContent className="pt-6 text-center">
                            <div className="text-3xl mb-2">{card.icon}</div>
                            <p className="text-sm text-gray-500">{card.label}</p>
                            <p className="text-xl font-bold text-gray-900">{formatMonto(card.monto)}</p>
                            <p className="text-xs text-gray-400">{card.ventas} ventas</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Encabezado solo para impresión */}
            <div className="hidden print:block text-center mb-4">
                <h2 className="text-2xl font-bold">Reporte de Turno en Caja</h2>
                <p className="text-gray-500">
                    Cajero: {cajaAbierta?.usuario_nombre} • Fecha:{' '}
                    {formatSoloFecha(new Date())}
                </p>
                <hr className="my-2 border-gray-300" />
            </div>

            {/* Resumen del turno */}
            <Card className="print:shadow-none print:border-gray-200">
                <CardHeader className="print:pb-2">
                    <CardTitle>📊 Resumen del Turno</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                            <p className="text-sm text-gray-500">Fondo Inicial</p>
                            <p className="font-semibold">{formatMonto(resumen?.resumen?.fondo_inicial)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Ventas (Solo Efectivo)</p>
                            <p className="font-semibold text-blue-600">{formatMonto(resumen?.resumen?.ventas_efectivo)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Ingresos Manuales</p>
                            <p className="font-semibold text-green-600">{formatMonto(resumen?.resumen?.ingresos_manuales)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Egresos Manuales</p>
                            <p className="font-semibold text-red-600">- {formatMonto(resumen?.resumen?.egresos_manuales)}</p>
                        </div>
                        <div className="bg-gray-100 p-2 rounded print:bg-transparent print:border print:border-gray-300">
                            <p className="text-sm text-gray-700 font-medium">Saldo Esperado Físico</p>
                            <p className="font-bold text-lg">{formatMonto(resumen?.resumen?.saldo_esperado)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Botones de acción */}
            <div className="flex flex-wrap gap-3 print:hidden">
                <Button
                    onClick={() => { setTipoMovimiento('ingreso'); setShowMovimientoModal(true); }}
                    className="bg-green-600 hover:bg-green-700"
                >
                    <Plus className="h-5 w-5 mr-2" /> Registrar Ingreso
                </Button>
                <Button
                    onClick={() => { setTipoMovimiento('egreso'); setShowMovimientoModal(true); }}
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                >
                    <Minus className="h-5 w-5 mr-2" /> Registrar Egreso
                </Button>
                <Button
                    onClick={() => setShowArqueoModal(true)}
                    variant="secondary"
                    className="bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                    <Calculator className="h-5 w-5 mr-2" /> Corte / Arqueo
                </Button>
                {!huboArqueo && (
                    <span className="flex items-center text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1 font-medium animate-pulse">
                        ⚠️ Debes hacer un Arqueo antes de cerrar
                    </span>
                )}
                <Button
                    onClick={() => setShowCierreModal(true)}
                    className="bg-orange-600 hover:bg-orange-700 ml-auto"
                >
                    🔒 Cerrar Turno
                </Button>
            </div>

            {/* Tabla de movimientos paginada */}
            <Card className="print:shadow-none print:border-gray-200">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
                    <CardTitle>📋 Historial de Movimientos</CardTitle>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Select
                            value={filtroMovimientos.tipo}
                            onValueChange={(value) => setFiltroMovimientos({ tipo: value })}
                        >
                            <SelectTrigger className="w-40 h-10">
                                <SelectValue placeholder="Filtrar" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos</SelectItem>
                                <SelectItem value="apertura">Apertura</SelectItem>
                                <SelectItem value="venta">Ventas</SelectItem>
                                <SelectItem value="ingreso">Ingresos</SelectItem>
                                <SelectItem value="retiro">Retiros</SelectItem>
                                <SelectItem value="gasto">Gastos</SelectItem>
                                <SelectItem value="cierre">Cierre</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            className="h-10 text-emerald-600 border-emerald-200 hover:bg-emerald-50 whitespace-nowrap font-medium"
                            onClick={handleExportarExcel}
                        >
                            <Download className="h-4 w-4 mr-2" /> Excel 
                        </Button>
                        <Button
                            variant="outline"
                            className="h-10 text-rose-600 border-rose-200 hover:bg-rose-50 whitespace-nowrap font-medium"
                            onClick={handleImprimirPDF}
                        >
                            <Printer className="h-4 w-4 mr-2" /> PDF
                        </Button>
                    </div>
                </CardHeader>

                <div className="hidden print:block px-6 pt-4">
                    <h3 className="text-lg font-bold">Detalle de Operaciones</h3>
                </div>

                <CardContent className="print:px-0">
                    {movimientosLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : movimientos?.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No hay movimientos registrados</p>
                    ) : (
                        <div className="overflow-x-auto print:overflow-visible">
                            <table className="w-full print:text-xs">
                                <thead>
                                    <tr className="border-b print:bg-gray-100">
                                        <th className="text-left py-3 px-4 print:py-2">Fecha</th>
                                        <th className="text-left py-3 px-4 print:py-2">Tipo</th>
                                        <th className="text-left py-3 px-4 print:py-2">Descripción</th>
                                        <th className="text-right py-3 px-4 print:py-2">Monto</th>
                                        <th className="text-left py-3 px-4 print:py-2">Usuario</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movimientosPaginados?.map((mov) => {
                                        const tipoMostrado = mov.tipo === 'retiro' && mov.monto < 0 ? 'ingreso' : mov.tipo;
                                        const montoMostrado = Math.abs(mov.monto);
                                        const signo = ['venta', 'ingreso', 'apertura'].includes(tipoMostrado) ? '+' : '-';
                                        return (
                                            <tr key={mov.id} className="border-b hover:bg-gray-50 print:border-gray-200">
                                                <td className="py-3 px-4 print:py-2 text-sm">
                                                    {formatSoloHora(mov.created_at)}
                                                </td>
                                                <td className="py-3 px-4 print:py-2">
                                                    <Badge
                                                        variant={
                                                            tipoMostrado === 'venta'
                                                                ? 'default'
                                                                : tipoMostrado === 'ingreso'
                                                                    ? 'success'
                                                                    : ['retiro', 'gasto'].includes(tipoMostrado)
                                                                        ? 'destructive'
                                                                        : 'secondary'
                                                        }
                                                        className="print:border-none print:p-0 print:bg-transparent print:text-black"
                                                    >
                                                        {tipoMostrado.toUpperCase()}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4 print:py-2 text-sm">
                                                    {mov.descripcion || (mov.numero_ticket ? `Venta #${mov.numero_ticket}` : '-')}
                                                    {mov.metodo_pago_venta && (
                                                        <span className="block text-xs text-gray-400 print:text-gray-600">
                                                            {mov.metodo_pago_venta.toUpperCase()}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 print:py-2 text-right font-semibold">
                                                    {signo}{formatMonto(montoMostrado)}
                                                </td>
                                                <td className="py-3 px-4 print:py-2 text-sm text-gray-500">
                                                    {mov.usuario_nombre}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* MEJORA SOLICITADA: CONTROLES DE PAGINACIÓN */}
                            {totalPaginas > 1 && (
                                <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 print:hidden">
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
                                                <span className="font-medium">{totalFilas}</span> movimientos
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

            {/* MODALES */}
            <MovimientoModal
                isOpen={showMovimientoModal}
                onClose={() => setShowMovimientoModal(false)}
                tipoMovimiento={tipoMovimiento}
                onRegistrar={handleRegistrarMovimiento}
                isPending={registrarMovimientoMutation.isPending}
            />

            <ArqueoModal
                isOpen={showArqueoModal}
                onClose={() => setShowArqueoModal(false)}
                onRegistrar={handleRegistrarArqueo}
                isPending={registrarArqueoMutation.isPending}
            />

            <CierreModal
                isOpen={showCierreModal}
                onClose={() => setShowCierreModal(false)}
                huboArqueo={huboArqueo}
                resumen={resumen}
                onConfirmar={handleCerrarCaja}
                isPending={cerrarCajaMutation.isPending}
            />
        </div>
    );
});
