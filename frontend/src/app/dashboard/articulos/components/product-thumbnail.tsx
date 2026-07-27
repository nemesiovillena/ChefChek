'use client';

import { useState } from 'react';
import { Tag } from 'lucide-react';

interface ProductThumbnailProps {
  imageUrl?: string | null;
  size?: number;
  className?: string;
}

/**
 * Miniatura de artículo con fallback "sin imagen" (icono Tag). Usa <img>
 * plano en vez de next/image porque las imágenes elegidas por búsqueda web
 * vienen de dominios arbitrarios, fuera de la whitelist de remotePatterns.
 */
export default function ProductThumbnail({ imageUrl, size = 32, className = '' }: ProductThumbnailProps) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(imageUrl) && !broken;

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-lg bg-[var(--surface-container-highest)] flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <Tag className="h-1/2 w-1/2 text-[var(--on-surface-variant)]" />
      )}
    </div>
  );
}
