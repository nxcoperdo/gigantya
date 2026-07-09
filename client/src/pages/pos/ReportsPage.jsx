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
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar,
  PieChart, Pie, Cell,
} from 'recharts';
import { posReportsService } from '../../services/api';

// Paleta de colores estable (no se randomiza entre renders para
// evitar "parpadeo" cuando se re-renderiza el donut).
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

/** Formatea número como COP (sin símbolo, con separador de miles). */
function fmtCOP(n) {
  const v = Number(n || 0);
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(v);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Reportes
          </h1>
          <p className="text-sm text-[color:var(--text-muted)]">
            Ventas, productos más vendidos y métodos de pago del restaurante.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-[color:var(--text-muted)] mb-1">
              <Calendar className="w-3 h-3 inline mr-1" />
              Desde
            </label>
            <input
              type="date"
              value={rango.desde}
              onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))}
              className="input input-small"
            />
          </div>
          <div>
            <label className="block text-xs text-[color:var(--text-muted)] mb-1">
              <Calendar className="w-3 h-3 inline mr-1" />
              Hasta
            </label>
            <input
              type="date"
              value={rango.hasta}
              onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))}
              className="input input-small"
            />
          </div>
          <div>
            <label className="block text-xs text-[color:var(--text-muted)] mb-1">
              Agrupar por
            </label>
            <select
              value={agrupadoPor}
              onChange={(e) => setAgrupadoPor(e.target.value)}
              className="input input-small"
            >
              <option value="dia">Día</option>
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
            </select>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="btn btn-primary btn-small"
          >
            {loading ? 'Cargando…' : 'Refrescar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card border border-red-300 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          icon={ShoppingBag} label="Pedidos" value={kpis?.total_pedidos ?? '—'}
          loading={loading}
        />
        <KpiCard
          icon={DollarSign} label="Revenue" value={kpis ? `$${fmtCOP(kpis.revenue_total)}` : '—'}
          loading={loading}
        />
        <KpiCard
          icon={TrendingUp} label="Ticket prom."
          value={kpis ? `$${fmtCOP(kpis.ticket_promedio)}` : '—'}
          loading={loading}
        />
        <KpiCard
          icon={Users} label="Staff activos" value={kpis?.total_staff_activos ?? '—'}
          loading={loading}
        />
        <KpiCard
          icon={Hash} label="Items vendidos" value={kpis?.total_items_vendidos ?? '—'}
          loading={loading}
        />
      </div>

      {/* Revenue por período */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Revenue por {agrupadoPor}
        </h2>
        {revenue.length === 0 ? (
          <p className="text-sm text-[color:var(--text-muted)] py-8 text-center">
            {loading ? 'Cargando…' : 'Sin datos en el rango seleccionado.'}
          </p>
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
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top productos */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Top 10 productos
          </h2>
          {top.length === 0 ? (
            <p className="text-sm text-[color:var(--text-muted)] py-8 text-center">
              {loading ? 'Cargando…' : 'Sin datos en el rango seleccionado.'}
            </p>
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
                  <Bar dataKey="unidades_vendidas" name="Unidades" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Métodos de pago */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <PieIcon className="w-5 h-5" />
            Métodos de pago
          </h2>
          {metodos.length === 0 ? (
            <p className="text-sm text-[color:var(--text-muted)] py-8 text-center">
              {loading ? 'Cargando…' : 'Sin pagos en el rango seleccionado.'}
            </p>
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
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, loading: isLoading }) {
  return (
    <div className="card flex items-center gap-3">
      <div className="p-2 rounded-lg bg-primary/10 text-primary">
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[color:var(--text-muted)] truncate">{label}</p>
        <p className="text-lg font-semibold truncate">
          {isLoading ? '…' : value}
        </p>
      </div>
    </div>
  );
}
