/**
 * ConfigPage (Fase 8).
 *
 * Pantalla de configuración POS. Solo accesible para dueño/admin
 * (validado en el router y en el backend). Usa `ConfigForm` para
 * el form en sí.
 */
import ConfigForm from '../../components/pos/ConfigForm';

export default function ConfigPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Configuración POS</h1>
        <p className="text-sm text-[color:var(--text-muted)]">
          Ajustes globales del Punto de Venta del local.
        </p>
      </div>
      <ConfigForm />
    </div>
  );
}
