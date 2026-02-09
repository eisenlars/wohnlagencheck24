'use client';

import { useState } from 'react';
import Image from 'next/image';

type BlogAuthorImageProps = {
  src: string | null;
  fallbackSrc: string;
  alt: string;
  className?: string;
};

const passthroughLoader = ({ src }: { src: string }) => src;

export default function BlogAuthorImage({
  src,
  fallbackSrc,
  alt,
  className,
}: BlogAuthorImageProps) {
  const [errorForSrc, setErrorForSrc] = useState<string | null>(null);
  const baseSrc = src || fallbackSrc;
  if (!baseSrc) return null;
  const shouldFallback = Boolean(fallbackSrc && errorForSrc === baseSrc);
  const effectiveSrc = shouldFallback ? fallbackSrc : baseSrc;

  return (
    <Image
      src={effectiveSrc}
      alt={alt}
      className={className}
      width={64}
      height={64}
      sizes="64px"
      loader={passthroughLoader}
      unoptimized
      onError={() => {
        if (errorForSrc !== baseSrc) {
          setErrorForSrc(baseSrc);
        }
      }}
    />
  );
}
