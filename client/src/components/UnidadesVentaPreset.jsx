import { useState, useEffect, useMemo } from 'react';
import { X, Scale, Check, AlertCircle } from 'lucide-react';
import { UNIDADES_VENTA_PREDETERMINADAS, GRUPO_PRESENTACION_NOMBRE } from '../constants/unidadesVenta';

/**
 * Modal de preset para productos de fruver/mercado/abarrotes.
 *
 * Crea automáticamente un grupo "Presentación" con las unidades de venta
 * que el comerciante elija. Reutiliza la infraestructura de Fase 10 (grupos
 * de adiciones con obligatoriedad y min/max) — sin cambios en backend
 * ni schema de BD.
 *
 * Props:
 *   - isOpen: bool
 *   - onClose: () => void
 *   - onConfirm: ({ grupoExistente: bool, unidades: [{nombre, precio_extra}] }) => void
 *   - grupoYaExiste: bool — true si el producto ya tiene un grupo "Presentación".
 *                       En ese caso, se muestra un warning y el modal ofrece
 *                       "Reemplazar" o "Agregar a las existentes".
 */
export default function UnidadesVentaPreset({ isOpen, onClose, onConfirm, grupoYaExiste = false }) {
  // Estado: mapa { [idUnidad]: { activa: bool, precio: string } }
  const [seleccion, setSeleccion] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    // Inicializa con las unidades "sugeridas" tildadas.
    const inicial = {};
    for (const u of UNIDADES_VENTA_PREDETERMINADAS) {
      inicial[u.id] = { activa: u.sugerida, precio: '' };
    }
    setSeleccion(inicial);
  }, [isOpen]);

  const unidadesActivas = useMemo(() => {
    return UNIDADES_VENTA_PREDETERMINADAS
      .map((u) => ({ ...u, ...seleccion[u.id] }))
      .filter((u) => u.activa);
  }, [seleccion]);

  const todasConPrecio = unidadesActivas.every((u) => {
    const num = Number(u.precio);
    return Number.isFinite(num) && num >= 0;
  });

  const handleToggle = (id) => {
    setSeleccion((prev) => ({
      ...prev,
      [id]: { ...prev[id], activa: !prev[id] },
    }));
  };

  const handlePrecio = (id, value) => {
    setSeleccion((prev) => ({
      ...prev,
      [id]: { ...prev[id], precio: value },
    }));
  };

  const handleConfirm = () => {
    if (unidadesActivas.length === 0) return;
    if (!todasConPrecio) return;
    onConfirm({
      grupoExistente: grupoYaExiste,
      unidades: unidadesActivas.map((u) => ({
        nombre: u.nombre,
        precio_extra: Number(u.precio),
      })),
    });
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-[color:var(--bg-elevated)] rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con gradiente (estilo UI/UX Pro Max) */}
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--border-subtle)] bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
          <div className="flex items-center gap-2">
            <Scale size={20} className="text-emerald-600" />
            <h2 className="text-lg font-bold text-[color:var(--text-primary)]">
              Unidades de venta
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-[color:var(--bg-muted)] rounded-full transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} className="text-[color:var(--text-muted)]" />
          </button>
        </div>

        {/* Warning si ya existe el grupo */}
        {grupoYaExiste && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2 text-xs text-amber-800">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Este producto ya tiene un grupo "{GRUPO_PRESENTACION_NOMBRE}".</p>
              <p className="mt-0.5">Las unidades que elijas acá se <strong>agregarán</strong> a las existentes (no se reemplazan).</p>
            </div>
          </div>
        )}

        <p className="px-4 pt-3 pb-2 text-xs text-[color:var(--text-muted)]">
          Tildá las unidades que querés ofrecer para este producto y poné el precio de cada una. El cliente va a tener que elegir 1 obligatoriamente.
        </p>

        {/* Lista scrolleable */}
        <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1">
          {UNIDADES_VENTA_PREDETERMINADAS.map((u) => {
            const estado = seleccion[u.id] || { activa: false, precio: '' };
            return (
              <div
                key={u.id}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                  estado.activa
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : 'border-[color:var(--border-subtle)] hover:bg-[color:var(--bg-subtle)]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={estado.activa}
                  onChange={() => handleToggle(u.id)}
                  className="w-4 h-4 accent-emerald-600 flex-shrink-0"
                  aria-label={`Ofrecer ${u.nombre}`}
                />
                <span className="flex-1 text-sm text-[color:var(--text-primary)]">
                  {u.nombre}
                </span>
                {estado.activa && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-[color:var(--text-muted)]">$</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={estado.precio}
                      onChange={(e) => handlePrecio(u.id, e.target.value)}
                      placeholder="0"
                      className="w-24 px-2 py-1 rounded-md border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-sm text-[color:var(--text-primary)] text-right focus:ring-2 focus:ring-emerald-500 outline-none"
                      aria-label={`Precio de ${u.nombre}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer con acciones */}
        <div className="flex items-center justify-between gap-2 p-4 border-t border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)]">
          <span className="text-xs text-[color:var(--text-muted)]">
            {unidadesActivas.length === 0
              ? 'Tildá al menos una unidad'
              : `${unidadesActivas.length} unidad${unidadesActivas.length === 1 ? '' : 'es'} seleccionada${unidadesActivas.length === 1 ? '' : 's'}`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-lg border border-[color:var(--border-default)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={unidadesActivas.length === 0 || !todasConPrecio}
              className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Check size={14} />
              {grupoYaExiste ? 'Agregar' : 'Crear grupo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
