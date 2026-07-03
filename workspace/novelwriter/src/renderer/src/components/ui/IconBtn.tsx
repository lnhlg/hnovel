import React from 'react'

interface IconBtnProps {
  children: React.ReactNode
  onClick?: () => void
  title?: string
  className?: string
  disabled?: boolean
  size?: number
}

export function IconBtn({ children, onClick, title, className = '', disabled, size }: IconBtnProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`icon-btn ${className}`}
      style={size ? { width: size, height: size } : undefined}
    >
      {children}
    </button>
  )
}
