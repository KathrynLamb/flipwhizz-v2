import Link from 'next/link'
import { getAllPosts } from '@/lib/blog'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog | FlipWhizz',
  description: 'Insights on children, reading, and why the stories we tell our kids matter more than you think.',
}

export default function BlogPage() {
  const posts = getAllPosts()

  return (
    <main className="min-h-screen bg-[#F9F5FF]">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 px-6 py-20 text-center">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        />
        <div className="relative">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-purple-200">
            From the FlipWhizz desk
          </p>
          <h1 className="font-display text-4xl font-bold text-white md:text-5xl"
            style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            Words on Reading
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-purple-100">
            Honest thoughts on children, stories, and why the books we give our kids matter more than we realise.
          </p>
        </div>
      </div>

      {/* Posts grid */}
      <div className="mx-auto max-w-4xl px-6 py-16">
        {posts.length === 0 ? (
          <p className="text-center text-gray-500">No posts yet — check back soon.</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            {posts.map(post => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block rounded-[22px] bg-white p-8 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-purple-400">
                  {new Date(post.date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <h2 className="mb-3 text-xl font-bold leading-snug text-gray-900 group-hover:text-purple-600 transition-colors"
                  style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                  {post.title}
                </h2>
                <p className="text-sm leading-relaxed text-gray-500 line-clamp-3">
                  {post.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-purple-500 group-hover:gap-2 transition-all">
                  Read more <span>→</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}