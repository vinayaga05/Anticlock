'use client';

import { useId } from 'react';

export type EventArtworkKind = 'trophy' | 'community' | 'calendar' | 'watch' | 'nutrition' | 'strength' | 'ticket';

export function EventArtwork({ kind, className }: { kind: EventArtworkKind; className?: string }) {
  const id = useId().replace(/:/g, '');
  const paint = (name: string) => `url(#${id}-${name})`;

  return (
    <svg viewBox="0 0 96 96" fill="none" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <linearGradient id={`${id}-gold`} x1="20" y1="12" x2="74" y2="82" gradientUnits="userSpaceOnUse"><stop stopColor="#fff2a6" /><stop offset=".45" stopColor="#ffca39" /><stop offset="1" stopColor="#e78a19" /></linearGradient>
        <linearGradient id={`${id}-coral`} x1="24" y1="15" x2="75" y2="82" gradientUnits="userSpaceOnUse"><stop stopColor="#ff9d78" /><stop offset="1" stopColor="#df365c" /></linearGradient>
        <linearGradient id={`${id}-cyan`} x1="20" y1="15" x2="75" y2="83" gradientUnits="userSpaceOnUse"><stop stopColor="#8bf2e3" /><stop offset="1" stopColor="#169dc5" /></linearGradient>
        <linearGradient id={`${id}-navy`} x1="20" y1="18" x2="75" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#28639b" /><stop offset="1" stopColor="#09235b" /></linearGradient>
        <filter id={`${id}-shadow`} x="-30%" y="-25%" width="160%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#09235b" floodOpacity=".17" /></filter>
      </defs>
      <ellipse cx="48" cy="85" rx="31" ry="5" fill="#09235b" opacity=".08" />
      <g filter={paint('shadow')}>
        {kind === 'trophy' && <>
          <path d="M27 24H15v9c0 12 10 20 21 20M69 24h12v9c0 12-10 20-21 20" stroke="#eaa31d" strokeWidth="7" strokeLinecap="round" />
          <path d="M25 17h46v19c0 17-10 27-23 27S25 53 25 36V17Z" fill={paint('gold')} />
          <path d="M32 23v12c0 9 3 15 8 19" stroke="#fff8c9" strokeWidth="5" strokeLinecap="round" opacity=".8" />
          <path d="M48 27l4 8 9 1-7 7 2 9-8-4-8 4 2-9-7-7 9-1 4-8Z" fill="#df7d14" />
          <path d="M43 62h10v13H43z" fill={paint('gold')} /><path d="M34 74h28l5 8H29l5-8Z" fill={paint('navy')} />
        </>}
        {kind === 'community' && <>
          <circle cx="24" cy="33" r="11" fill={paint('coral')} /><circle cx="72" cy="33" r="11" fill={paint('gold')} />
          <path d="M8 70V59c0-9 7-16 16-16s16 7 16 16v11H8Z" fill={paint('coral')} /><path d="M56 70V59c0-9 7-16 16-16s16 7 16 16v11H56Z" fill={paint('gold')} />
          <circle cx="48" cy="27" r="14" fill={paint('navy')} /><path d="M25 78V65c0-13 10-23 23-23s23 10 23 23v13H25Z" fill={paint('cyan')} />
          <path d="M34 61c2-6 6-10 12-10" stroke="#cefff5" strokeWidth="4" strokeLinecap="round" /><path d="M41 75h14" stroke="#087699" strokeWidth="4" strokeLinecap="round" />
        </>}
        {kind === 'calendar' && <>
          <rect x="15" y="21" width="66" height="60" rx="12" fill="#fff" /><path d="M15 34c0-7 5-13 12-13h42c7 0 12 6 12 13v9H15v-9Z" fill={paint('coral')} />
          <path d="M31 15v14m34-14v14" stroke="#09235b" strokeWidth="6" strokeLinecap="round" />
          <rect x="25" y="52" width="10" height="9" rx="3" fill="#c6e9ed" /><rect x="43" y="52" width="10" height="9" rx="3" fill="#c6e9ed" /><rect x="25" y="67" width="10" height="7" rx="3" fill="#c6e9ed" />
          <circle cx="64" cy="65" r="16" fill={paint('gold')} /><path d="m57 65 5 5 9-10" stroke="#09235b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </>}
        {kind === 'watch' && <>
          <path d="m35 10-4 23v30l4 23h26l4-23V33l-4-23H35Z" fill={paint('cyan')} /><path d="M42 15h12M42 80h12" stroke="#d4fff7" strokeWidth="3" strokeLinecap="round" />
          <rect x="24" y="25" width="48" height="47" rx="15" fill={paint('navy')} /><rect x="29" y="30" width="38" height="37" rx="11" fill="#061a3d" />
          <path d="M73 40v10" stroke="#225781" strokeWidth="5" strokeLinecap="round" />
          <path d="M35 49h7l4-10 6 20 5-10h5" stroke="#69eddb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx="57" cy="38" r="3" fill="#ffbd39" />
        </>}
        {kind === 'nutrition' && <>
          <rect x="20" y="27" width="44" height="51" rx="10" fill={paint('navy')} /><rect x="19" y="19" width="46" height="14" rx="5" fill="#09235b" /><path d="M26 23h31" stroke="#3b6697" strokeWidth="3" strokeLinecap="round" />
          <rect x="20" y="42" width="44" height="23" fill={paint('cyan')} /><path d="M37 48h10v4h4v9H33v-9h4v-4Z" fill="#fff" opacity=".9" />
          <path d="M69 56c-1-12 5-19 15-23 3 13-1 23-15 23Z" fill="#26ad83" /><path d="m68 62 9-16" stroke="#087c69" strokeWidth="3" strokeLinecap="round" />
          <path d="M58 69h21l-4 13H62l-4-13Z" fill={paint('gold')} /><path d="M78 70h9" stroke="#d99a25" strokeWidth="4" strokeLinecap="round" />
        </>}
        {kind === 'strength' && <>
          <path d="m28 62 34-34" stroke="#b8dce3" strokeWidth="11" /><path d="m29 58 29-29" stroke="#f2ffff" strokeWidth="4" />
          <g transform="rotate(-45 48 48)"><rect x="14" y="37" width="9" height="22" rx="4" fill={paint('navy')} /><rect x="23" y="29" width="14" height="38" rx="5" fill={paint('cyan')} /><rect x="59" y="29" width="14" height="38" rx="5" fill={paint('cyan')} /><rect x="73" y="37" width="9" height="22" rx="4" fill={paint('navy')} /><path d="M28 36v22m36-22v22" stroke="#c8fff4" strokeWidth="3" strokeLinecap="round" /></g>
          <path d="m72 12 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" fill="#ffbd39" />
        </>}
        {kind === 'ticket' && <>
          <path d="M18 25h60a5 5 0 0 1 5 5v10a9 9 0 0 0 0 18v10a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5V58a9 9 0 0 0 0-18V30a5 5 0 0 1 5-5Z" fill={paint('gold')} />
          <path d="M64 29v40" stroke="#c37918" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" /><path d="m39 35 4 8 9 1-6 6 1 9-8-4-8 4 1-9-6-6 9-1 4-8Z" fill={paint('coral')} />
          <path d="M71 36h5m-5 8h5m-5 8h5m-5 8h5" stroke="#ad691d" strokeWidth="2" strokeLinecap="round" />
        </>}
      </g>
    </svg>
  );
}
