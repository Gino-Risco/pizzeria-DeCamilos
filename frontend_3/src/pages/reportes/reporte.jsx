import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Wallet
} from 'lucide-react';
import {reportesService} from '@/services/reportes.service';
import { formatFechaSoloDia } from '@/utils/formatFecha';
// Asume que tienes configurado axios o tu propia instancia de api
// import api from '@/lib/api'; 

export const ReportesPage = () => {
  // Configurar fechas por defecto (Ej: Primer día del mes actual hasta hoy)
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  
  const [fechaDesde, setFechaDesde] = useState(primerDiaMes.toISOString().split('T')[0]);
  const [fechaHasta, setFechaHasta] = useState(hoy.toISOString().split('T')[0]);
  const [agruparPor, setAgruparPor] = useState('dia'); // dia, semana, mes
  
  const [data, setData] = useState([]);
  const [resumen, setResumen] = useState({ ingresos: 0, costos: 0, ganancia: 0, margen: 0 });
  const [loading, setLoading] = useState(false);

  const fetchRentabilidad = async () => {
    setLoading(true);
    try {
      // 2. Llamamos a la API usando tu propia arquitectura
      const reportes = await reportesService.getRentabilidad(fechaDesde, fechaHasta, agruparPor);
      
      setData(reportes);
      
      // Calculamos los totales
      const totIngresos = reportes.reduce((acc, curr) => acc + parseFloat(curr.ingresos_brutos), 0);
      const totCostos = reportes.reduce((acc, curr) => acc + parseFloat(curr.costo_insumos), 0);
      const totGanancia = reportes.reduce((acc, curr) => acc + parseFloat(curr.ganancia_neta), 0);
      const totMargen = totIngresos > 0 ? (totGanancia / totIngresos) * 100 : 0;

      setResumen({
        ingresos: totIngresos,
        costos: totCostos,
        ganancia: totGanancia,
        margen: totMargen
      });
      
    } catch (error) {
      console.error("Error cargando el reporte:", error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos cuando cambian los filtros
  useEffect(() => {
    fetchRentabilidad();
  }, [fechaDesde, fechaHasta, agruparPor]);

  // Formateador de moneda
  const formatoMoneda = (valor) => `S/ ${parseFloat(valor).toFixed(2)}`;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER Y FILTROS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="text-red-500 h-6 w-6" />
            Reporte de Rentabilidad
          </h1>
          <p className="text-slate-500 text-sm">Analiza tus ingresos, costos y ganancias reales.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input 
              type="date" 
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="text-sm border-none focus:ring-0 text-slate-600 bg-transparent"
            />
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="text-sm border-none focus:ring-0 text-slate-600 bg-transparent"
            />
          </div>
          <span className="text-slate-300">|</span>
          <select 
            value={agruparPor}
            onChange={(e) => setAgruparPor(e.target.value)}
            className="text-sm border-none focus:ring-0 text-slate-600 bg-transparent cursor-pointer font-medium"
          >
            <option value="dia">Por Día</option>
            <option value="semana">Por Semana</option>
            <option value="mes">Por Mes</option>
          </select>
        </div>
      </div>

      {/* TARJETAS DE RESUMEN (DASHBOARD) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Ingresos Brutos</p>
            <h3 className="text-2xl font-bold text-slate-800">{formatoMoneda(resumen.ingresos)}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Costo de Insumos</p>
            <h3 className="text-2xl font-bold text-slate-800">{formatoMoneda(resumen.costos)}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Ganancia Neta</p>
            <h3 className="text-2xl font-bold text-slate-800">{formatoMoneda(resumen.ganancia)}</h3>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl shadow-md flex items-center gap-4 text-white">
          <div className="h-12 w-12 rounded-full bg-slate-700 flex items-center justify-center">
            {resumen.margen >= 50 ? <TrendingUp className="h-6 w-6 text-emerald-400" /> : <TrendingDown className="h-6 w-6 text-orange-400" />}
          </div>
          <div>
            <p className="text-sm text-slate-300 font-medium">Margen Promedio</p>
            <h3 className="text-2xl font-bold text-white">{resumen.margen.toFixed(1)}%</h3>
          </div>
        </div>
      </div>

      {/* TABLA DE DETALLES */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Desglose por {agruparPor}</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="px-6 py-4">Periodo</th>
                <th className="px-6 py-4 text-right">Ingresos</th>
                <th className="px-6 py-4 text-right">Costos</th>
                <th className="px-6 py-4 text-right">Ganancia Neta</th>
                <th className="px-6 py-4 text-center">Margen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                    Calculando rentabilidad...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                    No hay ventas registradas en este periodo.
                  </td>
                </tr>
              ) : (
                data.map((fila, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {formatFechaSoloDia(fila.periodo, { month: 'short' })}
                    </td>
                    <td className="px-6 py-4 text-right">{formatoMoneda(fila.ingresos_brutos)}</td>
                    <td className="px-6 py-4 text-right text-red-500">{formatoMoneda(fila.costo_insumos)}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatoMoneda(fila.ganancia_neta)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        fila.margen_porcentaje >= 50 ? 'bg-emerald-100 text-emerald-700' : 
                        fila.margen_porcentaje >= 30 ? 'bg-orange-100 text-orange-700' : 
                        'bg-red-100 text-red-700'
                      }`}>
                        {fila.margen_porcentaje}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};