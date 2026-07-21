import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Package, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, ClipboardList, Search, RotateCcw } from 'lucide-react';
import Swal from 'sweetalert2';
import { kardexService } from '@/services/kardex.service';
import { productosService } from '@/services/productos.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { formatSoloFecha, formatSoloHora } from '@/utils/formatFecha';

// ── Configuración visual por tipo de movimiento ──────────────────────────────
const TIPO_CONFIG = {
  compra:         { label: 'Compra',         color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: TrendingUp,    signo: '+', signoColor: 'text-emerald-600', esEntrada: true  },
  ajuste_entrada: { label: 'Ajuste Entrada', color: 'bg-blue-100 text-blue-800 border-blue-200',          icon: TrendingUp,    signo: '+', signoColor: 'text-blue-600',    esEntrada: true  },
  reversion:      { label: 'Reversión',      color: 'bg-violet-100 text-violet-800 border-violet-200',    icon: RefreshCw,     signo: '+', signoColor: 'text-violet-600',  esEntrada: true  },
  ajuste:         { label: 'Ajuste',         color: 'bg-cyan-100 text-cyan-800 border-cyan-200',          icon: RefreshCw,     signo: '+', signoColor: 'text-cyan-600',    esEntrada: true  },
  venta:          { label: 'Venta',          color: 'bg-orange-100 text-orange-800 border-orange-200',    icon: TrendingDown,  signo: '-', signoColor: 'text-orange-600',  esEntrada: false },
  salida_cocina:  { label: 'Salida Cocina',  color: 'bg-amber-100 text-amber-800 border-amber-200',       icon: TrendingDown,  signo: '-', signoColor: 'text-amber-600',   esEntrada: false },
  merma:          { label: 'Merma',          color: 'bg-red-100 text-red-800 border-red-200',             icon: AlertTriangle, signo: '-', signoColor: 'text-red-600',     esEntrada: false },
  ajuste_salida:  { label: 'Ajuste Salida',  color: 'bg-rose-100 text-rose-800 border-rose-200',          icon: TrendingDown,  signo: '-', signoColor: 'text-rose-600',    esEntrada: false },
};

const ENTRADAS = ['compra', 'ajuste_entrada', 'reversion', 'ajuste'];
const SALIDAS  = ['venta', 'salida_cocina', 'merma', 'ajuste_salida'];

const getTipoConfig = (tipo) =>
  TIPO_CONFIG[tipo] || { label: tipo, color: 'bg-gray-100 text-gray-700 border-gray-200', icon: ClipboardList, signo: '', signoColor: 'text-gray-600', esEntrada: null };

const formatFecha = (fechaStr) => ({
  fecha: formatSoloFecha(fechaStr),
  hora: formatSoloHora(fechaStr),
});

// ── UTILIDAD: Formato inteligente de números (Quita el .00 si es entero) ───
const formatNumber = (num) => {
  const parsed = parseFloat(num);
  if (isNaN(parsed)) return '0';
  return parsed % 1 === 0 ? parsed.toString() : parsed.toFixed(2);
};

// Calcula saldo acumulado desde stock actual hacia atrás
const calcularSaldos = (movimientos, stockActual) => {
  if (!movimientos.length) return [];

  const primero = movimientos[0];
  if (primero.saldo_actual !== undefined && primero.saldo_actual !== null)
    return movimientos.map(m => ({ ...m, saldo_calculado: parseFloat(m.saldo_actual) }));
  if (primero.saldo_despues !== undefined && primero.saldo_despues !== null)
    return movimientos.map(m => ({ ...m, saldo_calculado: parseFloat(m.saldo_despues) }));

  const resultado = [...movimientos];
  let saldo = parseFloat(stockActual) || 0;
  for (let i = 0; i < resultado.length; i++) {
    resultado[i] = { ...resultado[i], saldo_calculado: saldo };
    const cfg = getTipoConfig(resultado[i].tipo_movimiento);
    const cantidad = parseFloat(resultado[i].cantidad) || 0;
    if (cfg.esEntrada === true)  saldo -= cantidad;
    if (cfg.esEntrada === false) saldo += cantidad;
  }
  return resultado;
};

// Pills de filtro limpiados (Solo los que realmente manejas)
const FILTROS = [
  { value: 'todos',     label: 'Todos'     },
  { value: 'entradas',  label: 'Entradas'  },
  { value: 'salidas',   label: 'Salidas'   },
  { value: 'compra',    label: 'Compra'    },
  { value: 'venta',     label: 'Venta'     },
  { value: 'merma',     label: 'Merma'     },
  { value: 'reversion', label: 'Reversión' },
];

