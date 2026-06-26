import { useState } from 'react';
import PaymentProofsView from './PaymentProofsView';
import PaymentConfigView from './PaymentConfigView';
import { FileText, Settings } from 'lucide-react';

export default function PaymentTabs({ refreshData }) {
  const [activePaymentTab, setActivePaymentTab] = useState('validation');

  return (
    <div className="space-y-6">
      {/* Tabs de pagos */}
      <div className="flex p-1 bg-[color:var(--bg-muted)] rounded-xl w-fit">
        <button
          onClick={() => setActivePaymentTab('validation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activePaymentTab === 'validation'
              ? 'bg-[color:var(--bg-elevated)] text-primary shadow-sm'
              : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'
          }`}
        >
          <FileText size={16} />
          Validación de Comprobantes
        </button>
        <button
          onClick={() => setActivePaymentTab('config')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activePaymentTab === 'config'
              ? 'bg-[color:var(--bg-elevated)] text-primary shadow-sm'
              : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'
          }`}
        >
          <Settings size={16} />
          Configuración de Pagos
        </button>
      </div>

      {/* Contenido de las tabs */}
      {activePaymentTab === 'validation' ? (
        <PaymentProofsView refreshData={refreshData} />
      ) : (
        <PaymentConfigView />
      )}
    </div>
  );
}
