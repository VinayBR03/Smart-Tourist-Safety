// src/components/common/SplashScreen.tsx

import { useEffect, useState } from 'react';
import logoWobg from '../../assets/logos/SentinelTour-logo.svg';

const FADE_IN_MS  = 600;
const HOLD_MS     = 1200;
const FADE_OUT_MS = 600;
const TOTAL_MS    = FADE_IN_MS + HOLD_MS + FADE_OUT_MS;

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), FADE_IN_MS);
    const t2 = setTimeout(() => setPhase('out'),  FADE_IN_MS + HOLD_MS);
    const t3 = setTimeout(() => onDone(),         TOTAL_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  const opacity =
    phase === 'in'   ? 'opacity-100' :
    phase === 'hold' ? 'opacity-100' :
                       'opacity-0';

  const transition =
    phase === 'in'  ? 'transition-opacity duration-[600ms] ease-in' :
    phase === 'out' ? 'transition-opacity duration-[600ms] ease-out' :
                      '';

  return (
    <div
      className={`
        fixed inset-0 z-[9999] flex flex-col items-center justify-center
        bg-slate-950
        ${opacity} ${transition}
      `}
    >
      {/* Logo */}
      <div
        className={`
          flex flex-col items-center gap-6
          ${phase === 'in' ? 'translate-y-2' : 'translate-y-0'}
          transition-transform duration-[600ms] ease-out
        `}
      >
        <img
          src={logoWobg}
          alt="Sentinel Tour"
          className="w-24 h-24 object-contain drop-shadow-2xl"
        />

        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Sentinel Tour
          </h1>
          <p className="mt-1.5 text-sm text-slate-400 tracking-widest uppercase">
            Crowd Safety Management
          </p>
        </div>

        {/* Loading dots */}
        <div className="flex items-center gap-1.5 mt-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}