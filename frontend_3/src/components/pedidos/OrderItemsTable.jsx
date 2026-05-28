import React from 'react';
import { Trash2, Gift } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const OrderItemsTable = React.memo(({
  orden,
  observaciones,
  handleUpdateObservacion,
  handleEliminarDetalle,
  handleCortesia,
  eliminarDetalleMutationIsPending,
  aplicarCortesiaMutationIsPending,
  layout = 'desktop'
}) => {
  if (!orden.detalles || orden.detalles.length === 0) return null;

  if (layout === 'mobile') {
    return (
      <div className="md:hidden space-y-2">
        {orden.detalles.map((detalle) => (
          <div key={detalle.id} className="bg-white border border-gray-100 rounded-xl px-3 py-2.5">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex-1">
                <p className="text-[13px] font-medium text-gray-900 leading-tight">
                  {detalle.es_menu ? `MENÚ: ${detalle.producto_nombre}` : detalle.producto_nombre}
                </p>
                {!detalle.enviado_cocina ? (
                  <input
                    type="text"
                    placeholder="Nota especial..."
                    className="mt-1 w-full text-[11px] p-1.5 border border-blue-100 bg-blue-50/50 rounded-lg outline-none italic"
                    value={observaciones[detalle.id] || ''}
                    onChange={(e) => handleUpdateObservacion(detalle.id, e.target.value)}
                  />
                ) : (
                  detalle.observaciones && (
                    <p className="text-[10px] text-orange-600 font-bold mt-1 italic uppercase">
                      📝 {detalle.observaciones}
                    </p>
                  )
                )}
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                  detalle.enviado_cocina ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {detalle.enviado_cocina ? '✅ Enviado' : '⏳ Pendiente'}
              </span>
            </div>
            {detalle.es_menu && detalle.entrada_incluida && (
              <p className="text-[11px] text-purple-600 mb-1.5">→ {detalle.entrada_incluida.nombre}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-gray-500">
                Cant: <span className="font-medium text-gray-800">{detalle.cantidad}</span>
                {' · '}S/ {parseFloat(detalle.precio || 0).toFixed(2)}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-gray-900">
                  S/ {parseFloat(detalle.subtotal || 0).toFixed(2)}
                </span>
                {!detalle.enviado_cocina && (
                  <button
                    onClick={() => handleEliminarDetalle(detalle.id)}
                    disabled={eliminarDetalleMutationIsPending}
                    className="p-1 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleCortesia(detalle.id)}
                  disabled={aplicarCortesiaMutationIsPending}
                  className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg"
                >
                  <Gift className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Desktop layout (default)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos en la Orden</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-gray-100 text-gray-500">
              <tr>
                <th className="font-medium py-3 px-4">Producto</th>
                <th className="text-center font-medium py-3 px-2">Cant.</th>
                <th className="text-right font-medium py-3 px-4">Precio</th>
                <th className="text-right font-medium py-3 px-4">Subtotal</th>
                <th className="text-center font-medium py-3 px-4">Cocina</th>
                <th className="text-center font-medium py-3 px-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orden.detalles.map((detalle) => (
                <tr key={detalle.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {detalle.es_menu ? `MENÚ: ${detalle.producto_nombre}` : detalle.producto_nombre}
                      </span>
                      {detalle.es_menu && detalle.entrada_incluida && (
                        <span className="block text-xs text-purple-600">→ {detalle.entrada_incluida.nombre}</span>
                      )}
                      {!detalle.enviado_cocina ? (
                        <input
                          type="text"
                          placeholder="Nota (ej. sin ají, pierna...)"
                          className="mt-1 w-full text-[11px] p-1 border-b border-blue-200 bg-blue-50/30 focus:bg-white outline-none italic rounded"
                          value={observaciones[detalle.id] || ''}
                          onChange={(e) => handleUpdateObservacion(detalle.id, e.target.value)}
                        />
                      ) : (
                        detalle.observaciones && (
                          <span className="text-[10px] text-orange-600 font-bold mt-1 uppercase italic">
                            📝 NOTA: {detalle.observaciones}
                          </span>
                        )
                      )}
                    </div>
                  </td>
                  <td className="text-center py-3 px-2">{detalle.cantidad}</td>
                  <td className="text-right py-3 px-4">S/ {parseFloat(detalle.precio || 0).toFixed(2)}</td>
                  <td className="text-right py-3 px-4 font-semibold">S/ {parseFloat(detalle.subtotal || 0).toFixed(2)}</td>
                  <td className="text-center py-3 px-4">
                    <Badge variant={detalle.enviado_cocina ? 'default' : 'secondary'} className="whitespace-nowrap text-[10px]">
                      {detalle.enviado_cocina ? '✅ Enviado' : '⏳ Pendiente'}
                    </Badge>
                  </td>
                  <td className="text-center py-3 px-4">
                    {!detalle.enviado_cocina && (
                      <button
                        onClick={() => handleEliminarDetalle(detalle.id)}
                        disabled={eliminarDetalleMutationIsPending}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleCortesia(detalle.id)}
                      disabled={aplicarCortesiaMutationIsPending}
                      title="Aplicar cortesía"
                      className="p-2 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Gift className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
});

OrderItemsTable.displayName = 'OrderItemsTable';
