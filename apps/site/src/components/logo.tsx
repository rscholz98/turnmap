import { cn } from "@/lib/utils"

/** The turnmap mark: three turns fanning into tools. Same drawing as the favicon. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-7", className)}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="14" className="fill-foreground" />
      <path
        d="M32 20v6M28 24l-7 6M36 24l7 6M20 40l9 8M44 40l-9 8"
        className="stroke-background/60"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="32" cy="14" r="6" fill="#60a5fa" />
      <circle cx="18" cy="34" r="6" fill="#a78bfa" />
      <circle cx="46" cy="34" r="6" fill="#a78bfa" />
      <circle cx="32" cy="52" r="6" fill="#4ade80" />
    </svg>
  )
}
