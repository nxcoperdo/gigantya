/**
 * Contexto del ticket en curso del POS.
 *
 * A diferencia de `CartContext` (cliente web, persiste en localStorage),
 * el ticket POS es server-authoritative: cuando el mesero pulsa
 * "Enviar a cocina", el backend crea el pedido y este contexto se vacía.
 *
 * El contexto vive solo en memoria; no persiste entre recargas (un POS
 * real nunca debería sobrevivir a un refresh con un ticket a medio armar,
 * y si el mesero pierde el ticket, es preferible que se dé cuenta y lo
 * reingrese a que se envíe algo sin querer).
 *
 * Shape de un item del ticket:
 *   { producto_id, nombre, cantidad, adiciones, removidos, nota,
 *     precioUnitario, subtotal }
 *
 * El shape de `adiciones` y `removidos` matchea exactamente lo que el
 * backend espera en el array `items` (ver `orderService.createOrderCore`).
 */
import { createContext, useContext, useMemo, useState } from 'react';

const POSTicketContext = createContext(null);

export function POSTicketProvider({ children }) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({
    mesa_id: null,        // null para pickup o delivery
    tipo: 'dine_in',      // 'dine_in' | 'pickup' | 'delivery'
    cliente_id: null,
    cliente_nombre: '',
    cliente_telefono: '',
    direccion_entrega: '',
    notas: '',
  });

  const total = useMemo(
    () => items.reduce((acc, it) => acc + (it.subtotal || 0), 0),
    [items]
  );

  const addItem = (nuevo) => {
    setItems((prev) => [...prev, nuevo]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateQty = (index, delta) => {
    setItems((prev) => prev.map((it, i) => {
      if (i !== index) return it;
      const nuevaCant = Math.max(0, it.cantidad + delta);
      if (nuevaCant === 0) return null;
      const nuevaBase = it.precioUnitario * nuevaCant;
      const nuevasAdiciones = it.adiciones.reduce(
        (s, a) => s + (a.precio_unitario_adicion || 0) * a.cantidad, 0
      ) * nuevaCant;
      return { ...it, cantidad: nuevaCant, subtotal: nuevaBase + nuevasAdiciones };
    }).filter(Boolean));
  };

  const updateMeta = (changes) => {
    setMeta((prev) => ({ ...prev, ...changes }));
  };

  const clear = () => {
    setItems([]);
    setMeta({
      mesa_id: null,
      tipo: 'dine_in',
      cliente_id: null,
      cliente_nombre: '',
      cliente_telefono: '',
      direccion_entrega: '',
      notas: '',
    });
  };

  return (
    <POSTicketContext.Provider value={{
      items, meta, total,
      addItem, removeItem, updateQty, updateMeta, clear,
    }}>
      {children}
    </POSTicketContext.Provider>
  );
}

export function usePOSTicket() {
  const ctx = useContext(POSTicketContext);
  if (!ctx) throw new Error('usePOSTicket debe usarse dentro de POSTicketProvider');
  return ctx;
}

export default POSTicketContext;
