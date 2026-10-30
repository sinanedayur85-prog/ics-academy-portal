import { cn } from '@/lib/utils'

type BrandWordmarkProps = {
  as?: 'div' | 'h1'
  className?: string
  topClassName?: string
  bottomClassName?: string
  gapClassName?: string
}

const SUBTITLE = 'MANHAPPATTA'

export function BrandWordmark({
  as: Tag = 'div',
  className,
  topClassName,
  bottomClassName,
  gapClassName = 'gap-0.5',
}: BrandWordmarkProps) {
  return (
    <Tag className={cn('inline-flex w-max flex-col font-display', gapClassName, className)}>
      {/* El Messiri glyphs carry side bearings (I and M start ~0.078em inside their box, final A overhangs ~0.03em), so em offsets align the visible ink edges. */}
      <span className={cn('-ml-[0.078em] block leading-none', topClassName)}>ICS ACADEMY</span>
      <span className="sr-only">{SUBTITLE}</span>
      <span
        aria-hidden="true"
        className={cn('flex w-full justify-between leading-none', bottomClassName)}
      >
        {SUBTITLE.split('').map((letter, index, letters) => (
          <span
            key={index}
            className={cn(
              index === 0 && '-ml-[0.078em]',
              index === letters.length - 1 && 'mr-[0.03em]',
            )}
          >
            {letter}
          </span>
        ))}
      </span>
    </Tag>
  )
}
