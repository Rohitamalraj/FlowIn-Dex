"use client"

import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import React from "react"

// <CHANGE> Added error boundary component to catch React errors
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[v0] React Error Boundary caught error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong.</div>
    }

    return this.props.children
  }
}

// <CHANGE> Added client component for global error handling
function GlobalErrorHandler({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // <CHANGE> Global unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("[v0] Unhandled promise rejection caught:", event.reason)
      event.preventDefault() // Prevent the error from being logged as unhandled
    }

    // <CHANGE> Global error handler
    const handleError = (event: ErrorEvent) => {
      console.error("[v0] Global error caught:", event.error)
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection)
    window.addEventListener("error", handleError)

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
      window.removeEventListener("error", handleError)
    }
  }, [])

  return <>{children}</>
}

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ErrorBoundary>
      <GlobalErrorHandler>
        {/* <CHANGE> Added proper loading fallback instead of null */}
        <Suspense fallback={<div className="min-h-screen bg-black" />}>{children}</Suspense>
        {/* <CHANGE> Wrapped Analytics in error boundary */}
        <ErrorBoundary>
          <Analytics />
        </ErrorBoundary>
      </GlobalErrorHandler>
    </ErrorBoundary>
  )
}
