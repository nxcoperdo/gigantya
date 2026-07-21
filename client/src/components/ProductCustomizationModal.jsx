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
 * Comportamiento por grupo (matriz de Fase 10 + fix cantidad × opciones):
 *   - obligatorio=0, min=0, max=1   → radio chips, opción "Sin [grupo]"
 *   - obligatorio=0, min=0, max>=2  → +/- por adición
 *   - obligatorio=1, min=1, max=1   → radio chips (no se deselecciona)
 *   - obligatorio=1, min=1, max>=2  → +/- por adición
 *
 * Regla "isSingle × cantidad" (fix del menú del día):
 *   Cuando el modal tiene cantidad > 1 y el grupo es isSingle (max=1),
 *   se renderizan N sub-grupos (1 por unidad del combo) y el cliente
 *   elige 1 opción POR CADA unidad. El payload que entrega onAdd sigue
 *   siendo la shape legacy `{adicion_id, cantidad}`: el frontend emite
 *   1 entrada por cada opción DISTINTA elegida, colapsando repeticiones
 *   de la misma adicion_id (ej: 2x Rancheros en vez de 2 entradas
 *   separadas de cantidad 1). El backend re-valida que la cantidad de
 *   entradas distintas del grupo cubra `item.cantidad` (ver
 *   `validateAdicionesYRemovibles` en `orderService.js`).
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
 *
 * `messageLabel` es consciente de la cantidad: cuando el modal tiene
 * cantidad > 1 y el grupo es `isSingle` (elige 1), el label avisa
 * que la selección se replica por unidad ("Elige 1 opción por unidad
 * (total: N)"). Para cantidad 1 el label es el de siempre.
 */
function getGrupoConfig(grupo, cantidad = 1) {
  const obligatorio = !!grupo.obligatorio;
  const min = Math.max(0, Math.floor(Number(grupo.min_selecciones) || 0));
  const maxRaw = Math.floor(Number(grupo.max_selecciones) || 99);
  // Defensa: si max < min (config inválida del admin), ajustar a min.
  const max = Math.max(maxRaw, min);
  const isSingle = max === 1;
  // Cuando la cantidad > 1 y el grupo es de "elige 1", la regla del
  // local se multiplica por la cantidad. Avisamos al cliente para que
  // sepa que debe elegir 1 opción POR CADA combo (no una sola para todos).
  const perUnidad = isSingle && cantidad > 1;

  let messageLabel = '';
  if (obligatorio) {
    if (perUnidad) messageLabel = `Obligatorio · elige 1 opción por cada unidad (${cantidad} en total)`;
    else if (min === 1 && max === 1) messageLabel = 'Obligatorio · elige 1 opción';
    else if (min === max) messageLabel = `Obligatorio · elige ${max} opciones`;
    else messageLabel = `Obligatorio · elige ${min}-${max} opciones`;
  } else {
    if (perUnidad) messageLabel = `Opcional · puedes elegir 1 opción por unidad (${cantidad} en total)`;
    else if (min === 0 && max === 1) messageLabel = 'Opcional';
    else if (min === 0 && max >= 2) messageLabel = `Opcional · puedes elegir hasta ${max}`;
    else messageLabel = `Opcional · elige ${min}-${max} opciones`;
  }

  return { id: grupo.id, nombre: grupo.nombre, obligatorio, min, max, isSingle, perUnidad, messageLabel };
}

/**
 * Cuenta cuántas "unidades" del grupo están cubiertas por la selección
 * actual. Para grupos isSingle (perUnidad) el "completo" significa que
 * las N unidades (cantidad del modal) tengan una opción asignada cada
 * una, no que la suma de cantidades llegue a N.
 *
 * Lee dos estados posibles:
 * - `selPorUnidad`: Map<grupoId, Array<adicionId | null>> con length === cantidad
 * - `adicionesQty`: Map<adicionId, qty> (legacy / no-single)
 *
 * @param {object} grupoCfg  - salida de getGrupoConfig
 * @param {Map<number, number>} adicionesQty
 * @param {Array<{id, grupo_id}>} todasAdiciones
 * @param {Map<number, Array<number|null>>|null} selPorUnidad
 * @param {number} cantidad - cantidad del modal (1..99)
 * @returns {number} unidades cubiertas (0..cantidad para isSingle, suma para los demás)
 */
function getGrupoCount(grupoCfg, adicionesQty, todasAdiciones, selPorUnidad, cantidad) {
  if (grupoCfg.perUnidad && selPorUnidad) {
    const arr = selPorUnidad.get(grupoCfg.id) || [];
    // Cubiertas = posiciones con adicionId no-null
    let cubiertas = 0;
    for (const v of arr) {
      if (v != null) cubiertas += 1;
    }
    return Math.min(cubiertas, cantidad);
  }
  // Legacy: sumar cantidades de adiciones del grupo (para grupos no-single).
  let count = 0;
  for (const a of todasAdiciones) {
    if (Number(a.grupo_id) === Number(grupoCfg.id)) {
      count += Number(adicionesQty[a.id] || 0);
    }
  }
  return count;
}

/**
 * ¿El grupo está completo según las reglas del local?
 * - Si no es obligatorio, siempre está completo (puede elegir 0).
 * - Si es obligatorio y perUnidad: las N unidades deben tener una
 *   opción asignada (count === cantidad).
 * - Si es obligatorio y NO perUnidad: count >= min_selecciones.
 */
function isGrupoCompleto(grupoCfg, count, cantidad) {
  if (!grupoCfg.obligatorio) return true;
  if (grupoCfg.perUnidad) return count >= cantidad;
  return count >= grupoCfg.min;
}
export default function ProductCustomizationModal({
  isOpen,
  onClose,
  producto,
  paquete,
  onAdd,
}) {
  const [cantidad, setCantidad] = useState(1);
  // Map<adicion_id, cantidad> con valores >= 0 (legacy, para grupos
  // max>=2 y adiciones sueltas).
  const [adicionesQty, setAdicionesQty] = useState({});
  // Para grupos isSingle (max=1) la cantidad de unidades importa:
  // guardamos Map<grupoId, Array<adicionId | null>> con length === cantidad.
  // Inicializar/limpiar al cambiar de producto o de cantidad.
  const [selPorUnidad, setSelPorUnidad] = useState(new Map());
  // Set<removible_id> de los removibles que el cliente desmarcó
  const [removidos, setRemovidos] = useState(new Set());
  const [nota, setNota] = useState('');

  // Reset de estado al abrir/cambiar de producto
  useEffect(() => {
    if (isOpen) {
      setCantidad(1);
      setAdicionesQty({});
      setSelPorUnidad(new Map());
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

  // ===== Fase 10: estado por grupo + puedeAgregar =====
  // gruposConEstado = cada grupo con su config normalizada, las
  // adiciones que le pertenecen, count y completado. puedeAgregar =
  // todos los grupos están completos. El backend re-valida.
  //
  // IMPORTANTE: este useMemo DEBE estar declarado ANTES que
  // `sumaPerUnidad` (línea ~197) porque ese otro useMemo lo
  // referencia dentro de su closure. Declararlos en otro orden
  // provoca "Cannot access 'y' before initialization" (TDZ) en
  // el bundle minificado, exactamente lo que pasó cuando se
  // activó el flujo perUnidad del menú del día con cantidad > 1.
  const gruposConEstado = useMemo(() => {
    return grupos.map((g) => {
      const cfg = getGrupoConfig(g, cantidad);
      const adicionesDelGrupo = todasAdiciones.filter(
        (a) => Number(a.grupo_id) === Number(g.id)
      );
      const count = getGrupoCount(cfg, adicionesQty, todasAdiciones, selPorUnidad, cantidad);
      const completado = isGrupoCompleto(cfg, count, cantidad);
      return { ...cfg, adicionesDelGrupo, count, completado };
    });
  }, [grupos, todasAdiciones, adicionesQty, selPorUnidad, cantidad]);

  // Suma de las selecciones perUnidad (precio_extra × veces que se eligió
  // cada adición en el array selPorUnidad). Necesario para que el subtotal
  // del modal refleje el costo de las opciones perUnidad elegidas, ya que
  // esas selecciones NO viven en adicionesQty.
  const sumaPerUnidad = useMemo(() => {
    let total = 0;
    for (const [grupoId, arr] of selPorUnidad.entries()) {
      const cfg = gruposConEstado.find((g) => g.id === grupoId);
      if (!cfg?.perUnidad) continue;
      for (const adId of arr) {
        if (adId == null) continue;
        const a = todasAdiciones.find((x) => Number(x.id) === Number(adId));
        if (!a) continue;
        const precio = a.precio_extra == null ? 0 : Number(a.precio_extra);
        total += precio;
      }
    }
    return total;
  }, [selPorUnidad, todasAdiciones, gruposConEstado]);

  const precioUnitarioFinal = Number(producto?.precio || 0) + sumaAdiciones + sumaPerUnidad;
  const subtotalItem = precioUnitarioFinal * Number(cantidad);

  const hayAdicionesElegidas = useMemo(
    () => Object.values(adicionesQty).some((q) => Number(q) > 0),
    [adicionesQty]
  );
  // Para grupos perUnidad, también cuentan como "elegidas" las
  // selecciones del state selPorUnidad (no se reflejan en
  // adicionesQty, que solo lleva el legacy +/-).
  const haySelPorUnidad = useMemo(() => {
    for (const arr of selPorUnidad.values()) {
      if (arr.some((v) => v != null)) return true;
    }
    return false;
  }, [selPorUnidad]);
  const hayRemovidos = removidos.size > 0;
  const hayNota = nota.trim().length > 0;

  const puedeAgregar = useMemo(
    () => gruposConEstado.every((g) => g.completado),
    [gruposConEstado]
  );

  // Sincronizar selPorUnidad con la cantidad del modal: cuando la
  // cantidad sube, extender los arrays; cuando baja, recortar.
  // No pisamos selecciones existentes.
  useEffect(() => {
    setSelPorUnidad((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const g of grupos) {
        const cfg = getGrupoConfig(g, cantidad);
        if (!cfg.perUnidad) continue;
        const current = next.get(cfg.id) || [];
        if (current.length === cantidad) continue;
        if (current.length < cantidad) {
          // Extender con null hasta llegar a `cantidad`
          const extended = [...current, ...Array(cantidad - current.length).fill(null)];
          next.set(cfg.id, extended);
          changed = true;
        } else {
          // Recortar (cliente bajó la cantidad). Perder las unidades
          // sobrantes es esperable: ya eligió menos combos.
          next.set(cfg.id, current.slice(0, cantidad));
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [cantidad, grupos]);

  // Limpia todas las unidades de un grupo perUnidad. Si el grupo NO es
  // perUnidad, limpia las adiciones que pertenecen al grupo en
  // adicionesQty (legacy, para grupos no-single).
  const clearGrupo = (grupoId) => {
    const cfg = gruposConEstado.find((g) => g.id === grupoId);
    if (cfg?.perUnidad) {
      setSelPorUnidad((prev) => {
        const next = new Map(prev);
        next.set(grupoId, Array(cantidad).fill(null));
        return next;
      });
    } else {
      setAdicionesQty((prev) => {
        const next = { ...prev };
        for (const a of todasAdiciones) {
          if (Number(a.grupo_id) === Number(grupoId)) delete next[a.id];
        }
        return next;
      });
    }
  };

  // Para radio (perUnidad): asigna adicionId a la unidad `unidadIdx` de
  // un grupo perUnidad. Si la adición ya estaba elegida en OTRA unidad,
  // la quita de ahí (no se puede repetir la misma opción si la cantidad
  // lo permite, pero el cliente está cambiando de idea).
  const selectSingleEnUnidad = (grupoId, unidadIdx, adicionId) => {
    setSelPorUnidad((prev) => {
      const next = new Map(prev);
      const current = (next.get(grupoId) || Array(cantidad).fill(null)).slice();
      // Quitar la adición de cualquier otra unidad
      for (let i = 0; i < current.length; i += 1) {
        if (current[i] === adicionId) current[i] = null;
      }
      // Toggle: si la unidad clickeada ya tenía esta opción, la quitamos
      // (sólo permitido en grupos opcionales; los obligatorios quedan
      // cubiertos por la validación de "completado" igual).
      if (current[unidadIdx] === adicionId) {
        current[unidadIdx] = null;
      } else {
        current[unidadIdx] = adicionId;
      }
      // Garantizar length === cantidad
      while (current.length < cantidad) current.push(null);
      next.set(grupoId, current);
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

    // ---- 1) Adiciones de grupos perUnidad (isSingle × cantidad) ----
    // Transformar Map<grupoId, Array<adicionId | null>> en una lista
    // de {adicion_id, cantidad} legacy. Colapsamos selecciones
    // repetidas de la misma opción en una entrada con cantidad N
    // (ej: 2x Rancheros en vez de 2 entradas separadas de cantidad 1).
    const adicionesDePerUnidad = [];
    for (const g of grupos) {
      const cfg = getGrupoConfig(g, cantidad);
      if (!cfg.perUnidad) continue;
      const sel = selPorUnidad.get(cfg.id) || [];
      // Conteo de cuántas veces se eligió cada adicionId (ignorando null)
      const conteo = new Map();
      for (const adId of sel) {
        if (adId == null) continue;
        conteo.set(adId, (conteo.get(adId) || 0) + 1);
      }
      for (const [adId, qty] of conteo.entries()) {
        const a = todasAdiciones.find((x) => Number(x.id) === Number(adId));
        if (!a) continue;
        const precio = a.precio_extra == null ? 0 : Number(a.precio_extra);
        adicionesDePerUnidad.push({
          adicion_id: a.id,
          nombre: a.nombre,
          grupo_nombre: grupoNombreById.get(a.grupo_id) || cfg.nombre,
          precio_extra: precio,
          cantidad: qty,
          subtotal: precio * qty,
        });
      }
    }

    // ---- 2) Adiciones de grupos NO-perUnidad (legacy +/-) ----
    // Suma simple de cantidades por adicion_id.
    const idsYaContados = new Set(adicionesDePerUnidad.map((a) => Number(a.adicion_id)));
    const adicionesLegacy = todasAdiciones
      .filter((a) => Number(adicionesQty[a.id] || 0) > 0 && !idsYaContados.has(Number(a.id)))
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

    const adicionesSeleccionadas = [...adicionesDePerUnidad, ...adicionesLegacy];

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
                      {g.perUnidad ? (
                        // ===== Radio per-unidad (isSingle × cantidad) =====
                        // El local configuró "elige 1". Como la cantidad
                        // del modal es N, hay que elegir 1 opción por
                        // cada unidad. Renderizamos N sub-grupos con su
                        // propio header "Unidad X/N" y los mismos chips.
                        (() => {
                          const selArr = selPorUnidad.get(g.id) || Array(cantidad).fill(null);
                          return Array.from({ length: cantidad }, (_, unidadIdx) => {
                            const seleccionada = selArr[unidadIdx];
                            return (
                              <div
                                key={`${g.id}-u-${unidadIdx}`}
                                className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)]/40 p-2"
                              >
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)]">
                                    Unidad {unidadIdx + 1}/{cantidad}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {/* Chip "Sin [grupo]" SOLO en la primera
                                      unidad para grupos opcionales: limpia
                                      todas las unidades a la vez. */}
                                  {!g.obligatorio && unidadIdx === 0 && (
                                    <button
                                      type="button"
                                      onClick={() => clearGrupo(g.id)}
                                      aria-pressed={selArr.every((v) => v == null)}
                                      className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                                        selArr.every((v) => v == null)
                                          ? 'bg-[color:var(--primary,#3b82f6)]/15 border-[color:var(--primary,#3b82f6)] text-[color:var(--primary,#3b82f6)]'
                                          : 'border-[color:var(--border-default)] text-[color:var(--text-primary)] hover:border-[color:var(--primary,#3b82f6)]/60'
                                      }`}
                                    >
                                      Sin {g.nombre}
                                    </button>
                                  )}
                                  {g.adicionesDelGrupo.map((a) => {
                                    const isSelected = Number(seleccionada) === Number(a.id);
                                    const precio = a.precio_extra == null ? null : Number(a.precio_extra);
                                    return (
                                      <button
                                        key={a.id}
                                        type="button"
                                        onClick={() => selectSingleEnUnidad(g.id, unidadIdx, a.id)}
                                        aria-pressed={isSelected}
                                        aria-label={`Unidad ${unidadIdx + 1}: ${a.nombre}`}
                                        className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors inline-flex items-center gap-1 ${
                                          isSelected
                                            ? 'bg-[color:var(--primary,#3b82f6)]/15 border-[color:var(--primary,#3b82f6)] text-[color:var(--primary,#3b82f6)]'
                                            : 'border-[color:var(--border-default)] text-[color:var(--text-primary)] hover:border-[color:var(--primary,#3b82f6)]/60'
                                        }`}
                                      >
                                        {isSelected && <Check size={14} aria-hidden="true" />}
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
                              </div>
                            );
                          });
                        })()
                      ) : g.isSingle ? (
                        // ===== Radio chips (max=1) — comportamiento legacy
                        // para cuando la cantidad del modal es 1.
                        <div className="flex flex-wrap gap-2">
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
                                onClick={() => setAdicionesQty((prev) => {
                                  const next = { ...prev };
                                  for (const aa of todasAdiciones) {
                                    if (Number(aa.grupo_id) === Number(g.id)) delete next[aa.id];
                                  }
                                  next[a.id] = 1;
                                  return next;
                                })}
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
            {(hayAdicionesElegidas || haySelPorUnidad || hayRemovidos || hayNota) && (
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
                {(hayAdicionesElegidas || haySelPorUnidad) && (
                  <p className="text-xs text-[color:var(--text-secondary)]">
                    <span className="font-semibold">Adiciones:</span>{' '}
                    {[
                      // Selecciones de grupos perUnidad (cada unidad
                      // se cuenta como 1 entrada; el cliente las ve
                      // listadas una vez por unidad).
                      ...Array.from(selPorUnidad.entries()).flatMap(([grupoId, arr]) => {
                        const cfg = gruposConEstado.find((g) => g.id === grupoId);
                        if (!cfg || !cfg.perUnidad) return [];
                        return arr
                          .filter((v) => v != null)
                          .map((adId) => {
                            const a = todasAdiciones.find((x) => Number(x.id) === Number(adId));
                            return a ? `1x ${a.nombre}` : null;
                          })
                          .filter(Boolean);
                      }),
                      // Adiciones legacy (+/-) y sueltas
                      ...todasAdiciones
                        .filter((a) => Number(adicionesQty[a.id] || 0) > 0)
                        .map((a) => `${adicionesQty[a.id]}x ${a.nombre}`),
                    ].join(', ')}
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
