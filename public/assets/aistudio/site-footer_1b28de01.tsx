import Image from 'next/image'
import { BrandWordmark } from '@/components/brand-wordmark'

export function SiteFooter() {
  return (
    <footer id="contact" className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-12 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/images/ics-mark-transparent.png"
            alt=""
            width={381}
            height={512}
            className="h-11 w-auto bg-transparent object-contain md:h-12"
          />
          <BrandWordmark
            gapClassName="gap-[2px]"
            topClassName="text-lg font-bold text-foreground md:text-xl leading-none"
            bottomClassName="text-[0.7rem] font-semibold text-lime md:text-xs leading-none"
          />
        </div>
        <address className="flex flex-col gap-1 text-sm text-muted-foreground not-italic md:text-right">
          <span>Manhappatta Campus</span>
          <a href="mailto:office@icsacademy.edu" className="text-cyan hover:underline">
            office@icsacademy.edu
          </a>
        </address>
      </div>
      <p className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        {'© 2026 ICS Academy Manhappatta. All rights reserved.'}
      </p>
    </footer>
  )
}
