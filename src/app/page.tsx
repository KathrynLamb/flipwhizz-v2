// src/app/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Link from "next/link";
import Image from "next/image";
import { Playfair_Display, Lato } from "next/font/google";
import HeroButton from "@/components/HeroButton"; 
import Header from "@/components/Header"; // 👈 IMPORT HERE
import { db } from "@/db"; 
import { projects } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

const playfair = Playfair_Display({ 
  subsets: ["latin"], 
  variable: "--font-serif",
  weight: ["400", "700", "900"]
});

const lato = Lato({ 
  subsets: ["latin"], 
  variable: "--font-sans",
  weight: ["400", "700"]
});

export default async function Home() {
  const session = await getServerSession(authOptions);

  // Check if user has projects
  let hasProjects = false;
  if (session?.user?.id) {
    const userProjects = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.userId, session.user.id));
    
    hasProjects = userProjects[0].count > 0;
  }

  return (
    <main className={`min-h-screen ${playfair.variable} ${lato.variable} font-sans bg-[#FDF8F0] text-slate-900 overflow-x-hidden`}>
      
      {/* 
        ========================================
        HERO SECTION
        ========================================
      */}
      <section className="relative w-full min-h-[95vh] flex flex-col">
        
        {/* 1. BACKGROUND IMAGE */}
        <div className="absolute inset-0 z-0">
            <Image 
              src="/LandingPage/hero-forestv2.jpeg" 
              alt="Magical forest background"
              fill
              priority
              className="object-cover object-[center_60%] md:object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-[#0F2236]/80"></div>
        </div>

        {/* 2. NAVBAR (Replaced with Component) */}
        <Header session={session} /> 

        {/* 3. HERO CONTENT ... (Rest remains same) */}
        <div className="relative z-10 flex-grow flex flex-col justify-center items-center text-center px-4 pb-32 md:pb-40 pt-10">
            <div className="max-w-4xl space-y-8 animate-fade-in-up">
                <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-[#FDF8F0] leading-[1.1] drop-shadow-2xl">
                    Turn Their Inner World <br/>
                    <span className="text-[#F4A261]">Into a Tangible Tale</span>
                </h1>
                
                <p className="mx-auto text-lg md:text-2xl text-[#FDF8F0]/90 max-w-2xl font-light leading-relaxed drop-shadow-lg">
                    Beautifully illustrated, deeply personal storybooks created from your child’s favorite things, quirks, and dreams.
                </p>

                <div className="flex justify-center pt-4">
                   <HeroButton session={session} hasProjects={hasProjects} />
                </div>
            </div>
        </div>

        {/* 4. CURVED DIVIDER (Wave) */}
        <div className="absolute bottom-[-1px] left-0 w-full overflow-hidden leading-none z-20">
            <svg className="relative block w-[calc(100%+1.3px)] h-[60px] md:h-[120px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="#FDF8F0" transform="scale(1, -1) translate(0, -120)"></path>
            </svg>
        </div>
      </section>

      {/* ... Rest of your sections (How It Works, Gallery, Footer) ... */}
      {/* Be sure to keep them as they were in your code */}
      {/* ... */}
      
      <section id="how-it-works" className="relative py-24 px-6 md:px-12 bg-[#FDF8F0]">
        {/* ... content ... */}
        {/* Just pasting the rest of your original code here to complete the file for you if needed */}
        {/* But for brevity, I assume you keep the sections below the hero unchanged */}
        <div className="relative flex justify-center items-center mb-20 w-full">
            <div className="relative w-full max-w-[450px] md:max-w-[700px] h-32 md:h-48 transition-all duration-700 ease-in-out">
            <Image 
                src="/LandingPage/theCreativeJourney.png" 
                alt="The Creative Journey"
                fill
                className="object-contain drop-shadow-md"
                priority
            />
            </div>
        </div>
        {/* ... */}
      </section>
      
      {/* ... (Gallery Section & Footer Section from your original code) ... */}
      <section className="py-24 px-6 md:px-12 bg-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="font-serif text-4xl text-[#261C15] font-bold">
            A Keepsake, Not Just a File
          </h2>
          <p className="mt-4 text-[#6B5D52]">
            Designed to be printed, held, and read under a duvet with a flashlight.
          </p>
        </div>

        <div className="relative w-full aspect-[16/9] md:aspect-[21/9] bg-[#EEE5D5] rounded-xl shadow-2xl overflow-hidden">
          {/* ✅ Image */}
          <Image
            src="/LandingPage/product.jpeg"   // change to /product.jpg or /product.webp if needed
            alt="FlipWhizz printed storybook mockup"
            fill
            className="object-cover"
            priority
          />

          {/* ✅ Soft overlay to keep the quote readable */}
          <div className="absolute inset-0 bg-black/0 md:bg-gradient-to-t md:from-black/20 md:via-black/0 md:to-black/0" />

          {/* ✅ Quote */}
          <div className="absolute bottom-6 right-6 hidden md:block max-w-xs text-right">
            <p className="font-serif text-lg text-[#261C15] font-bold italic drop-shadow-sm">
              "For Leo, our brave explorer."
            </p>
          </div>
        </div>
      </div>
    </section>

   {/* ========================================
  GALLERY
  ========================================
*/}
<section id="gallery" className="py-24 px-6 md:px-12 bg-[#FDF8F0]">
   <div className="mx-auto max-w-6xl">
      <h2 className="text-center font-serif text-4xl text-[#261C15] font-bold mb-16">
          Gallery of Wonder
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {/* Item 1: Mitch & The Dragon (NOW WITH REAL IMAGE) */}
          <div className="flex flex-col gap-4">
              <div className="aspect-square bg-slate-800 rounded-lg shadow-lg hover:scale-105 transition-transform duration-300 cursor-pointer overflow-hidden relative group">
                  <Image 
                    src="/LandingPage/mitch_and_the_dragon.jpeg" 
                    alt="Mitch and the Dragon illustration"
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80"></div>
                  <div className="absolute bottom-0 p-4 w-full">
                     <p className="text-white font-serif font-bold text-lg">Mitch & The Dragon</p>
                  </div>
              </div>
              <div className="flex items-start gap-3 px-1">
                  <div className="w-8 h-8 rounded-full bg-slate-300 flex-shrink-0 overflow-hidden relative">
                     {/* Optional: Add a small avatar image here */}
                  </div>
                  <p className="text-xs text-[#6B5D52] italic">
                    "The best gift I've ever given. She reads it every night." 
                    <br/><span className="font-bold not-italic">- Sarah, Mum of 2</span>
                  </p>
              </div>
          </div>

          {/* Item 2: The Sea Secret */}
          <div className="flex flex-col gap-4">
              <div className="aspect-square bg-sky-900 rounded-lg shadow-lg hover:scale-105 transition-transform duration-300 cursor-pointer overflow-hidden relative group">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
                  <div className="absolute bottom-0 p-4 w-full">
                     <p className="text-white font-serif font-bold">The Sea Secret</p>
                  </div>
              </div>
              <div className="flex items-start gap-3 px-1">
                  <div className="w-8 h-8 rounded-full bg-slate-300 flex-shrink-0"></div>
                  <p className="text-xs text-[#6B5D52] italic">"He couldn't believe the boy in the book looked just like him!" <br/><span className="font-bold not-italic">- Mike, Dad</span></p>
              </div>
          </div>

          {/* Item 3: Magical Treehouse */}
          <div className="flex flex-col gap-4">
              <div className="aspect-square bg-emerald-900 rounded-lg shadow-lg hover:scale-105 transition-transform duration-300 cursor-pointer overflow-hidden relative group">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
                  <div className="absolute bottom-0 p-4 w-full">
                     <p className="text-white font-serif font-bold">Magical Treehouse</p>
                  </div>
              </div>
              <div className="flex items-start gap-3 px-1">
                  <div className="w-8 h-8 rounded-full bg-slate-300 flex-shrink-0"></div>
                  <p className="text-xs text-[#6B5D52] italic">"Beautiful illustrations. Worth every penny." <br/><span className="font-bold not-italic">- Jess, Mum</span></p>
              </div>
          </div>

          {/* Item 4: Wild Animals */}
          <div className="flex flex-col gap-4">
              <div className="aspect-square bg-amber-900 rounded-lg shadow-lg hover:scale-105 transition-transform duration-300 cursor-pointer overflow-hidden relative group">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
                  <div className="absolute bottom-0 p-4 w-full">
                     <p className="text-white font-serif font-bold">Wild Animals</p>
                  </div>
              </div>
              <div className="flex items-start gap-3 px-1">
                  <div className="w-8 h-8 rounded-full bg-slate-300 flex-shrink-0"></div>
                  <p className="text-xs text-[#6B5D52] italic">"Finally, a keepsake that isn't plastic junk." <br/><span className="font-bold not-italic">- Tom, Grandad</span></p>
              </div>
          </div>
      </div>
   </div>
</section>

      {/* 
        ========================================
        FOOTER
        ========================================
      */}
      <footer className="relative bg-[#0F2236] text-[#FDF8F0] pt-32 pb-12">
         {/* Top Wave Divider */}
         <div className="absolute top-[-2px] left-0 w-full overflow-hidden leading-none z-20">
            <svg className="relative block w-[calc(100%+1.3px)] h-[60px] md:h-[100px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                <path d="M985.66,92.83C906.67,72,823.78,31,743.84,14.19c-82.26-17.34-168.06-16.33-250.45.39-57.84,11.73-114,31.07-172,41.86A600.21,600.21,0,0,1,0,27.35V120H1200V95.8C1132.19,118.92,1055.71,111.31,985.66,92.83Z" fill="#FDF8F0"></path>
            </svg>
         </div>

         <div className="relative z-10 mx-auto max-w-6xl px-6 md:px-12 flex flex-col md:flex-row justify-between items-end gap-12">
            
            {/* Left: Links */}
            <div className="flex flex-col gap-4 text-sm font-medium text-[#FDF8F0]/60">
                <Link href="/" className="hover:text-white transition">Home</Link>
                <Link href="#how-it-works" className="hover:text-white transition">How It Works</Link>
                <Link href="#gallery" className="hover:text-white transition">Gallery</Link>
                <Link href="#pricing" className="hover:text-white transition">Pricing</Link>
                <Link href="/contact" className="hover:text-white transition">Contact Us</Link>
            </div>

            {/* Middle: Brand */}
            <div className="text-center md:text-right">
                <h4 className="font-serif text-2xl font-bold">FlipWhizz</h4>
                <p className="text-sm opacity-50 mt-1">Made for magic, built to last.</p>
                <p className="text-xs opacity-30 mt-8">© {new Date().getFullYear()} FlipWhizz Ltd.</p>
            </div>

            {/* Right: Sleeping Child Illustration Placeholder */}
            <div className="w-full md:w-auto flex justify-center md:justify-end">
            <div className="w-64 h-40 relative rounded-t-full border-b-0 border-4 border-indigo-800 overflow-hidden">
                  <Image 
                    src="/illustrations/sleeping-child.png" 
                    alt="Child sleeping with a storybook"
                    fill
                    className="object-cover"
                  />
              </div>
            </div>
         </div>
      </footer>
    </main>
  );
}