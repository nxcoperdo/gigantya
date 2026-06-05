/**
 * Formatea números como moneda colombiana simplificada (sin signo $, sin decimales, con puntos de miles).
 * Ejemplo: 25000 -> "25.000"
 */
export const formatCurrency = (value) => {
  if (value === undefined || value === null || isNaN(value)) return '0';

  // Usamos el formato de Alemania (de-DE) que utiliza el punto como separador de miles
  // y configuramos para que no muestre decimales.
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};
