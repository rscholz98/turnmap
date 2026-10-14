import Prism from "prismjs"
import "prismjs/components/prism-bash"
import "prismjs/components/prism-jsx"
import "prismjs/components/prism-typescript"
import "prismjs/components/prism-tsx"
import { Check, Copy } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CopyButton({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn("absolute top-1.5 right-1.5", className)}
      aria-label="Copy"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  )
}

/** Syntax-highlighted, copyable code block for the site (not the library). */
export function Code({
  code,
  language,
  className,
}: {
  code: string
  language: "tsx" | "bash" | "json"
  className?: string
}) {
  const html = useMemo(
    () => Prism.highlight(code, Prism.languages[language], language),
    [code, language]
  )
  return (
    <div className="relative">
      <pre
        className={cn(
          "overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed",
          className
        )}
      >
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
      <CopyButton text={code} />
    </div>
  )
}
