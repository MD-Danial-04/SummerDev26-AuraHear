/**
 * @param {{ bearing: number, size: number, colors: { text: string, accent: string, muted: string, border: string, background: string } }} props
 */
export function Compass({ bearing, size, colors }) {
  const r = size / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`Compass bearing ${bearing} degrees`}
    >
      <circle cx={r} cy={r} r={r - 4} fill="none" stroke={colors.border} strokeWidth="3" />
      {[
        { label: 'N', x: r, y: 16, bold: true },
        { label: 'S', x: r, y: size - 6, bold: false },
        { label: 'E', x: size - 8, y: r + 5, bold: false },
        { label: 'W', x: 8, y: r + 5, bold: false },
      ].map(({ label, x, y, bold }) => (
        <text
          key={label}
          x={x}
          y={y}
          textAnchor="middle"
          fill={label === 'N' ? colors.accent : colors.muted}
          fontSize={size * 0.12}
          fontWeight={bold ? '900' : '600'}
        >
          {label}
        </text>
      ))}
      <g transform={`rotate(${bearing}, ${r}, ${r})`}>
        <polygon
          points={`${r},${r * 0.25} ${r - r * 0.12},${r} ${r},${r * 0.85} ${r + r * 0.12},${r}`}
          fill={colors.accent}
        />
        <polygon
          points={`${r},${r * 1.15} ${r - r * 0.12},${r} ${r},${r * 1.75} ${r + r * 0.12},${r}`}
          fill={colors.muted}
        />
        <circle cx={r} cy={r} r={r * 0.07} fill={colors.background} />
      </g>
    </svg>
  )
}
