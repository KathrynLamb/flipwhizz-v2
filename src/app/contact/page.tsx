import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#0b0b10] text-white px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-white/60 hover:text-white text-sm">
          ← Back
        </Link>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight">
          Contact FlipWhizz
        </h1>
        <p className="mt-3 text-white/70">
          Need help, spotted a bug, or want something magical added? Email us and
          we’ll reply as soon as we can.
        </p>

        <div className="mt-8 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
          <div className="text-sm text-white/60">Email</div>
          <a
            className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 font-semibold text-black hover:bg-white/90 transition"
            href="mailto:support@aigifts.org?subject=FlipWhizz%20Support"
          >
            support@aigifts.org
          </a>

          <p className="mt-4 text-xs text-white/50">
            Tip: include your project ID + what you expected to happen.
          </p>
        </div>
      </div>
    </main>
  );
}
