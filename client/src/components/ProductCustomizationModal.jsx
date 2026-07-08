import { useEffect, useMemo, useState } from 'react';
import { Plus, Minus, X, ListPlus, ShoppingCart, AlertCircle, ListChecks } from 'lucide-react';
import { formatCurrency } from '../utils/formatHelper';

/**
 * Modal de customización de producto (estilo Rappi/PedidosYa).
 *
 * Props:
 * - isOpen:   bool
 * - onClose:  () => void
 * - producto: { id, nombre, descripcion, precio, imagen_url, restaurante_id }
 * - paquete:  { grupos, adiciones, removibles } desde el backend
 * - onAdd:    ({ cantidad, adiciones, removidos, nota,
 *                precioUnitarioFinal, subtotalItem }) => void
 *
 * La forma del payload que entrega onAdd está alineada con la shape
 * que consume CartContext.addToCart.
 */
export default function ProductCustomizationModal({
  isOpen,
  onClose,
  producto,
  paquete,
  onAdd,
}) {
  const [cantidad, setCantidad] = useState(1);
  // Map<adicion_id, cantidad> con valores >= 0
  const [adicionesQty, setAdicionesQty] = useState({});
  // Set<removible_id> de los removibles que el cliente desmarcó
  const [removidos, setRemovidos] = useState(new Set());
  const [nota, setNota] = useState('');

  // Reset de estado al abrir/cambiar de producto
  useEffect(() => {
    if (isOpen) {
      setCantidad(1);
      setAdicionesQty({});
      setRemovidos(new Set());
      setNota('');
    }
  }, [isOpen, producto?.id]);

  // Body scroll lock: evita que la página de fondo scrollee mientras
  // el modal está abierto. Restaura el valor previo en cleanup para
  // no pisar el scroll de otros modales que se hayan cerrado antes.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const grupos = paquete?.grupos || [];
  const todasAdiciones = paquete?.adiciones || [];
  const removibles = paquete?.removibles || [];

  // Adiciones que NO están en ningún grupo (grupo_id NULL)
  const adicionesSueltas = useMemo(
    () => todasAdiciones.filter((a) => a.grupo_id == null),
    [todasAdiciones]
  );

  const sumaAdiciones = useMemo(() => {
    return todasAdiciones.reduce((sum, a) => {
      const qty = Number(adicionesQty[a.id] || 0);
      const precio = a.precio_extra == null ? 0 : Number(a.precio_extra);
      return sum + precio * qty;
    }, 0);
  }, [todasAdiciones, adicionesQty]);

  const precioUnitarioFinal = Number(producto?.precio || 0) + sumaAdiciones;
  const subtotalItem = precioUnitarioFinal * Number(cantidad);

  const hayAdicionesElegidas = useMemo(
    () => Object.values(adicionesQty).some((q) => Number(q) > 0),
    [adicionesQty]
  );
  const hayRemovidos = removidos.size > 0;
  const hayNota = nota.trim().length > 0;

  function incAdicion(id) {
    setAdicionesQty((prev) => ({ ...prev, [id]: (Number(prev[id]) || 0) + 1 }));
  }
  function decAdicion(id) {
    setAdicionesQty((prev) => {
      const next = { ...prev };
      const current = Number(next[id]) || 0;
      if (current <= 1) {
        delete next[id];
      } else {
        next[id] = current - 1;
      }
      return next;
    });
  }
  function toggleRemovido(id) {
    setRemovidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    if (!producto) return;
    // Mapa id → nombre del grupo, para que cada adición lleve el
    // nombre de su grupo en el payload del carrito. El backend hace
    // el snapshot final en `items_pedido_adiciones.grupo_nombre` (con
    // LEFT JOIN a producto_grupos_adiciones), pero acá también lo
    // dejamos para que el carrito del cliente lo pueda renderizar
    // sin tener que esperar al backend.
    const grupoNombreById = new Map(
      (paquete?.grupos || []).map((g) => [g.id, g.nombre])
    );
    const adicionesSeleccionadas = todasAdiciones
      .filter((a) => Number(adicionesQty[a.id] || 0) > 0)
      .map((a) => {
        const qty = Number(adicionesQty[a.id] || 0);
        const precio = a.precio_extra == null ? 0 : Number(a.precio_extra);
        return {
          adicion_id: a.id,
          nombre: a.nombre,
          grupo_nombre: a.grupo_id ? (grupoNombreById.get(a.grupo_id) || null) : null,
          precio_extra: precio,
          cantidad: qty,
          subtotal: precio * qty,
        };
      });
    const removidosSeleccionados = removibles
      .filter((r) => removidos.has(r.id))
      .map((r) => ({ id: r.id, nombre: r.nombre }));

    onAdd({
      cantidad: Number(cantidad),
      adiciones: adicionesSeleccionadas,
      removidos: removidosSeleccionados,
      nota: nota.trim(),
      precioUnitarioFinal,
      subtotalItem,
    });
    onClose();
  }

  if (!isOpen || !producto) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 animate-fadeIn"
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 pointer-events-none">
        <div className="relative bg-[color:var(--bg-elevated)] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg sm:mx-4 max-h-[90vh] flex flex-col animate-scaleIn pointer-events-auto">
          {/* Header */}
          <div className="flex items-start gap-3 p-5 border-b border-[color:var(--border-subtle)]">
            {producto.imagen_url ? (
              <img
                src={producto.imagen_url}
                alt={producto.nombre}
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--bg-subtle)' }}
              >
                <ListPlus size={24} className="text-[color:var(--text-muted)]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[color:var(--text-primary)] truncate">
                {producto.nombre}
              </h2>
              {producto.descripcion && (
                <p className="text-sm text-[color:var(--text-secondary)] line-clamp-2 mt-0.5">
                  {producto.descripcion}
                </p>
              )}
              <p className="text-sm text-[color:var(--text-muted)] mt-1">
                Base: {formatCurrency(producto.precio)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 -m-1.5 text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)] rounded-full hover:bg-[color:var(--bg-muted)] mobile-tap-target"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body scrollable */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Grupos de adiciones */}
            {grupos.length > 0 &&
              grupos.map((grupo) => {
                const adicionesDelGrupo = todasAdiciones.filter(
                  (a) => a.grupo_id === grupo.id
                );
                if (adicionesDelGrupo.length === 0) return null;
                return (
                  <section key={grupo.id}>
                    <h3 className="text-sm font-bold text-[color:var(--text-primary)] mb-2">
                      {grupo.nombre}
                    </h3>
                    <div className="space-y-2">
                      {adicionesDelGrupo.map((a) => (
                        <AdicionRow
                          key={a.id}
                          adicion={a}
                          qty={adicionesQty[a.id] || 0}
                          onInc={() => incAdicion(a.id)}
                          onDec={() => decAdicion(a.id)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}

            {/* Adiciones sueltas */}
            {adicionesSueltas.length > 0 && (
              <section>
                <h3 className="text-sm font-bold text-[color:var(--text-primary)] mb-2">
                  Adiciones
                </h3>
                <div className="space-y-2">
                  {adicionesSueltas.map((a) => (
                    <AdicionRow
                      key={a.id}
                      adicion={a}
                      qty={adicionesQty[a.id] || 0}
                      onInc={() => incAdicion(a.id)}
                      onDec={() => decAdicion(a.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Removibles */}
            {removibles.length > 0 && (
              <section>
                <h3 className="text-sm font-bold text-[color:var(--text-primary)] mb-2">
                  Quitar ingredientes
                </h3>
                <p className="text-xs text-[color:var(--text-muted)] mb-2">
                  Marca los ingredientes que NO quieres en tu producto.
                </p>
                <div className="space-y-2">
                  {removibles.map((r) => (
                    <label
                      key={r.id}
                      className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-[color:var(--bg-subtle)]"
                    >
                      <input
                        type="checkbox"
                        checked={removidos.has(r.id)}
                        onChange={() => toggleRemovido(r.id)}
                        className="w-4 h-4 accent-[color:var(--primary-text)]"
                      />
                      <span
                        className={`text-sm ${
                          removidos.has(r.id)
                            ? 'line-through text-[color:var(--text-muted)]'
                            : 'text-[color:var(--text-primary)]'
                        }`}
                      >
                        Sin {r.nombre}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {/* Nota libre */}
            <section>
              <h3 className="text-sm font-bold text-[color:var(--text-primary)] mb-2">
                Nota para el local (opcional)
              </h3>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value.slice(0, 200))}
                placeholder="Ej: poco cocido, sin picante..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:border-[color:var(--primary-text)]"
                maxLength={200}
              />
              <p className="text-[10px] text-[color:var(--text-muted)] mt-1 text-right">
                {nota.length}/200
              </p>
            </section>

            {/* Resumen interno de la customización */}
            {(hayAdicionesElegidas || hayRemovidos || hayNota) && (
              <div
                className="rounded-lg p-3 space-y-1.5"
                style={{ backgroundColor: 'var(--bg-subtle)' }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <ListChecks size={14} className="text-primary" aria-hidden="true" />
                  <h4 className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--primary-text)]">
                    Tu selección
                  </h4>
                </div>
                {hayAdicionesElegidas && (
                  <p className="text-xs text-[color:var(--text-secondary)]">
                    <span className="font-semibold">Adiciones:</span>{' '}
                    {todasAdiciones
                      .filter((a) => Number(adicionesQty[a.id] || 0) > 0)
                      .map((a) => `${adicionesQty[a.id]}x ${a.nombre}`)
                      .join(', ')}
                  </p>
                )}
                {hayRemovidos && (
                  <p className="text-xs text-[color:var(--text-secondary)]">
                    <span className="font-semibold">Sin:</span>{' '}
                    {removibles
                      .filter((r) => removidos.has(r.id))
                      .map((r) => r.nombre)
                      .join(', ')}
                  </p>
                )}
                {hayNota && (
                  <p className="italic text-[color:var(--text-secondary)]">
                    "{nota}"
                  </p>
                )}
              </div>
            )}

            {todasAdiciones.length === 0 && removibles.length === 0 && (
              <div
                className="flex items-start gap-2 p-3 rounded-lg"
                style={{ backgroundColor: 'var(--warning-bg, var(--bg-subtle))' }}
              >
                <AlertCircle size={16} className="text-[color:var(--text-muted)] mt-0.5" />
                <p className="text-xs text-[color:var(--text-secondary)]">
                  Este producto no tiene modificadores configurados. Solo puedes ajustar la cantidad.
                </p>
              </div>
            )}
          </div>

          {/* Footer fijo */}
          <div
            className="border-t border-[color:var(--border-subtle)] p-4 flex items-center gap-3 bg-[color:var(--bg-elevated)]"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center gap-1 border border-[color:var(--border-default)] rounded-lg">
              <button
                onClick={() => setCantidad((c) => Math.max(1, Number(c) - 1))}
                className="p-2 hover:bg-[color:var(--bg-subtle)] rounded-l-lg disabled:opacity-40"
                disabled={cantidad <= 1}
                aria-label="Disminuir cantidad"
              >
                <Minus size={16} />
              </button>
              <span className="w-8 text-center font-semibold text-[color:var(--text-primary)]">
                {cantidad}
              </span>
              <button
                onClick={() => setCantidad((c) => Math.min(99, Number(c) + 1))}
                className="p-2 hover:bg-[color:var(--bg-subtle)] rounded-r-lg disabled:opacity-40"
                disabled={cantidad >= 99}
                aria-label="Aumentar cantidad"
              >
                <Plus size={16} />
              </button>
            </div>

            <button
              onClick={handleAdd}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <ShoppingCart size={18} />
              <span className="text-sm">Agregar · {formatCurrency(subtotalItem)}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function AdicionRow({ adicion, qty, onInc, onDec }) {
  const precio =
    adicion.precio_extra == null ? null : Number(adicion.precio_extra);
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[color:var(--text-primary)] truncate">
          + {adicion.nombre}
        </p>
        <p
          className="text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {precio == null || precio === 0
            ? 'Gratis'
            : `+ ${formatCurrency(precio)}`}
        </p>
      </div>
      <div className="flex items-center gap-1 border border-[color:var(--border-default)] rounded-lg">
        <button
          onClick={onDec}
          className="p-2 hover:bg-[color:var(--bg-subtle)] rounded-l-lg disabled:opacity-30 mobile-tap-target"
          disabled={qty <= 0}
          aria-label={`Quitar una unidad de ${adicion.nombre}`}
        >
          <Minus size={16} />
        </button>
        <span className="w-8 text-center text-sm font-semibold text-[color:var(--text-primary)]">
          {qty}
        </span>
        <button
          onClick={onInc}
          className="p-2 hover:bg-[color:var(--bg-subtle)] rounded-r-lg mobile-tap-target"
          aria-label={`Agregar una unidad de ${adicion.nombre}`}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
