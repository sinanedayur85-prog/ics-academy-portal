import * as React from 'react'

type ImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean
  fill?: boolean
}

export default function Image({ priority, fill, style, ...props }: ImageProps) {
  return (
    <img
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      style={
        fill
          ? {
              position: 'absolute',
              height: '100%',
              width: '100%',
              inset: 0,
              ...style,
            }
          : style
      }
      {...props}
    />
  )
}
