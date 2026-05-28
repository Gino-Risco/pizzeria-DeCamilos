import React from 'react';
import { Plus } from 'lucide-react';

export const ProductCard = React.memo(({ item, onSelect, layout = 'desktop' }) => {
  if (layout === 'mobile') {
    return (
      <button
        onClick={() => onSelect(item)}
        className="p-3 border border-gray-200 rounded-xl bg-white text-left active:scale-95 transition-transform"
      >
        <p className="font-medium text-[13px] text-gray-900 leading-tight mb-1">
          {item.variantes ? item.nombreBase : item.nombre}
        </p>
        <p className="text-[11px] text-gray-400 mb-2">{item.categoria_nombre}</p>
        <div className="flex items-center justify-between">
          {item.variantes ? (
            <span className="text-[13px] font-semibold text-orange-500">Ver Tamaños →</span>
          ) : (
            <span className="text-[14px] font-semibold text-blue-700">S/ {item.precio_venta.toFixed(2)}</span>
          )}
          <span className="w-6 h-6 rounded-md bg-[#1e3a5f] flex items-center justify-center">
            <Plus className="h-3.5 w-3.5 text-white" />
          </span>
        </div>
      </button>
    );
  }

  // Desktop layout (default)
  return (
    <button
      onClick={() => onSelect(item)}
      className="border border-gray-200 rounded-lg hover:border-orange-400 hover:shadow-md transition-all text-left overflow-hidden flex flex-col"
    >
      {/* Imagen (solo para productos individuales) */}
      {!item.variantes && item.imagen_url ? (
        <div className="w-full h-28 bg-gray-50 overflow-hidden flex-shrink-0">
          <img
            src={item.imagen_url}
            alt={item.nombre}
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement.classList.add('hidden');
            }}
          />
        </div>
      ) : (
        <div className="w-full h-28 bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center flex-shrink-0">
          <span className="text-4xl">{item.variantes ? '🍕' : '🍽️'}</span>
        </div>
      )}
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight">
          {item.variantes ? item.nombreBase : item.nombre}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">{item.categoria_nombre}</p>
        {item.variantes ? (
          <p className="text-sm font-semibold text-orange-500 mt-auto pt-2">Ver Tamaños →</p>
        ) : (
          <p className="text-base font-bold text-blue-600 mt-auto pt-2">S/ {item.precio_venta.toFixed(2)}</p>
        )}
      </div>
    </button>
  );
});

ProductCard.displayName = 'ProductCard';