// ── Componente principal ─────────────────────────────────────────────────────
export const KardexProducto = () => {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [limite, setLimite]         = useState(100);

  const { data: producto, isLoading: prodLoading } = useQuery({
    queryKey: ['producto', id],
    queryFn:  () => productosService.getById(id),
    enabled:  !!id,
  });

  const { data: movimientosRaw = [], isLoading: kardexLoading, refetch } = useQuery({
    queryKey: ['kardex-producto', id, limite],
    queryFn:  () => kardexService.getPorProducto(id, limite),
    enabled:  !!id,
    staleTime: 0,
  });

  const revertirMutation = useMutation({
    mutationFn: ({ movId, motivo }) => kardexService.revertir(movId, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries(['kardex-producto', id]);
      queryClient.invalidateQueries(['producto', id]);
      Swal.fire({ icon: 'success', title: '¡Movimiento revertido!', timer: 1800, showConfirmButton: false });
    },
    onError: (error) => {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'No se pudo revertir el movimiento' });
    },
  });

  const handleRevertir = async (mov) => {
    const cfg = getTipoConfig(mov.tipo_movimiento);
    const { fecha, hora } = formatFecha(mov.created_at);

    const { value: motivo, isConfirmed } = await Swal.fire({
      title: '↩ Revertir Movimiento',
      html: `
        <div style="text-align:left;font-size:13px;color:#6b7280;background:#f9fafb;padding:10px 12px;border-radius:8px;margin-bottom:14px;line-height:1.8">
          <div><strong style="color:#374151">Tipo:</strong> ${cfg.label}</div>
          <div><strong style="color:#374151">Cantidad:</strong> ${cfg.signo}${formatNumber(mov.cantidad)} ${mov.unidad_medida}</div>
          <div><strong style="color:#374151">Fecha:</strong> ${fecha} ${hora}</div>
          ${mov.referencia ? `<div><strong style="color:#374151">Referencia:</strong> ${mov.referencia}</div>` : ''}
        </div>
        <label style="display:block;text-align:left;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Motivo de la reversión *</label>
        <input id="motivo-rev" class="swal2-input" placeholder="Ej: Error de registro, corrección de stock..." style="font-size:14px;margin:0;width:100%;">
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#7c3aed',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, revertir',
      cancelButtonText: 'Cancelar',
      focusConfirm: false,
      preConfirm: () => {
        const val = document.getElementById('motivo-rev').value.trim();
        if (!val) { Swal.showValidationMessage('El motivo es requerido'); return false; }
        return val;
      },
    });

    if (isConfirmed && motivo) revertirMutation.mutate({ movId: mov.id, motivo });
  };

  const isLoading  = prodLoading || kardexLoading;
  const movimientos = calcularSaldos(movimientosRaw, producto?.stock_actual);

  const filtrados = movimientos.filter((m) => {
    const matchSearch =
      m.referencia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.usuario_nombre?.toLowerCase().includes(searchTerm.toLowerCase()); // Quitamos la búsqueda por motivo
    const matchTipo =
      filterTipo === 'todos'    ? true :
      filterTipo === 'entradas' ? ENTRADAS.includes(m.tipo_movimiento) :
      filterTipo === 'salidas'  ? SALIDAS.includes(m.tipo_movimiento)  :
      m.tipo_movimiento === filterTipo;
    return matchSearch && matchTipo;
  });

  const totalEntradas = movimientos.filter(m => ENTRADAS.includes(m.tipo_movimiento)).reduce((s, m) => s + parseFloat(m.cantidad || 0), 0);
  const totalSalidas  = movimientos.filter(m => SALIDAS.includes(m.tipo_movimiento)).reduce((s, m)  => s + parseFloat(m.cantidad || 0), 0);

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
    </div>
  );

  if (!producto) return (
    <div className="space-y-4">
      <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Volver</Button>
      <Card><CardContent className="py-12 text-center text-gray-500">Producto no encontrado</CardContent></Card>
    </div>
  );

  const isStockBajo = producto.control_stock && producto.stock_actual <= producto.stock_minimo && producto.stock_actual > 0;
  const isAgotado   = producto.control_stock && producto.stock_actual <= 0;

  return (
    <div className="space-y-6 pb-10">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Volver
          </Button>
          {producto.imagen_url ? (
            <img src={producto.imagen_url} alt={producto.nombre}
              className="w-12 h-12 rounded-xl object-cover border border-gray-200 flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0">
              <Package className="h-6 w-6 text-green-500" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kardex: {producto.nombre}</h1>
            <p className="text-sm text-gray-500 flex items-center gap-2 flex-wrap">
              <span>{producto.categoria_nombre} · {producto.unidad_medida}</span>
              {producto.control_stock && (
                <span className={`font-semibold ${isAgotado ? 'text-red-600' : isStockBajo ? 'text-yellow-600' : 'text-green-700'}`}>
                  {isAgotado ? '🔴' : isStockBajo ? '⚠️' : '🟢'} Stock actual: <strong>{formatNumber(producto.stock_actual)}</strong>
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <select value={limite} onChange={(e) => setLimite(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white">
            <option value={50}>Últimos 50</option>
            <option value={100}>Últimos 100</option>
            <option value={200}>Últimos 200</option>
            <option value={500}>Últimos 500</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Actualizar
          </Button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Movimientos</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{movimientos.length}</p>
        </CardContent></Card>
        <Card className="border-emerald-200 bg-emerald-50/40"><CardContent className="pt-5 pb-4">
          <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Total Entradas</p>
          <p className="text-3xl font-bold text-emerald-700 mt-1">+{formatNumber(totalEntradas)}</p>
        </CardContent></Card>
        <Card className="border-red-200 bg-red-50/40"><CardContent className="pt-5 pb-4">
          <p className="text-xs font-medium text-red-600 uppercase tracking-wide">Total Salidas</p>
          <p className="text-3xl font-bold text-red-600 mt-1">-{formatNumber(totalSalidas)}</p>
        </CardContent></Card>
        <Card className={isAgotado ? 'border-red-300 bg-red-50' : isStockBajo ? 'border-yellow-300 bg-yellow-50' : ''}>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Stock Mínimo</p>
            <p className={`text-3xl font-bold mt-1 ${isAgotado ? 'text-red-600' : isStockBajo ? 'text-yellow-600' : 'text-gray-900'}`}>
              {producto.stock_minimo !== null ? formatNumber(producto.stock_minimo) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* FILTROS */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Buscar por referencia o usuario..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map((f) => {
              const isActive = filterTipo === f.value;
              return (
                <button key={f.value} onClick={() => setFilterTipo(f.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    isActive
                      ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
                  }`}>
                  {f.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* TABLA */}
      <Card>
        <CardContent className="p-0">
          {filtrados.length === 0 ? (
            <div className="py-16 text-center">
              <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No hay movimientos registrados</p>
              <p className="text-gray-400 text-sm mt-1">Prueba cambiando los filtros</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Fecha / Hora</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Tipo</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Cantidad</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Saldo</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Referencia</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Usuario</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtrados.map((mov) => {
                    const cfg = getTipoConfig(mov.tipo_movimiento);
                    const IconComp = cfg.icon;
                    const { fecha, hora } = formatFecha(mov.created_at);
                    const esReversion = mov.reversion_de !== null && mov.reversion_de !== undefined;
                    const yaRevertido = mov.tipo_movimiento === 'reversion';

                    return (
                      <tr key={mov.id}
                        className={`hover:bg-gray-50/80 transition-colors ${esReversion || yaRevertido ? 'bg-violet-50/30' : ''}`}>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <p className="font-semibold text-gray-900 text-[13px]">{fecha}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{hora}</p>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                            <IconComp className="h-3 w-3" />
                            {cfg.label}
                          </span>
                          {esReversion && <p className="text-[10px] text-violet-500 mt-0.5">↩ reversión</p>}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <p className={`font-bold text-[15px] ${cfg.signoColor}`}>
                            {cfg.signo}{formatNumber(mov.cantidad)}
                          </p>
                          <p className="text-xs text-gray-400">{mov.unidad_medida}</p>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <p className="font-semibold text-gray-800">
                            {mov.saldo_calculado !== undefined
                              ? formatNumber(mov.saldo_calculado)
                              : <span className="text-gray-300 font-normal">—</span>}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 max-w-[200px]">
                          <p className="text-gray-700 font-mono text-xs truncate" title={mov.referencia}>
                            {mov.referencia || <span className="text-gray-300">—</span>}
                          </p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="text-gray-700 text-xs font-medium">{mov.usuario_nombre || '—'}</p>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {!esReversion && !yaRevertido ? (
                            <Button variant="ghost" size="sm"
                              onClick={() => handleRevertir(mov)}
                              disabled={revertirMutation.isPending}
                              title="Revertir movimiento"
                              className="text-violet-600 hover:bg-violet-50 hover:text-violet-700 h-8 w-8 p-0">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 rounded-b-lg flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Mostrando <strong>{filtrados.length}</strong> de <strong>{movimientos.length}</strong> movimientos
                </p>
                {filterTipo !== 'todos' && (
                  <button onClick={() => setFilterTipo('todos')} className="text-xs text-blue-600 hover:underline">
                    Ver todos
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};