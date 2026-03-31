export default function HeroTextOverlay() {
  return (
    <div className="absolute top-30 md:top-48 left-8 z-10">
      <h1
        className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-wider mb-3.5 opacity-100"
        style={{
          fontFamily: "var(--font-montserrat)",
          color: "rgb(0, 0, 0)",
          WebkitTextStroke: "5px white",
          paintOrder: "stroke fill",
        }}
      >
        INDEX
      </h1>
      <p className="text-foreground font-mono text-sm md:text-base max-w-xs tracking-widest lg:text-base">
        Confidential Portfolio
        <br />
        Duels on Encrypted Data
      </p>
    </div>
  )
}
