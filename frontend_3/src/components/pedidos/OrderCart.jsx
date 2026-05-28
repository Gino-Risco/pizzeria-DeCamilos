import React from 'react';
import { ChefHat, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const OrderCart = React.memo(({
  selectedProductos,
  productos,
  esOrdenParaLlevar,
  handleAgregarEmpaque,
  handleActualizarCantidad,
  handleRemoverProducto,
  handleGuardarOrden,
  isPending,
  totalCarrito,
  layout = 'desktop'
}) => {
  if (layout === 'mobile') {
    if (selectedProductos.length === 0) return null;

    return (
      <div className="border border-green-200 rounded-xl overflow-hidden">
        <div className="bg-white divide-y divide-gray-100">
          {selectedProductos.map((item) => {
            const producto = productos?.find(p => p.id === item.producto_id);
            const nombreMostrar = item._esTemporal ? item._nombreTemporal : producto?.nombre;
            return (
              <div key={item.producto_id} className={`flex items-center gap-2 px-3 py-2 ${item._esTemporal ? 'bg-orange-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-900 truncate">{nombreMostrar}</p>
                  {item.es_menu && item.entrada_incluida && (
                    <p className="text-[11px] text-purple-600">Incluye: {item.entrada_incluida.nombre}</p>
                  )}
                  {item._esTemporal && (
                    <span className="text-[10px] text-orange-500 font-medium">🥡 Empaque</span>
                  )}
                  <p className="text-[12px] text-gray-500">S/ {parseFloat(item.precio).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleActualizarCantidad(item.producto_id, item.cantidad - 1)}
                    className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-medium"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{item.cantidad}</span>
                  <button
                    onClick={() => handleActualizarCantidad(item.producto_id, item.cantidad + 1)}
                    className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-medium"
                  >
                    +
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[13px] font-semibold text-gray-900 min-w-[52px] text-right">
                    S/ {(parseFloat(item.precio) * item.cantidad).toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleRemoverProducto(item.producto_id)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="bg-green-50 px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-green-700 text-white text-[11px] font-medium px-2 py-0.5 rounded-full">
              {selectedProductos.reduce((s, p) => s + p.cantidad, 0)} items
            </span>
            <span className="text-blue-700 font-semibold text-sm">S/ {totalCarrito.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {esOrdenParaLlevar && (
              <button
                onClick={handleAgregarEmpaque}
                className="bg-orange-100 text-orange-700 border border-orange-300 text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1"
              >
                🥡 Empaque
              </button>
            )}
            <button
              onClick={handleGuardarOrden}
              disabled={isPending}
              className="bg-green-700 text-white text-xs font-medium px-4 py-2 rounded-lg"
            >
              {isPending ? '...' : 'Agregar a la orden'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop layout (default)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChefHat className="h-5 w-5 text-green-600" /> Productos Agregados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedProductos.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay productos agregados</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {selectedProductos.map((item) => {
              const producto = productos?.find(p => p.id === item.producto_id);
              const nombreMostrar = item._esTemporal ? item._nombreTemporal : producto?.nombre;
              return (
                <div
                  key={item.producto_id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    item._esTemporal ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{nombreMostrar}</p>
                      {item.es_menu && <Badge className="bg-purple-600 text-white">MENÚ</Badge>}
                      {item._esTemporal && <Badge className="bg-orange-400 text-white text-[10px]">Empaque</Badge>}
                    </div>
                    {item.es_menu && item.entrada_incluida && (
                      <p className="text-xs text-purple-600 mt-1">Incluye: {item.entrada_incluida.nombre}</p>
                    )}
                    <p className="text-sm text-gray-500">S/ {parseFloat(item.precio).toFixed(2)} x {item.cantidad}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleActualizarCantidad(item.producto_id, item.cantidad - 1)}
                      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-semibold">{item.cantidad}</span>
                    <button
                      onClick={() => handleActualizarCantidad(item.producto_id, item.cantidad + 1)}
                      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                    >
                      +
                    </button>
                    <button
                      onClick={() => handleRemoverProducto(item.producto_id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* Botón de empaque: visible SIEMPRE que sea para llevar, sin importar si hay carrito */}
        {esOrdenParaLlevar && (
          <div className={`${selectedProductos.length > 0 ? '' : 'py-2'}`}>
            <button
              onClick={handleAgregarEmpaque}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-orange-300 text-orange-600 hover:bg-orange-50 hover:border-orange-400 rounded-lg py-2.5 text-sm font-medium transition-all"
            >
              🥡 Agregar Descartable / Empaque
            </button>
          </div>
        )}
        {selectedProductos.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total:</span>
              <span className="text-2xl font-bold text-blue-600">S/ {totalCarrito.toFixed(2)}</span>
            </div>
            <Button
              onClick={handleGuardarOrden}
              disabled={isPending}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-5 w-5 mr-2" />
              {isPending ? 'Agregando...' : 'Agregar a la Orden'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

OrderCart.displayName = 'OrderCart';
