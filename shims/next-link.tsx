import * as React from 'react'

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
}

export default function Link({ href, onClick, children, ...props }: LinkProps) {
  return (
    <a
      href={href}
      onClick={(e) => {
        if (onClick) onClick(e)
        if (!e.defaultPrevented && href === '/') {
          e.preventDefault()
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }}
      {...props}
    >
      {children}
    </a>
  )
}
