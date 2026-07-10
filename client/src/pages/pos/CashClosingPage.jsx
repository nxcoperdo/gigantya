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
import {
  ArrowLeft, Receipt, Check, AlertTriangle, Banknote,
  Calendar, User, StickyNote, Loader2, FileText,
} from 'lucide-react';
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
    return (
      <div className="p-8 text-center text-[color:var(--text-muted)] flex flex-col items-center gap-2">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Cargando cierre…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-3 max-w-3xl">
        <button
          onClick={() => navigate('/pos/caja')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors"
          type="button"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Caja
        </button>
        <div
          role="alert"
          className="px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
        >
          {error}
        </div>
      </div>
    );
  }
  if (!sesion) {
    return <p className="p-8 text-center text-[color:var(--text-muted)]">Sesión no encontrada.</p>;
  }

  const diferencia = Number(sesion.diferencia || 0);
  const cuadra = Math.abs(diferencia) < 0.01;
  const falta = diferencia < 0;
  const sobra = diferencia > 0;
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
      <header className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => navigate('/pos/caja')}
          className="p-2 rounded-lg hover:bg-[color:var(--bg-elevated)] transition-colors"
          type="button"
          aria-label="Volver a Caja"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
          aria-hidden="true"
        >
          <Receipt className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold leading-tight">Cierre de caja #{sesion.id}</h1>
          <p className="text-xs text-[color:var(--text-muted)]">
            Resumen del arqueo realizado al final de la sesión
          </p>
        </div>
      </header>

      {/* Estado del cierre: cuadra / sobrante / faltante */}
      <section
        className={[
          'rounded-xl border-2 p-4 flex items-center gap-4',
          cuadra
            ? 'border-emerald-500/40 bg-emerald-500/5'
            : falta
              ? 'border-rose-500/40 bg-rose-500/5'
              : 'border-amber-500/40 bg-amber-500/5',
        ].join(' ')}
        role="status"
      >
        <div
          className={[
            'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
            cuadra ? 'bg-emerald-500/15' : falta ? 'bg-rose-500/15' : 'bg-amber-500/15',
          ].join(' ')}
        >
          {cuadra ? (
            <Check className="w-6 h-6 text-emerald-400" />
          ) : (
            <AlertTriangle className={`w-6 h-6 ${falta ? 'text-rose-400' : 'text-amber-400'}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2
            className={[
              'font-bold text-lg',
              cuadra ? 'text-emerald-300' : falta ? 'text-rose-300' : 'text-amber-300',
            ].join(' ')}
          >
            {cuadra
              ? 'Caja cuadrada'
              : falta
                ? `Faltante de ${formatCurrency(Math.abs(diferencia))}`
                : `Sobrante de ${formatCurrency(diferencia)}`}
          </h2>
          <p className="text-xs text-[color:var(--text-muted)] mt-0.5">
            {cuadra
              ? 'El efectivo contado coincide con el esperado.'
              : falta
                ? 'El efectivo contado es menor al esperado.'
                : 'El efectivo contado es mayor al esperado.'}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <InfoCard
          icon={User}
          label="Cajero"
          value={sesion.cajero_nombre || `#${sesion.usuario_id}`}
        />
        <InfoCard
          icon={Calendar}
          label="Abierta"
          value={formatDateTime(sesion.abierta_en)}
        />
        <InfoCard
          icon={Calendar}
          label="Cerrada"
          value={sesion.cerrada_en ? formatDateTime(sesion.cerrada_en) : '—'}
        />
        <InfoCard
          icon={Banknote}
          label="Fondo de apertura"
          value={formatCurrency(sesion.monto_apertura)}
        />
      </section>

      <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Banknote className="w-4 h-4 text-[color:var(--primary,#3b82f6)]" aria-hidden="true" />
          Resumen del cierre
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <SummaryItem
            label="Esperado"
            value={formatCurrency(sesion.monto_cierre_esperado ?? 0)}
            tone="default"
          />
          <SummaryItem
            label="Contado"
            value={formatCurrency(sesion.monto_cierre_real ?? 0)}
            tone="default"
          />
          <SummaryItem
            label={cuadra ? 'Diferencia' : falta ? 'Faltante' : 'Sobrante'}
            value={(
              <>
                {diferencia > 0 ? '+' : diferencia < 0 ? '−' : ''}
                {formatCurrency(Math.abs(diferencia))}
              </>
            )}
            tone={cuadra ? 'success' : falta ? 'danger' : 'warning'}
          />
        </div>
      </section>

      {desglose && Object.keys(desglose).length > 0 && (
        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[color:var(--primary,#3b82f6)]" aria-hidden="true" />
            Desglose de billetes y monedas
          </h3>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-sm">
            {Object.entries(desglose)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([valor, cant]) => (
                <li
                  key={valor}
                  className="rounded-lg border border-[color:var(--border)] p-2 text-center bg-[color:var(--bg)]"
                >
                  <div className="text-xs text-[color:var(--text-muted)] font-mono">
                    ${Number(valor).toLocaleString('es-CO')}
                  </div>
                  <div className="font-mono text-sm font-bold mt-0.5">× {cant}</div>
                  <div className="text-xs font-semibold mt-0.5 text-emerald-300 font-mono">
                    = {formatCurrency(Number(valor) * Number(cant))}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}

      {sesion.notas_cierre && (
        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-[color:var(--primary,#3b82f6)]" aria-hidden="true" />
            Notas del cierre
          </h3>
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-[color:var(--text)]">
            {sesion.notas_cierre}
          </p>
        </section>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/pos/caja')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[color:var(--border)] hover:bg-[color:var(--bg-elevated)] text-sm font-medium transition-colors"
          type="button"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a Caja
        </button>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3.5 flex items-start gap-3">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
        aria-hidden="true"
      >
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider font-semibold">
          {label}
        </div>
        <div className="text-sm font-medium mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, tone = 'default' }) {
  const toneClass = {
    default: 'border-[color:var(--border)] bg-[color:var(--bg)]',
    success: 'border-emerald-500/40 bg-emerald-500/10',
    warning: 'border-amber-500/40 bg-amber-500/10',
    danger:  'border-rose-500/40 bg-rose-500/10',
  }[tone];
  const valueClass = {
    default: 'text-[color:var(--text)]',
    success: 'text-emerald-300',
    warning: 'text-amber-300',
    danger:  'text-rose-300',
  }[tone];
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider font-semibold">
        {label}
      </div>
      <div className={`font-mono text-base font-bold mt-0.5 ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}
