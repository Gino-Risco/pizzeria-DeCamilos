import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Printer,
  Save,
  RefreshCw,
  AlertTriangle,
  Receipt,
  ChevronRight,
  Upload,
  X,
  QrCode,
  Building,
  FileText,
  MapPin,
  Phone,
  Trash2,
  HelpCircle,
  Info,
  Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';
import Swal from 'sweetalert2';
import jsQR from 'jsqr';
import { api } from '@/services/api';
import { getConfiguracion, updateConfiguracion, recargarConfigImpresora } from '@/services/configuracion.service';
import { formatFechaHora } from '@/utils/formatFecha';

// ─── Preview del ticket (simulación visual hiperrealista) ───────────────────
const TicketPreview = ({ form }) => {
  const ahora = formatFechaHora(new Date());

  return (
    <div className="relative bg-white rounded-lg p-6 shadow-2xl border border-gray-200 font-mono text-[11px] text-gray-800 leading-relaxed max-w-[320px] mx-auto select-none overflow-hidden transition-all duration-300 hover:shadow-purple-100">
      {/* Bordes serrados estéticos (efecto papel térmico) */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-200 via-white to-gray-200 bg-[size:10px_6px] bg-repeat-x"></div>
      
      <div className="space-y-3">


        {/* Encabezado */}
        <div className="text-center pb-2 border-b border-dashed border-gray-300">
          <p className="font-bold text-xs text-gray-900 tracking-wider uppercase">
            {form.nombre_restaurante || "D' CAMILOS"}
          </p>
          <p className="text-gray-500 font-medium">{form.ruc ? `RUC: ${form.ruc}` : 'RUC: 20123456789'}</p>
          <p className="text-gray-500">{form.direccion || 'Jr. Belen 185 - Esperanza'}</p>
          <p className="text-gray-500">{form.telefono ? `Delivery: ${form.telefono}` : 'Delivery: 942 685 506'}</p>
        </div>

        {/* Info Venta de Ejemplo */}
        <div className="space-y-0.5 text-gray-500">
          <p><span className="font-bold text-gray-700">TICKET:</span> #0042</p>
          <p><span className="font-bold text-gray-700">MESA:</span> 5</p>
          <p><span className="font-bold text-gray-700">FECHA:</span> {ahora}</p>
        </div>

        <div className="border-t border-dashed border-gray-300 my-1"></div>

        {/* Detalles Productos */}
        <div className="space-y-1.5 py-1">
          <div className="flex justify-between items-start">
            <span className="flex-1">2x Pizza Especial (Familiar)</span>
            <span className="ml-2 whitespace-nowrap">S/ 50.00</span>
          </div>
          <div className="flex justify-between items-start">
            <span className="flex-1">1x Inka Kola (1.5L)</span>
            <span className="ml-2 whitespace-nowrap">S/ 8.00</span>
          </div>
        </div>

        <div className="border-t border-dashed border-gray-300 my-1"></div>

        {/* Totales */}
        <div className="space-y-1 text-right">
          <div className="flex justify-between">
            <span>SUBTOTAL BRUTO:</span>
            <span>S/ 58.00</span>
          </div>
          <div className="flex justify-between">
            <span>OP. GRAVADA:</span>
            <span>S/ 49.15</span>
          </div>
          <div className="flex justify-between">
            <span>IGV (18%):</span>
            <span>S/ 8.85</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 text-xs">
            <span>TOTAL A PAGAR:</span>
            <span>S/ 58.00</span>
          </div>
        </div>

        <div className="border-t border-dashed border-gray-300 my-1"></div>

        <div className="flex justify-between text-gray-900 font-bold">
          <span>PAGADO (YAPE):</span>
          <span>S/ 58.00</span>
        </div>

        <div className="border-t border-dashed border-gray-300 my-2"></div>

        {/* PIE DE TICKET (REORDENADO CON QR ARRIBA Y MENSAJE ABAJO) */}
        <div className="text-center pt-1 space-y-4">
          
          {/* QR Oficial de Yape Subido */}
          {form.qr_yape_url ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-purple-700 tracking-wider uppercase flex items-center justify-center gap-1">
                <QrCode className="h-3 w-3" /> Paga con YAPE:
              </p>
              <div className="relative group max-w-[130px] mx-auto bg-purple-50 p-2 rounded-lg border border-purple-100">
                <img 
                  src={form.qr_yape_url} 
                  alt="QR Oficial Yape" 
                  className="w-full h-auto object-contain aspect-square rounded"
                />
              </div>
              <p className="text-[8px] text-gray-400 font-mono overflow-hidden text-ellipsis whitespace-nowrap px-2">
                {form.qr_yape_contenido ? 'Enlace QR detectado ✓' : 'Imagen de QR guardada'}
              </p>
            </div>
          ) : (
            <div className="border border-dashed border-purple-200 bg-purple-50/50 rounded-lg p-4 space-y-1.5 max-w-[150px] mx-auto">
              <QrCode className="h-6 w-6 text-purple-400 mx-auto" />
              <p className="text-[9px] text-purple-600 font-medium">QR de Yape no configurado</p>
            </div>
          )}

          {/* Línea divisoria decorativa */}
          <div className="border-t border-dashed border-gray-300 pt-1"></div>

          {/* FRASE DE AGRADECIMIENTO EXACTAMENTE ABAJO DEL QR */}
          <div>
            <p className="text-gray-900 italic font-bold tracking-wide text-xs">
              "{form.mensaje_ticket || '¡Gracias por su preferencia!'}"
            </p>
            <p className="text-[9px] text-gray-400 mt-1">D' Camilos Pizzería &copy;</p>
          </div>

        </div>
      </div>
      
      {/* Bordes serrados inferiores */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-gray-200 via-white to-gray-200 bg-[size:10px_6px] bg-repeat-x"></div>
    </div>
  );
};

// ─── Página principal de configuración ──────────────────────────────────────
export const Configuracion = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('ticket');
  const [isUploadingYape, setIsUploadingYape] = useState(false);
  const [qrError, setQrError] = useState('');

  const yapeInputRef = useRef(null);

  const { data: configData, isLoading } = useQuery({
    queryKey: ['configuracion'],
    queryFn: getConfiguracion,
    staleTime: 60000,
  });

  const [form, setForm] = useState(null);

  // Sincronizar form cuando llegan los datos
  if (configData && !form) {
    setForm({
      nombre_restaurante: configData.nombre_restaurante || '',
      ruc: configData.ruc || '',
      direccion: configData.direccion || '',
      telefono: configData.telefono || '',
      qr_yape_numero: configData.qr_yape_numero || '',
      qr_yape_url: configData.qr_yape_url || '',
      qr_yape_contenido: configData.qr_yape_contenido || '',
      mensaje_ticket: configData.mensaje_ticket || '',
      logo_url: configData.logo_url || '',
    });
  }

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const saved = await updateConfiguracion(data);
      // Notificar al microservicio local de impresión
      await recargarConfigImpresora();
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['configuracion']);
      Swal.fire({
        icon: 'success',
        title: '¡Configuración guardada!',
        text: 'Los cambios se aplicarán en el próximo ticket impreso.',
        timer: 2500,
        showConfirmButton: false,
      });
    },
    onError: (err) => {
      Swal.fire('Error', err.message || 'No se pudo guardar la configuración', 'error');
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };



  // 📱 Subida, decodificación y validación del QR Oficial de Yape
  const handleYapeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      Swal.fire('Error', 'La imagen es muy pesada (Máximo 5MB)', 'error');
      return;
    }

    setQrError('');
    setIsUploadingYape(true);

    try {
      // 1. Decodificar el QR en tiempo real en el navegador
      const reader = new FileReader();
      const decodePromise = new Promise((resolve, reject) => {
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              
              // Ajustar la escala de imágenes gigantescas para optimizar lectura
              const maxDim = 1000;
              let width = img.width;
              let height = img.height;
              if (width > maxDim || height > maxDim) {
                if (width > height) {
                  height = (height / width) * maxDim;
                  width = maxDim;
                } else {
                  width = (width / height) * maxDim;
                  height = maxDim;
                }
              }
              
              canvas.width = width;
              canvas.height = height;
              ctx.drawImage(img, 0, 0, width, height);
              
              const imageData = ctx.getImageData(0, 0, width, height);
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              
              if (code) {
                resolve(code.data);
              } else {
                reject(new Error('No se detectó ningún código QR en la imagen. Por favor, sube la imagen nítida del QR oficial de Yape.'));
              }
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = () => reject(new Error('Error al cargar la imagen.'));
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });

      const qrContenido = await decodePromise;
      
      // 2. Si es válido, subir la imagen a Cloudinary para el frontend/pantalla
      const uploadData = new FormData();
      uploadData.append('imagen', file);
      
      const response = await api.post('/upload', uploadData, {
        headers: { 'Content-Type': undefined }
      });

      if (response.data.success) {
        setForm(prev => ({
          ...prev,
          qr_yape_url: response.data.data.url,
          qr_yape_contenido: qrContenido
        }));
        
        Swal.fire({
          icon: 'success',
          title: '¡QR de Yape Cargado!',
          text: 'Se detectó el código QR y la imagen oficial se guardó correctamente.',
          timer: 3000,
          showConfirmButton: false
        });
      } else {
        throw new Error(response.data.message || 'Error al subir la imagen');
      }
    } catch (error) {
      console.error("Error al procesar el QR:", error);
      setQrError(error.message || 'Error al procesar la imagen.');
      Swal.fire({
        icon: 'error',
        title: 'Error de Lectura del QR',
        text: error.message || 'No se pudo leer un código QR en la imagen. Asegúrate de que sea el QR oficial y que esté nítido.',
        confirmButtonColor: '#7c3aed'
      });
    } finally {
      setIsUploadingYape(false);
      if (yapeInputRef.current) yapeInputRef.current.value = '';
    }
  };

  // 🗑️ Eliminar QR de Yape
  const handleRemoveYape = () => {
    setForm(prev => ({
      ...prev,
      qr_yape_url: '',
      qr_yape_contenido: ''
    }));
  };

  const tabs = [
    { id: 'ticket', label: 'Ticket de Impresión', icon: Receipt, available: true },
    { id: 'negocio', label: 'Datos del Negocio', icon: Settings, available: false },
    { id: 'impresora', label: 'Impresora', icon: Printer, available: false },
  ];

  if (isLoading || !form) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
        <p className="text-sm font-medium text-slate-500">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Premium */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-8 md:p-10 shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-purple-600/20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-40 w-40 rounded-full bg-blue-600/20 blur-3xl"></div>
        
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6 z-10">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              Configuración del Sistema
            </h1>
            <p className="text-slate-400 text-sm max-w-xl">
              Configura el encabezado, logotipo y código QR de Yape para los comprobantes que se emiten en la caja de la Pizzería.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-slate-800/80 backdrop-blur border border-slate-700/50 rounded-2xl px-5 py-4 shrink-0">
            <div className="h-10 w-10 bg-purple-500/10 border border-purple-500/30 rounded-xl flex items-center justify-center">
              <Settings className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Estado de Caja</p>
              <p className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span> Activo
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Sidebar Nav */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="bg-white rounded-3xl border border-slate-150 p-3 shadow-md space-y-2">
            <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200/50 mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Módulos</p>
              <p className="text-lg font-extrabold text-slate-800">Panel de Control</p>
            </div>
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => tab.available && setActiveTab(tab.id)}
                    disabled={!tab.available}
                    className={`
                      w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200
                      ${isActive
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-200 scale-[1.02]'
                        : tab.available
                          ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          : 'text-slate-400 cursor-not-allowed'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-white' : tab.available ? 'text-slate-500' : 'text-slate-400'}`} />
                      <span>{tab.label}</span>
                    </div>
                    {tab.available ? (
                      <ChevronRight className={`h-4 w-4 transition-opacity ${isActive ? 'opacity-100 text-white' : 'opacity-0'}`} />
                    ) : (
                      <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">Pronto</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        {activeTab === 'ticket' && (
          <div className="flex-1 w-full grid grid-cols-1 xl:grid-cols-5 gap-8 items-start">
            
            {/* Formulario Rediseñado */}
            <div className="xl:col-span-3 space-y-6">
              
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* 1. Datos del Establecimiento Card */}
                <div className="bg-white rounded-3xl border border-slate-150 shadow-md overflow-hidden">
                  <div className="p-6 bg-slate-50 border-b border-slate-150 flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center">
                      <Building className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Datos de Cabecera del Ticket</h2>
                      <p className="text-xs text-slate-400">Datos de identificación tributaria y contacto</p>
                    </div>
                  </div>
                  
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Nombre */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Nombre del Restaurante / Razón Social
                      </label>
                      <div className="relative rounded-xl shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Building className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          name="nombre_restaurante"
                          value={form.nombre_restaurante}
                          onChange={handleChange}
                          placeholder="D' CAMILOS PIZZERIA"
                          className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-slate-300 font-medium"
                        />
                      </div>
                    </div>

                    {/* RUC */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        RUC
                      </label>
                      <div className="relative rounded-xl shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <FileText className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          name="ruc"
                          value={form.ruc}
                          onChange={handleChange}
                          placeholder="20123456789"
                          maxLength={11}
                          className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-slate-300 font-medium"
                        />
                      </div>
                    </div>

                    {/* Teléfono */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Teléfono / Delivery
                      </label>
                      <div className="relative rounded-xl shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Phone className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          name="telefono"
                          value={form.telefono}
                          onChange={handleChange}
                          placeholder="942 685 506"
                          className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-slate-300 font-medium"
                        />
                      </div>
                    </div>

                    {/* Dirección */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Dirección del Local
                      </label>
                      <div className="relative rounded-xl shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <MapPin className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          name="direccion"
                          value={form.direccion}
                          onChange={handleChange}
                          placeholder="Jr. Belen 185 - Esperanza Parte Baja"
                          className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-slate-300 font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Personalización del Ticket */}
                <div className="bg-white rounded-3xl border border-slate-150 shadow-md overflow-hidden">
                  <div className="p-6 bg-slate-50 border-b border-slate-150 flex items-center gap-3">
                    <div className="h-10 w-10 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center">
                      <FileText className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Mensaje de Agradecimiento</h2>
                      <p className="text-xs text-slate-400">Frase final que se muestra al pie del comprobante</p>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    {/* Mensaje final */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Frase de Agradecimiento / Mensaje del Ticket
                      </label>
                      <input
                        type="text"
                        name="mensaje_ticket"
                        value={form.mensaje_ticket}
                        onChange={handleChange}
                        placeholder="¡Gracias por su preferencia!"
                        className="block w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-slate-300 font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Subida del QR de Yape Oficial (DISEÑO PREMIUM DEDICADO) */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 shadow-md rounded-3xl overflow-hidden">
                  <div className="p-6 bg-purple-600 border-b border-purple-700 flex items-center gap-3 text-white">
                    <div className="h-10 w-10 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center">
                      <QrCode className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold">Subir QR Oficial de Yape</h2>
                      <p className="text-xs text-purple-200">Decodificación directa y previsualización HD</p>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">


                    {form.qr_yape_url ? (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-white border border-purple-200 rounded-2xl shadow-sm">
                          <img 
                            src={form.qr_yape_url} 
                            alt="QR de Yape" 
                            className="h-24 w-24 object-contain bg-slate-50 border border-slate-100 rounded-xl p-1 shrink-0"
                          />
                          <div className="flex-1 space-y-1.5 w-full overflow-hidden text-center sm:text-left">
                            <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full uppercase">
                                QR Oficial Activo
                              </span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Decodificado
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-800 truncate">Imagen oficial de Yape subida</p>
                            <p className="text-[10px] text-slate-500 font-mono select-all truncate bg-slate-50 p-1 rounded border border-slate-200">
                              {form.qr_yape_contenido || 'Enlace no extraído'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveYape}
                            className="h-10 w-10 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl flex items-center justify-center transition-colors border border-rose-100 shrink-0"
                            title="Eliminar QR"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div 
                          onClick={() => yapeInputRef.current?.click()}
                          className={`
                            border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
                            ${isUploadingYape 
                              ? 'border-purple-500 bg-purple-50' 
                              : 'border-purple-300 bg-purple-50/20 hover:border-purple-600 hover:bg-purple-50/40 hover:shadow-md'
                            }
                          `}
                        >
                          <input
                            type="file"
                            ref={yapeInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleYapeUpload}
                            disabled={isUploadingYape}
                          />
                          {isUploadingYape ? (
                            <div className="space-y-3">
                              <RefreshCw className="h-10 w-10 text-purple-600 animate-spin mx-auto" />
                              <p className="text-sm font-bold text-purple-800">Procesando y decodificando QR de Yape...</p>
                              <p className="text-xs text-purple-500">Estamos extrayendo el enlace de pago seguro en tu navegador</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <QrCode className="h-10 w-10 text-purple-500 mx-auto animate-pulse" />
                              <p className="text-sm font-bold text-purple-950">Selecciona o arrastra el QR oficial de Yape</p>
                              <p className="text-xs text-purple-500">El sistema validará que la imagen contenga un código QR de Yape antes de subirla</p>
                            </div>
                          )}
                        </div>
                        {qrError && (
                          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <p>{qrError}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón de Guardar Todo */}
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={saveMutation.isPending || isUploadingYape}
                    className="flex-1 flex items-center justify-center gap-2.5 px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-base font-bold shadow-lg shadow-purple-100 disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    {saveMutation.isPending ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <Save className="h-5 w-5" />
                    )}
                    {saveMutation.isPending ? 'Guardando cambios...' : 'Guardar Configuración General'}
                  </button>
                </div>
              </form>
            </div>

            {/* Vista Previa del Ticket (Fija y estilizada) */}
            <div className="xl:col-span-2 space-y-4 lg:sticky lg:top-6">
              <div className="bg-slate-100 border border-slate-200 rounded-3xl p-6 shadow-inner text-center space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Printer className="h-5 w-5 text-slate-600" />
                    <span className="font-extrabold text-sm text-slate-700">Vista de Comprobante</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                    Papel Térmico 80mm
                  </span>
                </div>
                
                <TicketPreview form={form} />
                
                <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-100 rounded-2xl text-left">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    <strong>Impresora Térmica Local:</strong> Asegúrate de tener el microservicio encendido en la PC de caja (`puerto 3001`) para que los cambios en el QR e información de contacto se apliquen físicamente al instante de mandar a imprimir.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
