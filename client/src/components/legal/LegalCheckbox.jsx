import { Link } from 'react-router-dom';

/**
 * `LegalCheckbox` — checkbox obligatorio con links a los documentos legales.
 *
 * Se usa en el registro de usuarios y restaurantes. El checkbox
 * NO se puede destildar programáticamente sin interacción del usuario
 * (es lo que la SIC espera para que el consentimiento sea "inequívoco").
 *
 * Props:
 *   - tyc: boolean
 *   - privacidad: boolean
 *   - onChangeTyc: fn
 *   - onChangePrivacidad: fn
 *   - merchant?: boolean  (opcional, mostrar también el de merchant)
 *   - onChangeMerchant?: fn
 *   - errors?: { tyc?, privacidad?, merchant? }  → strings de error
 *   - size?: 'sm' | 'md'  (default 'md')
 */
export default function LegalCheckbox({
  tyc,
  privacidad,
  onChangeTyc,
  onChangePrivacidad,
  merchant = false,
  onChangeMerchant,
  errors = {},
  size = 'md',
}) {
  const labelSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const linkSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="space-y-2.5">
      {/* TyC */}
      <label className="flex items-start gap-2.5 cursor-pointer group">
        <input
          type="checkbox"
          checked={!!tyc}
          onChange={(e) => onChangeTyc(e.target.checked)}
          className={[
            'mt-0.5 flex-shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer',
            size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4',
          ].join(' ')}
        />
        <span className={['leading-snug text-gray-700', labelSize].join(' ')}>
          Acepto los{' '}
          <Link to="/terminos" target="_blank" rel="noopener noreferrer" className={['text-indigo-600 underline hover:text-indigo-800', linkSize].join(' ')}>
            Términos y Condiciones
          </Link>
        </span>
      </label>
      {errors.tyc && <p className="ml-6 text-xs text-red-600">{errors.tyc}</p>}

      {/* Privacidad */}
      <label className="flex items-start gap-2.5 cursor-pointer group">
        <input
          type="checkbox"
          checked={!!privacidad}
          onChange={(e) => onChangePrivacidad(e.target.checked)}
          className={[
            'mt-0.5 flex-shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer',
            size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4',
          ].join(' ')}
        />
        <span className={['leading-snug text-gray-700', labelSize].join(' ')}>
          Acepto la{' '}
          <Link to="/privacidad" target="_blank" rel="noopener noreferrer" className={['text-indigo-600 underline hover:text-indigo-800', linkSize].join(' ')}>
            Política de Privacidad
          </Link>{' '}
          y autorizo el tratamiento de mis datos conforme a la Ley 1581 de 2012.
        </span>
      </label>
      {errors.privacidad && <p className="ml-6 text-xs text-red-600">{errors.privacidad}</p>}

      {/* Merchant Agreement (opcional) */}
      {merchant && (
        <label className="flex items-start gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={!!onChangeMerchant ? merchant : false}
            onChange={(e) => onChangeMerchant?.(e.target.checked)}
            className={[
              'mt-0.5 flex-shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer',
              size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4',
            ].join(' ')}
          />
          <span className={['leading-snug text-gray-700', labelSize].join(' ')}>
            Acepto el{' '}
            <Link to="/legal/restaurante" target="_blank" rel="noopener noreferrer" className={['text-indigo-600 underline hover:text-indigo-800', linkSize].join(' ')}>
              Acuerdo Comercial con Restaurantes
            </Link>
          </span>
        </label>
      )}
      {merchant && errors.merchant && <p className="ml-6 text-xs text-red-600">{errors.merchant}</p>}
    </div>
  );
}
