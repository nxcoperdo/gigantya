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
import { Search, ShoppingCart, Send, X, Trash2, Plus, Minus, User as UserIcon } from 'lucide-react';
import axios from 'axios';
import { usePosRestaurante } from '../../hooks/usePosRestaurante';
import { POSTicketProvider, usePOSTicket } from '../../context/POSTicketContext';
import { posTablesService, posOrdersService, printService } from '../../services/api';
import socketService from '../../services/socket';
import ProductCustomizationModal from '../../components/ProductCustomizationModal';
import TablePickerModal from '../../components/pos/TablePickerModal';
import WalkInCustomerModal from '../../components/pos/WalkInCustomerModal';
import AutoPrintIframe from '../../components/pos/AutoPrintIframe';
import { formatCurrency } from '../../utils/formatHelper';

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
    return <div className="p-8 text-center text-[color:var(--text-muted)]">Cargando menú…</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* ============ IZQUIERDA: selección ============ */}
      <div className="lg:col-span-2 space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Tomar pedido</h1>
          <button
            onClick={() => setShowTablePicker(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-[color:var(--bg-elevated)] border border-[color:var(--border)] hover:bg-[color:var(--bg)]"
            type="button"
          >
            <UserIcon className="w-4 h-4" />
            {ticket.meta.tipo === 'dine_in'
              ? `Mesa ${ticket.meta.mesa_id || '?'}`
              : ticket.meta.tipo === 'pickup' ? 'Recoger' : 'Domicilio'}
            {ticket.meta.cliente_nombre ? ` · ${ticket.meta.cliente_nombre}` : ''}
          </button>
        </header>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-muted)]" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto…"
              className="w-full pl-9 pr-3 py-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-sm"
            />
          </div>
          <select
            value={categoriaId || ''}
            onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-sm"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        {error && (
          <div className="px-3 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {productosFiltrados.map((p) => (
            <button
              key={p.id}
              onClick={() => setProductoParaCustom(p)}
              className="text-left p-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elevated)] hover:border-[color:var(--primary,#3b82f6)]/50 transition"
              type="button"
            >
              <div className="font-medium text-sm">{p.nombre}</div>
              <div className="text-xs text-[color:var(--text-muted)] mt-1">{formatCurrency(p.precio)}</div>
              {p.descripcion && (
                <div className="text-[11px] text-[color:var(--text-muted)] mt-1 line-clamp-2">{p.descripcion}</div>
              )}
            </button>
          ))}
          {productosFiltrados.length === 0 && (
            <div className="col-span-full text-center text-[color:var(--text-muted)] py-8">
              No hay productos disponibles
            </div>
          )}
        </div>
      </div>

      {/* ============ DERECHA: ticket ============ */}
      <aside className="bg-[color:var(--bg-elevated)] border border-[color:var(--border)] rounded-lg p-3 flex flex-col h-fit sticky top-3">
        <header className="flex items-center gap-2 mb-2">
          <ShoppingCart className="w-5 h-5" />
          <h2 className="font-semibold">Ticket en curso</h2>
          <span className="ml-auto text-xs text-[color:var(--text-muted)]">{ticket.items.length} ítems</span>
        </header>

        {ticket.items.length === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)] py-6 text-center">
            Tocá un producto de la grilla para agregarlo.
          </p>
        ) : (
          <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
            {ticket.items.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-sm border-b border-[color:var(--border)] pb-2">
                <div className="flex-1">
                  <div className="font-medium">{it.nombre}</div>
                  {it.adiciones.length > 0 && (
                    <div className="text-xs text-[color:var(--text-muted)]">
                      + {it.adiciones.map((a) => `${a.cantidad}× ${a.nombre}`).join(', ')}
                    </div>
                  )}
                  {it.removidos.length > 0 && (
                    <div className="text-xs text-rose-300">sin: {it.removidos.map((r) => r.nombre).join(', ')}</div>
                  )}
                  {it.nota && <div className="text-xs italic text-[color:var(--text-muted)]">"{it.nota}"</div>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <button onClick={() => ticket.updateQty(i, -1)} className="p-1 rounded hover:bg-[color:var(--bg)]" type="button" aria-label="Restar">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center">{it.cantidad}</span>
                    <button onClick={() => ticket.updateQty(i, +1)} className="p-1 rounded hover:bg-[color:var(--bg)]" type="button" aria-label="Sumar">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-xs text-[color:var(--text-muted)]">{formatCurrency(it.subtotal)}</div>
                  <button onClick={() => ticket.removeItem(i)} className="p-1 rounded text-rose-400 hover:bg-rose-500/10" type="button" aria-label="Quitar">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 pt-3 border-t border-[color:var(--border)]">
          <textarea
            value={ticket.meta.notas}
            onChange={(e) => ticket.updateMeta({ notas: e.target.value })}
            placeholder="Notas del pedido (opcional)…"
            className="w-full px-2 py-1.5 text-xs rounded border border-[color:var(--border)] bg-[color:var(--bg)]"
            rows={2}
          />
          <div className="flex items-center justify-between mt-2 text-sm font-semibold">
            <span>Total</span>
            <span>{formatCurrency(ticket.total)}</span>
          </div>
          <button
            onClick={enviarCocina}
            disabled={sending || ticket.items.length === 0}
            className="w-full mt-3 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-[color:var(--primary,#3b82f6)] text-white text-sm font-medium disabled:opacity-50"
            type="button"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Enviando…' : 'Enviar a cocina'}
          </button>
          {ticket.items.length > 0 && (
            <button
              onClick={() => ticket.clear()}
              className="w-full mt-1 inline-flex items-center justify-center gap-1 text-xs text-rose-400 hover:underline"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[color:var(--bg-elevated)] rounded-lg p-6 max-w-sm w-full border border-[color:var(--border)] text-center">
            <div className="text-3xl mb-2">✅</div>
            <h3 className="text-lg font-semibold mb-1">Pedido #{confirmSent.id} enviado</h3>
            <p className="text-sm text-[color:var(--text-muted)] mb-4">La cocina ya lo está viendo.</p>
            <button
              onClick={() => setConfirmSent(null)}
              className="w-full px-3 py-2 rounded-md bg-[color:var(--primary,#3b82f6)] text-white text-sm"
              type="button"
            >Aceptar</button>
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
 * de modificadores del producto. Lo carga on-demand. */
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
        <div className="text-[color:var(--text-muted)]">Cargando modificadores…</div>
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
