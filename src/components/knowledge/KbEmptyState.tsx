import { useLanguage } from '@/contexts/LanguageContext';
interface Props { icon?: string; text?: string }
export default function KbEmptyState({ icon = '🔍', text }: Props) {
  const { t } = useLanguage();
  const label = text ?? t('kb.empty');
  return (
    <div className="kb-empty">
      <div className="kb-empty-icon">{icon}</div>
      <div className="kb-empty-text">{label}</div>
    </div>
  );
}