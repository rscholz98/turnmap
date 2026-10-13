import type { ButtonHTMLAttributes } from "react"

import { cn } from "../cn"

export function IconButton({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "tm:inline-flex tm:h-6 tm:w-6 tm:cursor-pointer tm:items-center tm:justify-center tm:rounded-md tm:border-0 tm:bg-transparent tm:p-0 tm:text-muted-foreground tm:transition-colors tm:hover:bg-muted tm:hover:text-foreground tm:focus-visible:outline-2 tm:focus-visible:outline-ring tm:disabled:pointer-events-none tm:disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}
