import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, ShoppingCart, AlertCircle, Search, Image as ImageIcon, Receipt } from 'lucide-react';
import { formatCurrency } from '../../utils/formatHelper';
import chatService from '../../services/chat.js';
import { productService, paymentService } from '../../services/api.js';

/**
 * Modal de "Armar pedido" desde el chat.
 *
 * Aparece cuando el vendedor hace click en "Armar pedido" en
 * ChatAdminPage. Muestra los items sugeridos (los `adjuntos_json` que
 * el cliente clickeó en el catálogo), permite editar/agregar/quitar
 * items, completar modalidad/envío/pago, y al confirmar llama a
 * `POST /api/chat/admin/conversaciones/:id/draft-pedido`.
 *
 * El backend hace el resto: inserta el pedido con origen='web_asistido',
 * marca la conversación como 'convertida', emite el mensaje de sistema
 * "Pedido #N creado", y dispara la notificación al restaurante.
 */
export default function ArmarPedidoModal({ conversacion, onClose, onCreated }) {
  const [items, setItems] = useState([]); // [{producto_id, cantidad, precio_unitario, nombre}]
  const [metodoPago, setMetodoPago] = useState('contra_entrega');
  const [esRetiroLocal, setEsRetiroLocal] = useState(true);
  const [direccionEntrega, setDireccionEntrega] = useState('');
  const [telefonoContacto, setTelefonoContacto] = useState(conversacion.cliente_telefono || '');
  const [notas, setNotas] = useState('');
  const [costoEnvio, setCostoEnvio] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Comprobante opcional de pago digital (Nequi / Daviplata / Bre-B).
  // Si el cliente mandó la captura por WhatsApp, el local puede adjuntarla
  // acá mismo. Se sube DESPUÉS de crear el pedido, con un endpoint
  // dedicado del staff (`paymentService.uploadProofAsStaff`).
  const [comprobanteFile, setComprobanteFile] = useState(null);
  const [comprobantePreview, setComprobantePreview] = useState(null);
  const [comprobanteError, setComprobanteError] = useState(null);

  // Picker del catálogo (para agregar productos que el cliente no clickeó)
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [catalogo, setCatalogo] = useState([]);
  const [catalogoLoading, setCatalogoLoading] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  // Cargar items sugeridos desde el backend (los adjuntos de los mensajes)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await chatService.adminBuildDraft(conversacion.id);
        if (cancelled) return;
        setItems((data.items_sugeridos || []).map((it) => ({
          producto_id: it.producto_id,
          cantidad: it.cantidad,
          precio_unitario: Number(it.precio_unitario) || 0,
          nombre: it.nombre || `Producto #${it.producto_id}`,
        })));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [conversacion.id]);

  const total = useMemo(() => {
    const sub = items.reduce((acc, it) => acc + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0), 0);
    return sub + (esRetiroLocal ? 0 : Number(costoEnvio) || 0);
  }, [items, esRetiroLocal, costoEnvio]);

  const itemValido = (it) => it.producto_id && Number(it.cantidad) > 0 && Number(it.precio_unitario) >= 0;
  const puedeConfirmar = items.length > 0 && items.every(itemValido) && !submitting;

  const cambiarCantidad = (idx, delta) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, cantidad: Math.max(1, Number(it.cantidad) + delta) } : it));
  };
  const cambiarPrecio = (idx, precio) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, precio_unitario: Number(precio) || 0 } : it));
  };
  const eliminarItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Abre el picker y carga el catálogo del local una sola vez (lazy).
  const abrirPicker = async () => {
    setPickerAbierto((v) => !v);
    if (catalogo.length > 0 || catalogoLoading) return;
    setCatalogoLoading(true);
    try {
      const res = await productService.getByRestaurant(conversacion.restaurante_id);
      setCatalogo(res.data.productos || []);
    } catch {
      // No rompemos el modal si falla el catálogo; el vendedor puede
      // seguir con los items sugeridos o reintentar.
      setCatalogo([]);
    } finally {
      setCatalogoLoading(false);
    }
  };

  // Agrega un producto del catálogo. Si ya está en la lista, suma 1 a la cantidad.
  const agregarProducto = (prod) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.producto_id === prod.id);
      if (idx >= 0) {
        return prev.map((it, i) => i === idx ? { ...it, cantidad: Number(it.cantidad) + 1 } : it);
      }
      return [...prev, {
        producto_id: prod.id,
        cantidad: 1,
        precio_unitario: Number(prod.precio) || 0,
        nombre: prod.nombre || `Producto #${prod.id}`,
      }];
    });
  };

  const catalogoFiltrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return catalogo;
    return catalogo.filter((p) => (p.nombre || '').toLowerCase().includes(q));
  }, [catalogo, busqueda]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!puedeConfirmar) return;
    setError(null);
    setComprobanteError(null);
    setSubmitting(true);
    try {
      const draft = {
        items: items.map((it) => ({
          producto_id: it.producto_id,
          cantidad: it.cantidad,
          // El backend hace SELECT FOR UPDATE y re-valida el precio; lo que
          // mandamos es solo una sugerencia. Si difiere, gana el de la BD.
          // Por eso mandamos los items sin precio_unitario: el backend lo
          // toma de la BD.
        })),
        metodo_pago: metodoPago,
        esRetiroLocal,
        esConsumoEnLocal: false,
        direccion_entrega: esRetiroLocal ? null : (direccionEntrega.trim() || null),
        telefono_contacto: telefonoContacto.trim() || null,
        notas: notas.trim() || null,
        costo_envio: esRetiroLocal ? 0 : Number(costoEnvio) || 0,
        // usuario_id: el cliente es anónimo; el backend crea un walk-in
        // con su nombre + teléfono.
      };
      const res = await chatService.adminConvertToOrder(conversacion.id, draft);
      const pedidoId = res.pedido_id;

      // Si hay comprobante adjunto, lo subimos en nombre del cliente.
      // Si la subida falla, NO cancelamos la creación del pedido (el
      // comprobante se puede subir después desde la Recepción). Solo
      // informamos al staff.
      if (comprobanteFile && ['nequi', 'daviplata', 'bre_b'].includes(metodoPago)) {
        try {
          await paymentService.uploadProofAsStaff(pedidoId, metodoPago, comprobanteFile);
        } catch (proofErr) {
          console.error('[ArmarPedidoModal] Error subiendo comprobante:', proofErr);
          setComprobanteError(
            'Pedido creado, pero no se pudo subir el comprobante. Podés adjuntarlo después desde la Recepción.'
          );
          // Igual notificamos al padre para que refresque; el toast va aparte.
          onCreated(pedidoId);
          return;
        }
      }

      onCreated(pedidoId);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo crear el pedido');
    } finally {
      setSubmitting(false);
    }
  };

  // Cuando el modal se cierra, liberamos el object URL del preview para
  // no leakear memoria.
  useEffect(() => {
    return () => {
      if (comprobantePreview) URL.revokeObjectURL(comprobantePreview);
    };
  }, [comprobantePreview]);

  // Si cambia el método de pago a contra_entrega o cambia de uno digital
  // a otro, limpiamos el comprobante adjunto (no aplica).
  useEffect(() => {
    if (metodoPago === 'contra_entrega' && comprobanteFile) {
      setComprobanteFile(null);
      if (comprobantePreview) URL.revokeObjectURL(comprobantePreview);
      setComprobantePreview(null);
    }
  }, [metodoPago]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectComprobante = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setComprobanteError('El comprobante tiene que ser una imagen (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setComprobanteError('La imagen no puede pesar más de 5 MB.');
      return;
    }
    setComprobanteError(null);
    if (comprobantePreview) URL.revokeObjectURL(comprobantePreview);
    setComprobanteFile(file);
    setComprobantePreview(URL.createObjectURL(file));
  };

  const handleRemoveComprobante = () => {
    if (comprobantePreview) URL.revokeObjectURL(comprobantePreview);
    setComprobanteFile(null);
    setComprobantePreview(null);
    setComprobanteError(null);
  };

  const metodoDigital = ['nequi', 'daviplata', 'bre_b'].includes(metodoPago);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b border-[color:var(--border-subtle)]">
          <div>
            <h2 className="text-lg font-bold text-[color:var(--text-primary)] flex items-center gap-2">
              <ShoppingCart size={20} className="text-[var(--color-primary)]" />
              Armar pedido
            </h2>
            <p className="text-xs text-[color:var(--text-muted)] mt-1">
              {conversacion.cliente_nombre} · {conversacion.cliente_telefono}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Items */}
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--text-primary)] mb-2">
              Productos ({items.length})
            </h3>
            {loading ? (
              <div className="text-sm text-[color:var(--text-muted)] py-4 text-center">Cargando items sugeridos…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-[color:var(--text-muted)] py-4 px-3 text-center bg-[color:var(--bg-subtle)] rounded-md">
                El cliente no seleccionó productos en el catálogo. Agrégalos
                con el botón de abajo, o escríbele para que te diga qué necesita.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-[color:var(--bg-subtle)] rounded-md">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[color:var(--text-primary)] truncate">
                        {it.nombre}
                      </div>
                      <div className="text-xs text-[color:var(--text-muted)]">
                        {formatCurrency(it.precio_unitario)} c/u
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(idx, -1)}
                        className="w-7 h-7 rounded bg-[color:var(--bg-elevated)] border border-[color:var(--border-subtle)] text-sm font-bold"
                        aria-label="Restar"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums">
                        {it.cantidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(idx, 1)}
                        className="w-7 h-7 rounded bg-[color:var(--bg-elevated)] border border-[color:var(--border-subtle)] text-sm font-bold"
                        aria-label="Sumar"
                      >
                        +
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={it.precio_unitario}
                      onChange={(e) => cambiarPrecio(idx, e.target.value)}
                      className="w-24 px-2 py-1 border border-[color:var(--border-subtle)] rounded text-sm text-right tabular-nums"
                      placeholder="Precio"
                    />
                    <button
                      type="button"
                      onClick={() => eliminarItem(idx)}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      aria-label="Quitar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Picker del catálogo: permite armar el pedido aunque el
                cliente no haya clickeado productos en el chat. */}
            <button
              type="button"
              onClick={abrirPicker}
              className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-dashed border-[color:var(--border-subtle)] text-sm font-medium text-[color:var(--text-primary)] hover:bg-[color:var(--bg-subtle)]"
            >
              <Plus size={16} />
              {pickerAbierto ? 'Cerrar catálogo' : 'Agregar producto del catálogo'}
            </button>

            {pickerAbierto && (
              <div className="mt-2 border border-[color:var(--border-subtle)] rounded-md overflow-hidden">
                <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)]">
                  <Search size={15} className="text-[color:var(--text-muted)] flex-shrink-0" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar producto…"
                    autoFocus
                    className="flex-1 bg-transparent text-sm outline-none text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)]"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {catalogoLoading ? (
                    <div className="text-sm text-[color:var(--text-muted)] py-4 text-center">Cargando catálogo…</div>
                  ) : catalogoFiltrado.length === 0 ? (
                    <div className="text-sm text-[color:var(--text-muted)] py-4 text-center">
                      {catalogo.length === 0 ? 'Este local no tiene productos cargados.' : 'Sin resultados.'}
                    </div>
                  ) : (
                    catalogoFiltrado.map((prod) => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => agregarProducto(prod)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[color:var(--bg-subtle)] border-b border-[color:var(--border-subtle)] last:border-b-0"
                      >
                        <span className="flex-1 min-w-0 text-sm text-[color:var(--text-primary)] truncate">{prod.nombre}</span>
                        <span className="text-xs text-[color:var(--text-muted)] tabular-nums">{formatCurrency(Number(prod.precio) || 0)}</span>
                        <Plus size={15} className="text-[var(--color-primary)] flex-shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Modalidad */}
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--text-primary)] mb-2">Modalidad</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEsRetiroLocal(true)}
                className={[
                  'flex-1 px-3 py-2 rounded-md border text-sm font-medium',
                  esRetiroLocal ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[color:var(--bg-elevated)] border-[color:var(--border-subtle)]',
                ].join(' ')}
              >
                Retiro en local
              </button>
              <button
                type="button"
                onClick={() => setEsRetiroLocal(false)}
                className={[
                  'flex-1 px-3 py-2 rounded-md border text-sm font-medium',
                  !esRetiroLocal ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-[color:var(--bg-elevated)] border-[color:var(--border-subtle)]',
                ].join(' ')}
              >
                Domicilio
              </button>
            </div>
          </div>

          {!esRetiroLocal && (
            <>
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1">
                  Dirección de entrega
                </label>
                <input
                  type="text"
                  value={direccionEntrega}
                  onChange={(e) => setDireccionEntrega(e.target.value)}
                  placeholder="Calle, carrera, número, barrio…"
                  className="w-full px-3 py-2 border border-[color:var(--border-subtle)] rounded-md text-sm bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1">
                  Costo de envío
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={costoEnvio}
                  onChange={(e) => setCostoEnvio(e.target.value)}
                  className="w-32 px-3 py-2 border border-[color:var(--border-subtle)] rounded-md text-sm text-right tabular-nums"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1">
              Teléfono de contacto
            </label>
            <input
              type="tel"
              value={telefonoContacto}
              onChange={(e) => setTelefonoContacto(e.target.value)}
              placeholder="3001234567"
              className="w-full px-3 py-2 border border-[color:var(--border-subtle)] rounded-md text-sm tabular-nums"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1">
              Método de pago
            </label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              className="w-full px-3 py-2 border border-[color:var(--border-subtle)] rounded-md text-sm bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)]"
            >
              <option value="contra_entrega">Contra entrega (efectivo)</option>
              <option value="nequi">Nequi</option>
              <option value="daviplata">Daviplata</option>
              <option value="bre_b">Bre-B</option>
            </select>
          </div>

          {/* Comprobante opcional — solo para pagos digitales. El staff
              puede adjuntar la captura que el cliente le mandó por WhatsApp. */}
          {metodoDigital && (
            <div className="p-3 rounded-md bg-[color:var(--bg-subtle)] border border-[color:var(--border-subtle)] space-y-2">
              <div className="flex items-start gap-2 text-xs text-[color:var(--text-secondary)]">
                <Receipt size={14} className="flex-shrink-0 mt-0.5 text-[var(--color-primary)]" />
                <span>
                  Pedile al cliente el comprobante de la transferencia para
                  adjuntarlo al pedido. Si todavía no te lo mandó, podés
                  adjuntarlo después desde la Recepción.
                </span>
              </div>

              {comprobantePreview ? (
                <div className="flex items-center gap-3">
                  <div className="relative w-20 h-20 rounded-md overflow-hidden border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] flex-shrink-0">
                    <img
                      src={comprobantePreview}
                      alt="Vista previa del comprobante"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[color:var(--text-primary)] truncate">
                      {comprobanteFile.name}
                    </p>
                    <p className="text-[11px] text-[color:var(--text-muted)]">
                      {(comprobanteFile.size / 1024).toFixed(0)} KB
                    </p>
                    <button
                      type="button"
                      onClick={handleRemoveComprobante}
                      className="mt-1 text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full px-3 py-3 rounded-md border-2 border-dashed border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] hover:border-[var(--color-primary)]/50 cursor-pointer transition-colors">
                  <ImageIcon size={16} className="text-[color:var(--text-muted)]" />
                  <span className="text-sm font-medium text-[color:var(--text-primary)]">
                    Adjuntar comprobante
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSelectComprobante}
                    className="sr-only"
                  />
                </label>
              )}

              {comprobanteError && (
                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                  <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                  <span>{comprobanteError}</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1">
              Notas (opcional)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Indicaciones especiales para el domiciliario…"
              className="w-full px-3 py-2 border border-[color:var(--border-subtle)] rounded-md text-sm resize-none bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)]"
            />
          </div>

          {/* Total */}
          <div className="flex items-center justify-between p-3 bg-[color:var(--bg-subtle)] rounded-md">
            <span className="text-sm font-medium text-[color:var(--text-primary)]">Total</span>
            <span className="text-lg font-bold text-[color:var(--text-primary)] tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-md text-sm text-red-700 dark:text-red-300">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm font-medium border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-subtle)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!puedeConfirmar}
              className="px-4 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-50 active:scale-95 transition-transform"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {submitting ? 'Creando…' : 'Confirmar y crear pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
