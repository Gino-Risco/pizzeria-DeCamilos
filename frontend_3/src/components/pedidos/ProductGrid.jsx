import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductCard } from './ProductCard';

export const ProductGrid = React.memo(({
  productosMostrar,
  searchTerm,
  setSearchTerm,
  filterCategoria,
  setFilterCategoria,
  categoriasFiltro,
  onAgregarProducto,
  layout = 'desktop'
}) => {
  if (layout === 'mobile') {
    return (
      <div className="md:hidden space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categoriasFiltro.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setFilterCategoria(cat.value)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs border transition-all ${
                filterCategoria === cat.value
                  ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
          <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <input
            className="bg-transparent text-sm flex-1 outline-none text-gray-700 placeholder-gray-400"
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
          {productosMostrar?.map((item) => (
            <ProductCard
              key={item.variantes ? item._key : item.id}
              item={item}
              onSelect={onAgregarProducto}
              layout="mobile"
            />
          ))}
        </div>
      </div>
    );
  }

  // Desktop layout (default)
  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Agregar Productos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Buscar producto..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {categoriasFiltro.map((cat) => (
            <Button
              key={cat.value}
              variant={filterCategoria === cat.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterCategoria(cat.value)}
              className="text-sm"
            >
              {cat.icon} {cat.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {productosMostrar?.map((item) => (
            <ProductCard
              key={item.variantes ? item._key : item.id}
              item={item}
              onSelect={onAgregarProducto}
              layout="desktop"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

ProductGrid.displayName = 'ProductGrid';
