import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, User, Loader2, BarChart3, Trophy, Wallet, UtensilsCrossed, AlertTriangle } from 'lucide-react';
import { cajaService } from '@/services/caja.service';

// Atajos analíticos
const SUGGESTED_QUERIES = [
  { label: 'Ventas hoy', query: '¿Cuánto hemos vendido hoy?', icon: <BarChart3 className="h-3 w-3" /> },
  { label: 'Top platos', query: '¿Cuáles son los 3 platos más vendidos?', icon: <Trophy className="h-3 w-3" /> },
  { label: 'Ingresos Yape', query: '¿Cuánto dinero ha ingresado por Yape hoy?', icon: <Wallet className="h-3 w-3" /> },
  { label: 'Mesas activas', query: '¿Cuántas mesas están ocupadas?', icon: <UtensilsCrossed className="h-3 w-3" /> },
  { label: 'Stock bajo', query: '¿Qué productos tienen poco stock?', icon: <AlertTriangle className="h-3 w-3" /> },
];

export const CopilotoIA = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mensajes, setMensajes] = useState([
    {
      rol: 'ia',
      texto: 'Hola 👋 Soy Jov AI. Estoy listo para analizar los datos de tu negocio. ¿Qué métrica deseas revisar?',
    },
  ]);

  const mensajesEndRef = useRef(null);

  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, isLoading]);

  const procesarEnvio = async (textoAEnviar) => {
    if (!textoAEnviar.trim()) return;

    setMensajes((prev) => [...prev, { rol: 'usuario', texto: textoAEnviar }]);
    setMensaje('');
    setIsLoading(true);

    try {
      let cajaActivaId = null;
      try {
        const estado = await cajaService.verificarCajaAbierta();
        if (estado?.caja) cajaActivaId = estado.caja.id;
      } catch {
        console.warn('Sin caja activa');
      }

      const response = await fetch('http://localhost:3000/api/ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: textoAEnviar, caja_id: cajaActivaId }),
      });

      const data = await response.json();
      const respuesta = data.success
        ? data.data.respuesta
        : 'Lo siento, tuve un problema al procesar los datos. 😔';

      setMensajes((prev) => [...prev, { rol: 'ia', texto: respuesta }]);
    } catch {
      setMensajes((prev) => [
        ...prev,
        { rol: 'ia', texto: 'Error de conexión. Verifica que el servidor esté activo.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    procesarEnvio(mensaje);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">

      {/* Panel principal */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Jov AI Gerencial — asistente de análisis"
          className="absolute bottom-20 right-0 w-[380px] md:w-[400px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300"
        >

          {/* Header — color sólido, sin gradiente */}
          <div className="bg-indigo-600 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/15 p-2 rounded-xl border border-white/20">
                <Bot className="h-5 w-5 text-white" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm tracking-tight leading-none">
                  Jov AI Gerencial
                </h3>
                <p className="text-indigo-200 text-[10px] uppercase font-medium flex items-center gap-1.5 mt-0.5">
                  <span
                    className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"
                    aria-hidden="true"
                  />
                  Conectado a datos reales
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
              aria-label="Cerrar asistente"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Área de mensajes */}
          <div className="h-[400px] overflow-y-auto p-4 bg-slate-50 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-gray-200">
            {mensajes.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-2.5 max-w-[88%] ${msg.rol === 'usuario' ? 'self-end flex-row-reverse' : 'self-start'
                  }`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${msg.rol === 'usuario'
                      ? 'bg-indigo-600'
                      : 'bg-white border border-indigo-100'
                    }`}
                  aria-hidden="true"
                >
                  {msg.rol === 'usuario' ? (
                    <User className="h-4 w-4 text-white" />
                  ) : (
                    <Bot className="h-4 w-4 text-indigo-600" />
                  )}
                </div>

                {/* Burbuja — whitespace-pre-wrap en ambos roles */}
                <div
                  className={`p-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.rol === 'usuario'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                    }`}
                >
                  {msg.texto}
                </div>
              </div>
            ))}

            {/* Indicador de carga */}
            {isLoading && (
              <div className="flex gap-2.5 self-start" aria-label="Jov AI está escribiendo…">
                <div className="w-7 h-7 rounded-lg bg-white border border-indigo-100 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-indigo-400" aria-hidden="true" />
                </div>
                <div className="bg-white border border-slate-200 p-3.5 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={mensajesEndRef} />
          </div>

          {/* Sugerencias rápidas — padding unificado */}
          <div className="px-4 py-2.5 bg-white border-t border-slate-100 flex gap-2 overflow-x-auto no-scrollbar">
            {SUGGESTED_QUERIES.map((item, idx) => (
              <button
                key={idx}
                onClick={() => !isLoading && procesarEnvio(item.query)}
                disabled={isLoading}
                aria-label={`Consulta rápida: ${item.query}`}
                className="flex-shrink-0 flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-[11px] font-semibold hover:bg-indigo-600 hover:text-white transition-colors border border-indigo-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={handleFormSubmit}
            className="p-4 bg-white border-t border-slate-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Escribe tu consulta gerencial…"
              aria-label="Mensaje para Jov AI"
              disabled={isLoading}
              className="flex-1 bg-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400 border-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!mensaje.trim() || isLoading}
              aria-label="Enviar mensaje"
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white p-3 rounded-xl transition-colors active:scale-90"
            >
              {isLoading
                ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                : <Send className="h-5 w-5" aria-hidden="true" />
              }
            </button>
          </form>
        </div>
      )}

      {/* Botón flotante — sin rotación, transición limpia de íconos */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-[0_8px_30px_rgb(79,70,229,0.3)] transition-all duration-500 hover:scale-105 active:scale-95 ${isOpen ? 'bg-slate-900 rotate-180' : 'bg-indigo-600'
          }`}
      >
        {isOpen ? <X className="h-7 w-7" /> : <Sparkles className="h-7 w-7 animate-pulse" />}
      </button>
    </div>
  );
};
