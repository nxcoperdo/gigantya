/**
 * Mapa centralizado de íconos para categorías.
 *
 * Para agregar una nueva categoría:
 *   1. Si tiene un ícono específico, agrégalo aquí con la clave = nombre exacto.
 *   2. Si no, no hagas nada — la categoría recibirá el fallback `Tags`
 *      y seguirá funcionando.
 *
 * Cada categoría de la BD puede tener un ícono personalizado. Las claves
 * DEBEN coincidir exactamente con el campo `nombre` de la tabla `categorias`.
 *
 * Las dos filas llamadas "Bebidas" (una de tipo restaurante, otra de tipo
 * mercado) comparten el mismo ícono `GlassWater` porque el lookup es solo
 * por nombre — el tipo_negocio ya se gestiona por separado en el render.
 */
import {
  Beef,
  Utensils,
  UtensilsCrossed,
  Wheat,
  Cookie,
  Sandwich,
  Pizza,
  Salad,
  Plus,
  GlassWater,
  Cake,
  Package,
  Tag,
  ShoppingBasket,
  Carrot,
  Apple,
  Milk,
  Drumstick,
  Croissant,
  SprayCan,
  ShowerHead,
  Snowflake,
  Wine,
  Baby,
  PawPrint,
  Soup,
  Fish,
  Coffee,
  Sunrise,
  Tags,
} from 'lucide-react';

export const CATEGORY_ICON_MAP = {
  // ─── Restaurante ───
  'Hamburguesas': Beef,
  'Perros Calientes': Sandwich,
  'Salchipapas': Utensils,
  'Mazorcadas': Wheat,
  'Picadas': UtensilsCrossed,
  'Patacones Rellenos': Cookie,
  'Arepas Rellenas': Utensils,
  'Tacos': Utensils,
  'Burritos': Utensils,
  'Quesadillas': Utensils,
  'Nachos': Utensils,
  'Empanadas y Fritos': Drumstick,
  'Chuzos y Pinchos': Drumstick,
  'Alitas y Pollo': Drumstick,
  'Sandwiches': Sandwich,
  'Wraps': Sandwich,
  'Pizzas': Pizza,
  'Panzerottis': Pizza,
  'Calzones': Pizza,
  'Lasañas': Utensils,
  'Pastas': Utensils,
  'Acompañamientos': Salad,
  'Adiciones': Plus,
  'Bebidas': GlassWater,
  'Malteadas': GlassWater,
  'Postres': Cake,
  'Helados': Cake,
  'Combos': Package,
  'Promociones': Tag,

  // ─── Catálogo transversal de restaurante (seed 20260630000004 + 000005) ───
  // Carta típica colombiana: entradas, sopas, platos fuertes, etc.
  // Cualquier restaurante puede usar estas categorías sin tener que crearlas.
  'Entradas y Aperitivos': Utensils,
  'Sopas y Caldos': Soup,
  'Platos Fuertes — Carnes': Beef,
  'Platos Fuertes — Pollo': Drumstick,
  'Platos Fuertes — Pescados y Mariscos': Fish,
  'Platos Típicos Colombianos': UtensilsCrossed,
  'Pastas y Lasañas': Utensils,
  'Pizzas y Pastas Horneadas': Pizza,
  'Comida Rápida': Utensils,
  'Ensaladas y Vegetarianos': Salad,
  'Guarniciones y Acompañamientos': Salad,
  'Bebidas y Jugos': GlassWater,
  'Postres y Dulces': Cake,
  'Menú Infantil': Baby,
  'Desayunos': Sunrise,
  'Almuerzos Ejecutivos': Utensils,
  'Comida Vegana': Salad,
  'Café y Bebidas Calientes': Coffee,
  'Cócteles y Jugos Naturales': GlassWater,
  'Piqueos y Pasabocas': Cookie,

  // ─── Mercado y abarrotes ───
  'Abarrotes': ShoppingBasket,
  'Verduras': Carrot,
  'Frutas': Apple,
  'Lácteos': Milk,
  'Carnicería': Drumstick,
  'Panadería': Croissant,
  'Limpieza': SprayCan,
  'Aseo personal': ShowerHead,
  'Granos': Wheat,
  // Categorías adicionales (seed 20260630000003)
  'Congelados': Snowflake,
  'Snacks': Cookie,
  'Licores': Wine,
  'Bebé': Baby,
  'Mascotas': PawPrint,
};

/**
 * Resuelve el componente de ícono para una categoría por su nombre.
 * Si la categoría no está mapeada, devuelve `Tags` como fallback genérico
 * — esto permite crear categorías nuevas sin tocar este archivo.
 */
export function getCategoryIcon(nombre) {
  if (!nombre) return Tags;
  return CATEGORY_ICON_MAP[nombre] || Tags;
}