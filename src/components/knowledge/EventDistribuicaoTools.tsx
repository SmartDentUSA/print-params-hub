import { useState } from 'react';
import { Copy, Check, MessageCircle, Link2 } from 'lucide-react';
import { QrCodeButton } from '@/components/smartops/QrCodeButton';
import { buildLiaUrl } from '@/lib/attendanceChannel';

const PUBLIC_BASE = 'https://www.smartdent.com.br';

function CopyRow({ icon, label, url, qrTitle, qrSuffix }: { icon: React.ReactNode; label: string; url: string; qrTitle: string; qrSuffix: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="kb-dist-row">
      <span className="kb-dist-label">{icon} {label}</span>
      <div className="kb-dist-actions">
        <button
          type="button"
          className="kb-dist-btn"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          aria-label={`Copiar ${label}`}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copiado' : 'Copiar'}
        </button>
        <QrCodeButton url={url} title={qrTitle} fileSuffix={qrSuffix} />
      </div>
    </div>
  );
}

/** Ferramentas de Distribuição no card do evento — visível só para team member logado pelo celular. */
export function EventDistribuicaoTools({ eventName, form }: { eventName: string; form: { id: string; slug: string } }) {
  const formUrl = `${PUBLIC_BASE}/f/${form.slug}`;
  const liaUrl = buildLiaUrl({ formId: form.id, base: PUBLIC_BASE });
  return (
    <div className="kb-dist-box">
      <div className="kb-dist-title">Distribuição — Cadastro</div>
      <CopyRow icon={<Link2 size={13} />} label="Formulário" url={formUrl} qrTitle={`Distribuição - ${eventName}`} qrSuffix="distribuicao-form" />
      <CopyRow icon={<MessageCircle size={13} />} label="Simulador WhatsApp" url={liaUrl} qrTitle={`Distribuição WhatsApp - ${eventName}`} qrSuffix="distribuicao-whatsapp" />
    </div>
  );
}
