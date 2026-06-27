import Link from "next/link";
import { getAllPosts } from "@/lib/blog";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Blog | FlipWhizz",
  description:
    "Insights on children, reading, and why the stories we tell our kids matter more than you think.",
  alternates: {
    canonical: "https://flipwhizz.com/blog",
  },
  openGraph: {
    title: "Blog | FlipWhizz",
    description:
      "Honest thoughts on children, stories, and why the books we give our kids matter more than we realise.",
    url: "https://flipwhizz.com/blog",
    siteName: "FlipWhizz",
    type: "website",
    locale: "en_GB",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://flipwhizz.com",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Blog",
      item: "https://flipwhizz.com/blog",
    },
  ],
};

export default async function BlogPage() {
  const session = await getServerSession(authOptions);
  const posts = getAllPosts();

  return (
    <main className="min-h-screen" style={{ background: "#FEFCFA" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <Header session={session} />

      {/* Header */}
      <div
        className="relative overflow-hidden px-6 py-20 text-center"
        style={{
          background: "linear-gradient(135deg, #2D2235, #4A2D5E, #D94590)",
        }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative">
          <p
            className="mb-3 text-sm font-semibold uppercase tracking-[0.2em]"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            From the FlipWhizz desk
          </p>
          <h1 className="font-serif text-4xl font-bold text-white lg:text-5xl">
            Words on Reading
          </h1>
          <p
            className="mx-auto mt-4 max-w-xl text-lg"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            Honest thoughts on children, stories, and why the books we give our
            kids matter more than we realise.
          </p>
        </div>
      </div>

      {/* Posts grid */}
      <div className="mx-auto max-w-4xl px-6 py-16">
        {posts.length === 0 ? (
          <p className="text-center" style={{ color: "#6B5D52" }}>
            No posts yet — check back soon.
          </p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block rounded-[22px] bg-white p-8 transition-all duration-200 hover:-translate-y-1"
                style={{
                  border: "1px solid #E8DDCF",
                  boxShadow: "0 4px 24px rgba(45,34,53,0.06)",
                }}
              >
                <p
                  className="mb-3 text-xs font-semibold uppercase tracking-[0.15em]"
                  style={{ color: "#D94590" }}
                >
                  <time dateTime={post.date}>
                    {new Date(post.date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                </p>
                <h2
                  className="mb-3 font-serif text-xl font-bold leading-snug transition-colors duration-200"
                  style={{ color: "#2D2235" }}
                >
                  <span className="transition-colors duration-200 group-hover:text-[#D94590]">
                    {post.title}
                  </span>
                </h2>
                <p
                  className="line-clamp-3 text-sm leading-relaxed"
                  style={{ color: "#6B5D52" }}
                >
                  {post.description}
                </p>
                <span
                  className="mt-5 inline-flex items-center gap-1 text-sm font-semibold transition-all group-hover:gap-2"
                  style={{ color: "#D94590" }}
                >
                  Read more <span>→</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}