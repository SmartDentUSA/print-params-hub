interface Props { title: string; subtitle?: string }
export default function KbSectionHeader({ title, subtitle }: Props) {
  return (
    <header className="kb-section-header">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}