"use client"

import { Banner } from "@/components/ui/banner"
import { ArrowRight } from "lucide-react"
import { useState } from "react"

const MCPLogo = ({ className, size = 16 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 180 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <g clipPath="url(#clip0_19_13)">
      <path d="M18 84.8528L85.8822 16.9706C95.2548 7.59798 110.451 7.59798 119.823 16.9706V16.9706C129.196 26.3431 129.196 41.5391 119.823 50.9117L68.5581 102.177" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
      <path d="M69.2652 101.47L119.823 50.9117C129.196 41.5391 144.392 41.5391 153.765 50.9117L154.118 51.2652C163.491 60.6378 163.491 75.8338 154.118 85.2063L92.7248 146.6C89.6006 149.724 89.6006 154.789 92.7248 157.913L105.331 170.52" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
      <path d="M102.853 33.9411L52.6482 84.1457C43.2756 93.5183 43.2756 108.714 52.6482 118.087V118.087C62.0208 127.459 77.2167 127.459 86.5893 118.087L136.794 67.8822" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
    </g>
    <defs>
      <clipPath id="clip0_19_13">
        <rect width="180" height="180" fill="white" />
      </clipPath>
    </defs>
  </svg>
)

export function MCPBanner() {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  return (
    <Banner
      variant="muted"
      className="dark text-foreground border-b border-border/50 z-50 relative"
      isClosable
      onClose={() => setIsVisible(false)}
    >
      <div className="flex w-full items-center gap-2 sm:gap-3 min-w-0">
        <MCPLogo
          className="shrink-0 opacity-80 hidden sm:block"
          size={18}
        />
        <MCPLogo
          className="shrink-0 opacity-80 sm:hidden"
          size={14}
        />
        <div className="flex flex-row flex-1 min-w-0 gap-2 sm:gap-3 items-center justify-between">
          <p className="text-[11px] sm:text-sm truncate font-medium">
            <span className="hidden sm:inline">Unleash PortScope's power to your AI agents with our new native Model Context Protocol (MCP) server (v1.7.0) 🚀</span>
            <span className="sm:hidden">Native MCP server for your AI agents (v1.7.0) 🚀</span>
          </p>
          <a
            href="https://github.com/Neilblaze/portscope#mcp-server-support"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center whitespace-nowrap text-[10px] sm:text-xs font-semibold shrink-0 bg-white/90 text-zinc-900 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 hover:bg-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-sm transition-all border border-black/5 dark:border-white/10 w-fit"
          >
            <span className="hidden sm:inline">Learn more</span>
            <span className="sm:hidden">Docs</span>
            <ArrowRight
              className="mt-0 ms-1 inline-flex transition-transform group-hover:translate-x-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5"
              strokeWidth={2}
              aria-hidden="true"
            />
          </a>
        </div>
      </div>
    </Banner>
  )
}
