/**
 * ReportsPage (Fase 7).
 *
 * Pantalla de reportes POS para el dueño del restaurante. Cuatro
 * bloques:
 *   1. KPIs (cards): total pedidos, revenue total, ticket promedio,
 *      staff activos, items vendidos.
 *   2. Revenue por período (línea): configurable dia/semana/mes.
 *   3. Top 10 productos (barras horizontal).
 *   4. Métodos de pago (pie/donut).
 *
 * Selector de rango de fechas (default últimos 7 días). Refresca
 * cuando cambia el rango o el agrupadoPor.
 *
 * Permisos: solo roles `restaurante` y `admin` (validado en
 * ProtectedRoute y en el backend con `requireStaff`).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Calendar,
  DollarSign,
  Hash,
  ShoppingBag,
  TrendingUp,
  Users,
  PieChart as PieIcon,
  Activity,
  RefreshCw,
  Loader2,
  Receipt,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar,
  PieChart, Pie, Cell,
} from 'recharts';
import { posReportsService } from '../../services/api';
import { formatCurrency } from '../../utils/formatHelper';

// Paleta de colores estable (no se randomiza entre renders para
// evitar "parpadeo" cuando se re-renderiza el donut).
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

/** Formatea número como COP (sin símbolo, con separador de miles). */
function fmtCOP(n) {
  return formatCurrency(n);
}

/** Formatea fecha corta. Acepta 'YYYY-MM-DD', 'YYYY-MM' o 'YYYYWww' (semana). */
function fmtFecha(f) {
  if (!f) return '';
  // Para "semana" viene como 202627 (YEARWEEK). Lo mostramos tal cual
  // porque interpretarlo acá sería adivinar calendario.
  if (/^\d{6}$/.test(String(f))) return `Sem ${String(f).slice(4)}`;
  if (/^\d{4}-\d{2}$/.test(String(f))) {
    const [y, m] = String(f).split('-');
    return `${m}/${y.slice(2)}`;
  }
  // 'YYYY-MM-DD' → 'DD/MM'
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(f))) {
    const [, m, d] = String(f).split('-');
    return `${d}/${m}`;
  }
  return String(f);
}

/** Default: últimos 7 días (incluyendo hoy) */
function defaultRange() {
  const hasta = new Date();
  const desde = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  return {
    desde: desde.toISOString().slice(0, 10),
    hasta: hasta.toISOString().slice(0, 10),
  };
}

const inputCls = 'px-2.5 py-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary,#3b82f6)]/40 focus:border-[color:var(--primary,#3b82f6)] transition';

