'use client';

import { useEffect, useState } from 'react';

type BlogAuthorImageProps = {
  src: string | null;
  fallbackSrc: string;
  alt: string;
  className?: string;
};

export default function BlogAuthorImage({
  src,
  fallbackSrc,
  alt,
  className,
}: BlogAuthorImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string | null>(fallbackSrc || src);

  useEffect(() => {
    if (src) {
      setCurrentSrc(src);
    } else {
      setCurrentSrc(fallbackSrc);
    }
  }, [src, fallbackSrc]);

  if (!currentSrc) return null;

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
}
