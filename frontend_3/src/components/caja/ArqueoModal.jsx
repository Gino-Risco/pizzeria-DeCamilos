import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const ArqueoModal = React.memo(({
    isOpen,
    onClose,
    onRegistrar,
    isPending
}) => {
    const [montoContado, setMontoContado] = useState('');
    const [observaciones, setObservaciones] = useState('');

    useEffect(() => {
        if (isOpen) {
            setMontoContado('');
            setObservaciones('');
        }
    }, [isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onRegistrar({
            monto_contado: parseFloat(montoContado),
            observaciones
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>⚖️ Corte / Arqueo de Caja</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Ingresa cuánto dinero físico hay en la caja en este momento. El sistema calculará
                        la diferencia sin cerrar el turno.
                    </p>
                    <div>
                        <Label htmlFor="monto_contado">Monto Contado en Efectivo (S/)</Label>
                        <Input
                            id="monto_contado"
                            type="number"
                            step="0.01"
                            min="0"
                            value={montoContado}
                            onChange={(e) => setMontoContado(e.target.value)}
                            placeholder="0.00"
                            required
                        />
                    </div>
                    <div>
                        <Label htmlFor="observaciones_arqueo">Observaciones (opcional)</Label>
                        <Input
                            id="observaciones_arqueo"
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={isPending}
                        >
                            {isPending ? 'Verificando...' : 'Registrar Arqueo'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
});