export default function ReportsPage() {
  const [rango, setRango] = useState(defaultRange);
  const [agrupadoPor, setAgrupadoPor] = useState('dia');
  const [kpis, setKpis] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [top, setTop] = useState([]);
  const [metodos, setMetodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { desde: rango.desde, hasta: rango.hasta };
      const [j1, j2, j3, j4] = await Promise.all([
        posReportsService.estadisticas(params),
        posReportsService.revenue({ ...params, agrupadoPor }),
        posReportsService.topProductos({ ...params, limite: 10 }),
        posReportsService.metodosPago(params),
      ]);
      setKpis(j1);
      setRevenue(j2.items || []);
      setTop(j3.items || []);
      setMetodos(j4.items || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error cargando reportes');
    } finally {
      setLoading(false);
    }
  }, [rango.desde, rango.hasta, agrupadoPor]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      {/* Header con filtros */}
      <header className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)' }}
            aria-hidden="true"
          >
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-heading font-extrabold leading-tight">Reportes</h1>
            <p className="text-xs text-[color:var(--text-muted)]">
              Ventas, productos más vendidos y métodos de pago del restaurante.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[color:var(--primary,#3b82f6)] hover:opacity-90 text-white text-sm font-semibold disabled:opacity-50 active:scale-95 transition-all shadow-sm"
            type="button"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Cargando…' : 'Refrescar'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider font-semibold text-[color:var(--text-muted)] mb-1 inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Desde
            </span>
            <input
              type="date"
              value={rango.desde}
              onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider font-semibold text-[color:var(--text-muted)] mb-1 inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Hasta
            </span>
            <input
              type="date"
              value={rango.hasta}
              onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wider font-semibold text-[color:var(--text-muted)] mb-1">
              Agrupar por
            </span>
            <select
              value={agrupadoPor}
              onChange={(e) => setAgrupadoPor(e.target.value)}
              className={inputCls}
            >
              <option value="dia">Día</option>
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
            </select>
          </label>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
        >
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          Icon={ShoppingBag} label="Pedidos" value={kpis?.total_pedidos ?? '—'}
          loading={loading} tone="blue"
        />
        <KpiCard
          Icon={DollarSign} label="Revenue" value={kpis ? `$${fmtCOP(kpis.revenue_total)}` : '—'}
          loading={loading} tone="emerald"
        />
        <KpiCard
          Icon={TrendingUp} label="Ticket prom."
          value={kpis ? `$${fmtCOP(kpis.ticket_promedio)}` : '—'}
          loading={loading} tone="violet"
        />
        <KpiCard
          Icon={Users} label="Staff activos" value={kpis?.total_staff_activos ?? '—'}
          loading={loading} tone="amber"
        />
        <KpiCard
          Icon={Hash} label="Items vendidos" value={kpis?.total_items_vendidos ?? '—'}
          loading={loading} tone="rose"
        />
      </div>

      {/* Revenue por período */}
      <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
        <h2 className="text-lg font-heading font-semibold mb-3 flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
            aria-hidden="true"
          >
            <Activity className="w-4 h-4 text-white" />
          </div>
          Revenue por {agrupadoPor}
        </h2>
        {revenue.length === 0 ? (
          <EmptyChart
            Icon={Activity}
            title="Sin datos en el rango seleccionado"
            loading={loading}
          />
        ) : (
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={revenue} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                <XAxis dataKey="fecha" tickFormatter={fmtFecha} fontSize={12} />
                <YAxis tickFormatter={(v) => `$${fmtCOP(v)}`} fontSize={12} />
                <Tooltip
                  formatter={(v, name) => [
                    name === 'revenue' ? `$${fmtCOP(v)}` : v,
                    name === 'revenue' ? 'Revenue' : 'Pedidos',
                  ]}
                  labelFormatter={fmtFecha}
                />
                <Legend />
                <Line
                  type="monotone" dataKey="revenue" name="Revenue"
                  stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone" dataKey="pedidos_count" name="Pedidos"
                  stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} yAxisId={0}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top productos */}
        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
          <h2 className="text-lg font-heading font-semibold mb-3 flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              aria-hidden="true"
            >
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            Top 10 productos
          </h2>
          {top.length === 0 ? (
            <EmptyChart
              Icon={Receipt}
              title="Sin ventas en el rango"
              loading={loading}
            />
          ) : (
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart
                  data={top.map((p) => ({ ...p, label: p.nombre.length > 18 ? p.nombre.slice(0, 18) + '…' : p.nombre }))}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                  <XAxis type="number" tickFormatter={(v) => fmtCOP(v)} fontSize={12} />
                  <YAxis type="category" dataKey="label" width={130} fontSize={12} />
                  <Tooltip
                    formatter={(v, name) => [
                      name === 'revenue' ? `$${fmtCOP(v)}` : v,
                      name === 'revenue' ? 'Revenue' : 'Unidades',
                    ]}
                  />
                  <Bar dataKey="unidades_vendidas" name="Unidades" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Métodos de pago */}
        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-4">
          <h2 className="text-lg font-heading font-semibold mb-3 flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
              aria-hidden="true"
            >
              <PieIcon className="w-4 h-4 text-white" />
            </div>
            Métodos de pago
          </h2>
          {metodos.length === 0 ? (
            <EmptyChart
              Icon={PieIcon}
              title="Sin pagos en el rango"
              loading={loading}
            />
          ) : (
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={metodos}
                    dataKey="total"
                    nameKey="metodo"
                    innerRadius={50}
                    outerRadius={100}
                    paddingAngle={2}
                    label={({ metodo, percent }) =>
                      `${metodo} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                    fontSize={12}
                  >
                    {metodos.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `$${fmtCOP(v)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const TONE_GRAD = {
  blue:   { bg: 'rgba(59,130,246,0.12)',  fg: '#60a5fa' },
  emerald:{ bg: 'rgba(16,185,129,0.12)',  fg: '#34d399' },
  violet: { bg: 'rgba(139,92,246,0.12)',  fg: '#a78bfa' },
  amber:  { bg: 'rgba(245,158,11,0.12)',  fg: '#fbbf24' },
  rose:   { bg: 'rgba(244,63,94,0.12)',   fg: '#fb7185' },
};

function KpiCard({ Icon, label, value, loading: isLoading, tone = 'blue' }) {
  const c = TONE_GRAD[tone] || TONE_GRAD.blue;
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elevated)] p-3.5 hover:border-[color:var(--primary,#3b82f6)]/40 transition-colors">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: c.bg }}
        >
          <Icon className="w-5 h-5" style={{ color: c.fg }} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-[color:var(--text-muted)] uppercase tracking-wider font-semibold">
            {label}
          </p>
          <p className="text-lg font-bold truncate font-mono">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : value}
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ Icon, title, loading: isLoading }) {
  return (
    <div className="py-10 text-center text-[color:var(--text-muted)] flex flex-col items-center gap-2">
      <Icon className="w-7 h-7 opacity-30" aria-hidden="true" />
      <p className="text-sm font-medium">
        {isLoading ? 'Cargando…' : title}
      </p>
    </div>
  );
}
