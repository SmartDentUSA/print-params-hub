import { ExternalLink, Star } from 'lucide-react';

interface InlineProductCardProps {
  productId: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  rating: number | null;
  shopUrl: string;
}

export function InlineProductCard({
  name,
  description,
  imageUrl,
  price,
  currency,
  rating,
  shopUrl
}: InlineProductCardProps) {
  const formatPrice = () => {
    if (!price) return null;
    const symbol = currency === 'BRL' ? 'R$' : currency;
    return `${symbol} ${price.toFixed(2).replace('.', ',')}`;
  };

  const truncateDescription = (text: string, maxLength: number = 120) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <div className="inline-product-card">
      <a 
        href={shopUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="card-link"
      >
        <div className="card-container">
          {imageUrl && (
            <img 
              src={imageUrl} 
              alt={name}
              loading="lazy"
              className="card-image"
            />
          )}
          <div className="card-content">
            <div className="card-badge">📦 Produto Recomendado</div>
            <h4 className="card-title">{name}</h4>
            {description && (
              <p className="card-description">
                {truncateDescription(description)}
              </p>
            )}
            <div className="card-meta">
              {rating && (
                <span className="card-rating">
                  <Star className="h-4 w-4 fill-current" />
                  {rating.toFixed(1)}/5
                </span>
              )}
              {price && (
                <span className="card-price">{formatPrice()}</span>
              )}
            </div>
            <button className="card-cta">
              <ExternalLink className="h-4 w-4" />
              Ver na Loja
            </button>
          </div>
        </div>
      </a>
    </div>
  );
}
