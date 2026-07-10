/**
 * Unidades de venta predefinidas para fruver/mercado/abarrotes.
 *
 * Cada entrada es una unidad de medida que el comerciante puede ofrecer
 * para un producto. Al aplicar el preset desde `ProductModal.jsx`, se crea
 * automáticamente un grupo "Presentación" (obligatorio, min=1, max=1) con
 * estas unidades como adiciones.
 *
 * `sugerida: true` aparece tildada por defecto cuando se abre el modal del
 * preset (las más comunes para fruver/mercado colombiano).
 *
 * El `id` es estable y se usa como key; el `nombre` es lo que ve el
 * comerciante y el cliente. Se pueden editar después como cualquier
 * adición (el id no se persiste, solo el nombre).
 */
export const UNIDADES_VENTA_PREDETERMINADAS = [
  { id: 'unidad',         nombre: 'Unidad',            sugerida: true  },
  { id: 'libra',          nombre: 'Libra',             sugerida: true  },
  { id: 'kilo',           nombre: 'Kilogramo',         sugerida: true  },
  { id: 'medio_kilo',     nombre: 'Medio kilogramo',   sugerida: false },
  { id: 'cuarto_libra',   nombre: 'Cuarto de libra',   sugerida: false },
  { id: 'gramo_100',      nombre: '100 gramos',        sugerida: false },
  { id: 'litro',          nombre: 'Litro',             sugerida: true  },
  { id: 'medio_litro',    nombre: 'Medio litro',       sugerida: false },
  { id: 'bulto',          nombre: 'Bulto',             sugerida: false },
  { id: 'canasta',        nombre: 'Canasta',           sugerida: false },
  { id: 'docena',         nombre: 'Docena',            sugerida: false },
  { id: 'mano',           nombre: 'Mano',              sugerida: false },
  { id: 'racimo',         nombre: 'Racimo',            sugerida: false },
  { id: 'bandeja',        nombre: 'Bandeja',           sugerida: false },
  { id: 'caja',           nombre: 'Caja',              sugerida: false },
  { id: 'paquete',        nombre: 'Paquete',           sugerida: false },
];

/**
 * Nombre del grupo que crea el preset. El backend lo guarda en
 * `producto_grupos_adiciones.nombre`. Si el admin ya creó un grupo
 * con este nombre, el handler de confirmación pregunta antes de
 * reemplazar.
 */
export const GRUPO_PRESENTACION_NOMBRE = 'Presentación';
