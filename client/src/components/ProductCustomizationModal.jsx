import { useEffect, useMemo, useState } from 'react';
import { Plus, Minus, X, ListPlus, ShoppingCart, AlertCircle, ListChecks, Check } from 'lucide-react';
import { formatCurrency } from '../utils/formatHelper';

/**
 * Modal de customización de producto (estilo Rappi/PedidosYa).
 *
 * Props:
 * - isOpen:   bool
 * - onClose:  () => void
 * - producto: { id, nombre, descripcion, precio, imagen_url, restaurante_id }
 * - paquete:  { grupos, adiciones, removibles } desde el backend.
 *             Cada grupo puede traer (Fase 10): obligatorio, min_selecciones,
 *             max_selecciones. Si no los trae, se asume opcional libre.
 * - onAdd:    ({ cantidad, adiciones, removidos, nota,
 *                precioUnitarioFinal, subtotalItem }) => void
 *
 * La forma del payload que entrega onAdd está alineada con la shape
 * que consume CartContext.addToCart.
 *
 * Comportamiento por grupo (matriz de Fase 10):
 *   - obligatorio=0, min=0, max=1   → radio chips, opción "Sin [grupo]"
 *   - obligatorio=0, min=0, max>=2  → +/- por adición
 *   - obligatorio=1, min=1, max=1   → radio chips (no se deselecciona)
 *   - obligatorio=1, min=1, max>=2  → +/- por adición
 *
 * El botón "Agregar" queda disabled si algún grupo obligatorio está
 * incompleto (count < min_selecciones). El backend re-valida como
 * defensa de profundidad (ver orderService.js:validateAdicionesYRemovibles).
 */

// ========== Helpers puros (Fase 10) ==========

/**
 * Normaliza la config de un grupo y devuelve los campos que el render
 * necesita. Maneja grupos sin las 3 columnas nuevas (shape viejo):
 * en ese caso devuelve defaults `false / 0 / 99` (comportamiento
 * idéntico al pre-existente).
 */
function getGrupoConfig(grupo) {
  const obligatorio = !!grupo.obligatorio;
  const min = Math.max(0, Math.floor(Number(grupo.min_selecciones) || 0));
  const maxRaw = Math.floor(Number(grupo.max_selecciones) || 99);
  // Defensa: si max < min (config inválida del admin), ajustar a min.
  const max = Math.max(maxRaw, min);
  const isSingle = max === 1;

  let messageLabel = '';
  if (obligatorio) {
    if (min === 1 && max === 1) messageLabel = 'Obligatorio · elige 1 opción';
    else if (min === max) messageLabel = `Obligatorio · elige ${max} opciones`;
    else messageLabel = `Obligatorio · elige ${min}-${max} opciones`;
  } else {
    if (min === 0 && max === 1) messageLabel = 'Opcional';
    else if (min === 0 && max >= 2) messageLabel = `Opcional · puedes elegir hasta ${max}`;
    else messageLabel = `Opcional · elige ${min}-${max} opciones`;
  }

  return { id: grupo.id, nombre: grupo.nombre, obligatorio, min, max, isSingle, messageLabel };
}

/**
 * Suma las cantidades de adiciones que pertenecen a `grupoId` en el
 * state de UI. Devuelve 0 si el grupo no tiene adiciones elegidas.
 */
function getGrupoCount(grupoId, adicionesQty, todasAdiciones) {
  let count = 0;
  for (const a of todasAdiciones) {
    if (Number(a.grupo_id) === Number(grupoId)) {
      count += Number(adicionesQty[a.id] || 0);
    }
  }
  return count;
}

/**
 * ¿El grupo está completo según las reglas del local?
 * - Si no es obligatorio, siempre está completo (puede elegir 0).
 * - Si es obligatorio, count >= min_selecciones.
 */
