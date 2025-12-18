/**
 * FinSight Logo Component
 *
 * Minimal, aesthetic logo with:
 * - Concentric circles representing focus/insight
 * - Spark element representing the "aha" moment
 * - Clean typography with weight contrast
 *
 * Usage:
 *   <Logo />                    - Full logo with text
 *   <Logo iconOnly />           - Just the icon
 *   <Logo size="sm" />          - Small size
 *   <Logo className="..." />    - Custom styling
 */

export function Logo({ iconOnly = false, size = "md", className = "" }) {
  const sizes = {
    sm: { icon: 24, text: 14, gap: 8, height: 24 },
    md: { icon: 32, text: 18, gap: 10, height: 32 },
    lg: { icon: 40, text: 22, gap: 12, height: 40 },
  };

  const s = sizes[size] || sizes.md;

  return (
    <div
      className={`flex items-center gap-[${s.gap}px] ${className}`}
      style={{ gap: s.gap }}
    >
      {/* Icon Mark */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 40 40"
        fill="none"
        className="flex-shrink-0"
      >
        {/* Outer glow ring */}
        <circle
          cx="20"
          cy="20"
          r="17"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.1"
        />

        {/* Middle ring */}
        <circle
          cx="20"
          cy="20"
          r="12"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.3"
        />

        {/* Core circle - the lens */}
        <circle cx="20" cy="20" r="6" stroke="currentColor" strokeWidth="2" />

        {/* Center dot */}
        <circle cx="20" cy="20" r="1.5" fill="currentColor" />

        {/* Insight spark */}
        <path
          d="M27 13 L32 8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="34" cy="6" r="2.5" fill="currentColor" />
      </svg>

      {/* Wordmark */}
      {!iconOnly && (
        <span
          className="font-medium tracking-tight text-[var(--color-text-primary)]"
          style={{ fontSize: s.text }}
        >
          <span className="font-semibold">Fin</span>
          <span className="font-light opacity-80">Sight</span>
        </span>
      )}
    </div>
  );
}

/**
 * Animated Logo - for loading states or hero sections
 */
export function LogoAnimated({ size = "lg" }) {
  return (
    <div className="relative">
      <Logo size={size} iconOnly />

      {/* Pulsing ring animation */}
      <div
        className="absolute inset-0 rounded-full border border-current opacity-20 animate-ping"
        style={{ animationDuration: "2s" }}
      />
    </div>
  );
}

export default Logo;
