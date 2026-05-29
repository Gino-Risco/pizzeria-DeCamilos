import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  Receipt,
  Package,
  LogOut,
  ChefHat,
  Database,
  BarChart3,
  TrendingUp,
  Truck,
  Users,
  AlertTriangle,
  History,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Utensils,
  FileText
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

// Menú Unificado en orden lógico (Operativo -> Financiero -> Administrativo -> Logístico -> Reportes)
const menuItems = [
  // 1. Grupo Operaciones / Salón (FOH)
  {
    type: 'link',
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    roles: ['administrador', 'cajero', 'mesero'],
    color: 'text-blue-400'
  },
  {
    type: 'link',
    title: 'Mesas',
    icon: UtensilsCrossed,
    path: '/mesas',
    roles: ['administrador', 'cajero', 'mesero'],
    color: 'text-green-400'
  },
  {
    type: 'link',
    title: 'Pedidos',
    icon: Receipt,
    path: '/pedidos',
    roles: ['administrador', 'cajero', 'mesero'],
    color: 'text-purple-400'
  },
  {
    type: 'link',
    title: 'Cocina',
    icon: ChefHat,
    path: '/cocina',
    roles: ['administrador', 'mesero'],
    color: 'text-orange-400'
  },
  // 2. Grupo Finanzas y Caja
  {
    type: 'link',
    title: 'Caja',
    icon: Receipt,
    path: '/caja',
    roles: ['administrador', 'cajero'],
    color: 'text-emerald-400'
  },
  {
    type: 'accordion',
    title: 'Ventas',
    icon: ShoppingBag,
    roles: ['administrador', 'cajero'],
    color: 'text-pink-400',
    subMenuKey: 'ventas',
    items: [
      {
        title: 'Cobrar Mesa',
        icon: ShoppingBag,
        path: '/ventas',
        roles: ['administrador', 'cajero'],
        color: 'text-pink-400'
      },
      {
        title: 'Historial',
        icon: FileText,
        path: '/historial-ventas',
        roles: ['administrador', 'cajero'],
        color: 'text-pink-300'
      }
    ]
  },
  // 3. Grupo Administración y Catálogo
  {
    type: 'accordion',
    title: 'Productos',
    icon: Package,
    roles: ['administrador'],
    color: 'text-cyan-400',
    subMenuKey: 'productos',
    items: [
      {
        title: 'Carta / Platos',
        icon: Utensils,
        path: '/productos/carta',
        roles: ['administrador'],
        color: 'text-cyan-400'
      },
      {
        title: 'Almacén / Insumos',
        icon: Package,
        path: '/productos/almacen',
        roles: ['administrador'],
        color: 'text-blue-400'
      }
    ]
  },
  {
    type: 'link',
    title: 'Categorías',
    icon: Database,
    path: '/categorias',
    roles: ['administrador'],
    color: 'text-indigo-400'
  },
  // 4. Grupo Logística e Inventario (BOH)
  {
    type: 'accordion',
    title: 'Inventario',
    icon: TrendingUp,
    roles: ['administrador'],
    color: 'text-indigo-400',
    subMenuKey: 'inventario',
    items: [
      {
        title: 'Compras',
        icon: Truck,
        path: '/inventario/compras',
        roles: ['administrador'],
        color: 'text-blue-400'
      },
      {
        title: 'Proveedores',
        icon: Users,
        path: '/inventario/proveedores',
        roles: ['administrador'],
        color: 'text-green-400'
      },
      {
        title: 'Salidas Cocina',
        icon: ChefHat,
        path: '/inventario/salidas-cocina',
        roles: ['administrador'],
        color: 'text-orange-400'
      },
      {
        title: 'Alertas de Stock',
        icon: AlertTriangle,
        path: '/inventario/alertas',
        roles: ['administrador', 'cocinero'],
        color: 'text-red-400'
      },
      {
        title: 'Kardex',
        icon: History,
        path: '/inventario/kardex',
        roles: ['administrador'],
        color: 'text-purple-400'
      }
    ]
  },
  // 5. Grupo Control y Configuración
  {
    type: 'link',
    title: 'Reportes',
    icon: BarChart3,
    path: '/reportes',
    roles: ['administrador'],
    color: 'text-red-400'
  },
  {
    type: 'link',
    title: 'Usuarios',
    icon: Users,
    path: '/usuarios',
    roles: ['administrador'],
    color: 'text-indigo-400'
  }
];

