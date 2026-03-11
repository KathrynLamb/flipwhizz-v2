import { getPostBySlug, getAllPosts } from '@/lib/blog'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Metadata } from 'next'
import BlogCTA from '@/components/BlogCTA'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const posts = getAllPosts()
  return posts.map(post => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}
  return {
    title: `${post.title} | FlipWhizz Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  return (
    <main className="min-h-screen bg-[#F9F5FF]">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 px-6 py-20">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <Link
            href="/blog"
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-purple-200 hover:text-white transition-colors"
          >
            ← Back to blog
          </Link>
          <h1
            className="mt-4 text-3xl font-bold leading-tight text-white md:text-5xl"
            style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}
          >
            {post!.title}
          </h1>
          <div className="mt-6 flex items-center justify-center gap-3 text-sm text-purple-200">
            <span>{post!.author}</span>
            <span>·</span>
            <span>
              {new Date(post!.date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Article body */}
      <div className="mx-auto max-w-2xl px-6 py-16">
        <article
          className="prose prose-lg prose-purple max-w-none
            prose-headings:font-bold prose-headings:text-gray-900
            prose-p:text-gray-700 prose-p:leading-relaxed
            prose-strong:text-gray-900
            prose-a:text-purple-600 prose-a:no-underline hover:prose-a:underline
            prose-hr:border-purple-100"
          style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}
        >
          <MDXRemote source={post!.content} />
        </article>

        {/* CTA — client component, fetches its own session */}
        <BlogCTA />

        {/* Back link */}
        <div className="mt-10 text-center">
          <Link
            href="/blog"
            className="text-sm font-semibold text-purple-500 hover:text-purple-700 transition-colors"
          >
            ← More from the blog
          </Link>
        </div>
      </div>
    </main>
  )
}