import {
  Check,
  Palette as PaletteIcon,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { PALETTE_KEYS } from "turnmap"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { usePalettes } from "@/palettes"

type Palettes = ReturnType<typeof usePalettes>

function Swatches({ colors }: { colors: Record<string, string> }) {
  return (
    <span className="flex gap-0.5">
      {["user", "response", "toolCall", "toolReturn", "retry"].map((k) => (
        <span
          key={k}
          className="size-2.5 rounded-sm"
          style={{ background: colors[k] }}
        />
      ))}
    </span>
  )
}

export function PaletteMenu({ palettes }: { palettes: Palettes }) {
  const {
    active,
    saved,
    presets,
    setActive,
    setColor,
    save,
    remove,
    isDefault,
  } = palettes
  const [name, setName] = useState("")

  const isActive = (p: Record<string, string>) =>
    JSON.stringify(p) === JSON.stringify(active)

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Color palette">
              <PaletteIcon />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Color palette</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-80">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Node colors
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={isDefault}
            onClick={() => setActive(presets[0].palette)}
          >
            <RotateCcw /> Reset
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {PALETTE_KEYS.map(({ key, label }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 text-xs"
            >
              <input
                type="color"
                value={active[key]}
                onChange={(e) => setColor(key, e.target.value)}
                className="size-6 cursor-pointer rounded-md border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border [&::-webkit-color-swatch-wrapper]:p-0"
                aria-label={label}
              />
              <span className="truncate">{label}</span>
            </label>
          ))}
        </div>

        <div className="mt-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Presets
        </div>
        <ul className="mt-1 flex flex-col gap-0.5">
          {presets.map((p) => (
            <li key={p.name}>
              <button
                type="button"
                onClick={() => setActive(p.palette)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-accent",
                  isActive(p.palette) && "bg-accent"
                )}
              >
                <span className="flex items-center gap-2">
                  <Swatches colors={p.palette} /> {p.name}
                </span>
                {isActive(p.palette) && <Check className="size-3.5" />}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Saved
        </div>
        {saved.length === 0 ? (
          <p className="mt-1 px-2 text-xs text-muted-foreground">
            Nothing saved yet.
          </p>
        ) : (
          <ul className="mt-1 flex flex-col gap-0.5">
            {saved.map((p) => (
              <li key={p.id} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => setActive(p.palette)}
                  className={cn(
                    "flex min-w-0 flex-1 cursor-pointer items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-accent",
                    isActive(p.palette) && "bg-accent"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Swatches colors={p.palette} />{" "}
                    <span className="truncate">{p.name}</span>
                  </span>
                  {isActive(p.palette) && (
                    <Check className="size-3.5 shrink-0" />
                  )}
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => remove(p.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="mt-2 flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            save(name.trim())
            setName("")
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Save current as…"
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!name.trim()}
          >
            <Save /> Save
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
