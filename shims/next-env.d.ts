declare module 'next' {
  export type Metadata = Record<string, unknown>
  export type Viewport = Record<string, unknown>
}

declare module 'next/font/google' {
  export function El_Messiri(options: Record<string, unknown>): { variable: string; className: string }
  export function Poppins(options: Record<string, unknown>): { variable: string; className: string }
  export function Inter(options: Record<string, unknown>): { variable: string; className: string }
}

declare module '@vercel/analytics/next' {
  import * as React from 'react'
  export const Analytics: React.FC
}
