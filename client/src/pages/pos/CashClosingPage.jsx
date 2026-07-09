/**
 * CashClosingPage (Fase 5).
 *
 * Vista de detalle de un cierre de caja. Se llega acá desde la
 * CashierPage después de cerrar (con `state.sesion` en la navegación)
 * o directamente con `:sesionId` (re-cargar la página, ver histórico).
 *
 * Muestra:
 *   - Estado (cerrada / cuándo / por quién).
 *   - Fondo apertura.
 *   - Esperado (Σ efectivo cobrado + fondo) vs Real (contado) vs
 *     Diferencia (sobrante / faltante).
 *   - Desglose de billetes/monedas (si el cajero lo completó).
 *   - Notas del cierre.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Receipt, Check, AlertTriangle, Banknote } from 'lucide-react';
import { posCashService } from '../../services/api';
import { formatCurrency } from '../../utils/formatHelper';
import { formatDateTime } from '../../utils/dateHelper';

export default function CashClosingPage() {
  const { sesionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [sesion, setSesion] = useState(location.state?.sesion || null);
  const [loading, setLoading] = useState(!sesion);
  const [error, setError] = useState(null);

  const fetchSesion = useCallback(async () => {
    try {
      const r = await posCashService.sessionById(sesionId);
      setSesion(r.data?.sesion || null);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [sesionId]);

  useEffect(() => { fetchSesion(); }, [fetchSesion]);

  if (loading) {
    return <p className="p-8 text-center text-[color:var(--text-muted)]">Cargando cierre…</p>;
  }
  if (error) {
    return (
      <div className="p-4">
        <div className="px-3 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
        <button
          onClick={() => navigate('/pos/caja')}
          className="mt-3 inline-flex items-center gap-1 text-sm"
          type="button"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Caja
        </button>
      </div>
    );
  }
  if (!sesion) {
    return <p className="p-8 text-center">Sesión no encontrada.</p>;
  }

  const diferencia = Number(sesion.diferencia || 0);
  const cuadra = Math.abs(diferencia) < 0.01;
  let desglose = null;
  if (sesion.desglose_billetes) {
    try {
      desglose = typeof sesion.desglose_billetes === 'string'
        ? JSON.parse(sesion.desglose_billetes)
        : sesion.desglose_billetes;
    } catch { desglose = null; }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <header className="flex items-center gap-2">
        <button
          onClick={() => navigate('/pos/caja')}
          className="p-2 rounded hover:bg-[color:var(--bg-elevated)]"
          type="button"
          aria-label="Volver"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-2xl font-bold">Cierre de caja #{sesion.id}</h1>
      </header>

      <section
        className={`rounded-lg border p-4 ${
          cuadra
            ? 'border-emerald-500/40 bg-emerald-500/5'
            : diferencia > 0
              ? 'border-amber-500/40 bg-amber-500/5'
              : 'border-rose-500/40 bg-rose-500/5'
        }`}
      >
        <div className="flex items-center gap-2">
          {cuadra ? (
            <Check className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          )}
          <h2 className="font-semibold text-lg">
            {cuadra
              ? 'Cuadra exacto'
              : diferencia > 0
                ? `Sobrante de ${formatCurrency(diferencia)}`
                : `Faltante de ${formatCurrency(Math.abs(diferencia))}`}
          </h2>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card label="Cajero" value={sesion.cajero_nombre || `#${sesion.usuario_id}`} />
        <Card label="Abierta" value={formatDateTime(sesion.abierta_en)} />
        <Card label="Cerrada" value={sesion.cerrada_en ? formatDateTime(sesion.cerrada_en) : '—'} />
        <Card label="Fondo apertura" value={formatCurrency(sesion.monto_apertura)} />
      </section>

      <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Banknote className="w-4 h-4" /> Resumen del cierre
        </h3>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="text-[color:var(--text-muted)] text-xs">Esperado</div>
            <div className="font-mono text-base">
              {formatCurrency(sesion.monto_cierre_esperado ?? 0)}
            </div>
          </div>
          <div>
            <div className="text-[color:var(--text-muted)] text-xs">Contado</div>
            <div className="font-mono text-base">
              {formatCurrency(sesion.monto_cierre_real ?? 0)}
            </div>
          </div>
          <div>
            <div className="text-[color:var(--text-muted)] text-xs">Diferencia</div>
            <div
              className={`font-mono text-base font-semibold ${
                cuadra
                  ? 'text-emerald-400'
                  : diferencia > 0
                    ? 'text-amber-400'
                    : 'text-rose-400'
              }`}
            >
              {diferencia > 0 ? '+' : ''}
              {formatCurrency(diferencia)}
            </div>
          </div>
        </div>
      </section>

      {desglose && Object.keys(desglose).length > 0 && (
        <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
          <h3 className="font-semibold text-sm mb-3">Desglose</h3>
          <ul className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
            {Object.entries(desglose)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([valor, cant]) => (
                <li
                  key={valor}
                  className="rounded border border-[color:var(--border)] p-2 text-center"
                >
                  <div className="text-xs text-[color:var(--text-muted)]">
                    ${Number(valor).toLocaleString('es-CO')}
                  </div>
                  <div className="font-mono">× {cant}</div>
                  <div className="text-xs font-semibold">
                    {formatCurrency(Number(valor) * Number(cant))}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}

      {sesion.notas_cierre && (
        <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
          <h3 className="font-semibold text-sm mb-2">Notas del cierre</h3>
          <p className="text-sm whitespace-pre-wrap">{sesion.notas_cierre}</p>
        </section>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/pos/caja')}
          className="px-3 py-2 rounded-md border border-[color:var(--border)] text-sm"
          type="button"
        >
          Volver a Caja
        </button>
      </div>
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3">
      <div className="text-[color:var(--text-muted)] text-xs">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
