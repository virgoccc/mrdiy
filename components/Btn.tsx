// components/Btn.tsx
export default function Btn({ children, onClick, outline, dark, sm, disabled }: {
  children: React.ReactNode
  onClick?: () => void
  outline?: boolean
  dark?: boolean
  sm?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg font-extrabold uppercase tracking-wide transition-all"
      style={{
        padding: sm ? '5px 12px' : '8px 18px',
        fontSize: sm ? '11px' : '13px',
        fontFamily: '"Barlow Condensed",sans-serif',
        background: outline ? 'transparent' : dark ? '#1A1A1A' : '#FFD600',
        color: outline ? '#3A3A38' : dark ? '#fff' : '#1A1A1A',
        border: outline ? '1.5px solid #CCC9B5' : 'none',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}
