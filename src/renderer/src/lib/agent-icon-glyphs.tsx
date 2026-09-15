import React from 'react'

export function PiIcon({ size = 14 }: { size?: number }): React.JSX.Element {
  // SVG sourced from pi.dev/favicon.svg — the π shape rendered in currentColor.
  // Why: className="text-current" opts out of shadcn's Select rule that forces
  // text-muted-foreground on any <svg> that lacks a text-* class.
  return (
    <svg
      height={size}
      width={size}
      viewBox="0 0 800 800"
      xmlns="http://www.w3.org/2000/svg"
      className="text-current"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M165.29 165.29 H517.36 V400 H400 V517.36 H282.65 V634.72 H165.29 Z M282.65 282.65 V400 H400 V282.65 Z"
      />
      <path fill="currentColor" d="M517.36 400 H634.72 V634.72 H517.36 Z" />
    </svg>
  )
}

export function OpenCodeIcon({ size = 14 }: { size?: number }): React.JSX.Element {
  // SVG geometry sourced from opencode.ai/favicon.svg's official 512 canvas.
  // Why: the branded fills are adapted to currentColor so the mark is visible
  // in both Orca themes, and keeping the square viewBox matches sibling glyphs.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="text-current"
    >
      <path d="M320 224V352H192V224H320Z" fill="currentColor" fillOpacity="0.28" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M384 416H128V96H384V416ZM320 160H192V352H320V160Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function AgentLetterIcon({
  letter,
  size = 14
}: {
  letter: string
  size?: number
}): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="text-current"
    >
      <rect width="14" height="14" rx="3" fill="currentColor" fillOpacity="0.2" />
      <text
        x="7"
        y="10.5"
        textAnchor="middle"
        fontSize="8.5"
        fill="currentColor"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {letter}
      </text>
    </svg>
  )
}
