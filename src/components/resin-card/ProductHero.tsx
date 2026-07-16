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
          crossOrigin="anonymous"
          draggable={false}
        />
      ) : (
        <div className="placeholder">Sem imagem oficial</div>
      )}
    </div>
  )
}