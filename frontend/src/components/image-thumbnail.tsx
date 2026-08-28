'use client';

import { useState } from 'react';
import { Tag } from 'lucide-react';

interface ImageThumbnailProps {
  imageUrl?: string | null;
  size?: number;
  className?: string;
}

/**
 * Miniatura con fallback "sin imagen" (icono Tag). Usa <img> plano en vez de
 * next/image porque las imágenes elegidas por búsqueda web pueden venir de
 * dominios fuera de la whitelist de remotePatterns.
 */
export default function ImageThumbnail({ imageUrl, size = 32, className = '' }: ImageThumbnailProps) {
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
