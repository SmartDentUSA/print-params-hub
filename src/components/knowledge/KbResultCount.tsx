interface Props { count: number; noun: 'video' | 'article' | 'product' }
const MAP = {
  video:   { sing: 'vídeo encontrado',   plur: 'vídeos encontrados' },
  article: { sing: 'artigo encontrado',  plur: 'artigos encontrados' },
  product: { sing: 'produto encontrado', plur: 'produtos encontrados' },
};
export default function KbResultCount({ count, noun }: Props) {
  const m = MAP[noun];
  return <div className="kb-count">{count} {count === 1 ? m.sing : m.plur}</div>;
}