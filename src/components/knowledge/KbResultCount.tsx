import { useLanguage } from '@/contexts/LanguageContext';
interface Props { count: number; noun: 'video' | 'article' | 'product' }
const NS: Record<Props['noun'], string> = {
  video: 'kb.videos',
  article: 'kb.artigos',
  product: 'kb.catalogo',
};
export default function KbResultCount({ count, noun }: Props) {
  const { t } = useLanguage();
  const key = count === 1 ? `${NS[noun]}.count_one` : `${NS[noun]}.count_other`;
  return <div className="kb-count">{t(key, { count })}</div>;
}