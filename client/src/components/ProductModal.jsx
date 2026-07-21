import React, { useState, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Trash2, Sparkles, ListPlus, Plus, ChefHat, GripVertical, Scale } from 'lucide-react';
import { productService, categoryService, authService } from '../services/api';
import { getImageUrl } from '../utils/imageHelper';
import { getCategoryIcon } from '../utils/categoryIcons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { canAccessPlan } from '../utils/planFeatures';
import UnidadesVentaPreset from './UnidadesVentaPreset';
import { GRUPO_PRESENTACION_NOMBRE } from '../constants/unidadesVenta';

// ========== Fase 10: sub-componentes Sortable (dnd-kit) ==========
// Definidos fuera de ProductModal para no remontarlos en cada render
// (causa flickering en el drag). Cada uno llama useSortable y aplica
// transform/transition al wrapper; el handle se aísla con listeners
// para que los inputs del card sigan siendo clickeables.

/**
 * SortableGrupoCard: renderiza el card completo del grupo (incluye
 * input de nombre, fila de Obligatorio/Mín/Máx, lista de adiciones,
 * botón de borrar) con un handle GripVertical a la izquierda.
 *
 * Props:
 *   - grupo: el grupo de UI ({_uiId, nombre, obligatorio, min_selecciones, max_selecciones, adiciones})
 *   - children: el contenido del card (sin el wrapper)
 *   - onRemove: () => void
 */
