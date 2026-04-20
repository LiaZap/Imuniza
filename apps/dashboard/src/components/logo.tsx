import type { SVGProps } from 'react';

/** Minimalist drop mark — clean stroke, translucent fill, inherits color via `currentColor`. */
export function LogoDrop(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      fill="none"
      {...props}
    >
      <path
        d="M24 4 C24 4 8 22 8 31 C8 40 15 44 24 44 C33 44 40 40 40 31 C40 22 24 4 24 4 Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.14"
      />
      <path
        d="M16 30 C16 36 19 40 23 40"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

/**
 * Logotipo com a gota + texto "CLÍNICA IMUNIZA".
 * variant: "light" em fundos escuros/gradiente, "dark" em fundos brancos.
 */
export function LogoMark({
  variant = 'light',
  size = 'md',
}: {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: { drop: 'h-8 w-8', top: 'text-[9px]', bottom: 'text-base' },
    md: { drop: 'h-11 w-11', top: 'text-[10px]', bottom: 'text-xl' },
    lg: { drop: 'h-16 w-16', top: 'text-xs', bottom: 'text-3xl' },
  } as const;
  const s = sizes[size];
  const isLight = variant === 'light';
  const textTop = isLight ? 'text-white/70' : 'text-brand-deep/65';
  const textBottom = isLight ? 'text-white' : 'text-brand-deep';
  const dropColor = isLight ? 'text-white' : 'text-brand';

  return (
    <div className="flex items-center gap-3">
      <LogoDrop className={`${s.drop} ${dropColor}`} />
      <div className="leading-none">
        <div className={`font-display ${s.top} font-semibold uppercase tracking-[0.32em] ${textTop}`}>
          Clínica
        </div>
        <div className={`font-display ${s.bottom} font-extrabold tracking-wide ${textBottom}`}>
          IMUNIZA
        </div>
      </div>
    </div>
  );
}
