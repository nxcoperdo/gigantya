import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { zonaService } from '../services/api';
import { MapPin, AlertCircle, ChevronDown } from 'lucide-react';
// Sin AddressAutocomplete ni AddressMapPicker: el usuario escribe la dirección
// como texto libre. El restaurante la geocodifica en el iframe de embed si no
// hay coordenadas (AddressMapPreview.jsx hace fallback por texto).
//
// El consentimiento legal (TyC + Privacidad) se gestiona en
// <LegalGate />, que se monta globalmente en App.jsx y se activa cuando
// el AuthContext reconoce un usuario nuevo sin aceptaciones. NO se
// pide el consentimiento acá en el form — el modal bloqueante lo hace
// con scroll-to-bottom obligatorio y queda como log legal consistente
// con el flujo de usuarios ya registrados.

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    contrasena: '',
    contrasena_confirmacion: '',
    tipo_usuario: 'cliente',
    documento_identidad: '',
    direccion: '',
    ciudad: 'Gigante, Huila',
    sector_id: '',
    barrio_id: '',
    notas: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  // Catálogo de zonas
  const [sectores, setSectores] = useState([]);
  const [barriosBySector, setBarriosBySector] = useState({});
  const [sectoresLoading, setSectoresLoading] = useState(false);
  const [sinZonas, setSinZonas] = useState(false);

  useEffect(() => {
    const fetchSectores = async () => {
      try {
        setSectoresLoading(true);
        const res = await zonaService.getSectores();
        const lista = res.data.sectores || [];
        setSectores(lista);
        setSinZonas(lista.length === 0);
      } catch (err) {
        console.error('Error cargando sectores:', err);
      } finally {
        setSectoresLoading(false);
      }
    };
    fetchSectores();
  }, []);

  // Cuando cambia el sector, cargar sus barrios
  useEffect(() => {
    if (!formData.sector_id) return;
    if (barriosBySector[formData.sector_id]) return;

    const fetchBarrios = async () => {
      try {
        const res = await zonaService.getBarrios(formData.sector_id);
        setBarriosBySector(prev => ({
          ...prev,
          [formData.sector_id]: res.data.barrios || []
        }));
      } catch (err) {
        console.error('Error cargando barrios:', err);
      }
    };
    fetchBarrios();
  }, [formData.sector_id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      // Si cambia el sector, limpiamos el barrio
      if (name === 'sector_id') {
        next.barrio_id = '';
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (formData.contrasena !== formData.contrasena_confirmacion) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    if (formData.contrasena.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    if (!formData.direccion.trim()) {
      setError('La dirección es obligatoria');
      setLoading(false);
      return;
    }

    // Barrio es obligatorio para poder calcular el envío (la API de zonas
    // necesita un barrio_id válido).
    if (!formData.barrio_id) {
      setError('Selecciona un barrio del menú para fijar tu dirección');
      setLoading(false);
      return;
    }

    try {
      // Construir payload limpio para el backend
      const payload = {
        nombre: formData.nombre.trim(),
        email: formData.email.trim().toLowerCase(),
        telefono: formData.telefono.trim(),
        contrasena: formData.contrasena,
        contrasena_confirmacion: formData.contrasena_confirmacion,
        tipo_usuario: 'cliente',
        documento_identidad: formData.documento_identidad?.trim() || null,
        direccion: formData.direccion.trim(),
        ciudad: formData.ciudad.trim() || 'Gigante, Huila',
        barrio_id: formData.barrio_id ? Number(formData.barrio_id) : null,
        notas: formData.notas?.trim() || null,
        // Sin autocompletado de mapa: el cliente tipea la dirección como texto
        // libre. El restaurante la ve en el detalle del pedido y la geocodifica
        // automáticamente en el iframe de embed de Google Maps
        // (AddressMapPreview.jsx hace fallback por texto).
        latitud: null,
        longitud: null,
        direccion_formateada: null,
        place_id: null,
      };
      await register(payload);
      // No mandamos aceptaciones legales desde acá: el <LegalGate />
      // global se activa cuando el AuthContext reconoce al nuevo usuario
      // y abre el modal bloqueante de TyC+Privacidad con scroll obligatorio.
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  const barriosDelSector = formData.sector_id
    ? (barriosBySector[formData.sector_id] || [])
    : [];

  return (
    <div className="min-h-screen bg-[color:var(--bg-base)] py-6 sm:py-12 px-3 sm:px-4">
      <div className="max-w-md mx-auto bg-[color:var(--bg-elevated)] rounded-2xl shadow-xl border border-[color:var(--border-subtle)] p-5 sm:p-8">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-1 sm:mb-2">Gigantya</h1>
          <p className="text-sm sm:text-base text-[color:var(--text-secondary)]">
            Registro exclusivo para clientes
          </p>
        </div>

        <div className="mb-5 sm:mb-6 alert alert-info text-xs sm:text-sm">
          <p className="font-semibold mb-1">Importante para locales</p>
          <p>
            Los locales no se registran desde esta pantalla. Para ingresar a la plataforma,
            deben contactarse <strong>coderepairtech@gmail.com</strong> y ser habilitados por el equipo administrativo.
          </p>
        </div>

        {error && (
          <div className="alert alert-error text-sm">
            {error}
          </div>
        )}

        {sinZonas && !sectoresLoading && (
          <div className="mb-5 sm:mb-6 alert alert-warning text-xs sm:text-sm">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Aún no hay sectores/barrios configurados</p>
              <p>
                Pídele al administrador que cree los sectores y barrios en el panel admin antes de registrarte.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5">Nombre completo</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              className="input"
              placeholder="Tu nombre completo"
              autoComplete="name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="input"
              placeholder="tu@email.com"
              autoComplete="email"
              inputMode="email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Teléfono</label>
            <input
              type="tel"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              className="input"
              placeholder="+57 3XX XXXXXXX"
              autoComplete="tel"
              inputMode="tel"
              required
            />
          </div>

          {formData.tipo_usuario === 'restaurante' && (
            <div>
              <label className="block text-sm font-semibold mb-1.5">Documento</label>
              <input
                type="text"
                name="documento_identidad"
                value={formData.documento_identidad}
                onChange={handleChange}
                className="input"
                placeholder="NIT o Cédula"
              />
            </div>
          )}

          {/* ============ DIRECCIÓN (obligatoria en registro) ============ */}
          <div className="pt-3 border-t border-[color:var(--border-subtle)]">
            <h3 className="text-sm font-bold text-[color:var(--text-primary)] mb-1 flex items-center gap-2">
              <MapPin size={16} className="text-primary" /> Tu primera dirección
            </h3>
            <p className="text-xs text-[color:var(--text-muted)] mb-3">
              La necesitamos para poder calcular el envío en tus pedidos. Podrás agregar más después.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">
              Dirección (calle/carrera/número)
            </label>
            <input
              type="text"
              name="direccion"
              value={formData.direccion}
              onChange={handleChange}
              className="input"
              placeholder="Calle 5 #12-45, Gigante, Huila"
              autoComplete="street-address"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1.5">Sector</label>
              <div className="relative">
                <select
                  name="sector_id"
                  value={formData.sector_id}
                  onChange={handleChange}
                  className="input appearance-none pr-10"
                  required
                  disabled={sectoresLoading || sinZonas}
                >
                  <option value="">
                    {sectoresLoading ? 'Cargando sectores…' : 'Selecciona un sector'}
                  </option>
                  {sectores.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] pointer-events-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">Barrio</label>
              <div className="relative">
                <select
                  name="barrio_id"
                  value={formData.barrio_id}
                  onChange={handleChange}
                  className="input appearance-none pr-10"
                  required
                  disabled={!formData.sector_id}
                >
                  <option value="">
                    {formData.sector_id ? 'Selecciona un barrio' : 'Primero selecciona un sector'}
                  </option>
                  {barriosDelSector.map(b => (
                    <option key={b.id} value={b.id}>{b.nombre}</option>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] pointer-events-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Ciudad</label>
            <input
              type="text"
              name="ciudad"
              value={formData.ciudad}
              onChange={handleChange}
              className="input"
              autoComplete="address-level2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">
              Notas <span className="text-[color:var(--text-muted)] font-normal">(opcional)</span>
            </label>
            <textarea
              name="notas"
              value={formData.notas}
              onChange={handleChange}
              className="input"
              rows="2"
              placeholder="Ej: Portón rojo, segundo piso"
            />
          </div>

          {/* ============ CONTRASEÑA ============ */}
          <div className="pt-3 border-t border-[color:var(--border-subtle)]">
            <h3 className="text-sm font-bold text-[color:var(--text-primary)] mb-2">Seguridad</h3>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Contraseña</label>
            <input
              type="password"
              name="contrasena"
              value={formData.contrasena}
              onChange={handleChange}
              className="input"
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Confirmar contraseña</label>
            <input
              type="password"
              name="contrasena_confirmacion"
              value={formData.contrasena_confirmacion}
              onChange={handleChange}
              className="input"
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          {/* Aceptaciones legales: el gate real está en <LegalGate /> (App.jsx),
              que se activa con el AuthContext apenas el usuario queda logueado
              y muestra un modal bloqueante con scroll-to-bottom. No se duplica
              acá para evitar dos lugares de aceptación inconsistentes.

              Igual dejamos visibles los links a los 2 documentos para que el
              usuario pueda leerlos ANTES de registrarse (defensa legal: que
              haya tenido oportunidad real de informarse), y un texto chico
              debajo del botón submit avisando que se pedirán las aceptaciones
              apenas termine el registro. Es la cobertura legal del flujo. */}
          <p className="text-xs text-[color:var(--text-muted)] leading-relaxed mt-2">
            Al crear tu cuenta se te pedirán los{' '}
            <Link to="/terminos" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline hover:text-indigo-800">
              Términos y Condiciones
            </Link>{' '}
            y la{' '}
            <Link to="/privacidad" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline hover:text-indigo-800">
              Política de Privacidad
            </Link>
            . Puedes leerlos ahora haciendo click.
          </p>

          <button
            type="submit"
            disabled={loading || sinZonas}
            className="btn btn-primary w-full mt-5 sm:mt-6 py-3.5 text-base disabled:opacity-50"
          >
            {loading ? 'Registrando...' : 'Registrarse'}
          </button>
          <p className="text-[11px] text-[color:var(--text-muted)] text-center mt-3 leading-relaxed">
            Al hacer click en "Registrarse" aceptás que te mostremos nuestros
            documentos legales y los registremos como evidencia (Ley 527/1999,
            Ley 1581/2012).
          </p>
        </form>

        <div className="mt-5 sm:mt-6 text-center text-sm text-[color:var(--text-secondary)]">
          <p>
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}