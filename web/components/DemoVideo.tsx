'use client';

import { useEffect, useRef, useState } from 'react';

/** The demo video: muted, plays while on screen, never on its own with reduced motion. */
export function DemoVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !userPaused.current) v.play().catch(() => undefined);
        else if (!entry.isIntersecting) v.pause();
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
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        className={'demo-toggle' + (playing ? ' playing' : '')}
        type="button"
        aria-label={playing ? 'Pause the demo video' : 'Play the demo video'}
        onClick={() => {
          const v = video.current;
          if (!v) return;
          if (v.paused) {
            userPaused.current = false;
            v.play().catch(() => undefined);
          } else {
            userPaused.current = true;
            v.pause();
          }
        }}
      >
        <span className="ic" aria-hidden="true">
          <svg className="i-play" viewBox="0 0 24 24">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
          <svg className="i-pause" viewBox="0 0 24 24">
            <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
          </svg>
        </span>
        <span>{playing ? 'Pause' : 'Play'}</span>
      </button>
      <figcaption id="demoCap">A real run of the demo shop, start to finish in 20 seconds. No sound.</figcaption>
    </figure>
  );
}
