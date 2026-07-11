/**
 * Página de toma de pedidos del POS (Fase 3).
 *
 * Layout 2 columnas:
 *   - Izquierda: header con tipo/mesa/cliente, grilla de productos,
 *     buscador por nombre.
 *   - Derecha: ticket en curso con items, controles de cantidad, notas,
 *     total, y botón "Enviar a cocina".
 *
 * El mesero elige primero mesa/pickup/delivery (modal `TablePickerModal`),
 * después agrega items al ticket (modal `ProductCustomizationModal` reusado
 * del cliente), y al final envía. Si es walk-in (sin cliente), pide nombre
 * y teléfono antes de enviar.
 *
 * Categorías: se listan en un dropdown. Sin categoría = todos.
 */
import { useEffect, useMemo, useState } from 'react';
import { Search, ShoppingCart, Send, X, Trash2, Plus, Minus, User as UserIcon, ChefHat, CheckCircle2, Loader2 } from 'lucide-react';
import axios from 'axios';
import { usePosRestaurante } from '../../hooks/usePosRestaurante';
import { POSTicketProvider, usePOSTicket } from '../../context/POSTicketContext';
import { posOrdersService, printService } from '../../services/api';
import socketService from '../../services/socket';
import ProductCustomizationModal from '../../components/ProductCustomizationModal';
import TablePickerModal from '../../components/pos/TablePickerModal';
import WalkInCustomerModal from '../../components/pos/WalkInCustomerModal';
import AutoPrintIframe from '../../components/pos/AutoPrintIframe';
import { formatCurrency } from '../../utils/formatHelper';

const inputCls = 'w-full pl-9 pr-3 py-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40 focus:border-[color:var(--primary,#3b82f6)] transition';

