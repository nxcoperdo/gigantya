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
import { Plus, Edit, Trash2, Boxes, Package, AlertTriangle, History } from 'lucide-react';
import { posInventoryService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { subscribeToEvent, unsubscribeFromEvent } from '../../services/socket';
import IngredientForm from '../../components/pos/IngredientForm';
import StockAdjustModal from '../../components/pos/StockAdjustModal';

const TABS = [
  { id: 'ingredientes', label: 'Ingredientes', icon: Boxes },
  { id: 'kardex',       label: 'Kardex',       icon: History },
  { id: 'alertas',      label: 'Alertas',      icon: AlertTriangle },
];

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
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Boxes className="w-6 h-6" /> Inventario
        </h1>
        {isOwner && tab === 'ingredientes' && (
          <button
            type="button"
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-primary text-white text-sm"
          >
            <Plus className="w-4 h-4" /> Nuevo ingrediente
          </button>
        )}
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[color:var(--border)]">
        {TABS.map((t) => {
          const Icn = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-medium flex items-center gap-1 border-b-2 ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]'
              }`}
            >
              <Icn className="w-4 h-4" />
              {t.label}
              {t.id === 'alertas' && alertas.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300">
                  {alertas.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="px-3 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 text-xs underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[color:var(--text-muted)] p-4">Cargando…</p>
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
      <p className="text-sm text-[color:var(--text-muted)] p-4 italic">
        No hay ingredientes cargados todavía. {isOwner && 'Hacé click en "Nuevo ingrediente" para empezar.'}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[color:var(--border)]">
      <table className="w-full text-sm">
        <thead className="bg-[color:var(--bg-elevated)] text-[color:var(--text-muted)] text-xs uppercase">
          <tr>
            <th className="px-3 py-2 text-left">Nombre</th>
            <th className="px-3 py-2 text-left">Unidad</th>
            <th className="px-3 py-2 text-right">Stock actual</th>
            <th className="px-3 py-2 text-right">Mínimo</th>
            <th className="px-3 py-2 text-center">Estado</th>
            <th className="px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {ingredientes.map((ing) => {
            const bajoMin = Number(ing.stock_actual) < Number(ing.stock_minimo);
            return (
              <tr key={ing.id} className="border-t border-[color:var(--border)] hover:bg-[color:var(--bg-elevated)]/40">
                <td className="px-3 py-2 font-medium">{ing.nombre}</td>
                <td className="px-3 py-2 text-[color:var(--text-muted)]">{ing.unidad}</td>
                <td className="px-3 py-2 text-right font-mono">{Number(ing.stock_actual).toFixed(3)}</td>
                <td className="px-3 py-2 text-right font-mono text-[color:var(--text-muted)]">{Number(ing.stock_minimo).toFixed(3)}</td>
                <td className="px-3 py-2 text-center">
                  {bajoMin ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300">
                      <AlertTriangle className="w-3 h-3" /> Bajo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300">
                      OK
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      type="button"
                      onClick={() => onAdjust(ing)}
                      className="px-2 py-1 rounded text-xs border border-[color:var(--border)] hover:bg-[color:var(--bg-elevated)]"
                    >
                      Ajustar stock
                    </button>
                    {isOwner && (
                      <>
                        <button
                          type="button"
                          onClick={() => onEdit(ing)}
                          className="p-1 rounded hover:bg-[color:var(--bg-elevated)]"
                          aria-label="Editar"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(ing)}
                          className="p-1 rounded text-rose-400 hover:bg-rose-500/10"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
      <div className="flex gap-2 flex-wrap text-sm">
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className="px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--bg-elevated)]"
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
          className="px-2 py-1 rounded border border-[color:var(--border)] bg-[color:var(--bg-elevated)]"
        >
          <option value="">Todos los ingredientes</option>
          {ingredientes.map((i) => (
            <option key={i.id} value={i.id}>{i.nombre}</option>
          ))}
        </select>
      </div>

      {movimientos.length === 0 ? (
        <p className="text-sm text-[color:var(--text-muted)] p-4 italic">
          No hay movimientos para los filtros seleccionados.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[color:var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--bg-elevated)] text-[color:var(--text-muted)] text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Ingrediente</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-right">Cantidad</th>
                <th className="px-3 py-2 text-right">Stock ant.</th>
                <th className="px-3 py-2 text-right">Stock nuevo</th>
                <th className="px-3 py-2 text-left">Usuario</th>
                <th className="px-3 py-2 text-left">Notas</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => {
                const isNeg = Number(m.cantidad) < 0;
                return (
                  <tr key={m.id} className="border-t border-[color:var(--border)]">
                    <td className="px-3 py-2 text-[color:var(--text-muted)] text-xs">
                      {new Date(m.creado_en).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-3 py-2 font-medium">{m.ingrediente_nombre}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-[color:var(--bg-elevated)] text-[color:var(--text-muted)]">
                        {m.tipo}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${isNeg ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {isNeg ? '' : '+'}{Number(m.cantidad).toFixed(3)} {m.ingrediente_unidad}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[color:var(--text-muted)]">{Number(m.stock_anterior).toFixed(3)}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(m.stock_nuevo).toFixed(3)}</td>
                    <td className="px-3 py-2 text-[color:var(--text-muted)] text-xs">{m.usuario_nombre || '—'}</td>
                    <td className="px-3 py-2 text-[color:var(--text-muted)] text-xs">{m.notas || (m.pedido_id ? `Pedido #${m.pedido_id}` : '—')}</td>
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
      <p className="text-sm text-[color:var(--text-muted)] p-4 italic">
        No hay ingredientes por debajo del mínimo. Todo OK.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {alertas.map((a) => (
        <div
          key={a.id}
          className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold">{a.nombre}</h3>
              <p className="text-sm text-[color:var(--text-muted)]">
                Stock actual: <span className="font-mono">{Number(a.stock_actual).toFixed(3)} {a.unidad}</span>
              </p>
              <p className="text-xs text-amber-300/80">
                Mínimo: <span className="font-mono">{Number(a.stock_minimo).toFixed(3)} {a.unidad}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAdjust({ ...a, stock_minimo: a.stock_minimo, stock_actual: a.stock_actual })}
              className="px-2 py-1 rounded text-xs border border-amber-500/40 hover:bg-amber-500/10"
            >
              Reponer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
