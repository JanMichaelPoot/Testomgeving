// The recurring "window frame" motif: several panels behind one frame, each
// hinting at a different kind of possibility (a trail, a quiet room, a
// starlit night, a city). Built as SVG shapes rather than photos so the
// visual stays crisp, on-brand, and dependency-free.
export function PossibilityWindow() {
  return (
    <svg
      viewBox="0 0 600 480"
      className="h-auto w-full"
      role="img"
      aria-label="A window opening onto four different possibilities: a mountain trail, a cozy reading nook, a starlit forest, and a city street."
    >
      <defs>
        <linearGradient id="panel-trail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0E9FB" />
          <stop offset="100%" stopColor="#CBB6EE" />
        </linearGradient>
        <linearGradient id="panel-nook" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F6DFC2" />
          <stop offset="100%" stopColor="#E7B583" />
        </linearGradient>
        <linearGradient id="panel-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2C2557" />
          <stop offset="100%" stopColor="#1A1A2E" />
        </linearGradient>
        <linearGradient id="panel-city" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C5CD9" />
          <stop offset="100%" stopColor="#4B2AA6" />
        </linearGradient>
        <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="14"
            stdDeviation="18"
            floodColor="#1A1A2E"
            floodOpacity="0.16"
          />
        </filter>
        <clipPath id="frame-clip">
          <rect x="24" y="24" width="552" height="384" rx="12" />
        </clipPath>
      </defs>

      {/* sill */}
      <rect
        x="8"
        y="424"
        width="584"
        height="20"
        rx="6"
        fill="#FFFFFF"
        filter="url(#soft-shadow)"
      />

      {/* frame casing */}
      <rect
        x="8"
        y="8"
        width="584"
        height="416"
        rx="18"
        fill="#FFFFFF"
        filter="url(#soft-shadow)"
      />

      <g clipPath="url(#frame-clip)">
        {/* panel 1 — mountain trail */}
        <g>
          <rect x="24" y="24" width="138" height="384" fill="url(#panel-trail)" />
          <path
            d="M24 300 L70 220 L100 260 L140 190 L162 240 L162 408 L24 408 Z"
            fill="#8F73CC"
            opacity="0.55"
          />
          <path
            d="M40 340 C 70 320, 90 360, 130 330"
            stroke="#4B2AA6"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            opacity="0.6"
          />
          <circle cx="95" cy="325" r="5" fill="#1A1A2E" />
        </g>

        {/* panel 2 — cozy reading nook */}
        <g>
          <rect x="162" y="24" width="138" height="384" fill="url(#panel-nook)" />
          {[0, 1, 2].map((row) => (
            <rect
              key={row}
              x="176"
              y={60 + row * 34}
              width="60"
              height="26"
              rx="2"
              fill="#1A1A2E"
              opacity="0.18"
            />
          ))}
          <rect x="250" y="300" width="34" height="60" rx="2" fill="#1A1A2E" opacity="0.25" />
          <circle cx="267" cy="292" r="8" fill="#F5F3EE" opacity="0.8" />
        </g>

        {/* panel 3 — starlit forest */}
        <g>
          <rect x="300" y="24" width="138" height="384" fill="url(#panel-night)" />
          {[
            [318, 60],
            [345, 100],
            [400, 70],
            [420, 130],
            [330, 160],
            [410, 200],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={i % 2 === 0 ? 2 : 1.4} fill="#F5F3EE" />
          ))}
          <path d="M300 408 L330 330 L350 380 L370 300 L395 360 L410 320 L438 408 Z" fill="#12112090" />
        </g>

        {/* panel 4 — city street */}
        <g>
          <rect x="438" y="24" width="138" height="384" fill="url(#panel-city)" />
          <rect x="450" y="220" width="36" height="188" fill="#1A1A2E" opacity="0.3" />
          <rect x="494" y="180" width="30" height="228" fill="#1A1A2E" opacity="0.35" />
          <rect x="532" y="240" width="34" height="168" fill="#1A1A2E" opacity="0.3" />
          {Array.from({ length: 6 }).map((_, i) => (
            <rect
              key={i}
              x={458 + (i % 2) * 12}
              y={240 + Math.floor(i / 2) * 28}
              width="8"
              height="10"
              fill="#F5F3EE"
              opacity="0.7"
            />
          ))}
          <circle cx="500" cy="392" r="6" fill="#1A1A2E" opacity="0.5" />
          <circle cx="520" cy="392" r="6" fill="#1A1A2E" opacity="0.5" />
        </g>
      </g>

      {/* mullions */}
      {[162, 300, 438].map((x) => (
        <rect key={x} x={x - 3} y="24" width="6" height="384" fill="#FFFFFF" />
      ))}
      <rect x="24" y="24" width="552" height="384" rx="12" fill="none" stroke="#FFFFFF" strokeWidth="6" />
    </svg>
  );
}
