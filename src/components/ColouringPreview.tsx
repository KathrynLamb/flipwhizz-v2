// src/components/ColouringPreview.tsx
//
// Side-by-side "their colouring page / the finished picture" preview.
//
// Until you have a real sample, it renders a simple drawn scene in both
// states so the section never shows a broken image. Once you've generated a
// real colouring page with the new feature, save the two files to
// /public/LandingPage/ and set the paths in COLOURING_SAMPLE below.

import Image from "next/image";

// Set both to real files, e.g. "/LandingPage/colouring-line.jpg" and
// "/LandingPage/colouring-colour.jpg". Leave as null to use the drawn fallback.
export const COLOURING_SAMPLE: { line: string | null; colour: string | null } = {
  line: null,
  colour: null,
};

const INK = "#2D2235";

function Scene({ coloured }: { coloured: boolean }) {
  const fill = (c: string) => (coloured ? c : "#FFFFFF");
  return (
    <svg viewBox="0 0 400 400" className="w-full h-full" role="img" aria-hidden="true">
      <rect x="0" y="0" width="400" height="400" fill={fill("#DDF1F8")} />
      {/* sun */}
      <circle cx="320" cy="80" r="38" fill={fill("#F7C948")} stroke={INK} strokeWidth="4" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r1 = 50, r2 = 66, rad = (a * Math.PI) / 180;
        return (
          <line key={a} x1={320 + r1 * Math.cos(rad)} y1={80 + r1 * Math.sin(rad)} x2={320 + r2 * Math.cos(rad)} y2={80 + r2 * Math.sin(rad)} stroke={INK} strokeWidth="4" strokeLinecap="round" />
        );
      })}
      {/* cloud */}
      <path d="M60 110 q0 -30 30 -30 q10 -25 40 -15 q25 -10 35 15 q25 0 25 25 q0 20 -25 20 h-85 q-20 0 -20 -15z" fill={fill("#FFFFFF")} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      {/* hills */}
      <path d="M0 300 Q100 220 210 290 T400 270 V400 H0Z" fill={fill("#8CCB7E")} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      {/* house */}
      <rect x="70" y="250" width="110" height="90" fill={fill("#F59AB8")} stroke={INK} strokeWidth="4" />
      <path d="M60 255 L125 195 L190 255Z" fill={fill("#A270C9")} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <rect x="110" y="290" width="30" height="50" fill={fill("#F7A93E")} stroke={INK} strokeWidth="4" />
      <rect x="82" y="268" width="22" height="22" fill={fill("#DDF1F8")} stroke={INK} strokeWidth="4" />
      <rect x="146" y="268" width="22" height="22" fill={fill("#DDF1F8")} stroke={INK} strokeWidth="4" />
      {/* kite */}
      <path d="M270 150 L300 190 L270 240 L240 190Z" fill={fill("#F2546A")} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <line x1="270" y1="150" x2="270" y2="240" stroke={INK} strokeWidth="3" />
      <line x1="240" y1="190" x2="300" y2="190" stroke={INK} strokeWidth="3" />
      <path d="M270 240 q-15 25 5 40 q20 15 0 40 q-10 15 -5 30" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      {/* flowers */}
      {[240, 330, 370].map((x, i) => (
        <g key={x}>
          <line x1={x} y1={350 - i * 6} x2={x} y2={378} stroke={INK} strokeWidth="4" />
          <circle cx={x} cy={344 - i * 6} r="11" fill={fill(["#F7A93E", "#F2546A", "#A270C9"][i])} stroke={INK} strokeWidth="4" />
        </g>
      ))}
    </svg>
  );
}

function Panel({ coloured, label }: { coloured: boolean; label: string }) {
  const src = coloured ? COLOURING_SAMPLE.colour : COLOURING_SAMPLE.line;
  return (
    <figure className="flex flex-col items-center gap-3">
      <div
        className="relative w-full aspect-square rounded-[18px] overflow-hidden bg-white"
        style={{ boxShadow: "0 18px 44px rgba(45,34,53,0.12), 0 0 0 1px rgba(45,34,53,0.06)" }}
      >
        {src ? (
          <Image src={src} alt={label} fill className="object-cover" />
        ) : (
          <Scene coloured={coloured} />
        )}
      </div>
      <figcaption className="text-sm font-semibold tracking-wide" style={{ color: "#6B5D52" }}>
        {label}
      </figcaption>
    </figure>
  );
}

export default function ColouringPreview({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-4 sm:gap-8 ${className}`}>
      <Panel coloured={false} label="The page you print" />
      <Panel coloured label="The page they finish" />
    </div>
  );
}
