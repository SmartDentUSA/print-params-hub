interface Props {
  title: string;
  subtitle?: string;
  artUrl?: string;
}

export default function KbHero({ title, subtitle, artUrl }: Props) {
  return (
    <section className="kbs-hero">
      <div className="kbs-hero-text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {artUrl && <div className="kbs-hero-art" style={{ backgroundImage: `url(${artUrl})` }} />}
    </section>
  );
}