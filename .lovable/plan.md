

# Plan: Fix oversized product images in Knowledge Base articles

## Problem
Product images inside `inline-product-card` elements appear at full width instead of the intended 140x140px. The CSS rule `.article-content img` (in `article-content.css`) applies `height: auto; display: block; margin: 2em 0;` which overrides the card-specific sizing in `inline-product-card.css`.

## Root cause
CSS specificity conflict: both `.article-content img` and `.inline-product-card .card-image` have similar specificity, but `article-content.css` loads after and overrides key properties like `height: auto` (breaking `height: 140px`) and `margin: 2em 0`.

## Fix

### 1. Add override rule in `src/styles/article-content.css`

Add a higher-specificity rule to exclude product card images from the generic article image styling:

```css
.article-content .inline-product-card img {
  width: 140px;
  height: 140px;
  object-fit: cover;
  margin: 0;
  display: block;
  box-shadow: none;
  border-radius: 8px;
  flex-shrink: 0;
}
```

And add mobile override:

```css
@media (max-width: 640px) {
  .article-content .inline-product-card img {
    width: 100%;
    height: 200px;
  }
}
```

### Files affected
- `src/styles/article-content.css` — add specificity overrides for product card images

