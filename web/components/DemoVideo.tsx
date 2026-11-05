'use client';

import { useEffect, useRef } from 'react';

/** The demo video: muted, plays while on screen and pauses when scrolled away. Stays on its poster with reduced motion. */
export function DemoVideo() {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.4 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <figure className="demo-video hero-video">
      <video
        ref={video}
        src="/media/repeval-demo.mp4"
        poster="/media/repeval-demo-poster.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        aria-describedby="demoCap"
      />
      <figcaption id="demoCap">A real run of the demo shop, start to finish in 20 seconds. No sound.</figcaption>
    </figure>
  );
}
