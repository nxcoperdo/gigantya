/**
 * ConfigPage (Fase 8).
 *
 * Pantalla de configuración POS. Solo accesible para dueño/admin
 * (validado en el router y en el backend). Usa `ConfigForm` para
 * el form en sí.
 */
import { Settings } from 'lucide-react';
import ConfigForm from '../../components/pos/ConfigForm';

export default function ConfigPage() {
  return (
    <div className="space-y-4 max-w-3xl">
      <header className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)' }}
          aria-hidden="true"
        >
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-extrabold leading-tight">Configuración POS</h1>
          <p className="text-xs text-[color:var(--text-muted)]">
            Ajustes globales del Punto de Venta del local.
          </p>
        </div>
      </header>
      <ConfigForm />
    </div>
  );
}