export const Sidebar = ({ isOpen, setIsOpen, isCollapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const [isVentasOpen, setIsVentasOpen] = useState(false);
  const [isProductosOpen, setIsProductosOpen] = useState(false);
  const [isInventarioOpen, setIsInventarioOpen] = useState(false);

  const canAccessMenu = (roles) => {
    if (!user) return false;
    return roles.includes(user.rol);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLinkClick = () => {
    if (setIsOpen) setIsOpen(false);
  };

  const accordionStates = {
    ventas: { value: isVentasOpen, setValue: setIsVentasOpen },
    productos: { value: isProductosOpen, setValue: setIsProductosOpen },
    inventario: { value: isInventarioOpen, setValue: setIsInventarioOpen }
  };

  const handleAccordionClick = (key) => {
    const { value, setValue } = accordionStates[key];
    if (isCollapsed) {
      // Si el sidebar está colapsado, expandirlo primero de forma fluida
      onToggleCollapse();
      // Y forzar a abrir el acordeón de submenús
      setValue(true);
    } else {
      setValue(!value);
    }
  };

  const isVentasActive = menuItems.find(i => i.subMenuKey === 'ventas')?.items.some(sub => location.pathname === sub.path);
  const isProductosActive = menuItems.find(i => i.subMenuKey === 'productos')?.items.some(sub => location.pathname === sub.path);
  const isInventarioActive = menuItems.find(i => i.subMenuKey === 'inventario')?.items.some(sub => location.pathname === sub.path);

  const getAccordionActiveState = (key) => {
    if (key === 'ventas') return isVentasActive;
    if (key === 'productos') return isProductosActive;
    if (key === 'inventario') return isInventarioActive;
    return false;
  };

  return (
    <aside
      className={cn(
        "fixed z-40 bg-slate-800 border-r border-slate-700 transition-all duration-300 ease-in-out lg:translate-x-0 shadow-xl shadow-slate-900/30",
        isCollapsed 
          ? "lg:w-20 lg:h-[calc(100vh-24px)] lg:m-3 lg:rounded-2xl lg:border border-slate-700/50" 
          : "lg:w-64 lg:h-[calc(100vh-24px)] lg:m-3 lg:rounded-2xl lg:border border-slate-700/50",
        isOpen 
          ? "translate-x-0 w-64 h-screen top-0 left-0 rounded-r-2xl border-r border-slate-700" 
          : "-translate-x-full lg:translate-x-0 top-0 left-0 h-screen lg:h-[calc(100vh-24px)]"
      )}
    >
      <div className="flex flex-col h-full relative">
        {/* Botón flotante para colapsar visible únicamente en pantallas grandes, situado exactamente en el borde lateral */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute -right-3 top-8 z-50 h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-slate-400 border border-slate-700 shadow-md hover:bg-slate-700 hover:text-white hover:scale-110 transition-all duration-200"
          title={isCollapsed ? "Expandir menú" : "Contraer menú"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        {/* Logo Section con alineación centralizada al colapsar */}
        <div className="h-20 flex items-center px-4 border-b border-slate-700 shrink-0">
          <div className={cn("flex items-center gap-3 overflow-hidden transition-all duration-300", isCollapsed ? "mx-auto justify-center" : "w-auto")}>
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shrink-0">
              <span className="text-white font-bold text-lg">POS</span>
            </div>
            <div className={cn("transition-all duration-300", isCollapsed ? "lg:opacity-0 lg:w-0 lg:h-0 overflow-hidden" : "opacity-100 w-auto")}>
              <h1 className="text-white font-bold text-sm leading-tight whitespace-nowrap">D' Camilos</h1>
              <p className="text-xs text-slate-400 font-medium">v1.0.2</p>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className={cn(
          "flex-1 space-y-1 overflow-y-auto custom-scrollbar transition-all duration-300",
          isCollapsed ? "lg:p-2 lg:py-4 p-3" : "p-3"
        )}>
          {menuItems.map((item, idx) => {
            if (!canAccessMenu(item.roles)) return null;

            if (item.type === 'link') {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path || idx}
                  to={item.path}
                  onClick={handleLinkClick}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white',
                      isCollapsed && "lg:justify-center lg:px-0 lg:h-11 lg:w-11 lg:mx-auto"
                    )
                  }
                  title={isCollapsed ? item.title : undefined}
                >
                  <item.icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-white' : item.color)} />
                  <span className={cn('transition-all duration-300 whitespace-nowrap', isCollapsed ? 'lg:hidden' : 'inline')}>
                    {item.title}
                  </span>
                </NavLink>
              );
            }

            if (item.type === 'accordion') {
              const { value: isSubOpen } = accordionStates[item.subMenuKey];
              const isParentActive = getAccordionActiveState(item.subMenuKey);

              return (
                <div key={item.subMenuKey || idx} className="space-y-1">
                  <button
                    onClick={() => handleAccordionClick(item.subMenuKey)}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                      isParentActive || isSubOpen
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white',
                      isCollapsed && "lg:justify-center lg:px-0 lg:h-11 lg:w-11 lg:mx-auto"
                    )}
                    title={isCollapsed ? item.title : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn('h-5 w-5 shrink-0', isParentActive || isSubOpen ? item.color : 'text-slate-400')} />
                      <span className={cn('transition-all duration-300 whitespace-nowrap', isCollapsed ? 'lg:hidden' : 'inline')}>
                        {item.title}
                      </span>
                    </div>
                    <div className={cn(isCollapsed ? 'lg:hidden' : 'block')}>
                      {isSubOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    </div>
                  </button>

                  {isSubOpen && !isCollapsed && (
                    <div className="ml-4 pl-4 border-l-2 border-slate-600 space-y-1 mt-1">
                      {item.items.map((subItem, sIdx) => {
                        if (!canAccessMenu(subItem.roles)) return null;
                        const isSubActive = location.pathname === subItem.path;
                        return (
                          <NavLink
                            key={subItem.path || sIdx}
                            to={subItem.path}
                            onClick={handleLinkClick}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                                isActive ? 'bg-slate-700 text-pink-400' : 'text-slate-400 hover:text-white'
                              )
                            }
                          >
                            <subItem.icon className={cn('h-4 w-4 shrink-0', isSubActive ? subItem.color : 'text-slate-400')} />
                            <span className="whitespace-nowrap">{subItem.title}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
        </nav>

        {/* Logout Section con bordes redondeados adaptables */}
        <div className={cn("p-3 border-t border-slate-700 shrink-0 bg-slate-800", !isCollapsed && "lg:rounded-b-2xl")}>
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all duration-200",
              isCollapsed && "lg:justify-center lg:px-0 lg:h-11 lg:w-11 lg:mx-auto"
            )}
            title={isCollapsed ? "Cerrar Sesión" : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={cn("transition-all duration-300 whitespace-nowrap", isCollapsed ? "lg:hidden" : "inline")}>
              Cerrar Sesión
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};