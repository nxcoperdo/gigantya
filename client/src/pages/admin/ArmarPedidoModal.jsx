import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, ShoppingCart, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatHelper';
import chatService from '../../services/chat.js';

/**
 * Modal de "Armar pedido" desde el chat.
 *
 * Aparece cuando el vendedor hace click en "Armar pedido" en
 * ChatAdminPage. Muestra los items sugeridos (los `adjuntos_json` que
 * el cliente clickeó en el catálogo), permite editar/agregar/quitar
 * items, completar modalidad/envío/pago, y al confirmar llama a
 * `POST /api/chat/admin/conversaciones/:id/draft-pedido`.
 *
 * El backend hace el resto: inserta el pedido con origen='web_asistido',
 * marca la conversación como 'convertida', emite el mensaje de sistema
 * "Pedido #N creado", y dispara la notificación al restaurante.
 */
export default function ArmarPedidoModal({ conversacion, onClose, onCreated }) {
  const [items, setItems] = useState([]); // [{producto_id, cantidad, precio_unitario, nombre}]
  const [metodoPago, setMetodoPago] = useState('contra_entrega');
  const [esRetiroLocal, setEsRetiroLocal] = useState(true);
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [telefonoContacto, setTelefonoContacto] = useState(conversacion.cliente_telefono || '');
  const [notas, setNotas] = useState('');
  const [costoEnvio, setCostoEnvio] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Cargar items sugeridos desde el backend (los adjuntos de los mensajes)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await chatService.adminBuildDraft(conversacion.id);
        if (cancelled) return;
        setItems((data.items_sugeridos || []).map((it) => ({
          producto_id: it.producto_id,
          cantidad: it.cantidad,
          precio_unitario: Number(it.precio_unitario) || 0,
          nombre: it.nombre || `Producto #${it.producto_id}`,
        })));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [conversacion.id]);

  const total = useMemo(() => {
    const sub = items.reduce((acc, it) => acc + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0), 0);
    return sub + (esRetiroLocal ? 0 : Number(costoEnvio) || 0);
  }, [items, esRetiroLocal, costoEnvio]);

  const itemValido = (it) => it.producto_id && Number(it.cantidad) > 0 && Number(it.precio_unitario) >= 0;
  const puedeConfirmar = items.length > 0 && items.every(itemValido) && !submitting;

  const cambiarCantidad = (idx, delta) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, cantidad: Math.max(1, Number(it.cantidad) + delta) } : it));
  };
  const cambiarPrecio = (idx, precio) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, precio_unitario: Number(precio) || 0 } : it));
  };
  const eliminarItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!puedeConfirmar) return;
    setError(null);
    setSubmitting(true);
    try {
      const draft = {
        items: items.map((it) => ({
          producto_id: it.producto_id,
          cantidad: it.cantidad,
          // El backend hace SELECT FOR UPDATE y re-valida el precio; lo que
          // mandamos es solo una sugerencia. Si difiere, gana el de la BD.
          // Por eso mandamos los items sin precio_unitario: el backend lo
          // toma de la BD.
        })),
        metodo_pago: metodoPago,
        esRetiroLocal,
        esConsumoEnLocal: false,
        direccion_entrega: esRetiroLocal ? null : (direccionEntrega.trim() || null),
        telefono_contacto: telefonoContacto.trim() || null,
        notas: notas.trim() || null,
        costo_envio: esRetiroLocal ? 0 : Number(costoEnvio) || 0,
        // usuario_id: el cliente es anónimo; el backend crea un walk-in
        // con su nombre + teléfono.
      };
      const res = await chatService.adminConvertToOrder(conversacion.id, draft);
      onCreated(res.pedido_id);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo crear el pedido');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b border-[color:var(--border-subtle)]">
          <div>
            <h2 className="text-lg font-bold text-[color:var(--text-primary)] flex items-center gap-2">
              <ShoppingCart size={20} className="text-[var(--color-primary)]" />
              Armar pedido
            </h2>
            <p className="text-xs text-[color:var(--text-muted)] mt-1">
              {conversacion.cliente_nombre} · {conversacion.cliente_telefono}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Items */}
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--text-primary)] mb-2">
              Productos ({items.length})
            </h3>
            {loading ? (
              <div className="text-sm text-[color:var(--text-muted)] py-4 text-center">Cargando items sugeridos…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-[color:var(--text-muted)] py-4 text-center bg-[color:var(--bg-subtle)] rounded-md">
                El cliente no clickeó productos en el catálogo. Escribile
                para que te diga qué necesita.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-[color:var(--bg-subtle)] rounded-md">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[color:var(--text-primary)] truncate">
                        {it.nombre}
                      </div>
                      <div className="text-xs text-[color:var(--text-muted)]">
                        {formatCurrency(it.precio_unitario)} c/u
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(idx, -1)}
                        className="w-7 h-7 rounded bg-[color:var(--bg-elevated)] border border-[color:var(--border-subtle)] text-sm font-bold"
                        aria-label="Restar"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums">
                        {it.cantidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(idx, 1)}
                        className="w-7 h-7 rounded bg-[color:var(--bg-elevated)] border border-[color:var(--border-subtle)] text-sm font-bold"
                        aria-label="Sumar"
                      >
                        +
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={it.precio_unitario}
                      onChange={(e) => cambiarPrecio(idx, e.target.value)}
                      className="w-24 px-2 py-1 border border-[color:var(--border-subtle)] rounded text-sm text-right tabular-nums"
                      placeholder="Precio"
                    />
                    <button
                      type="button"
                      onClick={() => eliminarItem(idx)}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      aria-label="Quitar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Nota: el botón "+ Agregar producto" lo dejamos para fase
                futura (requiere un picker del catálogo completo). */}
          </div>

          {/* Modalidad */}
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--text-primary)] mb-2">Modalidad</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEsRetiroLocal(true)}
                className={[
                  'flex-1 px-3 py-2 rounded-md border text-sm font-medium',
                  esRetiroLocal ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[color:var(--bg-elevated)] border-[color:var(--border-subtle)]',
                ].join(' ')}
              >
                Retiro en local
              </button>
              <button
                type="button"
                onClick={() => setEsRetiroLocal(false)}
                className={[
                  'flex-1 px-3 py-2 rounded-md border text-sm font-medium',
                  !esRetiroLocal ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[color:var(--bg-elevated)] border-[color:var(--border-subtle)]',
                ].join(' ')}
              >
                Domicilio
              </button>
            </div>
          </div>

          {!esRetiroLocal && (
            <>
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1">
                  Dirección de entrega
                </label>
                <input
                  type="text"
                  value={direccionEntrega}
                  onChange={(e) => setDireccionEntrega(e.target.value)}
                  placeholder="Calle, carrera, número, barrio…"
                  className="w-full px-3 py-2 border border-[color:var(--border-subtle)] rounded-md text-sm bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1">
                  Costo de envío
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={costoEnvio}
                  onChange={(e) => setCostoEnvio(e.target.value)}
                  className="w-32 px-3 py-2 border border-[color:var(--border-subtle)] rounded-md text-sm text-right tabular-nums"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1">
              Teléfono de contacto
            </label>
            <input
              type="tel"
              value={telefonoContacto}
              onChange={(e) => setTelefonoContacto(e.target.value)}
              placeholder="3001234567"
              className="w-full px-3 py-2 border border-[color:var(--border-subtle)] rounded-md text-sm tabular-nums"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1">
              Método de pago
            </label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              className="w-full px-3 py-2 border border-[color:var(--border-subtle)] rounded-md text-sm bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)]"
            >
              <option value="contra_entrega">Contra entrega (efectivo)</option>
              <option value="nequi">Nequi</option>
              <option value="daviplata">Daviplata</option>
              <option value="bre_b">Bre-B</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1">
              Notas (opcional)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Indicaciones especiales para el domiciliario…"
              className="w-full px-3 py-2 border border-[color:var(--border-subtle)] rounded-md text-sm resize-none bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)]"
            />
          </div>

          {/* Total */}
          <div className="flex items-center justify-between p-3 bg-[color:var(--bg-subtle)] rounded-md">
            <span className="text-sm font-medium text-[color:var(--text-primary)]">Total</span>
            <span className="text-lg font-bold text-[color:var(--text-primary)] tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-md text-sm text-red-700 dark:text-red-300">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm font-medium border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-subtle)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!puedeConfirmar}
              className="px-4 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-50 active:scale-95 transition-transform"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {submitting ? 'Creando…' : 'Confirmar y crear pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
