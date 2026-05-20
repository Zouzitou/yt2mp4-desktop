interface Props {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}

export default function Toggle({ checked, onChange, disabled }: Props) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        position: 'relative',
        width: 40,
        height: 22,
        borderRadius: 99,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked
          ? 'linear-gradient(135deg, #8b5cf6, #6366f1, #3b82f6)'
          : 'var(--surface-elevated)',
        boxShadow: checked ? '0 2px 8px rgba(99,102,241,0.35)' : 'none',
        transition: 'background 180ms ease, box-shadow 180ms ease',
        outline: 'none',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: checked ? '#fff' : 'var(--text-tertiary)',
          transition: 'left 180ms cubic-bezier(0.34, 1.56, 0.64, 1), background 180ms ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}
