import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

// Genera un id estable en el navegador (fallback si crypto.randomUUID
// no está disponible, lo cual no pasa en navegadores modernos pero
// dejamos la defensa).
function makeLineId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Construye una firma estable para deduplicar líneas del carrito.
 * Dos items con la misma firma se suman (mismo producto, mismas
 * adiciones, mismos removidos, misma nota). Dos items con firma
 * distinta quedan como dos líneas separadas (mismo producto con
 * customización diferente — comportamiento Rappi).
 *
 * @param {object} params
 * @param {number} params.id              producto_id
 * @param {Array}  params.adiciones       [{ adicion_id, cantidad }]
 * @param {Array}  params.removidos       [{ id }]
 * @param {string} params.nota            nota libre
 */
function buildFirma({ id, adiciones = [], removidos = [], nota = '' }) {
  const ad = [...adiciones]
    .sort((a, b) => a.adicion_id - b.adicion_id)
    .map((a) => ({ id: a.adicion_id, c: a.cantidad }));
  const re = [...removidos]
    .sort((a, b) => a.id - b.id)
    .map((r) => r.id);
  return JSON.stringify({ id, ad, re, nota: nota || '' });
}

/**
 * Normaliza un item del carrito persistido en localStorage al shape
 * nuevo (con _firma, line_id, adiciones, removidos, nota,
 * precio_unitario_final). Maneja carritos viejos sin customización:
 * les inyecta arrays vacíos y genera line_id/firma.
 */
function normalizeItem(item) {
  const adiciones = Array.isArray(item.adiciones) ? item.adiciones : [];
  const removidos = Array.isArray(item.removidos) ? item.removidos : [];
  const nota = typeof item.nota === 'string' ? item.nota : '';
  const cantidad = Number(item.cantidad) || 1;
  const precio = Number(item.precio) || 0;
  const precio_unitario_final =
    Number(item.precio_unitario_final) || precio;
  const subtotal =
    Number(item.subtotal) || precio_unitario_final * cantidad;
  const _firma =
    item._firma ||
    buildFirma({ id: item.id, adiciones, removidos, nota });
  const line_id = item.line_id || makeLineId();
  return {
    ...item,
    line_id,
    _firma,
    adiciones,
    removidos,
    nota,
    cantidad,
    precio_unitario_final,
    subtotal,
  };
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('cart');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.map(normalizeItem) : [];
    } catch {
      return [];
    }
  });

  // Guardar carrito en localStorage
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  /**
   * Agrega un item al carrito. Deduplica por firma: dos pedidos del
   * mismo producto con la misma customización suman cantidad en la
   * misma línea. Distinta customización → nueva línea.
   *
   * @param {object} producto
   * @param {number} [cantidad=1]
   * @param {Array}  [adiciones=[]]  [{ adicion_id, nombre, precio_extra, cantidad, subtotal }]
   * @param {Array}  [removidos=[]]  [{ id, nombre }]
   * @param {string} [nota='']
   */
  const addToCart = (
    producto,
    cantidad = 1,
    adiciones = [],
    removidos = [],
    nota = ''
  ) => {
    if (cart.length > 0) {
      const firstItemRestaurantId = cart[0].restaurante_id;
      if (producto.restaurante_id && firstItemRestaurantId !== producto.restaurante_id) {
        return {
          success: false,
          error: 'Solo puedes agregar productos de un mismo local por pedido.',
        };
      }
    }

    const firma = buildFirma({ id: producto.id, adiciones, removidos, nota });
    const sumaAdiciones = adiciones.reduce(
      (s, a) => s + Number(a.precio_extra || 0) * Number(a.cantidad || 0),
      0
    );
    const precio_unitario_final = Number(producto.precio || 0) + sumaAdiciones;
    const subtotal = precio_unitario_final * Number(cantidad);

    let merged = false;
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item._firma === firma);
      if (existing) {
        merged = true;
        return prevCart.map((item) =>
          item._firma === firma
            ? {
                ...item,
                cantidad: item.cantidad + Number(cantidad),
                subtotal: item.precio_unitario_final * (item.cantidad + Number(cantidad)),
              }
            : item
        );
      }
      return [
        ...prevCart,
        {
          ...producto,
          cantidad: Number(cantidad),
          adiciones,
          removidos,
          nota,
          _firma: firma,
          line_id: makeLineId(),
          precio_unitario_final,
          subtotal,
        },
      ];
    });

    return { success: true, merged };
  };

  // Eliminar línea del carrito (por line_id, no por id de producto)
  const removeFromCart = (lineId) => {
    setCart((prevCart) => prevCart.filter((item) => item.line_id !== lineId));
  };

  // Actualizar cantidad (por line_id)
  const updateQuantity = (lineId, cantidad) => {
    const nuevaCantidad = Number(cantidad);
    if (nuevaCantidad <= 0) {
      removeFromCart(lineId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.line_id === lineId
          ? {
              ...item,
              cantidad: nuevaCantidad,
              subtotal: item.precio_unitario_final * nuevaCantidad,
            }
          : item
      )
    );
  };

  // Calcular total (sobre precio_unitario_final — incluye adiciones)
  const total = cart.reduce(
    (acc, item) => acc + (item.precio_unitario_final || item.precio || 0) * item.cantidad,
    0
  );

  // Limpiar carrito
  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        total,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe ser usado dentro de CartProvider');
  }
  return context;
}
