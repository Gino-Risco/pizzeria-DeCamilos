import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet } from 'lucide-react';

export const CierreModal = React.memo(({
    isOpen,
    onClose,
    huboArqueo,
    resumen,
    onConfirmar,
    isPending
}) => {
    const [turno, setTurno] = useState('manana');
    const [montoReal, setMontoReal] = useState('');
    const [fondoReservadoProximo, setFondoReservadoProximo] = useState('');
    const [observaciones, setObservaciones] = useState('');

    useEffect(() => {
        if (isOpen) {
            setTurno('manana');
            setMontoReal('');
            setFondoReservadoProximo('');
            setObservaciones('');
        }
    }, [isOpen]);

    const formatMonto = (monto) => `S/ ${parseFloat(monto || 0).toFixed(2)}`;

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirmar({
            turno,
            monto_real: montoReal,
            fondo_reservado_proximo: fondoReservadoProximo,
            observaciones
        });
    };

    const saldoEsperado = parseFloat(resumen?.resumen?.saldo_esperado || 0);
    const diferencia = montoReal !== '' ? parseFloat(montoReal) - saldoEsperado : 0;
    const utilidadDueno = (montoReal !== '' ? parseFloat(montoReal) : 0) - (fondoReservadoProximo !== '' ? parseFloat(fondoReservadoProximo) : 0);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>🔒 Cerrar Turno</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {!huboArqueo && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg p-3 text-amber-800 text-sm">
                            <span className="text-lg leading-none">⚠️</span>
                            <span>
                                Aún no has realizado un <strong>Corte / Arqueo</strong> en este turno.
                                Cierra este modal y registra el arqueo primero.
                            </span>
                        </div>
                    )}

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <Label htmlFor="cierre_turno">Turno</Label>
                            <Select value={turno} onValueChange={setTurno}>
                                <SelectTrigger id="cierre_turno">
                                    <SelectValue placeholder="Selecciona turno" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="manana">🌅 Mañana</SelectItem>
                                    <SelectItem value="tarde">🌙 Tarde</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1">
                            <Label htmlFor="monto_real">Monto Real Contado (S/)</Label>
                            <Input
                                id="monto_real"
                                type="number"
                                step="0.01"
                                min="0"
                                value={montoReal}
                                onChange={(e) => setMontoReal(e.target.value)}
                                placeholder="Total en caja"
                                required
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
                        <h4 className="font-semibold text-orange-800 flex items-center">
                            <Wallet className="w-4 h-4 mr-2" /> Distribución del Dinero Físico
                        </h4>
                        <div>
                            <Label className="text-orange-900" htmlFor="fondo_reservado_proximo">
                                ¿Cuánto dinero dejará en caja para mañana? (S/)
                            </Label>
                            <Input
                                id="fondo_reservado_proximo"
                                type="number"
                                step="0.01"
                                min="0"
                                max={montoReal || 0}
                                value={fondoReservadoProximo}
                                onChange={(e) => setFondoReservadoProximo(e.target.value)}
                                placeholder="Ej: 200.00"
                            />
                        </div>
                        {montoReal !== '' && fondoReservadoProximo !== '' && (
                            <>
                                {parseFloat(fondoReservadoProximo) > parseFloat(montoReal) && (
                                    <p className="text-xs text-red-600">
                                        ⚠️ El fondo para mañana supera el monto real contado.
                                    </p>
                                )}
                                <div className="pt-2 border-t border-orange-200 flex justify-between text-orange-900 font-medium">
                                    <span>Retiro del Dueño (Utilidad):</span>
                                    <span className="text-lg">
                                        S/ {utilidadDueno.toFixed(2)}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Saldo Esperado:</span>
                            <span className="font-semibold">{formatMonto(saldoEsperado)}</span>
                        </div>
                        {montoReal !== '' && (
                            <div
                                className={`flex justify-between p-2 rounded ${diferencia < 0
                                    ? 'bg-red-50 text-red-700'
                                    : diferencia > 0
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-blue-50 text-blue-700'
                                    }`}
                            >
                                <span>Diferencia con sistema:</span>
                                <span className="font-bold">
                                    {formatMonto(diferencia)}
                                </span>
                            </div>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="cierre_observaciones">Observaciones (opcional)</Label>
                        <Input
                            id="cierre_observaciones"
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            placeholder="Ej: Faltante por cambio mal dado"
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                            disabled={isPending || !huboArqueo}
                        >
                            {isPending ? 'Cerrando...' : '🔒 Confirmar Cierre'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
});