function isGrupoCompleto(grupoCfg, count) {
  return grupoCfg.obligatorio ? count >= grupoCfg.min : true;
}
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

  // ===== Fase 10: estado por grupo + puedeAgregar =====
  // gruposConEstado = cada grupo con su config normalizada, las
  // adiciones que le pertenecen, count y completado. puedeAgregar =
  // todos los grupos están completos. El backend re-valida.
  const gruposConEstado = useMemo(() => {
    return grupos.map((g) => {
      const cfg = getGrupoConfig(g);
      const adicionesDelGrupo = todasAdiciones.filter(
        (a) => Number(a.grupo_id) === Number(g.id)
      );
      const count = getGrupoCount(g.id, adicionesQty, todasAdiciones);
      const completado = isGrupoCompleto(cfg, count);
      return { ...cfg, adicionesDelGrupo, count, completado };
    });
  }, [grupos, todasAdiciones, adicionesQty]);

  const puedeAgregar = useMemo(
    () => gruposConEstado.every((g) => g.completado),
    [gruposConEstado]
  );

  // Limpia todas las adiciones de un grupo específico. Usado por el
  // chip "Sin [grupo]" cuando se deselecciona la única opción elegida.
  const clearGrupo = (grupoId) => {
    setAdicionesQty((prev) => {
      const next = { ...prev };
      for (const a of todasAdiciones) {
        if (Number(a.grupo_id) === Number(grupoId)) delete next[a.id];
      }
      return next;
    });
  };

  // Para radio (max=1): selecciona UNA opción del grupo. Si es la
  // misma que ya estaba elegida, no hace nada (los obligatorios no se
  // pueden deseleccionar; los opcionales tampoco, porque max=1 y borrar
  // no tiene sentido — está el chip "Sin [grupo]").
  const selectSingleEnGrupo = (grupoId, adicionId) => {
    setAdicionesQty((prev) => {
      const next = { ...prev };
      // Limpiar todas las adiciones del grupo, después setear la nueva
      for (const a of todasAdiciones) {
        if (Number(a.grupo_id) === Number(grupoId)) delete next[a.id];
      }
      next[adicionId] = 1;
      return next;
    });
  };

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
            {/* Grupos de adiciones — Fase 10: render adaptativo por min/max */}
            {gruposConEstado.length > 0 &&
              gruposConEstado.map((g) => {
                if (g.adicionesDelGrupo.length === 0) return null;
                const mensajeColor = g.obligatorio
                  ? (g.completado ? 'text-emerald-600' : 'text-rose-500')
                  : 'text-[color:var(--text-muted)]';
                return (
                  <section key={g.id}>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-[color:var(--text-primary)]">
                        {g.nombre}
                      </h3>
                      {g.obligatorio && !g.completado && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300">
                          Falta elegir
                        </span>
                      )}
                    </div>
                    <p
                      aria-live="polite"
                      className={`text-xs font-medium mb-2 ${mensajeColor}`}
                    >
                      {g.messageLabel}
                    </p>
                    <div className="space-y-2">
                      {g.isSingle ? (
                        // ===== Radio chips (max=1) =====
                        <div className="flex flex-wrap gap-2">
                          {/* Chip "Sin [grupo]" solo para grupos opcionales */}
                          {!g.obligatorio && (
                            <button
                              type="button"
                              onClick={() => clearGrupo(g.id)}
                              aria-pressed={g.count === 0}
                              className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                                g.count === 0
                                  ? 'bg-[color:var(--primary,#3b82f6)]/15 border-[color:var(--primary,#3b82f6)] text-[color:var(--primary,#3b82f6)]'
                                  : 'border-[color:var(--border-default)] text-[color:var(--text-primary)] hover:border-[color:var(--primary,#3b82f6)]/60'
                              }`}
                            >
                              Sin {g.nombre}
                            </button>
                          )}
                          {g.adicionesDelGrupo.map((a) => {
                            const seleccionado = Number(adicionesQty[a.id] || 0) > 0;
                            const precio = a.precio_extra == null ? null : Number(a.precio_extra);
                            return (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => selectSingleEnGrupo(g.id, a.id)}
                                aria-pressed={seleccionado}
                                className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors inline-flex items-center gap-1 ${
                                  seleccionado
                                    ? 'bg-[color:var(--primary,#3b82f6)]/15 border-[color:var(--primary,#3b82f6)] text-[color:var(--primary,#3b82f6)]'
                                    : 'border-[color:var(--border-default)] text-[color:var(--text-primary)] hover:border-[color:var(--primary,#3b82f6)]/60'
                                }`}
                              >
                                {seleccionado && <Check size={14} aria-hidden="true" />}
                                {a.nombre}
                                {precio != null && precio > 0 && (
                                  <span className="text-[10px] font-mono opacity-75">
                                    + {formatCurrency(precio)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        // ===== +/- por adición (max >= 2) =====
                        g.adicionesDelGrupo.map((a) => (
                          <AdicionRow
                            key={a.id}
                            adicion={a}
                            qty={adicionesQty[a.id] || 0}
                            onInc={() => incAdicion(a.id)}
                            onDec={() => decAdicion(a.id)}
                          />
                        ))
                      )}
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
              disabled={!puedeAgregar}
              title={!puedeAgregar ? 'Completá los grupos obligatorios' : undefined}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
