import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

export const DashboardLayout = () => {
  // Estado para controlar si el menú está abierto en el celular
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Estado para controlar si el menú está colapsado en la PC
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });

  const handleToggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Overlay oscuro para móviles: si el menú está abierto, oscurece el fondo y al tocarlo se cierra */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Le pasamos el estado al Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen} 
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      
      {/* Contenedor principal: en pantallas grandes (lg) deja un margen a la izquierda dinámico y fluido de forma flotante */}
      <div className={`flex transition-all duration-300 ease-in-out ${isCollapsed ? 'lg:pl-[96px]' : 'lg:pl-[272px]'} min-h-screen lg:h-screen`}>
        {/* Tarjeta flotante de altura fija: Navbar fijo arriba + contenido scrollable abajo */}
        <div className="flex flex-col flex-1 lg:my-3 lg:mr-3 lg:bg-white lg:rounded-2xl lg:border lg:border-gray-200/80 lg:shadow-lg lg:shadow-slate-900/5 overflow-hidden">
          {/* Navbar fijo en la cima de la tarjeta (no scrollea) */}
          <div className="shrink-0">
            <Navbar onMenuClick={() => setSidebarOpen(true)} />
          </div>
          
          {/* Solo el contenido de la página scrollea dentro de la tarjeta */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};