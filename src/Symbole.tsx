// Kleine Strichsymbole, damit die Oberfläche ohne Emoji auskommt.

const strich = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const Nadel = ({ groesse = 15 }: { groesse?: number }) => (
  <svg width={groesse} height={groesse} viewBox="0 0 24 24" {...strich}>
    <path d="M12 17v5" />
    <path d="M9 10.8V5h6v5.8l2.4 3.2H6.6z" />
    <path d="M8 3h8" />
  </svg>
)

export const Lupe = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...strich}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
)

export const Haken = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...strich} strokeWidth={2.4}>
    <path d="M5 12l5 5 9-10" />
  </svg>
)

export const Warnung = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...strich}>
    <path d="M12 3l10 18H2z" />
    <path d="M12 10v5" />
    <path d="M12 18h.01" />
  </svg>
)

export const Winkel = ({ offen = false }: { offen?: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" {...strich} style={{ transform: offen ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }}>
    <path d="M9 6l6 6-6 6" />
  </svg>
)

export const Abwaerts = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" {...strich}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)

export const Kasten = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" {...strich}>
    <rect x="3" y="5" width="18" height="14" rx="1" />
    <path d="M3 9h18" />
  </svg>
)

export const Bibliothek = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" {...strich}>
    <path d="M3 21h18" />
    <path d="M5 21V10l7-5 7 5v11" />
    <path d="M9 21v-6h6v6" />
  </svg>
)

export const Blatt = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...strich}>
    <path d="M6 2h9l5 5v15H6z" />
    <path d="M14 2v6h6" />
  </svg>
)

/** Status-Punkt: gefüllt = fest, gestrichelt = vorläufig */
export const StatusPunkt = ({ status }: { status: 'fest' | 'vorlaeufig' }) => (
  <span className={`punkt ${status}`} role="img" aria-label={status === 'fest' ? 'fest angelegt' : 'vorläufig'} />
)
