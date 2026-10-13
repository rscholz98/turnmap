import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Every library utility carries the `tm:` prefix (see styles.css); tell
// tailwind-merge so conflicting classes still collapse correctly.
const twMerge = extendTailwindMerge({ prefix: "tm" })

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
