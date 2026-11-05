const paths = {
  upload: ['M12 16V3m-5 5 5-5 5 5', 'M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5'],
  file: ['M14 2H5v20h14V7z', 'M14 2v5h5', 'M8 12h8M8 16h5'],
  arrow: ['M5 12h14m-6-6 6 6-6 6'],
  external: ['M14 3h7v7m0-7L10 14', 'M10 3H3v18h18v-7'],
  check: ['m5 12 4 4L19 6'],
  alert: ['M12 3 2 21h20z', 'M12 9v5m0 3v.1'],
  download: ['M12 3v12m-5-5 5 5 5-5', 'M4 16v5h16v-5'],
  qr: ['M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3z', 'M15 15h3v3h3v3h-6zm6-3v3M12 3v3M3 12h3m6 0v9'],
  close: ['m6 6 12 12M6 18 18 6'],
  layers: ['m12 3 10 5-10 5L2 8z', 'm2 12 10 5 10-5M2 16l10 5 10-5'],
}

export function Icon({ name, size = 20 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" className="icon">
      {paths[name].map((path) => <path key={path} d={path} />)}
    </svg>
  )
}
