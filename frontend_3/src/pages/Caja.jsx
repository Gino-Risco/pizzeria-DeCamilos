import { useState } from 'react';
import { VistaDashboard } from '@/components/caja/VistaDashboard';
import { VistaHistorial } from '@/components/caja/VistaHistorial';

export const Caja = () => {
    const [vista, setVista] = useState('historial');

    if (vista === 'dashboard') {
        return <VistaDashboard onVolver={() => setVista('historial')} />;
    }

    return <VistaHistorial onIrADashboard={() => setVista('dashboard')} />;
};
