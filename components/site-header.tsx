import Image from 'next/image'
import Link from 'next/link'
import { BrandWordmark } from '@/components/brand-wordmark'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

const navLinks = [
  { label: 'About', href: '#about' },
  { label: 'Portal', href: '#portal' },
  { label: 'Contact', href: '#contact' },
]

export function SiteHeader() {
  return (
    <header className="absolute top-0 z-50 w-full border-b border-black/15 bg-transparent transition-colors duration-300 dark:border-white/20">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="ICS Academy Manhappatta home">
          <Image
            src="/images/ics-mark-transparent.png"
            alt="ICS Academy logo"
            width={381}
            height={512}
            className="h-11 w-auto bg-transparent object-contain md:h-12"
            priority
          />
          <BrandWordmark
            gapClassName="gap-0"
            topClassName="text-lg font-bold text-black transition-colors duration-300 dark:text-white md:text-[19px] leading-none"
            bottomClassName="-mt-[2px] text-[10px] font-semibold text-emerald-900 transition-colors duration-300 dark:text-emerald-400 md:text-[10.5px] leading-none"
          />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-black transition-colors hover:text-black/70 dark:text-white/85 dark:hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            nativeButton={false}
            render={<a href="#portal" />}
            className="h-10 rounded-full px-5 font-semibold"
          >
            Log in
          </Button>
        </div>
      </div>
    </header>
  )
}
