import { Sun, UtensilsCrossed, Plus, Clock, CalendarDays } from 'lucide-react';
import { getImageUrl, IMAGE_DEFAULT_ATTRS } from '../utils/imageHelper';
import { formatCurrency } from '../utils/formatHelper';

// Metadatos visuales por tipo de comida.
const MEAL_META = {
  desayuno: { label: 'Desayuno del día', Icon: Sun, emoji: '🍳' },
  almuerzo: { label: 'Almuerzo del día', Icon: UtensilsCrossed, emoji: '🍲' },
};

// ¿La hora actual cae dentro de la franja? El día ya lo resolvió el backend
// en zona horaria Bogotá; aquí solo damos un indicador suave de "ahora" con
// la hora local del navegador (los clientes están en Colombia).
function withinWindow(horario) {
  if (!horario?.desde || !horario?.hasta) return true; // sin franja = siempre
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return hhmm >= horario.desde && hhmm <= horario.hasta;
}

function ComboCard({ tipo, combo, horario, restauranteId, onAdd, isOpen }) {
  const meta = MEAL_META[tipo];
  const Icon = meta.Icon;
  const disponibleAhora = withinWindow(horario);
  const tieneFranja = horario?.desde && horario?.hasta;

  // El combo es un producto real: lo mapeamos al shape que espera addToCart /
  // el flujo de customización de la página del restaurante.
  const productoObj = {
    id: combo.producto_id,
    restaurante_id: restauranteId,
    nombre: combo.nombre,
    descripcion: combo.descripcion,
    precio: combo.precio,
    imagen_url: combo.imagen_url,
    tiene_modificadores: combo.tiene_modificadores,
  };

  return (
    <div className="relative flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-[color:var(--bg-elevated)] border border-[color:var(--border-subtle)] shadow-sm">
      {/* Imagen */}
      <div className="relative w-full sm:w-32 h-40 sm:h-32 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-warm">
        {combo.imagen_url ? (
          <img
            src={getImageUrl(combo.imagen_url)}
            alt={combo.nombre}
            className="w-full h-full object-cover"
            {...IMAGE_DEFAULT_ATTRS}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">{meta.emoji}</div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary mb-1">
          <Icon size={14} />
          {meta.label}
        </div>
        <h4 className="text-lg font-heading font-bold text-[color:var(--text-primary)] leading-tight">
          {combo.nombre}
        </h4>
        {combo.descripcion && (
          <p className="text-sm text-[color:var(--text-secondary)] mt-1 leading-relaxed line-clamp-3">
            {combo.descripcion}
          </p>
        )}

        {/* Franja horaria */}
        {tieneFranja && (
          <div className={`inline-flex items-center gap-1 text-xs mt-2 ${disponibleAhora ? 'text-emerald-600' : 'text-[color:var(--text-muted)]'}`}>
            <Clock size={12} />
            {disponibleAhora ? 'Disponible ahora' : `Disponible de ${horario.desde} a ${horario.hasta}`}
          </div>
        )}

        {/* Precio + agregar */}
        <div className="flex items-center justify-between gap-3 mt-3 pt-2">
          <span className="text-xl font-bold text-primary tabular-nums">
            {formatCurrency(combo.precio)}
          </span>
          <button
            type="button"
            disabled={!isOpen}
            onClick={() => onAdd(productoObj)}
            className="btn btn-primary btn-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!isOpen ? 'El local está cerrado' : 'Agregar al carrito'}
          >
            <Plus size={16} />
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Sección "Menú de hoy" (corrientazo) en la página del restaurante.
 * Muestra el desayuno y/o almuerzo del día resueltos por el backend.
 * No renderiza nada si el local no tiene menú del día para hoy.
 */
export default function MenuDeHoy({ menu, restauranteId, onAdd, isOpen }) {
  if (!menu) return null;
  const { desayuno, almuerzo, horarios } = menu;
  if (!desayuno && !almuerzo) return null;

  return (
    <section className="mb-8">
      <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-primaryLight/40 to-accent/20 border border-primary/20">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0">
            <CalendarDays size={18} />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-heading font-bold text-[color:var(--text-primary)] leading-tight">
              Menú de hoy
            </h3>
            <p className="text-xs text-[color:var(--text-secondary)]">Corrientazo del día · cambia cada día</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {desayuno && (
            <ComboCard
              tipo="desayuno"
              combo={desayuno}
              horario={horarios?.desayuno}
              restauranteId={restauranteId}
              onAdd={onAdd}
              isOpen={isOpen}
            />
          )}
          {almuerzo && (
            <ComboCard
              tipo="almuerzo"
              combo={almuerzo}
              horario={horarios?.almuerzo}
              restauranteId={restauranteId}
              onAdd={onAdd}
              isOpen={isOpen}
            />
          )}
        </div>
      </div>
    </section>
  );
}
