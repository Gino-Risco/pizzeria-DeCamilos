import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, ChefHat, Send, DollarSign, ArrowLeft, Receipt, Plus, History } from 'lucide-react';
import Swal from 'sweetalert2';
import { enviarImpresion } from '@/utils/printServer';
import { mostrarEImprimirTicket } from '@/utils/ticket';
import { formatSoloHora } from '@/utils/formatFecha';
import { ordenesService } from '@/services/ordenes.service';
import { productosService } from '@/services/productos.service';
import { categoriasService } from '@/services/categorias.service';
import * as configService from '@/services/configuracion.service';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Componentes modulares
import { PizzaSizeDialog } from '@/components/pedidos/PizzaSizeDialog';
import { ProductGrid } from '@/components/pedidos/ProductGrid';
import { OrderCart } from '@/components/pedidos/OrderCart';
import { OrderItemsTable } from '@/components/pedidos/OrderItemsTable';

export const Pedidos = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ordenId = searchParams.get('orden_id');

  const { user } = useAuthStore();
  const isAdminOCajero = user?.rol === 'administrador' || user?.rol === 'cajero';

  // --- ESTADOS LOCALES ---
  const [selectedProductos, setSelectedProductos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('todos');
  const [pizzaSeleccionada, setPizzaSeleccionada] = useState(null);
  const [observaciones, setObservaciones] = useState({});

  useEffect(() => {
    setSelectedProductos([]);
  }, [ordenId]);

  // --- DATA FETCHING (REACT QUERY) ---
  const { data: orden, isLoading: ordenLoading } = useQuery({
    queryKey: ['orden', ordenId],
    queryFn: async () => {
      const data = await ordenesService.getById(ordenId);
      return data;
    },
    enabled: !!ordenId,
    staleTime: 0,
  });

  const { data: ordenes, isLoading: ordenesLoading } = useQuery({
    queryKey: ['ordenes', 'abiertas'],
    queryFn: async () => {
      return await ordenesService.getAll({ estado: 'abierta' });
    },
    enabled: !ordenId,
    staleTime: 30000,
  });

  const { data: productos, isLoading: productosLoading } = useQuery({
    queryKey: ['productos'],
    queryFn: async () => {
      const data = await productosService.getAll({ activo: true });
      return data.map(p => ({
        ...p,
        precio_venta: parseFloat(p.precio_venta) || 0,
      }));
    },
  });

  const { data: productosEmpaques } = useQuery({
    queryKey: ['productos', 'empaques'],
    queryFn: async () => {
      const data = await productosService.getAll({ activo: true });
      return data
        .filter(p => {
          const cat = p.categoria_nombre?.toLowerCase() || '';
          return cat.includes('empaque') || cat.includes('descartable') || cat.includes('envase');
        })
        .map(p => ({
          ...p,
          precio_venta: parseFloat(p.precio_venta) > 0
            ? parseFloat(p.precio_venta)
            : parseFloat(p.costo_promedio) || 0,
        }));
    },
  });

  const { data: categoriasDB } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => await categoriasService.getAll(),
  });

  const { data: systemConfig } = useQuery({
    queryKey: ['configuracion'],
    queryFn: configService.getConfiguracion,
    staleTime: 60000,
  });

  // --- HELPER DE EMOJIS ---
  const getCategoriaEmoji = useCallback((nombre) => {
    const nombreLower = nombre.toLowerCase();
    if (nombreLower.includes('pizza')) return '🍕';
    if (nombreLower.includes('combo')) return '🍗';
    if (nombreLower.includes('carta') || nombreLower.includes('plato')) return '🍽️';
    if (nombreLower.includes('piqueo') || nombreLower.includes('entrada')) return '🥟';
    if (nombreLower.includes('bebida') || nombreLower.includes('gaseosa') || nombreLower.includes('refresco')) return '🥤';
    if (nombreLower.includes('burger') || nombreLower.includes('hambur')) return '🍔';
    if (nombreLower.includes('postre') || nombreLower.includes('dulce')) return '🍨';
    if (nombreLower.includes('ensalada')) return '🥗';
    if (nombreLower.includes('pasta') || nombreLower.includes('tallar')) return '🍝';
    if (nombreLower.includes('mariscos') || nombreLower.includes('ceviche')) return '🦐';
    return '🍴';
  }, []);

  // --- FILTROS Y CATEGORÍAS (MEMORIZADOS) ---
  const categoriasFiltro = useMemo(() => {
    return [
      { value: 'todos', label: 'Todos', icon: '📋' },
      ...(categoriasDB
        ?.filter(cat => cat.tipo !== 'insumo')
        .map(cat => ({
          value: cat.nombre,
          label: cat.nombre,
          icon: getCategoriaEmoji(cat.nombre),
        })) || []),
    ];
  }, [categoriasDB, getCategoriaEmoji]);

  const filteredProductos = useMemo(() => {
    return productos?.filter((prod) => {
      if (prod.tipo === 'insumo') return false;
      const matchesSearch = prod.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategoria = filterCategoria === 'todos' || (prod.categoria_nombre?.trim().toLowerCase() === filterCategoria.trim().toLowerCase());
      return matchesSearch && matchesCategoria;
    });
  }, [productos, searchTerm, filterCategoria]);

  const productosMostrar = useMemo(() => {
    const resultado = [];
    const grupoPizzas = {};
    (filteredProductos || []).forEach((prod) => {
      if (prod.categoria_nombre !== 'Pizzas') {
        resultado.push(prod);
      } else {
        const nombreBase = prod.nombre.split(' - ')[0];
        if (!grupoPizzas[nombreBase]) {
          grupoPizzas[nombreBase] = { nombreBase, variantes: [], categoria_nombre: 'Pizzas', _key: nombreBase };
          resultado.push(grupoPizzas[nombreBase]);
        }
        grupoPizzas[nombreBase].variantes.push(prod);
      }
    });
    return resultado;
  }, [filteredProductos]);

  // --- MUTACIONES (REACT QUERY) ---
  const agregarDetalleMutation = useMutation({
    mutationFn: async (detalles) => {
      return await ordenesService.agregarDetalles(ordenId, detalles);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orden', ordenId]);
      Swal.fire({ icon: 'success', title: '¡Productos agregados!', timer: 1500, showConfirmButton: false });
      setSelectedProductos([]);
    },
    onError: (error) => {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al agregar' });
    },
  });

  const crearOrdenMutation = useMutation({
    mutationFn: async (tipo = 'llevar') => {
      const { value: nombreCliente, isConfirmed } = await Swal.fire({
        title: '🛍️ Nuevo Pedido Para Llevar',
        html: `
          <p style="color:#6b7280;margin-bottom:12px;font-size:14px;">Ingresa el nombre del cliente para identificar el pedido</p>
          <input 
            id="nombre_cliente" 
            class="swal2-input" 
            placeholder="Ej: María, Juan García..." 
            maxlength="100"
            style="font-size:16px;"
            autofocus
          />
        `,
        showCancelButton: true,
        confirmButtonText: '✓ Crear Pedido',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f97316',
        focusConfirm: false,
        preConfirm: () => {
          const val = document.getElementById('nombre_cliente').value.trim();
          if (!val) {
            Swal.showValidationMessage('El nombre del cliente es requerido');
            return false;
          }
          return val;
        },
      });

      if (!isConfirmed || !nombreCliente) return null;

      return await ordenesService.create({
        tipo_pedido: tipo,
        mesa_id: null,
        nombre_cliente: nombreCliente,
        observaciones: 'Pedido rápido para llevar'
      });
    },
    onSuccess: (nuevaOrden) => {
      if (!nuevaOrden) return;
      queryClient.invalidateQueries(['ordenes']);
      setSearchParams({ orden_id: nuevaOrden.id });
      Swal.fire({ icon: 'success', title: `Pedido de ${nuevaOrden.nombre_cliente || 'Llevar'} creado`, timer: 1500, showConfirmButton: false });
    },
    onError: (error) => {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'No se pudo crear el pedido' });
    },
  });

  const eliminarDetalleMutation = useMutation({
    mutationFn: async ({ ordenId, detalleId }) => {
      return await ordenesService.eliminarDetalle(ordenId, detalleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orden', ordenId]);
      Swal.fire({ icon: 'success', title: '¡Eliminado!', timer: 1500, showConfirmButton: false });
    },
    onError: (error) => {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al eliminar' });
    },
  });

  const aplicarCortesiaMutation = useMutation({
    mutationFn: async ({ ordenId, detalleId, motivo }) => {
      return await ordenesService.aplicarCortesia(ordenId, detalleId, motivo);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orden', ordenId]);
      Swal.fire({
        icon: 'success',
        title: 'Cortesía Aplicada',
        text: 'El precio del plato ahora es S/ 0.00',
        timer: 2000,
        showConfirmButton: false
      });
    },
    onError: (error) => {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al aplicar cortesía' });
    }
  });

  const enviarCocinaMutation = useMutation({
    mutationFn: async (notasLocales) => {
      return await ordenesService.enviarCocina(ordenId, notasLocales);
    },
    onSuccess: (data, notasLocales) => {
      queryClient.invalidateQueries(['orden', ordenId]);
      queryClient.invalidateQueries(['ordenes']);
      if (data.imprimir) {
        const detallesParaTicket = data.detalles.map(d => ({
          ...d,
          observaciones: notasLocales[d.id] || d.observaciones
        }));
        imprimirTicketCocina(data.orden, detallesParaTicket);
      }
      setObservaciones({});
      Swal.fire({ icon: 'success', title: '¡Enviado a cocina!', timer: 1500, showConfirmButton: false });
    },
    onError: (error) => {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al enviar' });
    },
  });

  const cerrarOrdenMutation = useMutation({
    mutationFn: async (datosPago) => {
      return await ordenesService.cerrar(ordenId, datosPago);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['orden', ordenId]);
      queryClient.invalidateQueries(['ordenes']);
      queryClient.invalidateQueries(['mesas']);
      if (data.imprimir) {
        imprimirComprobanteCaja(data.orden);
      }
      Swal.fire({ icon: 'success', title: '¡Orden cobrada!', timer: 2000, showConfirmButton: false });
      setSearchParams({});
    },
    onError: (error) => {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al cobrar' });
    },
  });

  const anularOrdenMutation = useMutation({
    mutationFn: async ({ id, motivo }) => {
      return await ordenesService.cancelar(id, { motivo });
    },
    onSuccess: (data) => {
      queryClient.removeQueries(['orden', ordenId]);
      queryClient.invalidateQueries(['ordenes']);
      queryClient.invalidateQueries(['mesas']);
      setSearchParams({});
      Swal.fire({
        icon: 'success',
        title: '¡Mesa Liberada!',
        text: data?.message || 'La orden ha sido anulada correctamente.',
        timer: 2500,
        showConfirmButton: false
      });
      setSearchParams({});
    },
    onError: (error) => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.error?.message || 'Error al anular la orden'
      });
    },
  });

  const aplicarDescuentoMutation = useMutation({
    mutationFn: async ({ ordenId, tipo, valor, total_descontado, motivo }) => {
      return await ordenesService.aplicarDescuentoGlobal(ordenId, { tipo, valor, total_descontado, motivo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orden', ordenId]);
      Swal.fire({ icon: 'success', title: 'Descuento Aplicado', timer: 1500, showConfirmButton: false });
    },
    onError: (error) => {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al aplicar' });
    }
  });

  // --- IMPRESIÓN ---
  const imprimirTicketCocina = useCallback(async (orden, detalles) => {
    const esLlevar = !orden.mesa_id;
    const contenido = `
══════════════════════════════════
${esLlevar ? `🛍️ PARA LLEVAR: ${orden.nombre_cliente || 'SIN NOMBRE'}` : `🍳 COCINA - Mesa ${orden.mesa_numero}`}
#${orden.numero_comanda} - ${formatSoloHora(new Date())}
──────────────────────────────────
${detalles.map(d => {
      let linea = `${d.cantidad}x ${d.es_menu ? 'MENÚ: ' : ''}${d.producto_nombre}`;
      if (d.es_menu && d.entrada_incluida) linea += `\n   → Entrada: ${d.entrada_incluida.nombre}`;
      if (d.observaciones && d.observaciones.trim() !== "") linea += `\n   ⚠️ NOTA: ${d.observaciones.toUpperCase()}`;
      return linea;
    }).join('\n──────────────────────────────────\n')}
    `.trim();

    console.log('🖨️ TICKET COCINA:\n', contenido);
    Swal.fire({
      title: '🖨️ Ticket Enviado a Cocina',
      html: `<pre style="text-align:left;font-family:monospace;font-size:14px;background:#fdfdfd;padding:10px;border:1px solid #eee;">${contenido}</pre>`,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#16a34a'
    });
    await enviarImpresion('/api/imprimir/cocina', { orden, detalles });
  }, []);

  // Config del negocio con fallback, para armar el ticket (nombre, RUC, QR Yape, etc.)
  const obtenerConfigActiva = useCallback(async () => {
    if (systemConfig) return systemConfig;
    try {
      return await configService.getConfiguracion();
    } catch {
      return {
        nombre_restaurante: "D' CAMILOS",
        ruc: "20123456789",
        direccion: "Jr. Belen 185 - Esperanza Parte Baja",
        telefono: "942 685 506",
        mensaje_ticket: "¡Gracias por su preferencia!"
      };
    }
  }, [systemConfig]);

  const imprimirComprobanteCaja = useCallback(async (orden) => {
    const activeConfig = await obtenerConfigActiva();
    await mostrarEImprimirTicket(orden, false, activeConfig);
  }, [obtenerConfigActiva]);

  const handleImprimirPreCuenta = useCallback(async () => {
    if (!orden) return;
    const activeConfig = await obtenerConfigActiva();
    await mostrarEImprimirTicket(orden, true, activeConfig);
  }, [orden, obtenerConfigActiva]);

  // --- HANDLERS DE NEGOCIO (MEMORIZADOS CON USECALLBACK) ---
  const handleAgregarProducto = useCallback((producto) => {
    if (producto.variantes) {
      setPizzaSeleccionada(producto);
      return;
    }
    agregarAlCarritoIndividual(producto);
  }, []);

  const agregarAlCarritoIndividual = useCallback((producto) => {
    setSelectedProductos((prev) => {
      const existing = prev.find(p => p.producto_id === producto.id && !p.es_menu);
      if (existing) {
        return prev.map(p => p.producto_id === producto.id && !p.es_menu ? { ...p, cantidad: p.cantidad + 1 } : p);
      }
      return [...prev, {
        producto_id: producto.id,
        cantidad: 1,
        precio: producto.precio_venta,
        es_menu: false,
        entrada_incluida: null,
        fondo_incluido: null,
      }];
    });
  }, []);

  const handleRemoverProducto = useCallback((productoId) => {
    setSelectedProductos((prev) => prev.filter(p => p.producto_id !== productoId));
  }, []);

  const handleActualizarCantidad = useCallback((productoId, nuevaCantidad) => {
    if (nuevaCantidad < 1) {
      handleRemoverProducto(productoId);
      return;
    }
    setSelectedProductos((prev) => prev.map(p =>
      p.producto_id === productoId ? { ...p, cantidad: nuevaCantidad } : p
    ));
  }, [handleRemoverProducto]);

  const handleGuardarOrden = useCallback(() => {
    if (selectedProductos.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Sin productos', text: 'Agrega al menos un producto' });
      return;
    }
    agregarDetalleMutation.mutate(selectedProductos);
  }, [selectedProductos, agregarDetalleMutation]);

  const handleEliminarDetalle = useCallback(async (detalleId) => {
    const result = await Swal.fire({
      title: '¿Eliminar producto?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (result.isConfirmed) {
      eliminarDetalleMutation.mutate({ ordenId, detalleId });
    }
  }, [ordenId, eliminarDetalleMutation]);

  const handleCortesia = useCallback(async (detalleId) => {
    const { value: motivo } = await Swal.fire({
      title: 'Anular Plato (Cortesía)',
      text: 'El plato se mantendrá en el registro con valor S/ 0.00. Ingresa el motivo:',
      input: 'text',
      inputPlaceholder: 'Ej: Mosca en la sopa, pollo crudo, cliente canceló...',
      showCancelButton: true,
      confirmButtonColor: '#f97316',
      confirmButtonText: 'Anular Plato',
      cancelButtonText: 'Cancelar'
    });

    if (motivo) {
      aplicarCortesiaMutation.mutate({ ordenId, detalleId, motivo });
    }
  }, [ordenId, aplicarCortesiaMutation]);

  const handleEnviarCocina = useCallback(() => {
    const pendientes = orden?.detalles?.filter(d => !d.enviado_cocina) || [];
    if (pendientes.length === 0) {
      Swal.fire({ icon: 'info', title: 'Sin pendientes', text: 'Todos los items ya fueron enviados' });
      return;
    }
    enviarCocinaMutation.mutate(observaciones);
  }, [orden, observaciones, enviarCocinaMutation]);

  const handleCobrar = useCallback(async () => {
    if (!orden?.detalles?.length) {
      Swal.fire({ icon: 'warning', title: 'Orden vacía', text: 'No hay productos para cobrar' });
      return;
    }
    const { value: formValues } = await Swal.fire({
      title: 'Cobrar Orden',
      html: `
        <div style="text-align: left;">
          <p><strong>Total:</strong> S/ ${orden.detalles.reduce((s, d) => s + parseFloat(d.subtotal), 0).toFixed(2)}</p>
          <label>Método de pago:</label>
          <select id="metodo_pago" class="swal2-input" style="width: 100%; margin: 8px 0;">
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="yape">Yape/Plin</option>
          </select>
          <label>N° Comprobante (opcional):</label>
          <input id="numero_comprobante" class="swal2-input" placeholder="B001-000123" style="width: 100%;">
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Cobrar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => ({
        metodo_pago: document.getElementById('metodo_pago').value,
        numero_comprobante: document.getElementById('numero_comprobante').value,
      }),
    });
    if (formValues) {
      const total = orden.detalles.reduce((sum, d) => sum + parseFloat(d.subtotal), 0);
      cerrarOrdenMutation.mutate({ total, metodo_pago: formValues.metodo_pago, numero_comprobante: formValues.numero_comprobante });
    }
  }, [orden, cerrarOrdenMutation]);

  const handleUpdateObservacion = useCallback((detalleId, texto) => {
    setObservaciones(prev => ({ ...prev, [detalleId]: texto }));
  }, []);

  const handleAplicarDescuento = useCallback(async () => {
    const totalActual = orden.detalles?.reduce((s, d) => s + parseFloat(d.subtotal), 0) || 0;

    const { value: formValues } = await Swal.fire({
      title: 'Aplicar Descuento a la Cuenta',
      html: `
        <div style="text-align: left;">
          <p style="font-size: 14px; color: #6b7280; margin-bottom: 12px;">Subtotal actual: <strong>S/ ${totalActual.toFixed(2)}</strong></p>
          
          <label style="font-size: 13px; font-weight: bold;">Tipo de Descuento:</label>
          <select id="swal-tipo" class="swal2-input" style="width: 100%; margin: 8px 0 16px 0;">
            <option value="fijo">Monto Fijo (S/)</option>
            <option value="porcentaje">Porcentaje (%)</option>
          </select>
          
          <label style="font-size: 13px; font-weight: bold;">Valor (S/ o %):</label>
          <input id="swal-valor" type="number" step="0.50" min="0" class="swal2-input" placeholder="Ej: 10" style="width: 100%; margin: 8px 0 16px 0;">
          
          <label style="font-size: 13px; font-weight: bold;">Motivo:</label>
          <input id="swal-motivo" type="text" class="swal2-input" placeholder="Ej: Amigo del dueño, Queja..." style="width: 100%; margin: 8px 0;">
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Aplicar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const tipo = document.getElementById('swal-tipo').value;
        const valor = parseFloat(document.getElementById('swal-valor').value);
        const motivo = document.getElementById('swal-motivo').value;

        if (!valor || valor <= 0) return Swal.showValidationMessage('Ingresa un valor mayor a 0');

        let total_descontado = 0;
        if (tipo === 'fijo') {
          if (valor > totalActual) return Swal.showValidationMessage('El descuento no puede ser mayor a la cuenta');
          total_descontado = valor;
        } else if (tipo === 'porcentaje') {
          if (valor > 100) return Swal.showValidationMessage('El porcentaje no puede ser mayor a 100%');
          total_descontado = (totalActual * valor) / 100;
        }

        return { tipo, valor, total_descontado, motivo };
      }
    });

    if (formValues) {
      aplicarDescuentoMutation.mutate({
        ordenId,
        ...formValues
      });
    }
  }, [orden, ordenId, aplicarDescuentoMutation]);

  const handleAnularOrden = useCallback(async () => {
    const { value: formValues } = await Swal.fire({
      title: '⚠️ ¿Anular Orden?',
      html: `
        <p style="color:#ef4444; font-size:14px; margin-bottom:12px;">
          Esta acción liberará la mesa inmediatamente.
        </p>
        <input 
          id="motivo_anulacion" 
          class="swal2-input" 
          placeholder="Motivo (Ej. Error de creación)" 
          style="width: 100%; font-size:15px;"
        >
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar',
      focusConfirm: false,
      preConfirm: () => {
        return {
          motivo: document.getElementById('motivo_anulacion').value
        };
      }
    });

    if (formValues) {
      anularOrdenMutation.mutate({
        id: ordenId,
        motivo: formValues.motivo
      });
    }
  }, [ordenId, anularOrdenMutation]);

  // --- MANEJO DE EMPAQUES / DESCARTABLES ---
  const esOrdenParaLlevar = !!ordenId && !!orden && !orden.mesa_id;
  const totalCarrito = useMemo(() => {
    return selectedProductos.reduce((sum, p) => sum + parseFloat(p.precio) * p.cantidad, 0);
  }, [selectedProductos]);

  const handleAgregarEmpaque = useCallback(async () => {
    const empaquesDisponibles = (productosEmpaques || []).map(p => ({
      ...p,
      precio_venta: parseFloat(p.precio_venta) > 0
        ? parseFloat(p.precio_venta)
        : parseFloat(p.costo_promedio) || 0,
    }));

    const opcionesParaModal = empaquesDisponibles.length > 0
      ? empaquesDisponibles
      : [
        { id: '__taper_s', nombre: 'Taper Chico (Alitas 4 pzas)', precio_venta: 1.00, _esTemporal: true },
        { id: '__taper_m', nombre: 'Taper Grande (Alitas 6 pzas)', precio_venta: 1.50, _esTemporal: true },
        { id: '__vaso', nombre: 'Vaso Descartable (Jugo)', precio_venta: 0.50, _esTemporal: true },
      ];

    const seleccion = await new Promise((resolve) => {
      const callbackMap = {};
      opcionesParaModal.forEach((emp) => {
        callbackMap[emp.id] = emp;
      });

      window.__empaqueResolve = resolve;
      window.__empaqueOpciones = callbackMap;

      const esFallback = empaquesDisponibles.length === 0;

      const botonesHTML = opcionesParaModal.map(emp => `
        <button
          type="button"
          onclick="window.__empaqueResolve(window.__empaqueOpciones['${emp.id}']); Swal.close();"
          style="
            display:flex; justify-content:space-between; align-items:center;
            width:100%; margin-bottom:8px; padding:12px 16px;
            border:1px solid #e5e7eb; border-radius:10px;
            background:#fff; cursor:pointer; transition:all 0.15s;
            font-size:14px;
          "
          onmouseover="this.style.borderColor='#f97316';this.style.background='#fff7ed';"
          onmouseout="this.style.borderColor='#e5e7eb';this.style.background='#fff';"
        >
          <span style="font-weight:500;color:#111827;">🥡 ${emp.nombre}</span>
          <span style="font-weight:700;color:#ea580c;">S/ ${emp.precio_venta.toFixed(2)}</span>
        </button>
      `).join('');

      const avisofallback = esFallback ? `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:12px;text-align:left;">
          <p style="margin:0;font-size:12px;color:#1d4ed8;">
            💡 <strong>Tip:</strong> Crea una categoría "Empaques" en tu panel de productos para gestionar precios desde ahí.
          </p>
        </div>
      ` : '';

      Swal.fire({
        title: '🥡 Agregar Descartable',
        html: `
          <div style="text-align:left;">
            <p style="color:#6b7280;font-size:13px;margin-bottom:12px;">
              Selecciona el envase para este pedido para llevar:
            </p>
            ${avisofallback}
            ${botonesHTML}
          </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        width: '420px',
      }).then(({ isDismissed }) => {
        if (isDismissed) resolve(null);
      });
    });

    delete window.__empaqueResolve;
    delete window.__empaqueOpciones;

    if (!seleccion) return;

    if (seleccion._esTemporal) {
      setSelectedProductos(prev => {
        const existing = prev.find(p => p.producto_id === seleccion.id);
        if (existing) {
          return prev.map(p => p.producto_id === seleccion.id ? { ...p, cantidad: p.cantidad + 1 } : p);
        }
        return [...prev, {
          producto_id: seleccion.id,
          cantidad: 1,
          precio: seleccion.precio_venta,
          es_menu: false,
          entrada_incluida: null,
          fondo_incluido: null,
          _nombreTemporal: seleccion.nombre,
          _esTemporal: true,
        }];
      });
      Swal.fire({
        toast: true, position: 'top-end', icon: 'warning',
        title: `${seleccion.nombre} agregado (temporal)`,
        text: 'Recuerda crear el producto en BD para que quede registrado.',
        showConfirmButton: false, timer: 3000,
      });
    } else {
      const productoDB = productos.find(p => p.id === seleccion.id);
      if (productoDB) {
        agregarAlCarritoIndividual(productoDB);
        Swal.fire({
          toast: true, position: 'top-end', icon: 'success',
          title: `${seleccion.nombre} agregado`,
          showConfirmButton: false, timer: 1500,
        });
      }
    }
  }, [productos, productosEmpaques, agregarAlCarritoIndividual]);

  // --- COMPORTAMIENTOS DE RENDER ---
  if (ordenLoading || ordenesLoading || productosLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // ── VISTA: Lista de órdenes (Dashboard Principal) ──
  if (!ordenId) {
    return (
      <div className="space-y-4">
        {/* Header Móvil */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
              <p className="text-gray-500 text-sm">Gestión de órdenes activas</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/historial-pedidos')}
                className="flex items-center gap-1 text-gray-500 border border-gray-300 bg-white text-sm font-medium px-2.5 py-2 rounded-xl"
              >
                <History className="h-4 w-4" />
              </button>
              <button
                onClick={() => crearOrdenMutation.mutate('llevar')}
                disabled={crearOrdenMutation?.isPending}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-sm font-semibold px-3 py-2.5 rounded-xl shadow-md transition-all"
              >
                <Plus className="h-4 w-4" />
                Para Llevar
              </button>
            </div>
          </div>
        </div>

        {/* Header Desktop */}
        <div className="hidden md:flex md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pedidos</h1>
            <p className="text-gray-500 mt-1">Gestión de órdenes activas</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/historial-pedidos')}
              className="border-gray-300 text-gray-600 hover:text-gray-900"
            >
              <History className="h-4 w-4 mr-2" />
              Historial
            </Button>
            <Button
              onClick={() => crearOrdenMutation.mutate('llevar')}
              disabled={crearOrdenMutation?.isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Plus className="h-5 w-5 mr-2" />
              Para Llevar
            </Button>
          </div>
        </div>

        {ordenes?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No hay órdenes activas</h2>
              <p className="text-gray-500 mb-6">Crea una orden desde el módulo de Mesas o inicia un pedido rápido.</p>
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={() => navigate('/mesas')}>Ir a Mesas</Button>
                <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => crearOrdenMutation.mutate('llevar')}>
                  Nuevo Para Llevar
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Tarjetas Desktop */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ordenes?.map((orden) => {
                const esLlevar = !orden.mesa_id;
                return (
                  <Card
                    key={orden.id}
                    className={`cursor-pointer hover:shadow-lg transition-shadow ${esLlevar ? 'border-l-4 border-l-orange-500' : ''}`}
                    onClick={() => setSearchParams({ orden_id: orden.id })}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{esLlevar ? `🛍️ ${orden.nombre_cliente || 'Para Llevar'}` : `Orden #${orden.numero_comanda?.split('-')[2] || orden.id}`}</span>
                        <Badge variant={esLlevar ? 'outline' : 'default'} className={esLlevar ? 'border-orange-500 text-orange-600' : ''}>
                          {orden.estado}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{esLlevar ? 'Cliente:' : 'Mesa:'}</span>
                        <span className="font-semibold">{esLlevar ? (orden.nombre_cliente || 'Para Llevar') : orden.mesa_numero}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Mesero:</span>
                        <span className="font-semibold">{orden.mesero_nombre}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Productos:</span>
                        <span className="font-semibold">{orden.detalles?.length || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total:</span>
                        <span className="font-bold text-blue-600">S/ {orden.total_real ? parseFloat(orden.total_real).toFixed(2) : '0.00'}</span>
                      </div>
                      <Button className="w-full mt-4" variant={esLlevar ? 'outline' : 'default'}>Ver Detalle</Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Tarjetas Móvil */}
            <div className="flex flex-col gap-3 md:hidden">
              {ordenes?.map((orden) => {
                const esLlevar = !orden.mesa_id;
                return (
                  <div
                    key={orden.id}
                    onClick={() => setSearchParams({ orden_id: orden.id })}
                    className={`bg-white rounded-2xl shadow-sm border active:scale-[0.98] transition-transform cursor-pointer overflow-hidden
                      ${esLlevar ? 'border-l-4 border-l-orange-400' : 'border-l-4 border-l-blue-500'}`}
                  >
                    <div className={`px-4 pt-3 pb-2 flex items-center justify-between ${esLlevar ? 'bg-orange-50' : 'bg-blue-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{esLlevar ? '🛍️' : '🍽️'}</span>
                        <div>
                          <p className={`font-bold text-[15px] ${esLlevar ? 'text-orange-700' : 'text-blue-700'}`}>
                            {esLlevar ? (orden.nombre_cliente || 'Para Llevar') : `Orden #${orden.numero_comanda?.split('-')[2] || orden.id}`}
                          </p>
                          {!esLlevar ? (
                            <p className="text-[11px] text-blue-500">Mesa {orden.mesa_numero}</p>
                          ) : (
                            <p className="text-[11px] text-orange-500">#{orden.numero_comanda?.split('-')[2]} · Llevar</p>
                          )}
                        </div>
                      </div>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full
                        ${esLlevar ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                        {orden.estado}
                      </span>
                    </div>

                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[12px] text-gray-500">
                          Mesero: <span className="font-semibold text-gray-800">{orden.mesero_nombre}</span>
                        </p>
                        <p className="text-[12px] text-gray-500">
                          Productos: <span className="font-semibold text-gray-800">{orden.detalles?.length || 0}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[11px] text-gray-400">Total</p>
                          <p className="text-[16px] font-bold text-blue-600">
                            S/ {orden.total_real ? parseFloat(orden.total_real).toFixed(2) : '0.00'}
                          </p>
                        </div>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${esLlevar ? 'bg-orange-500' : 'bg-blue-600'}`}>
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── VISTA: Orden no encontrada ──
  if (!orden) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setSearchParams({})}>
          <ArrowLeft className="h-5 w-5 mr-2" /> Volver
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Orden no encontrada</h2>
            <Button onClick={() => setSearchParams({})}>Volver a la lista</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="md:flex md:items-center md:justify-between md:gap-4">
        {/* Móvil */}
        <div className="md:hidden bg-[#1e3a5f] -mx-4 -mt-4 px-4 pt-4 pb-3 mb-4">
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => setSearchParams({})} className="flex items-center gap-1 text-blue-300 text-sm">
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>
            <Badge className="bg-green-500 text-white text-[10px] px-2 py-0.5">{orden.estado.toUpperCase()}</Badge>
          </div>
          <h1 className="text-white font-semibold text-base">
            {orden.mesa_id ? `Mesa ${orden.mesa_numero}` : `🛍️ CLIENTE: ${orden.nombre_cliente || 'Llevar'}`} — Comanda #{orden.numero_comanda?.split('-')[2] || orden.id}
          </h1>
          <p className="text-blue-300 text-xs mb-2">Mesero: {orden.mesero_nombre}</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Comanda', value: `#${orden.numero_comanda?.split('-')[2] || orden.id}` },
              { label: orden.mesa_id ? 'Mesa' : 'Cliente', value: orden.mesa_id ? orden.mesa_numero : (orden.nombre_cliente || 'Para Llevar') },
              { label: 'Estado', value: orden.estado },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/10 rounded-lg px-2 py-1.5">
                <p className="text-blue-300 text-[10px]">{label}</p>
                <p className="text-white text-[13px] font-medium capitalize truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden md:block">
          <h1 className="text-3xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-500 mt-1">
            Orden #{orden.numero_comanda?.split('-')[2] || orden.id} - {orden.mesa_id ? `Mesa ${orden.mesa_numero}` : `🛍️ CLIENTE: ${orden.nombre_cliente || 'Para Llevar'}`}
          </p>
        </div>
        <div className="hidden md:flex gap-2">
          <Badge variant={orden.estado === 'abierta' ? 'default' : 'secondary'} className="text-sm">
            {orden.estado.toUpperCase()}
          </Badge>
          {isAdminOCajero && orden.estado !== 'cobrada' && orden.estado !== 'cancelada' && (
            <Button
              variant="destructive"
              onClick={handleAnularOrden}
              disabled={anularOrdenMutation.isPending}
              className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-none shadow-none font-medium"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {anularOrdenMutation.isPending ? 'Anulando...' : 'Anular Orden'}
            </Button>
          )}
          <Button variant="outline" onClick={() => setSearchParams({})}>
            <ArrowLeft className="h-5 w-5 mr-2" /> Volver
          </Button>
        </div>
      </div>

      {/* Info Orden (Desktop) */}
      <Card className="hidden md:block">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-sm text-gray-500">Comanda</p><p className="font-semibold">{orden.numero_comanda}</p></div>
            <div><p className="text-sm text-gray-500">{orden.mesa_id ? 'Mesa' : 'Cliente'}</p><p className="font-semibold">{orden.mesa_numero || (orden.nombre_cliente || 'Para Llevar')}</p></div>
            <div><p className="text-sm text-gray-500">Mesero</p><p className="font-semibold">{orden.mesero_nombre}</p></div>
            <div><p className="text-sm text-gray-500">Estado</p><p className="font-semibold capitalize">{orden.estado}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* ── SECCIÓN CENTRAL (Desktop) ── */}
      <div className="hidden md:grid md:grid-cols-3 gap-6">
        <ProductGrid
          productosMostrar={productosMostrar}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterCategoria={filterCategoria}
          setFilterCategoria={setFilterCategoria}
          categoriasFiltro={categoriasFiltro}
          onAgregarProducto={handleAgregarProducto}
          layout="desktop"
        />

        <OrderCart
          selectedProductos={selectedProductos}
          productos={productos}
          esOrdenParaLlevar={esOrdenParaLlevar}
          handleAgregarEmpaque={handleAgregarEmpaque}
          handleActualizarCantidad={handleActualizarCantidad}
          handleRemoverProducto={handleRemoverProducto}
          handleGuardarOrden={handleGuardarOrden}
          isPending={agregarDetalleMutation.isPending}
          totalCarrito={totalCarrito}
          layout="desktop"
        />
      </div>

      {/* ── SECCIÓN CENTRAL (Móvil) ── */}
      <div className="md:hidden space-y-2">
        <ProductGrid
          productosMostrar={productosMostrar}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterCategoria={filterCategoria}
          setFilterCategoria={setFilterCategoria}
          categoriasFiltro={categoriasFiltro}
          onAgregarProducto={handleAgregarProducto}
          layout="mobile"
        />

        <OrderCart
          selectedProductos={selectedProductos}
          productos={productos}
          esOrdenParaLlevar={esOrdenParaLlevar}
          handleAgregarEmpaque={handleAgregarEmpaque}
          handleActualizarCantidad={handleActualizarCantidad}
          handleRemoverProducto={handleRemoverProducto}
          handleGuardarOrden={handleGuardarOrden}
          isPending={agregarDetalleMutation.isPending}
          totalCarrito={totalCarrito}
          layout="mobile"
        />
      </div>

      {/* ── PRODUCTOS EN LA ORDEN (DB) ── */}
      <OrderItemsTable
        orden={orden}
        observaciones={observaciones}
        handleUpdateObservacion={handleUpdateObservacion}
        handleEliminarDetalle={handleEliminarDetalle}
        handleCortesia={handleCortesia}
        eliminarDetalleMutationIsPending={eliminarDetalleMutation.isPending}
        aplicarCortesiaMutationIsPending={aplicarCortesiaMutation.isPending}
        layout="desktop"
      />

      <OrderItemsTable
        orden={orden}
        observaciones={observaciones}
        handleUpdateObservacion={handleUpdateObservacion}
        handleEliminarDetalle={handleEliminarDetalle}
        handleCortesia={handleCortesia}
        eliminarDetalleMutationIsPending={eliminarDetalleMutation.isPending}
        aplicarCortesiaMutationIsPending={aplicarCortesiaMutation.isPending}
        layout="mobile"
      />

      {/* ── TOTALES Y ACCIONES FINALIZADORAS ── */}
      <div className="mt-8 border-t border-gray-200 pt-6 flex flex-col md:flex-row justify-between items-end md:items-center gap-4 font-sans">
        <div className="text-right md:text-left w-full md:w-auto">
          <span className="text-gray-500 text-sm font-normal block">
            Subtotal: S/ {orden.detalles?.reduce((acc, d) => acc + parseFloat(d.subtotal || 0), 0).toFixed(2)}
          </span>
          {parseFloat(orden.descuento_total) > 0 && (
            <span className="text-orange-500 text-sm font-medium block">
              Descuento: - S/ {parseFloat(orden.descuento_total).toFixed(2)}
            </span>
          )}
          <span className="text-2xl font-bold text-gray-800 block mt-1">
            TOTAL: S/ {(
              orden.detalles?.reduce((acc, d) => acc + parseFloat(d.subtotal || 0), 0) -
              parseFloat(orden.descuento_total || 0)
            ).toFixed(2)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">
          {isAdminOCajero && orden.estado !== 'cobrada' && orden.estado !== 'cancelada' && (
            <Button
              onClick={handleAplicarDescuento}
              variant="outline"
              size="sm"
              className="w-auto text-xs md:text-sm md:w-auto bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 hover:text-orange-700 px-3 py-1.5"
            >
              <DollarSign className="w-3.5 h-3.5 mr-1.5" />
              Aplicar Descuento
            </Button>
          )}

          {orden.estado === 'abierta' && orden.detalles?.some(d => !d.enviado_cocina) && (
            <Button
              onClick={handleEnviarCocina}
              disabled={enviarCocinaMutation.isPending}
              className="w-full md:w-auto bg-green-600 hover:bg-green-700"
            >
              <Send className="h-4 w-4 mr-2" />
              {enviarCocinaMutation.isPending
                ? 'Enviando...'
                : `Enviar a Cocina (${orden.detalles.filter(d => !d.enviado_cocina).length} pdtes)`
              }
            </Button>
          )}

          {orden.estado !== 'cobrada' && orden.estado !== 'cancelada' && (
            <Button
              onClick={handleImprimirPreCuenta}
              variant="outline"
              className="w-full md:w-auto"
            >
              <Receipt className="h-4 w-4 mr-2" />
              Imprimir Pre-Cuenta
            </Button>
          )}

          {isAdminOCajero && orden.estado !== 'cobrada' && orden.estado !== 'cancelada' && (
            <Button
              onClick={handleCobrar}
              disabled={cerrarOrdenMutation.isPending}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              <Receipt className="h-4 w-4 mr-2" />
              Cobrar Cuenta
            </Button>
          )}
        </div>
      </div>

      {/* ── MODAL SELECCIÓN DE TAMAÑO DE PIZZA ── */}
      <PizzaSizeDialog
        pizzaSeleccionada={pizzaSeleccionada}
        onClose={() => setPizzaSeleccionada(null)}
        onSelectVariant={agregarAlCarritoIndividual}
      />
    </div>
  );
};