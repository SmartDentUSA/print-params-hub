interface Props { icon?: string; text?: string }
export default function KbEmptyState({ icon = '🔍', text = 'Nenhum resultado encontrado' }: Props) {
  return (
    <div className="kb-empty">
      <div className="kb-empty-icon">{icon}</div>
      <div className="kb-empty-text">{text}</div>
    </div>
  );
}