function SortableGrupoCard({ grupo, children, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: grupo._uiId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] p-3"
    >
      <div className="flex items-start gap-2">
        {/* Handle aislado: solo el botón recibe los listeners.
            Los inputs del card siguen siendo clickeables. */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1.5 mt-0.5 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] cursor-grab active:cursor-grabbing touch-none"
          aria-label={`Reordenar grupo ${grupo.nombre || 'sin nombre'}`}
          title="Arrastrar para reordenar"
        >
          <GripVertical size={14} />
        </button>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={grupo.nombre}
              onChange={(e) => grupo._onChangeNombre(e.target.value)}
              placeholder='Nombre del grupo (ej. "Salsas")'
              className="flex-1 px-3 py-1.5 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-sm text-[color:var(--text-primary)]"
            />
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 text-[color:var(--danger-text)] hover:bg-[color:var(--bg-muted)] rounded-lg"
              aria-label="Eliminar grupo"
            >
              <Trash2 size={14} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * SortableAdicionRow: input + precio_extra + handle + botón borrar.
 * Mismo principio que SortableGrupoCard.
 */
function SortableAdicionRow({ adicion, onChangeNombre, onChangePrecio, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: adicion._uiId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="p-1 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] cursor-grab active:cursor-grabbing touch-none"
        aria-label={`Reordenar adición ${adicion.nombre || 'sin nombre'}`}
        title="Arrastrar para reordenar"
      >
        <GripVertical size={12} />
      </button>
      <input
        type="text"
        value={adicion.nombre}
        onChange={(e) => onChangeNombre(e.target.value)}
        placeholder='Nombre (ej. "Mayo")'
        className="flex-1 px-2 py-1.5 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-xs text-[color:var(--text-primary)]"
      />
      <input
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        value={adicion.precio_extra}
        onChange={(e) => onChangePrecio(e.target.value)}
        placeholder="Gratis"
        aria-label={`Precio extra de ${adicion.nombre || 'esta adición'}`}
        className="w-24 px-2 py-1.5 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-xs text-[color:var(--text-primary)]"
      />
      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 text-[color:var(--danger-text)] hover:bg-[color:var(--bg-muted)] rounded-lg"
        aria-label="Eliminar adición"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export default function ProductModal({ isOpen, onClose, onSave, product = null, restaurantId, restaurante }) {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    categoria_id: '',
    imagen_url: '',
    disponible: true,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  // Galería de fotos (plan Profesional/Premium)
  const [gallery, setGallery] = useState([]);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  // Modificadores de producto (estilo Rappi/PedidosYa) — sin plan-gating
  const [grupos, setGrupos] = useState([]);
  const [adicionesSueltas, setAdicionesSueltas] = useState([]);
  const [removibles, setRemovibles] = useState([]);
  const [loadingModificadores, setLoadingModificadores] = useState(false);
  const [savingModificadores, setSavingModificadores] = useState(false);
  const [plan, setPlan] = useState('basico');
  // Fase 11: preset de unidades de venta para fruver/mercado
  const [showUnidadesPreset, setShowUnidadesPreset] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await categoryService.getAll();
        const all = res.data.categorias || [];
        // Filtrar categorías por el/los namespace(s) del local. El admin
        // puede combinar flags ("restaurante + comida rápida"), así que el
        // conjunto de namespaces visibles no es único.
        //   - Local mercado: solo categorías de tipo 'mercado' (mercado
        //     sigue siendo nicho excluyente).
        //   - Local panadería (solo): solo categorías 'panaderia_pasteleria'.
        //   - Local combo (es_restaurante=1, es_comida_rapida=1): ambos
        //     namespaces, para que el admin pueda elegir dónde catalogar
        //     cada producto.
        //   - Local combo (es_restaurante=1, es_panaderia_pasteleria=1):
        //     namespaces 'restaurante' + 'panaderia_pasteleria'.
        //   - Local combo (es_comida_rapida=1, es_panaderia_pasteleria=1):
        //     namespaces 'comida_rapida' + 'panaderia_pasteleria'.
        //   - Local combo triple: los tres namespaces.
        //   - Local solo comida rápida: solo categorías 'comida_rapida'.
        //   - Local solo restaurante: solo categorías 'restaurante'.
        // Si el modal se usa sin restaurante (ej. admin sin contexto), no
        // filtramos.
        let tiposVisibles;
        if (!restaurante) {
          tiposVisibles = null; // null = sin filtro
        } else if (restaurante.es_mercado_abarrotes) {
          // Mercado sigue siendo nicho excluyente: aunque tuviera panadería
          // activada por error en la UI, aquí solo mostramos categorías de
          // mercado.
          tiposVisibles = ['mercado'];
        } else if (restaurante.es_restaurante && restaurante.es_comida_rapida && restaurante.es_panaderia_pasteleria) {
          // Combo triple: restaurante + comida rápida + panadería.
          tiposVisibles = ['restaurante', 'comida_rapida', 'panaderia_pasteleria'];
        } else if (restaurante.es_restaurante && restaurante.es_comida_rapida) {
          // Combo restaurante + comida rápida: mostrar ambos catálogos.
          tiposVisibles = ['restaurante', 'comida_rapida'];
        } else if (restaurante.es_restaurante && restaurante.es_panaderia_pasteleria) {
          // Combo restaurante + panadería.
          tiposVisibles = ['restaurante', 'panaderia_pasteleria'];
        } else if (restaurante.es_comida_rapida && restaurante.es_panaderia_pasteleria) {
          // Combo comida rápida + panadería.
          tiposVisibles = ['comida_rapida', 'panaderia_pasteleria'];
        } else if (restaurante.es_panaderia_pasteleria) {
          // Solo panadería.
          tiposVisibles = ['panaderia_pasteleria'];
        } else if (restaurante.es_comida_rapida) {
          tiposVisibles = ['comida_rapida'];
        } else {
          tiposVisibles = ['restaurante'];
        }
        const filtradas = tiposVisibles
          ? all.filter(c => tiposVisibles.includes(c.tipo_negocio || 'restaurante'))
          : all;
        // Orden alfabético A→Z para que el <select> sea fácil de navegar.
        filtradas.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
        setCategories(filtradas);
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    const fetchRestaurantPlan = async () => {
      try {
        const res = await authService.getProfile();
        const p = res.data?.usuario?.restaurante?.plan || 'basico';
        setPlan(p);
      } catch (e) {
        // Sin auth de restaurante (ej. admin creando producto) → basico
        setPlan('basico');
      }
    };
    fetchCategories();
    fetchRestaurantPlan();
  }, [restaurante]);

  useEffect(() => {
    if (product) {
      setFormData({
        nombre: product.nombre || '',
        descripcion: product.descripcion || '',
        precio: product.precio || '',
        categoria_id: product.categoria_id || '',
        imagen_url: product.imagen_url || '',
        disponible: product.disponible === 1 || product.disponible === true,
      });
      setImagePreview(product.imagen_url ? getImageUrl(product.imagen_url) : '');
      loadGallery(product.id);
      loadModificadores(product.id);
    } else {
      setFormData({
        nombre: '',
        descripcion: '',
        precio: '',
        categoria_id: '',
        imagen_url: '',
        disponible: true,
      });
      setImagePreview('');
      setGallery([]);
      setGrupos([]);
      setAdicionesSueltas([]);
      setRemovibles([]);
    }
    setGalleryFiles([]);
    setError('');
  }, [product]);

  const loadGallery = async (productId) => {
    if (!productId) return;
    try {
      const res = await productService.getGallery(productId);
      setGallery(res.data?.imagenes || []);
    } catch (e) {
      setGallery([]);
    }
  };

  // Carga el paquete de modificadores del producto. Se llama cada vez
  // que se abre el modal con un producto existente.
  const loadModificadores = async (productId) => {
    if (!productId) return;
    setLoadingModificadores(true);
    try {
      const res = await productService.getPaqueteModificadores(productId);
      const config = res.data?.configuracion || { grupos: [], adiciones: [], removibles: [] };
      // El backend devuelve todas las adiciones juntas (con y sin grupo).
      // Aquí las partimos: las de grupo_id NULL van a adicionesSueltas, el
      // resto a su grupo correspondiente.
      //
      // Fase 10: leer las 3 columnas nuevas con fallback a defaults
      // (compatibilidad con backend aún sin migración aplicada).
      const gruposAdaptados = (config.grupos || []).map((g) => ({
        _uiId: `g-${g.id}`,
        _serverId: g.id,
        nombre: g.nombre,
        obligatorio: !!g.obligatorio,
        min_selecciones: Number(g.min_selecciones) || 0,
        max_selecciones: Number(g.max_selecciones) || 99,
        adiciones: (config.adiciones || [])
          .filter((a) => a.grupo_id === g.id)
          .map((a) => ({
            _uiId: `a-${a.id}`,
            _serverId: a.id,
            nombre: a.nombre,
            precio_extra: a.precio_extra == null ? '' : a.precio_extra,
          })),
      }));
      const sueltasAdaptadas = (config.adiciones || [])
        .filter((a) => a.grupo_id == null)
        .map((a) => ({
          _uiId: `a-${a.id}`,
          _serverId: a.id,
          nombre: a.nombre,
          precio_extra: a.precio_extra == null ? '' : a.precio_extra,
        }));
      const removiblesAdaptados = (config.removibles || []).map((r) => ({
        _uiId: `r-${r.id}`,
        _serverId: r.id,
        nombre: r.nombre,
      }));
      setGrupos(gruposAdaptados);
      setAdicionesSueltas(sueltasAdaptadas);
      setRemovibles(removiblesAdaptados);
    } catch (e) {
      // Si el endpoint no existe o falla, asumimos que no hay
      // modificadores (compatibilidad con migración aún no corrida).
      setGrupos([]);
      setAdicionesSueltas([]);
      setRemovibles([]);
    } finally {
      setLoadingModificadores(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryChange = (e) => {
    const files = Array.from(e.target.files || []);
    setGalleryFiles(files);
  };

  const uploadImage = async () => {
    if (!imageFile) return '';

    const formDataPayload = new FormData();
    formDataPayload.append('image', imageFile);

    try {
      const response = await productService.uploadImage(formDataPayload);
      return response.data.url;
    } catch (err) {
      throw new Error('Error al subir la imagen');
    }
  };

  const uploadGallery = async (productoId) => {
    if (!galleryFiles.length) return;
    const fd = new FormData();
    fd.append('producto_id', productoId);
    galleryFiles.forEach((f) => fd.append('images', f));
    setGalleryUploading(true);
    try {
      await productService.uploadGallery(productoId, fd);
      setGalleryFiles([]);
      await loadGallery(productoId);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al subir la galería');
    } finally {
      setGalleryUploading(false);
    }
  };

  const deleteGalleryImage = async (imagenId) => {
    if (!product?.id) return;
    if (!window.confirm('¿Eliminar esta imagen de la galería?')) return;
    try {
      await productService.deleteGalleryImage(product.id, imagenId);
      await loadGallery(product.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar la imagen');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      let finalImageUrl = formData.imagen_url;
      if (imageFile) {
        setUploading(true);
        finalImageUrl = await uploadImage();
        setUploading(false);
      }

      const dataToSave = {
        ...formData,
        // El <select> devuelve '' cuando el usuario no eligió categoría.
        // La columna categoria_id en DB es INT, no acepta string vacío.
        // Mapeamos a null para que el server guarde "sin categoría" en vez de crashear.
        categoria_id: formData.categoria_id === '' ? null : formData.categoria_id,
        precio: parseFloat(formData.precio),
        imagen_url: finalImageUrl,
        disponible: formData.disponible,
      };

      let productoId = product?.id;
      if (productoId) {
        await productService.update(productoId, dataToSave);
      } else {
        const res = await productService.create(dataToSave);
        productoId = res.data?.producto_id;
      }

      // Si hay archivos pendientes en la galería, subirlos tras guardar
      if (galleryFiles.length > 0 && productoId) {
        await uploadGallery(productoId);
      }

      // Guardar el paquete de modificadores (todos los planes pueden).
      // Es un PUT que reemplaza el paquete entero.
      if (productoId) {
        await saveModificadores(productoId);
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el producto');
    } finally {
      setSaving(false);
    }
  };

  // Construye el payload del paquete y lo manda al backend.
  // No falla el guardado del producto si esta parte falla: se loguea
  // y se sigue. (La sección de modificadores es un extra.)
  //
  // Fase 10: incluye obligatorio/min/max y valida client-side antes
  // de mandar. Si el admin configura algo inválido, el PUT tira 400
  // (el backend valida de nuevo como defensa de profundidad).
  const saveModificadores = async (productoId) => {
    setSavingModificadores(true);
    try {
      // Validar antes de armar el payload. Si hay un error, el PUT ni
      // se intenta. El producto ya quedó guardado (el catch de más
      // abajo no aplica).
      for (const g of grupos) {
        if (!g.nombre || !g.nombre.trim()) continue;
        const obligatorio = g.obligatorio === true;
        const minSel = Math.max(0, Math.floor(Number(g.min_selecciones) || 0));
        const maxSelRaw = Math.floor(Number(g.max_selecciones) || 99);
        if (obligatorio && minSel < 1) {
          throw new Error(`Grupo "${g.nombre}": si es obligatorio, el mínimo debe ser 1 o más`);
        }
        if (maxSelRaw < minSel) {
          throw new Error(`Grupo "${g.nombre}": el máximo (${maxSelRaw}) no puede ser menor que el mínimo (${minSel})`);
        }
      }
      const payload = {
        grupos: grupos
          .filter((g) => g.nombre && g.nombre.trim())
          .map((g) => ({
            nombre: g.nombre.trim(),
            obligatorio: g.obligatorio === true,
            min_selecciones: Math.max(0, Math.floor(Number(g.min_selecciones) || 0)),
            max_selecciones: Math.max(1, Math.floor(Number(g.max_selecciones) || 99)),
            adiciones: (g.adiciones || [])
              .filter((a) => a.nombre && a.nombre.trim())
              .map((a) => ({
                nombre: a.nombre.trim(),
                precio_extra:
                  a.precio_extra === '' || a.precio_extra == null
                    ? null
                    : Number(a.precio_extra),
              })),
          })),
        adiciones_sueltas: adicionesSueltas
          .filter((a) => a.nombre && a.nombre.trim())
          .map((a) => ({
            nombre: a.nombre.trim(),
            precio_extra:
              a.precio_extra === '' || a.precio_extra == null
                ? null
                : Number(a.precio_extra),
          })),
        removibles: removibles
          .filter((r) => r.nombre && r.nombre.trim())
          .map((r) => ({ nombre: r.nombre.trim() })),
      };
      await productService.replacePaqueteModificadores(productoId, payload);
    } catch (err) {
      console.error('Error guardando modificadores:', err);
      // No bloqueamos el cierre del modal: el producto ya quedó
      // guardado, los modificadores pueden reintentarse.
      setError(
        (prev) => prev || 'Producto guardado, pero falló al guardar los modificadores: ' +
        (err.response?.data?.error || err.message)
      );
    } finally {
      setSavingModificadores(false);
    }
  };

  // Helpers para manipular los arrays de modificadores
  const addGrupo = () => {
    // Fase 10: defaults coinciden con la migración (false / 0 / 99),
    // así un grupo nuevo arranca como "opcional libre" (comportamiento
    // pre-existente) y el admin decide si lo quiere obligatorio.
    setGrupos((prev) => [
      ...prev,
      {
        _uiId: `g-new-${Date.now()}`,
        nombre: '',
        obligatorio: false,
        min_selecciones: 0,
        max_selecciones: 99,
        adiciones: [],
      },
    ]);
  };

  // Fase 11: aplica el preset de unidades de venta al estado de grupos.
  // Si ya existe un grupo "Presentación" (case-insensitive), agrega las
  // unidades elegidas a las existentes (no las reemplaza, para no perder
  // trabajo del admin).
  const aplicarUnidadesVenta = ({ unidades }) => {
    if (!unidades || unidades.length === 0) return;
    const now = Date.now();
    const nuevasAdiciones = unidades.map((u, i) => ({
      _uiId: `a-preset-${now}-${i}`,
      nombre: u.nombre,
      precio_extra: u.precio_extra,
    }));
    setGrupos((prev) => {
      const idxExistente = prev.findIndex(
        (g) => (g.nombre || '').trim().toLowerCase() === GRUPO_PRESENTACION_NOMBRE.toLowerCase()
      );
      if (idxExistente >= 0) {
        // Append al grupo existente (no reemplaza las que el admin haya puesto a mano).
        return prev.map((g, i) =>
          i === idxExistente
            ? { ...g, adiciones: [...g.adiciones, ...nuevasAdiciones] }
            : g
        );
      }
      // Crear grupo nuevo obligatorio, elige 1.
      return [
        ...prev,
        {
          _uiId: `g-preset-${now}`,
          nombre: GRUPO_PRESENTACION_NOMBRE,
          obligatorio: true,
          min_selecciones: 1,
          max_selecciones: 1,
          adiciones: nuevasAdiciones,
        },
      ];
    });
    setShowUnidadesPreset(false);
  };
  const grupoPresentacionExiste = grupos.some(
    (g) => (g.nombre || '').trim().toLowerCase() === GRUPO_PRESENTACION_NOMBRE.toLowerCase()
  );
  const updateGrupo = (uiId, patch) => {
    setGrupos((prev) => prev.map((g) => (g._uiId === uiId ? { ...g, ...patch } : g)));
  };
  const removeGrupo = (uiId) => {
    setGrupos((prev) => prev.filter((g) => g._uiId !== uiId));
  };
  const addAdicionToGrupo = (grupoUiId) => {
    setGrupos((prev) =>
      prev.map((g) =>
        g._uiId === grupoUiId
          ? { ...g, adiciones: [...g.adiciones, { _uiId: `a-new-${Date.now()}`, nombre: '', precio_extra: '' }] }
          : g
      )
    );
  };
  const updateAdicionInGrupo = (grupoUiId, adicionUiId, patch) => {
    setGrupos((prev) =>
      prev.map((g) =>
        g._uiId === grupoUiId
          ? {
              ...g,
              adiciones: g.adiciones.map((a) =>
                a._uiId === adicionUiId ? { ...a, ...patch } : a
              ),
            }
          : g
      )
    );
  };
  const removeAdicionFromGrupo = (grupoUiId, adicionUiId) => {
    setGrupos((prev) =>
      prev.map((g) =>
        g._uiId === grupoUiId
          ? { ...g, adiciones: g.adiciones.filter((a) => a._uiId !== adicionUiId) }
          : g
      )
    );
  };
  const addAdicionSuelta = () => {
    setAdicionesSueltas((prev) => [
      ...prev,
      { _uiId: `a-new-${Date.now()}`, nombre: '', precio_extra: '' },
    ]);
  };
  const updateAdicionSuelta = (uiId, patch) => {
    setAdicionesSueltas((prev) => prev.map((a) => (a._uiId === uiId ? { ...a, ...patch } : a)));
  };
  const removeAdicionSuelta = (uiId) => {
    setAdicionesSueltas((prev) => prev.filter((a) => a._uiId !== uiId));
  };
  const addRemovible = () => {
    setRemovibles((prev) => [
      ...prev,
      { _uiId: `r-new-${Date.now()}`, nombre: '' },
    ]);
  };
  const updateRemovible = (uiId, patch) => {
    setRemovibles((prev) => prev.map((r) => (r._uiId === uiId ? { ...r, ...patch } : r)));
  };
  const removeRemovible = (uiId) => {
    setRemovibles((prev) => prev.filter((r) => r._uiId !== uiId));
  };

  // ===== Fase 10: drag & drop con @dnd-kit/sortable =====
  // Reordena grupos y adiciones dentro de cada grupo. Persistencia
  // automática: el backend usa el índice del for como `orden`, así que
  // alcanza con reordenar el array de UI antes del PUT.
  //
  // Sensor config: PointerSensor (mouse/touch) + KeyboardSensor (a11y:
  // Space/Enter para agarrar, flechas para mover, Space/Enter para
  // soltar, Esc para cancelar). Restricción: 8px de movimiento antes
  // de iniciar el drag, para no romper clicks en los inputs del card.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEndGrupos = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setGrupos((prev) => {
      const oldIdx = prev.findIndex((g) => g._uiId === active.id);
      const newIdx = prev.findIndex((g) => g._uiId === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const handleDragEndAdicionesGrupo = (grupoUiId) => (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setGrupos((prev) =>
      prev.map((g) => {
        if (g._uiId !== grupoUiId) return g;
        const oldIdx = g.adiciones.findIndex((a) => a._uiId === active.id);
        const newIdx = g.adiciones.findIndex((a) => a._uiId === over.id);
        if (oldIdx === -1 || newIdx === -1) return g;
        return { ...g, adiciones: arrayMove(g.adiciones, oldIdx, newIdx) };
      })
    );
  };

  // Plan con feature `multiples_fotos` habilitada (Profesional, Premium, Golden Plus).
  const allowGallery = canAccessPlan(plan, 'multiples_fotos');
  const galleryLimit = allowGallery ? 5 : 1;
  const gallerySlotsRemaining = Math.max(0, galleryLimit - gallery.length - galleryFiles.length);

  if (!isOpen) return null;

  // Cerrar al hacer click en el backdrop (no en el modal en sí)
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-[color:var(--bg-elevated)] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[color:var(--border-subtle)] flex-shrink-0">
          <h2 className="text-xl font-bold text-[color:var(--text-primary)]">
            {product ? 'Editar Producto' : 'Nuevo Producto'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[color:var(--bg-muted)] rounded-full transition-colors">
            <X size={20} className="text-[color:var(--text-muted)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5">
            {/* Imagen Upload */}
            <div className="flex flex-col items-center gap-3">
              <div
                className="relative w-32 h-32 rounded-2xl border-2 border-dashed border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] flex items-center justify-center overflow-hidden group"
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Upload size={20} className="text-white" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                  </>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-[color:var(--bg-muted)] transition-colors">
                    <ImageIcon size={32} className="text-[color:var(--text-subtle)] mb-2" />
                    <span className="text-xs text-[color:var(--text-muted)]">Sube una foto</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                )}
              </div>
              {imageFile && (
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(formData.imagen_url ? getImageUrl(formData.imagen_url) : ''); }}
                  className="text-xs hover:underline flex items-center gap-1"
                  style={{ color: 'var(--danger-text)' }}
                >
                  <Trash2 size={12} /> Eliminar imagen
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Nombre del producto</label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-primary outline-none transition-all"
                  placeholder="Ej. Hamburguesa Especial"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Precio ($)</label>
                  <input
                    type="number"
                    name="precio"
                    value={formData.precio}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="0.00"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    required
                />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Categoría</label>
                  <select
                    name="categoria_id"
                    value={formData.categoria_id}
                    onChange={handleInputChange}
                    className="select"
                  >
                    <option value="">Seleccione una categoría</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                  {formData.categoria_id && (() => {
                    const cat = categories.find(c => String(c.id) === String(formData.categoria_id));
                    if (!cat) return null;
                    const Icon = getCategoryIcon(cat.nombre);
                    return (
                      <div className="flex items-center gap-2 mt-1.5 px-2 py-1 rounded-lg bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)]">
                        <Icon size={14} className="text-primary flex-shrink-0" />
                        <span className="text-xs text-[color:var(--text-secondary)]">{cat.nombre}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[color:var(--text-secondary)] mb-1">Descripción</label>
                <textarea
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-4 py-2 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-base)] text-[color:var(--text-primary)] focus:ring-2 focus:ring-primary outline-none transition-all"
                  placeholder="Describe los ingredientes o detalles..."
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)]">
                <input
                  type="checkbox"
                  name="disponible"
                  checked={formData.disponible}
                  onChange={(e) => setFormData(prev => ({ ...prev, disponible: e.target.checked }))}
                  className="w-4 h-4 text-primary rounded focus:ring-primary"
                />
                <span className="text-sm font-medium text-[color:var(--text-secondary)]">Producto disponible para la venta</span>
              </div>
            </div>

            {/* Galería (plan Profesional/Premium) */}
            <div className="border-t border-[color:var(--border-subtle)] pt-4">
              {allowGallery ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[color:var(--text-primary)] flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-500" />
                      Galería de fotos
                    </p>
                    <span className="text-xs text-[color:var(--text-muted)]">
                      {gallery.length} / {galleryLimit}
                    </span>
                  </div>

                  {gallery.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {gallery.map((img) => (
                        <div key={img.id} className="relative group rounded-lg overflow-hidden aspect-square">
                          <img src={getImageUrl(img.imagen_url)} alt="galería" className="w-full h-full object-cover" />
                          {product?.id && (
                            <button
                              type="button"
                              onClick={() => deleteGalleryImage(img.id)}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {gallerySlotsRemaining > 0 && (
                    <div>
                      <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-[color:var(--border-default)] rounded-lg cursor-pointer hover:bg-[color:var(--bg-subtle)] transition-colors">
                        <Upload size={20} className="text-[color:var(--text-subtle)] mb-1" />
                        <span className="text-xs text-[color:var(--text-muted)]">
                          Subir hasta {gallerySlotsRemaining} imagen(es) más
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          multiple
                          aria-label="Subir imágenes a la galería"
                          onChange={handleGalleryChange}
                        />
                      </label>
                      {galleryFiles.length > 0 && (
                        <p className="text-xs text-primary mt-1">
                          {galleryFiles.length} archivo(s) listo(s) — se subirán al guardar el producto
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-[color:var(--bg-subtle)] border border-[color:var(--border-default)] text-xs text-[color:var(--text-muted)] flex items-start gap-2">
                  <Sparkles size={14} className="text-[color:var(--text-subtle)] flex-shrink-0 mt-0.5" />
                  <span>La galería de fotos está disponible en los planes Profesional y Premium.</span>
                </div>
              )}
            </div>

            {/* Modificadores (estilo Rappi/PedidosYa) — sin plan-gating.
                El cliente va a ver un modal de selección si este
                producto tiene adiciones o removibles configurados. */}
            <div className="border-t border-[color:var(--border-subtle)] pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-[color:var(--text-primary)] flex items-center gap-2">
                    <ListPlus size={16} className="text-primary" />
                    Adiciones y modificadores
                  </p>
                  <span className="text-xs text-[color:var(--text-muted)]">
                    {loadingModificadores ? 'Cargando…' : 'Todos los planes'}
                  </span>
                </div>
                <p className="text-xs text-[color:var(--text-muted)]">
                  Configura qué puede añadir o quitar el cliente al pedir este producto. Si no agregas nada, el producto se sigue pidiendo como siempre.
                </p>

                {/* Grupos de adiciones — Fase 10: drag & drop con dnd-kit */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[color:var(--text-secondary)] uppercase tracking-wide">
                    Grupos de adiciones (opcional)
                  </p>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEndGrupos}
                  >
                    <SortableContext
                      items={grupos.map((g) => g._uiId)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {grupos.map((g) => {
                          // Fase 10: derivar maxSel para validación visual.
                          const minSel = Math.max(0, Math.floor(Number(g.min_selecciones) || 0));
                          const maxSel = Math.floor(Number(g.max_selecciones) || 99);
                          const maxInvalido = maxSel < minSel;
                          return (
                            <SortableGrupoCard
                              key={g._uiId}
                              grupo={{
                                ...g,
                                _onChangeNombre: (nombre) => updateGrupo(g._uiId, { nombre }),
                              }}
                              onRemove={() => removeGrupo(g._uiId)}
                            >
                              {/* Fila de Obligatorio + Mín/Máx */}
                              <div className="flex flex-wrap items-center gap-3 pl-1 text-xs">
                                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={!!g.obligatorio}
                                    onChange={(e) => {
                                      const marcado = e.target.checked;
                                      updateGrupo(g._uiId, {
                                        obligatorio: marcado,
                                        // Si lo activan y min es 0, auto-corrigir a 1
                                        min_selecciones: marcado ? Math.max(1, minSel) : minSel,
                                      });
                                    }}
                                    className="w-3.5 h-3.5 accent-[color:var(--primary,#3b82f6)]"
                                    aria-label={`Grupo ${g.nombre || 'sin nombre'} obligatorio`}
                                  />
                                  <span className="font-semibold text-[color:var(--text-primary)]">Obligatorio</span>
                                </label>
                                <div className="inline-flex items-center gap-1.5">
                                  <label className="text-[color:var(--text-muted)]" htmlFor={`min-${g._uiId}`}>Mín</label>
                                  <input
                                    id={`min-${g._uiId}`}
                                    type="number"
                                    min="0"
                                    max="99"
                                    step="1"
                                    value={g.min_selecciones ?? 0}
                                    onChange={(e) => updateGrupo(g._uiId, { min_selecciones: e.target.value })}
                                    disabled={!!g.obligatorio}
                                    className="w-14 px-2 py-1 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-xs text-[color:var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label={`Mínimo de selecciones de ${g.nombre || 'este grupo'}`}
                                  />
                                </div>
                                <div className="inline-flex items-center gap-1.5">
                                  <label className="text-[color:var(--text-muted)]" htmlFor={`max-${g._uiId}`}>Máx</label>
                                  <input
                                    id={`max-${g._uiId}`}
                                    type="number"
                                    min="1"
                                    max="99"
                                    step="1"
                                    value={g.max_selecciones ?? 99}
                                    onChange={(e) => updateGrupo(g._uiId, { max_selecciones: e.target.value })}
                                    className={`w-14 px-2 py-1 rounded-lg border bg-[color:var(--bg-elevated)] text-xs text-[color:var(--text-primary)] ${
                                      maxInvalido ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-[color:var(--border-default)]'
                                    }`}
                                    aria-label={`Máximo de selecciones de ${g.nombre || 'este grupo'}`}
                                  />
                                </div>
                                {maxInvalido && (
                                  <span className="text-[10px] text-rose-500 font-medium">
                                    Máx &lt; Mín
                                  </span>
                                )}
                              </div>
                              {/* Adiciones del grupo con su propio DnD */}
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEndAdicionesGrupo(g._uiId)}
                              >
                                <SortableContext
                                  items={g.adiciones.map((a) => a._uiId)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <div className="space-y-1.5 pl-2">
                                    {g.adiciones.map((a) => (
                                      <SortableAdicionRow
                                        key={a._uiId}
                                        adicion={a}
                                        onChangeNombre={(nombre) => updateAdicionInGrupo(g._uiId, a._uiId, { nombre })}
                                        onChangePrecio={(precio_extra) => updateAdicionInGrupo(g._uiId, a._uiId, { precio_extra })}
                                        onRemove={() => removeAdicionFromGrupo(g._uiId, a._uiId)}
                                      />
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => addAdicionToGrupo(g._uiId)}
                                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                      <Plus size={12} /> Adición
                                    </button>
                                  </div>
                                </SortableContext>
                              </DndContext>
                            </SortableGrupoCard>
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                  <button
                    type="button"
                    onClick={addGrupo}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus size={12} /> Grupo de adiciones
                  </button>
                  {/* Fase 11: preset de unidades de venta (fruver/mercado/abarrotes).
                      Crea automáticamente un grupo "Presentación" obligatorio con
                      las unidades que el admin elija. Reutiliza Fase 10. */}
                  <button
                    type="button"
                    onClick={() => setShowUnidadesPreset(true)}
                    className="flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                  >
                    <Scale size={12} /> Unidades de venta (fruver/mercado)
                    {grupoPresentacionExiste && (
                      <span className="text-[10px] text-[color:var(--text-muted)] ml-1">
                        · editar existentes
                      </span>
                    )}
                  </button>
                </div>

                {/* Adiciones sueltas */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[color:var(--text-secondary)] uppercase tracking-wide">
                    Adiciones sueltas (sin grupo)
                  </p>
                  {adicionesSueltas.map((a) => (
                    <div key={a._uiId} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={a.nombre}
                        onChange={(e) => updateAdicionSuelta(a._uiId, { nombre: e.target.value })}
                        placeholder='Nombre (ej. "Con limón")'
                        className="flex-1 px-3 py-1.5 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] text-sm text-[color:var(--text-primary)]"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={a.precio_extra}
                        onChange={(e) => updateAdicionSuelta(a._uiId, { precio_extra: e.target.value })}
                        placeholder="Gratis"
                        aria-label={`Precio extra de ${a.nombre || 'esta adición'}`}
                        className="w-24 px-3 py-1.5 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] text-sm text-[color:var(--text-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => removeAdicionSuelta(a._uiId)}
                        className="p-1.5 text-[color:var(--danger-text)] hover:bg-[color:var(--bg-muted)] rounded-lg"
                        aria-label="Eliminar adición"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addAdicionSuelta}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus size={12} /> Adición suelta
                  </button>
                </div>

                {/* Removibles */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[color:var(--text-secondary)] uppercase tracking-wide flex items-center gap-1">
                    <ChefHat size={12} /> Ingredientes removibles
                  </p>
                  <p className="text-[11px] text-[color:var(--text-muted)]">
                    Cosas que vienen por defecto y el cliente puede quitar (ej. "Cebolla", "Tomate").
                  </p>
                  {removibles.map((r) => (
                    <div key={r._uiId} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={r.nombre}
                        onChange={(e) => updateRemovible(r._uiId, { nombre: e.target.value })}
                        placeholder='Nombre (ej. "Cebolla")'
                        className="flex-1 px-3 py-1.5 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] text-sm text-[color:var(--text-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => removeRemovible(r._uiId)}
                        className="p-1.5 text-[color:var(--danger-text)] hover:bg-[color:var(--bg-muted)] rounded-lg"
                        aria-label="Eliminar ingrediente"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addRemovible}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus size={12} /> Ingrediente removible
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || uploading || galleryUploading || savingModificadores}
              className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primaryDark transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving || uploading || galleryUploading || savingModificadores ? 'Guardando...' : product ? 'Actualizar' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </div>
      {/* Fase 11: modal del preset de unidades de venta (fuera del form para
          evitar submits accidentales). Se monta solo si el admin lo abrió. */}
      <UnidadesVentaPreset
        isOpen={showUnidadesPreset}
        onClose={() => setShowUnidadesPreset(false)}
        onConfirm={aplicarUnidadesVenta}
        grupoYaExiste={grupoPresentacionExiste}
      />
    </div>
  );
}
