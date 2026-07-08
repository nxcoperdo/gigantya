import { useEffect, useState } from 'react';
import { X, User, ShoppingBag, FileText, Activity, Phone, Mail, BadgeCheck, Calendar, Store, MapPin, History, ShieldAlert, CheckCircle, XCircle, AlertCircle, Map, Building2, Navigation, ExternalLink, Home } from 'lucide-react';
import { adminService } from '../services/api';
import { formatDate, formatDateTime, formatTime } from '../utils/dateHelper';
import { formatCurrency } from '../utils/formatHelper';
import { getImageUrl } from '../utils/imageHelper';

/**
 * Modal de detalle de un usuario para el admin.
 *
 * Tabs:
 *  - Perfil: datos del usuario + restaurante asociado (si aplica).
 *  - Pedidos: últimos pedidos del usuario (cliente o restaurante).
 *  - Comprobantes: comprobantes de pago de los pedidos del usuario.
 *  - Actividad: log de auditoría de cambios sobre este usuario.
 *
 * Props:
 *  - userId: number | null
 *  - onClose: () => void
 *
 * Renderiza null si userId es null. Muestra skeletons mientras carga.
 */
export default function UserDetailModal({ userId, onClose }) {
  const [tab, setTab] = useState('perfil');
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [comprobantes, setComprobantes] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset de tabs al cambiar de usuario.
  useEffect(() => {
    if (userId) {
      setTab('perfil');
      setUser(null);
      setOrders([]);
      setComprobantes([]);
      setAudit([]);
      setError('');
    }
  }, [userId]);

  // Cargar todos los datos del usuario cuando se abre el modal o cambia
  // la tab (los comprobantes/auditoría se cargan lazy al cambiar de tab
  // para no hacer 4 requests simultáneos en la primera apertura).
  useEffect(() => {
    if (!userId) return undefined;

    const loadAll = async () => {
      try {
        setLoading(true);
        setError('');
        const userRes = await adminService.getUserById(userId);
        setUser(userRes.data?.usuario || null);

        // Pedidos: si es restaurante, rol=restaurante; si no, cliente.
        const rol = userRes.data?.usuario?.tipo_usuario === 'restaurante' ? 'restaurante' : 'cliente';
        const ordersRes = await adminService.getUserOrders(userId, { rol, limit: 50 });
        setOrders(ordersRes.data?.pedidos || []);

        // Comprobantes: solo aplica a clientes (los comprobantes van
        // contra pedidos de clientes, no de locales).
        if (userRes.data?.usuario?.tipo_usuario === 'cliente') {
          const compRes = await adminService.getPaymentProofs({ cliente_id: userId, limit: 50 });
          setComprobantes(compRes.data?.comprobantes || []);
        }

        // Auditoría: siempre.
        const auditRes = await adminService.getAuditLogs({ entidad_id: userId, limit: 50 });
        // Filtramos los que NO son del tipo 'usuario' (puede haber
        // acciones sobre restaurante con entidad_tipo=restaurante que
        // no aplican al usuario directamente).
        setAudit(
          (auditRes.data?.logs || []).filter(
            (l) => l.entidad_tipo === 'usuario' || l.entidad_tipo === 'restaurante'
          )
        );
      } catch (err) {
        console.error('Error cargando detalle de usuario:', err);
        setError(err.response?.data?.error || 'No se pudo cargar la información del usuario');
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [userId]);

  // Body scroll lock mientras el modal está abierto.
  useEffect(() => {
    if (!userId) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [userId]);

  if (!userId) return null;

  const initials = (user?.nombre || '?')
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const tabs = [
    { id: 'perfil', label: 'Perfil', icon: User },
    { id: 'pedidos', label: `Pedidos${orders.length ? ` (${orders.length})` : ''}`, icon: ShoppingBag },
    { id: 'comprobantes', label: `Comprobantes${comprobantes.length ? ` (${comprobantes.length})` : ''}`, icon: FileText },
    { id: 'actividad', label: `Actividad${audit.length ? ` (${audit.length})` : ''}`, icon: Activity },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 animate-fadeIn" onClick={onClose} aria-hidden="true" />

      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div
          className="relative bg-[color:var(--bg-elevated)] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col animate-scaleIn pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header sticky con X */}
          <div className="flex items-center gap-3 p-4 sm:p-5 border-b border-[color:var(--border-subtle)]">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0"
              style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-text)' }}
              aria-hidden="true"
            >
              {loading ? '...' : initials}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[color:var(--text-primary)] truncate">
                {user?.nombre || 'Cargando…'}
              </h2>
              <p className="text-xs text-[color:var(--text-muted)] truncate">
                {user?.email || ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 -m-1.5 text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)] rounded-full hover:bg-[color:var(--bg-muted)] mobile-tap-target"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs scrolleables horizontalmente en mobile */}
          <div className="flex border-b border-[color:var(--border-subtle)] overflow-x-auto">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                    active
                      ? 'text-[color:var(--primary-text)] border-[color:var(--primary-text)]'
                      : 'text-[color:var(--text-muted)] border-transparent hover:text-[color:var(--text-secondary)]'
                  }`}
                >
                  <Icon size={16} aria-hidden="true" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Body scrollable */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {error && (
              <div className="alert alert-error rounded-xl mb-4">
                <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-4 w-1/2" />
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-1/3" />
              </div>
            ) : (
              <>
                {tab === 'perfil' && <TabPerfil user={user} />}
                {tab === 'pedidos' && <TabPedidos orders={orders} />}
                {tab === 'comprobantes' && <TabComprobantes comprobantes={comprobantes} />}
                {tab === 'actividad' && <TabActividad audit={audit} />}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================== TABS ============================== */

function Field({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon size={16} className="text-[color:var(--text-muted)] mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">{label}</p>
        <p className={`text-sm text-[color:var(--text-primary)] break-words ${mono ? 'font-mono' : ''}`}>
          {value || <span className="text-[color:var(--text-muted)]">—</span>}
        </p>
      </div>
    </div>
  );
}

function TabPerfil({ user }) {
  if (!user) return <p className="text-sm text-[color:var(--text-muted)]">Sin datos</p>;

  return (
    <div className="space-y-5">
      {/* Datos personales */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--text-muted)] mb-2">
          Datos personales
        </h3>
        <div className="rounded-xl border border-[color:var(--border-subtle)] p-4 space-y-1">
          <Field icon={User} label="Nombre" value={user.nombre} />
          <Field icon={Mail} label="Email" value={user.email} />
          <Field icon={Phone} label="Teléfono" value={user.telefono} />
          <Field icon={BadgeCheck} label="Documento" value={user.documento_identidad} />
          <Field icon={ShieldAlert} label="Rol" value={user.tipo_usuario} />
          <Field
            icon={CheckCircle}
            label="Estado"
            value={user.estado}
          />
          <Field icon={Calendar} label="Registrado" value={formatDateTime(user.creado_en)} />
          <Field icon={Activity} label="Última actividad" value={user.ultima_actividad ? formatDateTime(user.ultima_actividad) : null} />
        </div>
      </section>

      {/* Datos del restaurante (si aplica) */}
      {user.tipo_usuario === 'restaurante' && user.restaurante && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--text-muted)] mb-2 flex items-center gap-1.5">
            <Store size={14} aria-hidden="true" />
            Local asociado
          </h3>
          <div className="rounded-xl border border-[color:var(--border-subtle)] p-4 space-y-1">
            <Field icon={Store} label="Nombre" value={user.restaurante.nombre} />
            <Field icon={MapPin} label="Dirección" value={user.restaurante.direccion} />
            <Field icon={Phone} label="Teléfono" value={user.restaurante.telefono} />
            <Field icon={CheckCircle} label="Estado" value={user.restaurante.estado} />
            <Field icon={CheckCircle} label="Aprobado" value={user.restaurante.aprobado ? 'Sí' : 'No'} />
            <Field icon={Activity} label="Pedidos del local" value={user.restaurante.pedidos_count ?? '0'} />
            <p className="text-xs text-[color:var(--text-muted)] pt-2">
              Pedidos del usuario como cliente: <span className="font-semibold text-[color:var(--text-primary)]">{user.pedidos_count || 0}</span>
            </p>
          </div>
        </section>
      )}

      {/* Dirección por defecto (sector + barrio + Maps).
          Importante para que el admin vea desde qué zona hace pedidos
          el cliente, sin tener que abrir otro modal. */}
      <DireccionSeccion direccion={user.direccion_default || user.direccion} />

      {/* Otros datos (JSON libre) */}
      {user.otros_datos && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--text-muted)] mb-2">
            Datos adicionales
          </h3>
          <pre className="rounded-xl border border-[color:var(--border-subtle)] p-3 text-xs overflow-x-auto bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)]">
            {JSON.stringify(user.otros_datos, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}

/**
 * Sección que muestra la dirección por defecto del usuario con foco
 * en sector + barrio (que es lo que el admin necesita ver de un vistazo
 * para entender la zona desde donde se hacen los pedidos).
 *
 * - Si el usuario no tiene dirección: muestra un estado vacío claro.
 * - Si tiene barrio: muestra "Sector > Barrio" como navegación.
 * - Si tiene coordenadas de Maps: link externo a Google Maps.
 * - Si tiene `direccion_formateada` (la que devolvió Places): se prioriza
 *   sobre `direccion` cruda, porque es más legible.
 */
function DireccionSeccion({ direccion }) {
  const tieneDireccion = !!direccion && (!!direccion.direccion || !!direccion.direccion_formateada);

  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--text-muted)] mb-2 flex items-center gap-1.5">
        <Home size={14} aria-hidden="true" />
        Dirección registrada
      </h3>

      {!tieneDireccion ? (
        <div className="rounded-xl border border-dashed border-[color:var(--border-subtle)] p-4 text-center">
          <MapPin size={28} className="mx-auto mb-2 opacity-40 text-[color:var(--text-muted)]" aria-hidden="true" />
          <p className="text-sm text-[color:var(--text-muted)]">
            Este usuario no tiene una dirección guardada.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[color:var(--border-subtle)] p-4 space-y-1">
          {/* Sector + barrio como "breadcrumbs" — lo más importante
              para el admin. */}
          {(direccion.sector_nombre || direccion.barrio_nombre) && (
            <div className="flex items-center gap-2 pb-2 mb-1 border-b border-[color:var(--border-subtle)]">
              <Building2 size={16} className="text-[color:var(--primary-text)] flex-shrink-0" aria-hidden="true" />
              <div className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--text-primary)] flex-wrap">
                {direccion.sector_nombre && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[color:var(--primary-light)] text-[color:var(--primary-text)]">
                    {direccion.sector_nombre}
                  </span>
                )}
                {direccion.sector_nombre && direccion.barrio_nombre && (
                  <Navigation size={12} className="text-[color:var(--text-muted)]" aria-hidden="true" />
                )}
                {direccion.barrio_nombre && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)]">
                    {direccion.barrio_nombre}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Dirección formateada (la que devolvió Google Places al
              registrarse) tiene prioridad sobre la dirección cruda. */}
          {direccion.direccion_formateada && (
            <Field icon={Map} label="Dirección (Google)" value={direccion.direccion_formateada} />
          )}
          <Field icon={MapPin} label="Dirección" value={direccion.direccion} />
          <Field icon={Building2} label="Ciudad" value={direccion.ciudad} />
          <Field icon={Phone} label="Teléfono de contacto" value={direccion.telefono} />
          {direccion.notas && <Field icon={FileText} label="Notas" value={direccion.notas} />}

          {/* Coordenadas + link a Google Maps. Se muestran solo si
              existen, porque muchos usuarios anteriores a la integración
              con Maps no las tienen. */}
          {(direccion.latitud !== null && direccion.latitud !== undefined &&
            direccion.longitud !== null && direccion.longitud !== undefined) && (
            <div className="pt-2 mt-1 border-t border-[color:var(--border-subtle)]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-1">
                Ubicación
              </p>
              <p className="text-xs text-[color:var(--text-secondary)] font-mono">
                {Number(direccion.latitud).toFixed(6)}, {Number(direccion.longitud).toFixed(6)}
              </p>
              <a
                href={`https://www.google.com/maps?q=${direccion.latitud},${direccion.longitud}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-[color:var(--primary-text)] hover:underline"
              >
                Ver en Google Maps
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TabPedidos({ orders }) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-[color:var(--text-muted)]">
        <ShoppingBag size={40} className="mx-auto mb-3 opacity-40" aria-hidden="true" />
        Este usuario no tiene pedidos registrados.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {orders.map((o) => (
        <li
          key={o.id}
          className="rounded-xl border border-[color:var(--border-subtle)] p-3 flex items-center justify-between gap-3 hover:bg-[color:var(--bg-subtle)] transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[color:var(--text-primary)]">
              Pedido #{o.id}
              {o.restaurante && (
                <span className="ml-2 text-xs font-normal text-[color:var(--text-muted)]">· {o.restaurante}</span>
              )}
              {o.cliente && (
                <span className="ml-2 text-xs font-normal text-[color:var(--text-muted)]">· {o.cliente}</span>
              )}
            </p>
            <p className="text-[11px] text-[color:var(--text-muted)] mt-0.5">
              {formatDateTime(o.creado_en)}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-primary">{formatCurrency(o.total)}</p>
            <span
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              {o.estado}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TabComprobantes({ comprobantes }) {
  if (comprobantes.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-[color:var(--text-muted)]">
        <FileText size={40} className="mx-auto mb-3 opacity-40" aria-hidden="true" />
        Este cliente no ha subido comprobantes de pago.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {comprobantes.map((c) => (
        <li
          key={c.id}
          className="rounded-xl border border-[color:var(--border-subtle)] p-3 flex items-center gap-3"
        >
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-[color:var(--bg-subtle)] flex-shrink-0">
            <img
              src={getImageUrl(c.url_imagen)}
              alt={`Comprobante pedido #${c.pedido_id}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[color:var(--text-primary)] truncate">
              Pedido #{c.pedido_id} · <span className="uppercase font-normal text-xs">{c.metodo_pago}</span>
            </p>
            <p className="text-[11px] text-[color:var(--text-muted)] mt-0.5">
              {formatDateTime(c.fecha_subida)}
            </p>
            <p className="text-[11px] text-[color:var(--text-muted)] mt-0.5">
              {c.restaurante_nombre ? `Local: ${c.restaurante_nombre}` : ''}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-primary">{formatCurrency(c.pedido_total)}</p>
            <EstadoBadge estado={c.estado_validacion} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EstadoBadge({ estado }) {
  const styles = {
    aprobado: { bg: 'var(--success-bg)', fg: 'var(--success-text)', border: 'var(--success-border)' },
    rechazado: { bg: 'var(--danger-bg)', fg: 'var(--danger-text)', border: 'var(--danger-border)' },
    pendiente: { bg: 'var(--warning-bg)', fg: 'var(--warning-text)', border: 'var(--warning-border)' },
  };
  const s = styles[estado] || styles.pendiente;
  return (
    <span
      className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border"
      style={{ backgroundColor: s.bg, color: s.fg, borderColor: s.border }}
    >
      {estado}
    </span>
  );
}

function TabActividad({ audit }) {
  if (audit.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-[color:var(--text-muted)]">
        <History size={40} className="mx-auto mb-3 opacity-40" aria-hidden="true" />
        Sin cambios auditados sobre este usuario todavía.
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {audit.map((a) => (
        <li
          key={a.id}
          className="rounded-xl border border-[color:var(--border-subtle)] p-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <AccionIcon accion={a.accion} />
            <p className="text-sm font-semibold text-[color:var(--text-primary)] flex-1">
              {describeAccion(a)}
            </p>
            <span className="text-[10px] text-[color:var(--text-muted)]">
              {formatTime(a.creado_en)}
            </span>
          </div>
          <p className="text-[11px] text-[color:var(--text-muted)]">
            {formatDate(a.creado_en)} · por {a.admin_nombre || `admin #${a.admin_id}`}
          </p>
          {(a.datos_antes || a.datos_despues) && (
            <details className="mt-2">
              <summary className="text-[11px] text-[color:var(--primary-text)] cursor-pointer hover:underline">
                Ver detalles del cambio
              </summary>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {a.datos_antes && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[color:var(--text-muted)] mb-0.5">Antes</p>
                    <pre className="rounded bg-[color:var(--bg-subtle)] p-2 text-[10px] overflow-x-auto text-[color:var(--text-secondary)]">
                      {JSON.stringify(a.datos_antes, null, 2)}
                    </pre>
                  </div>
                )}
                {a.datos_despues && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[color:var(--text-muted)] mb-0.5">Después</p>
                    <pre className="rounded bg-[color:var(--bg-subtle)] p-2 text-[10px] overflow-x-auto text-[color:var(--text-secondary)]">
                      {JSON.stringify(a.datos_despues, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}
        </li>
      ))}
    </ol>
  );
}

function AccionIcon({ accion }) {
  const map = {
    'restaurante.approve': { Icon: CheckCircle, color: 'var(--success-text)' },
    'restaurante.reject': { Icon: XCircle, color: 'var(--danger-text)' },
    'comprobante.approve': { Icon: CheckCircle, color: 'var(--success-text)' },
    'comprobante.reject': { Icon: XCircle, color: 'var(--danger-text)' },
    'user.status_change': { Icon: ShieldAlert, color: 'var(--warning-text)' },
    'user.delete': { Icon: XCircle, color: 'var(--danger-text)' },
    'user.update': { Icon: User, color: 'var(--primary-text)' },
    'plan.change': { Icon: Store, color: 'var(--primary-text)' },
    'modalidad.toggle': { Icon: Store, color: 'var(--text-secondary)' },
  };
  const { Icon, color } = map[accion] || { Icon: History, color: 'var(--text-muted)' };
  return <Icon size={14} style={{ color }} aria-hidden="true" />;
}

function describeAccion(a) {
  const map = {
    'restaurante.approve': 'aprobó el local',
    'restaurante.reject': 'rechazó el local',
    'comprobante.approve': 'aprobó un comprobante',
    'comprobante.reject': 'rechazó un comprobante',
    'user.status_change': 'cambió el estado del usuario',
    'user.delete': 'eliminó el usuario',
    'user.update': 'actualizó datos del usuario',
    'plan.change': 'cambió el plan del local',
    'modalidad.toggle': 'cambió una modalidad del local',
  };
  return map[a.accion] || a.accion;
}
