/**
 * InventoryPage (Fase 6).
 *
 * Pantalla principal de inventario. Tres tabs:
 *   - Ingredientes: tabla con stock actual/mínimo, badge "Bajo mínimo",
 *     botones "Ajustar stock" y "Editar" / "Eliminar".
 *   - Kardex: lista de movimientos con filtros (ingrediente, tipo, fechas).
 *   - Alertas: lista de ingredientes bajo mínimo con stock destacado.
 *
 * Permisos:
 *   - Todos los roles staff pueden ver y registrar movimientos manuales.
 *   - Solo dueño/admin pueden crear/editar/borrar ingredientes.
 *
 * Datos en vivo:
 *   - Escucha `pos:stock_updated` para refrescar la tabla cuando se
 *     descuenta stock por un pedido o un movimiento.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Edit, Trash2, Boxes, Package, AlertTriangle, History,
  Loader2, Sliders, ArrowUp, ArrowDown, Filter, ChevronRight,
} from 'lucide-react';
import { posInventoryService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { subscribeToEvent, unsubscribeFromEvent } from '../../services/socket';
import { formatDateTime } from '../../utils/dateHelper';
import IngredientForm from '../../components/pos/IngredientForm';
import StockAdjustModal from '../../components/pos/StockAdjustModal';

const TABS = [
  { id: 'ingredientes', label: 'Ingredientes', Icon: Boxes },
  { id: 'kardex',       label: 'Kardex',       Icon: History },
  { id: 'alertas',      label: 'Alertas',      Icon: AlertTriangle },
];

const TIPO_PILL = {
  consumo_pedido: { label: 'Consumo por pedido', cls: 'bg-rose-500/15 text-rose-300 border border-rose-500/30' },
  compra:         { label: 'Compra',             cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' },
  merma:          { label: 'Merma',              cls: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' },
  ajuste:         { label: 'Ajuste',             cls: 'bg-sky-500/15 text-sky-300 border border-sky-500/30' },
};

export default function InventoryPage() {
  const { user } = useAuth();
  const isOwner = user && ['restaurante', 'admin'].includes(user.tipo_usuario);

  const [tab, setTab] = useState('ingredientes');
  const [ingredientes, setIngredientes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modales
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [adjustTarget, setAdjustTarget] = useState(null);

  // Filtros del kardex
  const [filterTipo, setFilterTipo] = useState('');
  const [filterIng, setFilterIng] = useState('');

  const fetchIngredientes = useCallback(async () => {
    try {
      const r = await posInventoryService.listIngredientes();
      setIngredientes(r.data?.ingredientes || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }, []);

  const fetchKardex = useCallback(async () => {
    try {
      const r = await posInventoryService.listKardex({
        tipo: filterTipo || undefined,
        ingrediente_id: filterIng || undefined,
      });
      setMovimientos(r.data?.movimientos || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }, [filterTipo, filterIng]);

  const fetchAlertas = useCallback(async () => {
    try {
      const r = await posInventoryService.listAlertas();
      setAlertas(r.data?.alertas || []);
    } catch (e) {
      // No es crítico, no mostramos error.
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    if (tab === 'ingredientes') fetchIngredientes().finally(() => setLoading(false));
    else if (tab === 'kardex') fetchKardex().finally(() => setLoading(false));
    else if (tab === 'alertas') fetchAlertas().finally(() => setLoading(false));
  }, [tab, fetchIngredientes, fetchKardex, fetchAlertas]);

  // Listener de socket para refrescar cuando cambia el stock.
  useEffect(() => {
    const handler = () => {
      // Refrescamos todas las vistas; es barato.
      fetchIngredientes();
      fetchAlertas();
      if (tab === 'kardex') fetchKardex();
    };
    subscribeToEvent('pos:stock_updated', handler);
    return () => unsubscribeFromEvent('pos:stock_updated', handler);
  }, [tab, fetchIngredientes, fetchKardex, fetchAlertas]);

  async function handleDelete(ing) {
    if (!window.confirm(`¿Eliminar "${ing.nombre}"? Los movimientos del kardex se conservan.`)) {
      return;
    }
    try {
      await posInventoryService.deleteIngrediente(ing.id);
      fetchIngredientes();
      fetchAlertas();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }

  return (
    <div className="space-y-4 max-w-6xl">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
            aria-hidden="true"
          >
            <Boxes className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-extrabold leading-tight">Inventario</h1>
            <p className="text-xs text-[color:var(--text-muted)]">
              {ingredientes.length} ingredientes · {alertas.length} alertas
            </p>
          </div>
        </div>
        {isOwner && tab === 'ingredientes' && (
          <button
            type="button"
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[color:var(--primary,#f59e0b)] hover:opacity-90 text-white text-sm font-semibold active:scale-95 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nuevo ingrediente
          </button>
        )}
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[color:var(--border)]" role="tablist">
        {TABS.map((t) => {
          const Icn = t.Icon;
          const active = tab === t.id;
          const count = t.id === 'alertas' ? alertas.length : null;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={[
                'px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors inline-flex items-center gap-2',
                active
                  ? 'border-[color:var(--primary,#3b82f6)] text-[color:var(--primary,#3b82f6)]'
                  : 'border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]',
              ].join(' ')}
            >
              <Icn className="w-4 h-4" />
              {t.label}
              {count !== null && count > 0 && (
                <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-amber-500/20 text-amber-300">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between gap-2"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs underline font-medium hover:no-underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-[color:var(--text-muted)] flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">Cargando…</span>
        </div>
      ) : tab === 'ingredientes' ? (
        <IngredientesTab
          ingredientes={ingredientes}
          onAdjust={(ing) => setAdjustTarget(ing)}
          onEdit={(ing) => { setEditTarget(ing); setShowForm(true); }}
          onDelete={handleDelete}
          isOwner={isOwner}
        />
      ) : tab === 'kardex' ? (
        <KardexTab
          movimientos={movimientos}
          ingredientes={ingredientes}
          filterTipo={filterTipo}
          setFilterTipo={setFilterTipo}
          filterIng={filterIng}
          setFilterIng={setFilterIng}
        />
      ) : (
        <AlertasTab alertas={alertas} onAdjust={(ing) => setAdjustTarget(ing)} />
      )}

      {showForm && (
        <IngredientForm
          ingrediente={editTarget}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
          onSaved={() => {
            setShowForm(false);
            setEditTarget(null);
            fetchIngredientes();
            fetchAlertas();
          }}
        />
      )}

      {adjustTarget && (
        <StockAdjustModal
          ingrediente={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSaved={() => {
            setAdjustTarget(null);
            fetchIngredientes();
            fetchAlertas();
            if (tab === 'kardex') fetchKardex();
          }}
        />
      )}
    </div>
  );
}

// ========== Sub-componentes ==========

function IngredientesTab({ ingredientes, onAdjust, onEdit, onDelete, isOwner }) {
  if (ingredientes.length === 0) {
    return (
      <div className="bg-[color:var(--bg-elevated)] border-2 border-dashed border-[color:var(--border)] rounded-xl p-10 text-center">
        <Package className="w-10 h-10 mx-auto mb-3 opacity-30" aria-hidden="true" />
        <p className="text-base font-semibold text-[color:var(--text)]">No hay ingredientes cargados todavía</p>
        <p className="text-sm text-[color:var(--text-muted)] mt-1">
          {isOwner ? 'Hacé click en "Nuevo ingrediente" para empezar.' : 'El dueño aún no cargó ingredientes.'}
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--border)] shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-[color:var(--bg-elevated)] text-[color:var(--text-muted)] text-xs uppercase tracking-wider">
          <tr>
            <th scope="col" className="px-3 py-2.5 text-left font-semibold">Nombre</th>
            <th scope="col" className="px-3 py-2.5 text-left font-semibold">Unidad</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Stock actual</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Mínimo</th>
            <th scope="col" className="px-3 py-2.5 text-center font-semibold">Estado</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {ingredientes.map((ing) => {
            const bajoMin = Number(ing.stock_actual) < Number(ing.stock_minimo);
            return (
              <tr
                key={ing.id}
                className="border-t border-[color:var(--border)] hover:bg-[color:var(--bg-elevated)]/40 transition-colors"
              >
                <td className="px-3 py-2.5 font-medium">{ing.nombre}</td>
                <td className="px-3 py-2.5 text-[color:var(--text-muted)]">{ing.unidad}</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold">
                  {Number(ing.stock_actual).toFixed(3)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[color:var(--text-muted)]">
                  {Number(ing.stock_minimo).toFixed(3)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {bajoMin ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Bajo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      OK
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      type="button"
                      onClick={() => onAdjust(ing)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-[color:var(--border)] hover:bg-[color:var(--bg-elevated)] transition-colors active:scale-95"
                    >
                      <Sliders className="w-3 h-3" aria-hidden="true" /> Ajustar
                    </button>
                    {isOwner && (
                      <>
                        <button
                          type="button"
                          onClick={() => onEdit(ing)}
                          className="p-1.5 rounded-md hover:bg-[color:var(--bg-elevated)] transition-colors"
                          aria-label={`Editar ${ing.nombre}`}
                        >
                          <Edit className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(ing)}
                          className="p-1.5 rounded-md text-rose-400 hover:bg-rose-500/10 transition-colors"
                          aria-label={`Eliminar ${ing.nombre}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KardexTab({ movimientos, ingredientes, filterTipo, setFilterTipo, filterIng, setFilterIng }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="inline-flex items-center gap-1.5 text-[color:var(--text-muted)] text-xs font-semibold uppercase tracking-wider mr-1">
          <Filter className="w-3.5 h-3.5" aria-hidden="true" /> Filtros
        </div>
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          aria-label="Filtrar por tipo"
          className="px-2.5 py-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40 focus:border-[color:var(--primary,#3b82f6)] transition"
        >
          <option value="">Todos los tipos</option>
          <option value="consumo_pedido">Consumo por pedido</option>
          <option value="compra">Compra</option>
          <option value="merma">Merma</option>
          <option value="ajuste">Ajuste</option>
        </select>
        <select
          value={filterIng}
          onChange={(e) => setFilterIng(e.target.value)}
          aria-label="Filtrar por ingrediente"
          className="px-2.5 py-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40 focus:border-[color:var(--primary,#3b82f6)] transition"
        >
          <option value="">Todos los ingredientes</option>
          {ingredientes.map((i) => (
            <option key={i.id} value={i.id}>{i.nombre}</option>
          ))}
        </select>
      </div>

      {movimientos.length === 0 ? (
        <div className="bg-[color:var(--bg-elevated)] border-2 border-dashed border-[color:var(--border)] rounded-xl p-10 text-center">
          <History className="w-10 h-10 mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p className="text-base font-semibold text-[color:var(--text)]">Sin movimientos</p>
          <p className="text-sm text-[color:var(--text-muted)] mt-1">
            No hay movimientos para los filtros seleccionados.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[color:var(--border)] shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--bg-elevated)] text-[color:var(--text-muted)] text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Fecha</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Ingrediente</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Tipo</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Cantidad</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Stock ant.</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Stock nuevo</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Usuario</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Notas</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => {
                const isNeg = Number(m.cantidad) < 0;
                const tipoMeta = TIPO_PILL[m.tipo] || { label: m.tipo, cls: 'bg-zinc-500/15 text-zinc-300 border border-zinc-500/30' };
                return (
                  <tr
                    key={m.id}
                    className="border-t border-[color:var(--border)] hover:bg-[color:var(--bg-elevated)]/40 transition-colors"
                  >
                    <td className="px-3 py-2.5 text-[color:var(--text-muted)] text-xs">
                      {formatDateTime(m.creado_en)}
                    </td>
                    <td className="px-3 py-2.5 font-medium">{m.ingrediente_nombre}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${tipoMeta.cls}`}>
                        {tipoMeta.label}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono font-semibold inline-flex items-center justify-end gap-0.5 w-full ${isNeg ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {isNeg ? <ArrowDown className="w-3 h-3" aria-hidden="true" /> : <ArrowUp className="w-3 h-3" aria-hidden="true" />}
                      {isNeg ? '' : '+'}{Number(m.cantidad).toFixed(3)} {m.ingrediente_unidad}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[color:var(--text-muted)]">
                      {Number(m.stock_anterior).toFixed(3)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      {Number(m.stock_nuevo).toFixed(3)}
                    </td>
                    <td className="px-3 py-2.5 text-[color:var(--text-muted)] text-xs">
                      {m.usuario_nombre || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[color:var(--text-muted)] text-xs">
                      {m.notas || (m.pedido_id ? `Pedido #${m.pedido_id}` : '—')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AlertasTab({ alertas, onAdjust }) {
  if (alertas.length === 0) {
    return (
      <div className="bg-[color:var(--bg-elevated)] border-2 border-dashed border-[color:var(--border)] rounded-xl p-10 text-center">
        <Boxes className="w-10 h-10 mx-auto mb-3 opacity-30" aria-hidden="true" />
        <p className="text-base font-semibold text-[color:var(--text)]">Todo en orden</p>
        <p className="text-sm text-[color:var(--text-muted)] mt-1">
          No hay ingredientes por debajo del mínimo.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {alertas.map((a) => (
        <div
          key={a.id}
          className="rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-4 hover:border-amber-500/60 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
              aria-hidden="true"
            >
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-heading font-semibold text-base">{a.nombre}</h3>
              <div className="mt-1.5 text-sm flex items-center gap-2 flex-wrap">
                <span className="text-[color:var(--text-muted)]">Stock:</span>
                <span className="font-mono font-bold text-amber-300">
                  {Number(a.stock_actual).toFixed(3)} {a.unidad}
                </span>
                <span className="text-[color:var(--text-muted)] text-xs">/</span>
                <span className="text-[color:var(--text-muted)] text-xs">
                  mín {Number(a.stock_minimo).toFixed(3)} {a.unidad}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onAdjust({ ...a, stock_minimo: a.stock_minimo, stock_actual: a.stock_actual })}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold border border-amber-500/40 hover:bg-amber-500/15 text-amber-200 transition-colors active:scale-95"
            >
              Reponer <ChevronRight className="w-3 h-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
