// The Kumite emblem, drawn for next/og's ImageResponse (no image files needed).
// Original art: a gold-ringed blood-red medallion with a carved K on dark stone.
export function Emblem({ size }: { size: number }) {
  const ring = Math.round(size * 0.05);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #2a1a15, #0d0706)",
      }}
    >
      <div
        style={{
          width: size * 0.8,
          height: size * 0.8,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `${ring}px solid #e9b64a`,
          background: "radial-gradient(circle at 50% 35%, #c4201a, #5c0606 70%)",
          boxShadow: `0 0 ${Math.round(size * 0.08)}px rgba(255, 96, 0, 0.55)`,
        }}
      >
        <div
          style={{
            fontSize: size * 0.5,
            fontWeight: 900,
            lineHeight: 1,
            color: "#f3cf6a",
            fontFamily: "serif",
            textShadow: `0 ${Math.max(1, Math.round(size * 0.02))}px 0 #3d0400`,
            marginTop: size * 0.02,
          }}
        >
          K
        </div>
      </div>
    </div>
  );
}
