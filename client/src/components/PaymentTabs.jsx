import { useState } from 'react';
import PaymentProofsView from './PaymentProofsView';
import PaymentConfigView from './PaymentConfigView';
import { FileText, Settings } from 'lucide-react';

export default function PaymentTabs({ refreshData }) {
  const [activePaymentTab, setActivePaymentTab] = useState('validation');

  return (
    <div className="space-y-6">
      {/* Tabs de pagos */}
      <div className="flex p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActivePaymentTab('validation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activePaymentTab === 'validation'
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-500 hover:text-dark'
          }`}
        >
          <FileText size={16} />
          Validación de Comprobantes
        </button>
        <button
          onClick={() => setActivePaymentTab('config')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activePaymentTab === 'config'
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-500 hover:text-dark'
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
