import { BrandLogoMark, BrandWordmark } from '@/components/brand-wordmark'

export function SiteFooter() {
  return (
    <footer
      id="contact"
      className="border-t border-border bg-background font-sans text-sm text-emerald-950/80 transition-colors duration-300 dark:text-gray-400"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-6 py-12 md:flex-row">
        {/* Left Brand Group: [Icon + English Text] -> [Vertical Line] -> [Arabic Calligraphy] */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:flex-nowrap md:justify-start md:gap-8">
          {/* 1. Water Drop Icon + English Text ("ICS ACADEMY MANHAPPATTA") — exact same size as SiteHeader */}
          <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
            <BrandLogoMark className="h-9 sm:h-11 w-auto shrink-0 md:h-12" />
            <BrandWordmark
              gapClassName="gap-0"
              topClassName="text-base sm:text-lg font-bold text-emerald-950 transition-colors duration-300 dark:text-white md:text-[19px] leading-none"
              bottomClassName="-mt-[2px] text-[9.5px] sm:text-[10px] font-semibold text-emerald-900 transition-colors duration-300 dark:text-emerald-400 md:text-[10.5px] leading-none"
            />
          </div>

          {/* 2. Vertical Divider Line */}
          <div
            aria-hidden="true"
            className="h-9 sm:h-10 w-px shrink-0 bg-gray-300 md:h-11 dark:bg-gray-600"
          />

          {/* 3. Arabic Calligraphy (matched to the height of ICS ACADEMY + MANHAPPATTA) */}
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

        {/* Right Side: Contact Info (aligned top-to-bottom with ICS ACADEMY + MANHAPPATTA) */}
        <address className="flex flex-col items-center justify-center gap-[5px] font-sans text-[13px] leading-none text-emerald-950/80 not-italic md:items-end md:text-right md:text-[13.5px] dark:text-gray-400">
          <span className=" block leading-none">Manjeri, Malappuram, Kerala, India, 676123</span>
          <a
            href="mailto:icsacademy@gmail.com"
            className="block leading-none text-emerald-950/80 transition-colors hover:text-cyan hover:underline dark:text-gray-400 dark:hover:text-cyan"
          >
            icsacademy@gmail.com
          </a>
        </address>
      </div>

      <p className="border-t border-border py-6 text-center font-sans text-sm text-emerald-950/80 dark:text-gray-400">
        {'© 2026 ICS Academy Manhappatta. All rights reserved.'}
      </p>
    </footer>
  )
}
