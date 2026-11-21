import { BrandLogoMark, BrandWordmark } from '@/components/brand-wordmark'

export function SiteFooter() {
  return (
    <footer
      id="contact"
      className="bg-background font-sans text-sm text-muted-foreground transition-colors duration-200"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-6 py-12 md:flex-row">
        {/* Left Brand Group: [Icon + English Text] -> [Vertical Line] -> [Arabic Calligraphy] */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:flex-nowrap md:justify-start md:gap-8">
          <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
            <BrandLogoMark className="h-9 sm:h-11 w-auto shrink-0 md:h-12" />
            <BrandWordmark
              className="pt-[2px]"
              gapClassName="gap-[1px]"
              topClassName="translate-y-[1px] text-base sm:text-lg font-bold text-[#009245] transition-colors duration-200 md:text-[19px] leading-none"
              bottomClassName="text-[9.5px] sm:text-[10px] font-semibold text-[#0077CC] transition-colors duration-200 dark:text-[#0095F6] md:text-[10.5px] leading-none"
            />
          </div>

          <div
            aria-hidden="true"
            className="h-9 sm:h-10 w-px shrink-0 bg-foreground/15 md:h-11"
          />

          <div className="flex shrink-0 items-center">
            <img
              src="/calligraphy-black.png?v=5"
              alt="ICS Academy Arabic calligraphy"
              width={1928}
              height={342}
              decoding="async"
              className="block h-6 sm:h-[26px] w-auto object-contain md:h-[27px] dark:hidden"
            />
            <img
              src="/calligraphy-white.png?v=5"
              alt="ICS Academy Arabic calligraphy"
              width={1928}
              height={342}
              decoding="async"
              className="hidden h-6 sm:h-[26px] w-auto object-contain md:h-[27px] dark:block"
            />
          </div>
        </div>

        <address className="flex flex-col items-center justify-center gap-[6px] font-sans text-[13.5px] leading-none text-muted-foreground not-italic md:items-end md:text-right dark:text-[#8E9AA4]">
          <span className="block leading-none">Manjeri, Malappuram, Kerala, India, 676123</span>
          <a
            href="mailto:icsacademy@gmail.com"
            className="block leading-none text-muted-foreground transition-colors hover:text-[#0095F6] dark:hover:text-[#0095F6]"
          >
            icsacademy@gmail.com
          </a>
        </address>
      </div>

      <p className="py-6 text-center font-sans text-sm text-muted-foreground">
        {'© 2026 ICS Academy Manhappatta. All rights reserved.'}
      </p>
    </footer>
  )
}
