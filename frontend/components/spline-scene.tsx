"use client"

import { Suspense, useState } from "react"
import Spline from "@splinetool/react-spline"

export default function SplineScene() {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleLoad = () => {
    console.log("[v0] Spline scene loaded successfully")
    setIsLoading(false)
    setHasError(false)
  }

  const handleError = (error: any) => {
    console.log("[v0] Spline scene failed to load:", error)
    setIsLoading(false)
    setHasError(true)
  }

  return (
    <div className="flow-spline-scene absolute inset-0 w-full h-full bg-background overflow-hidden">
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center">
          <div className="text-foreground text-center">
            <div className="text-lg mb-2">Loading 3D Scene...</div>
            <div className="text-sm opacity-70">Please wait</div>
          </div>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center">
          <div className="text-foreground text-center">
            <div className="text-lg mb-2">3D Scene Unavailable</div>
            <div className="text-sm opacity-70">Unable to load the 3D model</div>
          </div>
        </div>
      )}

      {/* Spline Scene */}
      {!hasError && (
        <Suspense fallback={null}>
          <Spline
            scene="https://prod.spline.design/l8gr6AhxxCqDIdBx/scene.splinecode"
            onLoad={handleLoad}
            onError={handleError}
            style={{
              width: "100%",
              height: "100%",
              background: "transparent",
            }}
          />
        </Suspense>
      )}

      <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border border-border/80 bg-background/75 px-3 py-1.5 backdrop-blur-md">
        <img src="/flow_logo.jpg" alt="Flow logo" className="h-5 w-5 rounded-full object-cover" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/85">Built with Flow</span>
      </div>
    </div>
  )
}
