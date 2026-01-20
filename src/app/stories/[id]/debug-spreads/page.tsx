import { db } from "@/db";
import { 
  storySpreads, 
  storyPages, 
  storyPageCharacters, 
  storyPageLocations, 
  characters, 
  locations,
  stories
} from "@/db/schema";
import { eq, inArray, asc, sql } from "drizzle-orm"; // Added sql
import { User, MapPin, Image as ImageIcon, FileText } from "lucide-react";
import Image from "next/image";

// --- TYPES ---
type EnrichedPage = {
  id: string;
  pageNumber: number;
  text: string;
  imageUrl: string | null;
  characters: {
    name: string;
    description: string | null;
    prominence: string | null;
    action: string | null;
    refImage: string | null;
  }[];
  locations: {
    name: string;
    description: string | null;
    refImage: string | null;
  }[];
};

// --- DATA FETCHING ---
async function getSpreadData(storyId: string) {
  // 1. Fetch Spreads
  const spreads = await db
    .select()
    .from(storySpreads)
    .where(eq(storySpreads.storyId, storyId))
    .orderBy(asc(storySpreads.spreadIndex));

  if (!spreads.length) return [];

  // 2. Fetch all Pages involved
  const pageIds = [
    ...spreads.map(s => s.leftPageId).filter((id): id is string => !!id),
    ...spreads.map(s => s.rightPageId).filter((id): id is string => !!id)
  ];

  if (pageIds.length === 0) return spreads.map(s => ({ 
    id: s.id, 
    index: s.spreadIndex, 
    summary: s.sceneSummary, 
    left: null, 
    right: null 
  }));

  const pages = await db
    .select()
    .from(storyPages)
    .where(inArray(storyPages.id, pageIds));

  // 3. Fetch Characters on these pages (FIXED IMAGE LOOKUP)
  const pageChars = await db
    .select({
      pageId: storyPageCharacters.pageId,
      name: characters.name,
      description: characters.description,
      prominence: storyPageCharacters.prominence,
      action: storyPageCharacters.action,
      // Priority: AI Portrait -> Uploaded Reference -> Null
      refImage: sql<string>`COALESCE(${characters.portraitImageUrl}, ${characters.referenceImageUrl})`,
    })
    .from(storyPageCharacters)
    .innerJoin(characters, eq(storyPageCharacters.characterId, characters.id))
    .where(inArray(storyPageCharacters.pageId, pageIds));

  // 4. Fetch Locations on these pages (FIXED IMAGE LOOKUP)
  const pageLocs = await db
    .select({
      pageId: storyPageLocations.pageId,
      name: locations.name,
      description: locations.description,
      // Priority: AI Image -> Uploaded Reference -> Null
      refImage: sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})`,
    })
    .from(storyPageLocations)
    .innerJoin(locations, eq(storyPageLocations.locationId, locations.id))
    .where(inArray(storyPageLocations.pageId, pageIds));

  // 5. Assemble Data Structure
  const getPageDetails = (pageId: string | null): EnrichedPage | null => {
    if (!pageId) return null;
    const p = pages.find((x) => x.id === pageId);
    if (!p) return null;

    return {
      id: p.id,
      pageNumber: p.pageNumber,
      text: p.text || "",
      imageUrl: p.imageUrl,
      characters: pageChars.filter((c) => c.pageId === pageId),
      locations: pageLocs.filter((l) => l.pageId === pageId),
    };
  };

  return spreads.map((s) => ({
    id: s.id,
    index: s.spreadIndex,
    summary: s.sceneSummary,
    left: getPageDetails(s.leftPageId),
    right: getPageDetails(s.rightPageId),
  }));
}

// --- COMPONENT ---
export default async function DebugSpreadsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const storyId = resolvedParams.id;

  if (!storyId) return <div className="p-10 text-red-500">Error: No Story ID provided</div>;

  const data = await getSpreadData(storyId);
  
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
    columns: { title: true }
  });

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex justify-between items-end border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{story?.title || "Untitled Story"}</h1>
            <p className="text-slate-500 font-mono text-xs mt-1">Debug View • ID: {storyId}</p>
          </div>
          <div className="text-right">
             <span className="text-sm font-medium text-slate-500">Spreads: {data.length}</span>
          </div>
        </header>

        <div className="space-y-16">
          {data.length === 0 && (
            <div className="p-12 bg-white rounded-xl border-2 border-dashed border-slate-300 text-center text-slate-500">
                <p className="text-lg font-medium">No spreads found.</p>
                <p className="text-sm mt-2">Check if "Phase A (Plan Spreads)" has run successfully.</p>
            </div>
          )}

          {data.map((spread) => (
            <div key={spread.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              
              {/* Spread Header */}
              <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="flex items-center gap-3">
                  <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-md shadow-sm">
                    SPREAD {spread.index}
                  </span>
                  <span className="text-slate-500 text-sm font-medium">
                    Pages {spread.left?.pageNumber ?? '?'}-{spread.right?.pageNumber ?? '?'}
                  </span>
                </div>
                {spread.summary && (
                    <div className="flex-1 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 text-sm text-slate-700 italic">
                        <span className="font-semibold not-italic text-blue-900 mr-1">Scene:</span>
                        {spread.summary}
                    </div>
                )}
              </div>

              {/* Book Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                <PageView side="left" page={spread.left} />
                <PageView side="right" page={spread.right} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageView({ page, side }: { page: EnrichedPage | null, side: "left" | "right" }) {
  if (!page) {
    return (
      <div className="p-12 bg-slate-50/50 flex items-center justify-center text-slate-400 italic h-full min-h-[300px]">
        No {side} page content
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 1. Image Preview */}
      <div className="relative aspect-[16/9] bg-slate-100 border-b border-slate-100 group overflow-hidden">
        {page.imageUrl ? (
          <div className="relative w-full h-full">
            <Image 
                src={page.imageUrl} 
                alt={`Page ${page.pageNumber}`}
                fill
                className="object-cover"
            />
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm">
                Generated
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 text-slate-400 bg-slate-50">
            <ImageIcon className="w-8 h-8 opacity-20" />
            <span className="text-xs font-medium">No Image Generated Yet</span>
          </div>
        )}
        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur text-slate-600 text-xs font-bold px-2 py-1 rounded border border-slate-200 shadow-sm z-10">
            Page {page.pageNumber}
        </div>
      </div>

      {/* 2. Content */}
      <div className="p-6 space-y-6 flex-1 bg-white">
        
        {/* Story Text */}
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <FileText className="w-3 h-3" />
                Story Text
            </div>
            <div className="p-4 bg-amber-50 border border-amber-100/50 rounded-lg text-slate-800 font-serif leading-relaxed text-sm">
                {page.text ? `"${page.text}"` : <span className="text-slate-400 italic">(Empty Page)</span>}
            </div>
        </div>

        {/* Data Inspector */}
        <div className="grid grid-cols-1 gap-4">
            
            {/* Characters */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <User className="w-3 h-3" />
                    Characters Present ({page.characters.length})
                </div>
                {page.characters.length > 0 ? (
                    <div className="space-y-2">
                        {page.characters.map((char, i) => (
                            <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                {/* Character Image */}
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-white relative shrink-0 border border-slate-200 shadow-sm">
                                    {char.refImage ? (
                                        <Image src={char.refImage} alt={char.name} fill className="object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-100">
                                            <User className="w-4 h-4 text-slate-300" />
                                        </div>
                                    )}
                                </div>
                                
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-sm text-slate-800 truncate">{char.name}</span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase font-medium tracking-wide ${
                                            char.prominence === 'primary' 
                                            ? 'bg-purple-100 text-purple-700' 
                                            : 'bg-slate-200 text-slate-600'
                                        }`}>
                                            {char.prominence || 'bg'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                                        {char.action || "No specific action defined"}
                                    </p>
                                    {!char.refImage && (
                                        <p className="text-[10px] text-red-500 mt-1 font-medium">⚠️ No reference image found</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-slate-400 italic pl-1 border-l-2 border-slate-200 ml-1">
                        No characters assigned by Phase A.
                    </p>
                )}
            </div>

            {/* Locations */}
            {page.locations.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <MapPin className="w-3 h-3" />
                        Location
                    </div>
                    {page.locations.map((loc, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-emerald-50/30 border border-emerald-100/50 rounded-lg text-emerald-900 text-sm">
                            <div className="w-8 h-8 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                                <MapPin className="w-4 h-4 text-emerald-600" />
                            </div>
                            <span className="font-medium truncate">{loc.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>

      </div>
    </div>
  );
}