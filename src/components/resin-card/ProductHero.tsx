import React from 'react'

type Props = {
  productName: string
  imageUrl: string | null
}

export function ProductHero({ productName, imageUrl }: Props) {
  return (
    <div className="product-hero" role="img" aria-label={productName}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={productName}
          // crossOrigin só faz sentido para URLs Supabase (com CORS liberado).
          // Para CDNs externas (ex.: awsli), definir crossOrigin bloqueia a
          // renderização do preview. A exportação exige rehospedagem no Storage.
          {...(imageUrl.includes('supabase.co') ? { crossOrigin: 'anonymous' as const } : {})}
          draggable={false}
        />
      ) : (
        <div className="placeholder">Sem imagem oficial</div>
      )}
    </div>
  )
}