function TakeOrderInner() {
  const { user, restauranteId } = usePosRestaurante();
  const ticket = usePOSTicket();
  const [categorias, setCategorias] = useState([]);
  const [categoriaId, setCategoriaId] = useState(null);
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productoParaCustom, setProductoParaCustom] = useState(null);
  const [showTablePicker, setShowTablePicker] = useState(true);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmSent, setConfirmSent] = useState(null);
  const [printUrl, setPrintUrl] = useState(null);

  // Cargar categorías y productos del restaurante del staff.
  useEffect(() => {
    if (!restauranteId) return;
    const api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [cats, prods] = await Promise.all([
          api.get('/categorias').then((r) => {
            // /api/categorias devuelve TODAS las categorías con su restaurante.
            // Filtramos en cliente las del restaurante del staff.
            const list = r.data.categorias || r.data || [];
            return list.filter((c) => Number(c.restaurante_id) === Number(restauranteId));
          }).catch(() => []),
          api.get(`/products/restaurant/${restauranteId}`).then((r) => r.data.productos || []).catch(() => []),
        ]);
        if (cancelled) return;
        setCategorias(Array.isArray(cats) ? cats : (cats.categorias || []));
        setProductos(prods);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [restauranteId]);

  // Socket: escuchar nuevos pedidos del restaurante (para que el mesero
  // vea confirmación visual de que "su" pedido llegó a cocina).
  useEffect(() => {
    if (!restauranteId) return;
    socketService.connectOrders();
    socketService.joinRestaurant(restauranteId, user.id);
  }, [restauranteId, user?.id]);

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      if (p.disponible !== 1 || p.estado !== 'activo') return false;
      if (categoriaId && Number(p.categoria_id) !== Number(categoriaId)) return false;
      if (busqueda.trim() && !p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())) return false;
      return true;
    });
  }, [productos, categoriaId, busqueda]);

  const onCustomAdd = (itemCustom) => {
    // El modal devuelve: { cantidad, adiciones, removidos, nota,
    //   precioUnitarioFinal, subtotalItem }
    // Adaptamos al shape del backend + agregamos producto_id y nombre.
    const shape = {
      producto_id: itemCustom.producto_id,
      nombre: itemCustom.nombre,
      cantidad: itemCustom.cantidad,
      adiciones: itemCustom.adiciones.map((a) => ({
        adicion_id: a.id,
        cantidad: a.cantidad,
        precio_unitario_adicion: a.precio_unitario_adicion,
        nombre: a.nombre,
        grupo_nombre: a.grupo_nombre || null,
      })),
      removidos: itemCustom.removidos.map((r) => ({ id: r.id, nombre: r.nombre })),
      nota: itemCustom.nota,
      precioUnitario: itemCustom.precioUnitarioFinal,
      subtotal: itemCustom.subtotalItem,
    };
    ticket.addItem(shape);
  };

  const enviarCocina = async () => {
    if (ticket.items.length === 0) return;
    // Si es dine_in sin mesa, pedir.
    if (ticket.meta.tipo === 'dine_in' && !ticket.meta.mesa_id) {
      setShowTablePicker(true);
      return;
    }
    // Si es delivery sin dirección, pedirla (rápido: prompt).
    if (ticket.meta.tipo === 'delivery' && !ticket.meta.direccion_entrega.trim()) {
      setError('Falta la dirección de entrega');
      return;
    }
    // Si no hay cliente, pedir walk-in.
    if (!ticket.meta.cliente_id && !ticket.meta.cliente_nombre.trim()) {
      setShowWalkIn(true);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const itemsPayload = ticket.items.map((it) => ({
        producto_id: it.producto_id,
        cantidad: it.cantidad,
        adiciones: it.adiciones.map((a) => ({
          adicion_id: a.adicion_id,
          cantidad: a.cantidad,
        })),
        removidos: it.removidos.map((r) => ({ id: r.id })),
        nota: it.nota || undefined,
      }));
      const payload = {
        tipo: ticket.meta.tipo,
        mesa_id: ticket.meta.tipo === 'dine_in' ? ticket.meta.mesa_id : null,
        cliente_id: ticket.meta.cliente_id,
        cliente_nombre: ticket.meta.cliente_nombre,
        cliente_telefono: ticket.meta.cliente_telefono,
        direccion_entrega: ticket.meta.tipo === 'delivery' ? ticket.meta.direccion_entrega : undefined,
        notas: ticket.meta.notas,
        items: itemsPayload,
        total: ticket.total,
      };
      const r = await posOrdersService.create(payload);
      setConfirmSent(r.data.pedido);
      // Auto-imprimir la comanda en la tablet del mesero (no es la de
      // cocina — esa la dispara el KDS por socket). Si falla, el mesero
      // puede re-imprimir desde el detalle del pedido (Fase 5).
      if (r.data.print_url) {
        try {
          const pdfBlob = await printService.kitchenTicket(r.data.pedido.id);
          const url = URL.createObjectURL(pdfBlob.data);
          setPrintUrl(url);
        } catch (e) { /* noop */ }
      }
      ticket.clear();
    } catch (e2) {
      setError(e2.response?.data?.error || e2.message || 'Error enviando pedido');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-[color:var(--text-muted)] flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-2 border-[color:var(--primary)]/30 border-t-[color:var(--primary)] rounded-full animate-spin" />
        <span>Cargando menú…</span>
      </div>
    );
  }

  // Resumen del header (mesa/pickup/delivery + cliente)
  const contextLabel =
    ticket.meta.tipo === 'dine_in'  ? `Mesa ${ticket.meta.mesa_id || '?'}` :
    ticket.meta.tipo === 'pickup'   ? 'Recoger' :
    'Domicilio';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* ============ IZQUIERDA: selección ============ */}
      <div className="lg:col-span-2 space-y-3 min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #FF6B00 0%, #B34B00 100%)' }}
              aria-hidden="true"
            >
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-heading font-extrabold">Tomar pedido</h1>
          </div>
          <button
            onClick={() => setShowTablePicker(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[color:var(--bg-elevated)] border border-[color:var(--border)] hover:bg-[color:var(--bg)] transition-colors"
            type="button"
          >
            <UserIcon className="w-4 h-4" aria-hidden="true" />
            {contextLabel}
            {ticket.meta.cliente_nombre ? ` · ${ticket.meta.cliente_nombre}` : ''}
          </button>
        </header>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)] pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto…"
              className={inputCls}
            />
          </div>
          <select
            value={categoriaId || ''}
            onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        {error && (
          <div
            role="alert"
            className="px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between gap-2"
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-xs underline font-medium hover:no-underline">Cerrar</button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {productosFiltrados.map((p) => (
            <button
              key={p.id}
              onClick={() => setProductoParaCustom(p)}
              className="text-left p-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] hover:border-[color:var(--primary,#3b82f6)]/60 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all"
              type="button"
            >
              <div className="font-semibold text-sm leading-snug">{p.nombre}</div>
              <div className="text-sm font-mono font-bold text-[color:var(--primary,#3b82f6)] mt-1.5">{formatCurrency(p.precio)}</div>
              {p.descripcion && (
                <div className="text-[11px] text-[color:var(--text-muted)] mt-1 line-clamp-2 leading-snug">{p.descripcion}</div>
              )}
            </button>
          ))}
          {productosFiltrados.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center text-center py-12 text-[color:var(--text-muted)] border-2 border-dashed border-[color:var(--border)] rounded-xl">
              <Search className="w-6 h-6 mb-2 opacity-40" aria-hidden="true" />
              <p className="text-sm font-medium">No hay productos disponibles</p>
              {busqueda && <p className="text-xs mt-1">Prueba limpiar el buscador o cambiar de categoría.</p>}
            </div>
          )}
        </div>
      </div>

      {/* ============ DERECHA: ticket ============ */}
      <aside className="bg-[color:var(--bg-elevated)] border border-[color:var(--border)] rounded-xl p-3 flex flex-col h-fit lg:sticky lg:top-3 shadow-sm">
        <header className="flex items-center gap-2 mb-2 pb-2 border-b border-[color:var(--border)]">
          <ShoppingCart className="w-5 h-5 text-[color:var(--primary,#3b82f6)]" aria-hidden="true" />
          <h2 className="font-heading font-bold">Ticket en curso</h2>
          <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-[color:var(--primary,#3b82f6)]/15 text-[color:var(--primary,#3b82f6)]">
            {ticket.items.length}
          </span>
        </header>

        {ticket.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-8 text-[color:var(--text-muted)]">
            <ShoppingCart className="w-8 h-8 mb-2 opacity-30" aria-hidden="true" />
            <p className="text-sm font-medium">Ticket vacío</p>
            <p className="text-xs mt-1 max-w-[200px]">Tocá un producto de la grilla para agregarlo.</p>
          </div>
        ) : (
          <ul className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {ticket.items.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-sm border-b border-[color:var(--border)] pb-2 last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold leading-snug">{it.nombre}</div>
                  {it.adiciones.length > 0 && (
                    <div className="text-xs text-[color:var(--text-muted)] mt-0.5">
                      + {it.adiciones.map((a) => `${a.cantidad}× ${a.nombre}`).join(', ')}
                    </div>
                  )}
                  {it.removidos.length > 0 && (
                    <div className="text-xs text-rose-300 mt-0.5">sin: {it.removidos.map((r) => r.nombre).join(', ')}</div>
                  )}
                  {it.nota && <div className="text-xs italic text-amber-600 mt-0.5">"{it.nota}"</div>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => ticket.updateQty(i, -1)}
                      className="w-7 h-7 rounded-md hover:bg-[color:var(--bg)] flex items-center justify-center transition-colors"
                      type="button"
                      aria-label="Restar uno"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center text-sm font-bold tabular-nums">{it.cantidad}</span>
                    <button
                      onClick={() => ticket.updateQty(i, +1)}
                      className="w-7 h-7 rounded-md hover:bg-[color:var(--bg)] flex items-center justify-center transition-colors"
                      type="button"
                      aria-label="Sumar uno"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-xs font-mono text-[color:var(--text-muted)]">{formatCurrency(it.subtotal)}</div>
                  <button
                    onClick={() => ticket.removeItem(i)}
                    className="p-1 rounded text-rose-400 hover:bg-rose-500/10 transition-colors"
                    type="button"
                    aria-label="Quitar item"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 pt-3 border-t border-[color:var(--border)] space-y-2">
          <textarea
            value={ticket.meta.notas}
            onChange={(e) => ticket.updateMeta({ notas: e.target.value })}
            placeholder="Notas del pedido (opcional)…"
            className="w-full px-2.5 py-2 text-xs rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] resize-none focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/30"
            rows={2}
          />
          <div className="flex items-center justify-between text-base font-bold">
            <span>Total</span>
            <span className="font-mono">{formatCurrency(ticket.total)}</span>
          </div>
          <button
            onClick={enviarCocina}
            disabled={sending || ticket.items.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[color:var(--primary,#3b82f6)] hover:opacity-90 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-sm"
            type="button"
          >
            {sending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
            ) : (
              <><Send className="w-4 h-4" /> Enviar a cocina</>
            )}
          </button>
          {ticket.items.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('¿Cancelar el ticket actual?')) ticket.clear();
              }}
              className="w-full inline-flex items-center justify-center gap-1 text-xs text-rose-400 hover:text-rose-300 hover:underline py-1 transition-colors"
              type="button"
            >
              <X className="w-3 h-3" /> Cancelar ticket
            </button>
          )}
        </div>
      </aside>

      {/* ============ Modales ============ */}
      {showTablePicker && (
        <TablePickerModal
          onClose={() => setShowTablePicker(false)}
          onPicked={(data) => {
            ticket.updateMeta(data);
            setShowTablePicker(false);
            // Si el tipo requiere cliente, abrir WalkIn
            if (!data.cliente_id && (data.tipo === 'pickup' || data.tipo === 'delivery')) {
              setShowWalkIn(true);
            }
          }}
        />
      )}

      {showWalkIn && (
        <WalkInCustomerModal
          onClose={() => setShowWalkIn(false)}
          onPicked={(cliente) => {
            ticket.updateMeta({
              cliente_id: cliente.id,
              cliente_nombre: cliente.nombre,
              cliente_telefono: cliente.telefono || '',
            });
            setShowWalkIn(false);
          }}
        />
      )}

      {productoParaCustom && (
        <ProductCustomizationWrapper
          producto={productoParaCustom}
          onClose={() => setProductoParaCustom(null)}
          onAdd={(data) => {
            onCustomAdd({ ...data, producto_id: productoParaCustom.id, nombre: productoParaCustom.nombre });
            setProductoParaCustom(null);
          }}
        />
      )}

      {confirmSent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[color:var(--bg-elevated)] rounded-2xl p-6 max-w-sm w-full border border-[color:var(--border)] text-center shadow-2xl">
            <div
              className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              aria-hidden="true"
            >
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-heading font-bold mb-1">Pedido #{confirmSent.id} enviado</h3>
            <p className="text-sm text-[color:var(--text-muted)] mb-5">La cocina ya lo está viendo. Te avisamos cuando esté listo.</p>
            <button
              onClick={() => setConfirmSent(null)}
              className="w-full px-4 py-2.5 rounded-lg bg-[color:var(--primary,#3b82f6)] hover:opacity-90 text-white text-sm font-semibold active:scale-[0.98] transition-all"
              type="button"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      <AutoPrintIframe url={printUrl} onPrinted={() => {
        setTimeout(() => setPrintUrl(null), 3000);
      }} />
    </div>
  );
}

/** Wrapper: el `ProductCustomizationModal` reusado necesita el `paquete`
 * de modificadores del producto. Lo carga on-demand.
 *
 * Fase 10 — Modificadores configurables: el render adaptativo (radio
 * chips vs +/-), los mensajes contextuales ("Obligatorio · elige 1 opción")
 * y la deshabilitación del botón "Agregar" se aplican automáticamente al
 * POS porque viven en el `ProductCustomizationModal` compartido con el
 * cliente web. La validación backend (`validateAdicionesYRemovibles`
 * en `orderService.js`) también aplica al POS, ya que `createPosOrder`
 * → `createOrderCore` → `validateAdicionesYRemovibles`. Cero código
 * POS-específico fue necesario para soportar obligatoriedad/min/max. */
function ProductCustomizationWrapper({ producto, onClose, onAdd }) {
  const [paquete, setPaquete] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = axios.create({
          baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const r = await api.get(`/products/${producto.id}/paquete-modificadores`);
        if (!cancelled) setPaquete(r.data);
      } catch (_) { /* noop */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [producto.id]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
        <div className="text-[color:var(--text-muted)] inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando modificadores…
        </div>
      </div>
    );
  }
  return <ProductCustomizationModal producto={producto} paquete={paquete} isOpen={true} onClose={onClose} onAdd={onAdd} />;
}

export default function TakeOrderPage() {
  return (
    <POSTicketProvider>
      <TakeOrderInner />
    </POSTicketProvider>
  );
}
