import Image from 'next/image'
import Link from 'next/link'
import { BrandWordmark } from '@/components/brand-wordmark'
import { Button } from '@/components/ui/button'

const navLinks = [
  { label: 'About', href: '#about' },
  { label: 'Portal', href: '#portal' },
  { label: 'Contact', href: '#contact' },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
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
            gapClassName="gap-[2px]"
            topClassName="text-lg font-bold text-foreground md:text-xl leading-none"
            bottomClassName="text-[0.7rem] font-semibold text-lime md:text-xs leading-none"
          />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Button
          nativeButton={false}
          render={<a href="#portal" />}
          className="h-10 rounded-full px-5 font-semibold"
        >
          Sign in
        </Button>
      </div>
    </header>
  )
}
