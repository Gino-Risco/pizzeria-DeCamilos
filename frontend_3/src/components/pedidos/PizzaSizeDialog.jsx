import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export const PizzaSizeDialog = React.memo(({ pizzaSeleccionada, onClose, onSelectVariant }) => {
  return (
    <Dialog open={!!pizzaSeleccionada} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>🍕 Elige el tamaño para: {pizzaSeleccionada?.nombreBase}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-3">
          {pizzaSeleccionada?.variantes?.map((variante) => {
            const tamano = variante.nombre.split(' - ')[1] || variante.nombre;
            return (
              <button
                key={variante.id}
                onClick={() => {
                  onSelectVariant(variante);
                  onClose();
                }}
                className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 active:scale-[0.98] transition-all text-left group"
              >
                <div>
                  <p className="font-semibold text-gray-900 text-base group-hover:text-orange-700">{tamano}</p>
                  <p className="text-xs text-gray-400">{pizzaSeleccionada?.nombreBase}</p>
                </div>
                <span className="text-lg font-bold text-blue-600">S/ {variante.precio_venta.toFixed(2)}</span>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

PizzaSizeDialog.displayName = 'PizzaSizeDialog';
