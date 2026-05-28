import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const MovimientoModal = React.memo(({
    isOpen,
    onClose,
    tipoMovimiento,
    onRegistrar,
    isPending
}) => {
    const [concepto, setConcepto] = useState('');
    const [monto, setMonto] = useState('');

    // Reiniciar campos cuando se abre o cierra
    useEffect(() => {
        if (isOpen) {
            setConcepto('');
            setMonto('');
        }
    }, [isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onRegistrar({ concepto, monto });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {tipoMovimiento === 'ingreso' ? '💵 Registrar Ingreso' : '💸 Registrar Egreso'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="concepto">Concepto</Label>
                        <Input
                            id="concepto"
                            value={concepto}
                            onChange={(e) => setConcepto(e.target.value)}
                            placeholder={tipoMovimiento === 'ingreso' ? 'Ej: Cliente devuelve adelanto' : 'Ej: Compra de bolsas'}
                            required
                        />
                    </div>
                    <div>
                        <Label htmlFor="monto">Monto (S/)</Label>
                        <Input
                            id="monto"
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                            placeholder="0.00"
                            required
                        />
                    </div>
                    <p className="text-xs text-gray-500">
                        ℹ️ Los movimientos manuales se registran solo en efectivo
                    </p>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className={tipoMovimiento === 'ingreso' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                            disabled={isPending}
                        >
                            {isPending ? 'Registrando...' : 'Registrar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
});
