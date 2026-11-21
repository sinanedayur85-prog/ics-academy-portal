import Link from 'next/link'
import { AppUpdateButton } from '@/components/app-update-manager'
import { BrandLogoMark, BrandWordmark } from '@/components/brand-wordmark'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

const navLinks = [
  { label: 'About', href: '#about' },
  { label: 'Portal', href: '#portal' },
  { label: 'Contact', href: '#contact' },
]

export function SiteHeader() {
  return (
    <header className="absolute top-0 z-40 w-full bg-transparent pt-[var(--safe-top)] transition-colors duration-200">
      <div className="mx-auto flex h-16 sm:h-20 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 sm:gap-3 active:opacity-80" aria-label="ICS Academy Manhappatta home">
          <BrandLogoMark className="h-8 sm:h-11 w-auto shrink-0 md:h-12" />
          <BrandWordmark
            className="pt-[2px]"
            gapClassName="gap-[1px]"
            topClassName="translate-y-[1px] text-[15px] sm:text-lg font-bold text-[#009245] dark:text-[#89C53F] transition-colors duration-200 md:text-[19px] leading-none"
            bottomClassName="text-[8.5px] sm:text-[10px] font-semibold text-[#0077CC] transition-colors duration-200 dark:text-[#0095F6] md:text-[10.5px] leading-none"
          />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[#0F1419] transition-colors hover:text-[#0095F6] dark:text-white/85 dark:hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <AppUpdateButton />
          <ThemeToggle />
          <Button
            nativeButton={false}
            render={<a href="#portal" />}
            className="h-9 sm:h-10 rounded-full px-4 sm:px-5 text-xs sm:text-sm font-semibold"
          >
            Log in
          </Button>
        </div>
      </div>
    </header>
  )
}
