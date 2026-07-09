/**
 * Placeholder genérico para rutas del POS que aún no están implementadas.
 * En lugar de un 404, mostramos un mensaje claro para que el staff sepa
 * que la feature viene en una fase posterior.
 */
export default function POSComingSoon({ titulo, fase = 'próxima' }) {
  return (
    <div className="max-w-md mx-auto text-center py-16">
      <h1 className="text-2xl font-bold mb-2">{titulo}</h1>
      <p className="text-[color:var(--text-muted)]">
        Esta sección del POS llega en la {fase} fase del plan.
        Por ahora solo está disponible Personal.
      </p>
    </div>
  );
}
