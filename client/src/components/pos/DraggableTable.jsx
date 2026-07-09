/**
 * Mesa arrastrable y redimensionable del plano del POS.
 *
 * Se renderiza DENTRO de un canvas absoluto (con `position: relative`).
 * Usa `react-rnd` para drag + resize, y un grid opcional de fondo para
 * alinear visualmente las mesas.
 *
 * Props:
 *  - mesa: { id, nombre, capacidad, pos_x, pos_y, ancho, alto, forma, estado }
 *  - editable: si true, permite drag/resize y dispara onChange al soltar
 *  - selected: si true, muestra borde destacado
 *  - onChange({id, pos_x, pos_y, ancho, alto}): callback al terminar drag/resize
 *  - onClick(mesa): click simple
 *  - onStatusChange(mesa, nextEstado): ciclo libre → reservada → mantenimiento → libre
 *
 * Estilos: usa las CSS vars ya definidas en el resto del dashboard
 * (--bg-elevated, --border, --text, --text-muted). El color de relleno por
 * estado se mantiene acá para que sea fácil de tunear.
 */
import { Rnd } from 'react-rnd';
import { Armchair } from 'lucide-react';

// Paleta de colores por estado. Mantener sincronizado con la leyenda en
// FloorPlanPage y con el backend (`mesas.estado`).
const ESTADO_COLORS = {
  libre:         { bg: 'bg-emerald-500/15', border: 'border-emerald-500/60', text: 'text-emerald-300' },
  ocupada:       { bg: 'bg-rose-500/15',    border: 'border-rose-500/60',    text: 'text-rose-300'    },
  reservada:     { bg: 'bg-amber-500/15',   border: 'border-amber-500/60',   text: 'text-amber-300'   },
  mantenimiento: { bg: 'bg-zinc-500/15',    border: 'border-zinc-500/60',    text: 'text-zinc-300'    },
};

const SHAPE_CLASS = {
  rectangle: 'rounded-lg',
  circle:    'rounded-full',
  round:     'rounded-full',
};

export default function DraggableTable({
  mesa,
  editable = false,
  selected = false,
  onChange,
  onClick,
  onStatusChange,
}) {
  const colors = ESTADO_COLORS[mesa.estado] ?? ESTADO_COLORS.libre;
  const shape = SHAPE_CLASS[mesa.forma] ?? 'rounded-lg';

  // Para círculos/redondos, forzamos ancho === alto al cambiar tamaño.
  const isCircular = mesa.forma === 'circle' || mesa.forma === 'round';
  const onResizeStop = (_e, _dir, ref) => {
    if (isCircular) {
      const size = Math.max(parseInt(ref.style.width, 10), parseInt(ref.style.height, 10));
      onChange?.({
        pos_x: mesa.pos_x,
        pos_y: mesa.pos_y,
        ancho: size,
        alto: size,
      });
    } else {
      onChange?.({
        pos_x: mesa.pos_x,
        pos_y: mesa.pos_y,
        ancho: parseInt(ref.style.width, 10),
        alto: parseInt(ref.style.height, 10),
      });
    }
  };

  // react-rnd aplica posición como `transform: translate`, no como left/top.
  // El backend guarda pos_x/pos_y en pixeles absolutos — los convertimos
  // en props `x`/`y` que Rnd entiende.
  return (
    <Rnd
      size={{ width: mesa.ancho, height: mesa.alto }}
      position={{ x: mesa.pos_x, y: mesa.pos_y }}
      minWidth={60}
      minHeight={60}
      maxWidth={300}
      maxHeight={300}
      bounds="parent"
      disableDragging={!editable}
      enableResizing={editable}
      onDragStop={(_e, d) => onChange?.({
        pos_x: d.x,
        pos_y: d.y,
        ancho: mesa.ancho,
        alto: mesa.alto,
      })}
      onResizeStop={onResizeStop}
      className={[
        colors.bg,
        colors.border,
        shape,
        'border-2 flex flex-col items-center justify-center select-none cursor-pointer transition-shadow',
        selected ? 'ring-2 ring-offset-2 ring-offset-[color:var(--bg)] ring-[color:var(--primary,#3b82f6)] shadow-lg' : '',
        editable ? 'hover:shadow-md' : '',
      ].join(' ')}
      onClick={() => onClick?.(mesa)}
      // Doble click cicla el estado. Útil para dueños que están solos y no
      // quieren abrir un menú dropdown para cambiar de `libre` a `reservada`.
      onDoubleClick={editable ? () => {
        const cycle = { libre: 'reservada', reservada: 'mantenimiento', mantenimiento: 'libre', ocupada: 'libre' };
        onStatusChange?.(mesa, cycle[mesa.estado] ?? 'libre');
      } : undefined}
    >
      <Armchair className={`w-5 h-5 ${colors.text}`} aria-hidden="true" />
      <div className={`text-sm font-semibold ${colors.text}`}>{mesa.nombre}</div>
      <div className="text-[10px] text-[color:var(--text-muted)] flex items-center gap-1">
        <span>👤</span><span>{mesa.capacidad}</span>
      </div>
    </Rnd>
  );
}
