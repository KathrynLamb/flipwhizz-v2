import { db } from "@/db";
import { 
  storySpreads, 
  storyPages, 
  storySpreadPresence,
  storySpreadScene,
  characters, 
  locations,
  stories,
  storyCharacters, // Added
  storyLocations   // Added
} from "@/db/schema";
import { eq, inArray, asc, sql } from "drizzle-orm";
import { User, MapPin, Image as ImageIcon, FileText, Info } from "lucide-react";
import Image from "next/image";

// --- TYPES ---
type SpreadChar = {
  characterId: string;
  role: string;
  reason: string;
};

type EnrichedPage = {
  id: string;
  pageNumber: number;
  text: string;
  imageUrl: string | null;
};

// --- DATA FETCHING ---
async function getSpreadData(storyId: string) {
  // 1. Fetch Spreads with Scene & Presence Data
  const spreads = await db
    .select({
      id: storySpreads.id,
      index: storySpreads.spreadIndex,
      leftPageId: storySpreads.leftPageId,
      rightPageId: storySpreads.rightPageId,
      
      // Scene Info
      sceneSummary: storySpreadScene.sceneSummary,
      illustrationPrompt: storySpreadScene.illustrationPrompt,
      mood: storySpreadScene.mood,
      
      // Presence Info
      primaryLocationId: storySpreadPresence.primaryLocationId,
      charactersJson: storySpreadPresence.characters, // JSONB
    })
    .from(storySpreads)
    .leftJoin(storySpreadScene, eq(storySpreads.id, storySpreadScene.spreadId))
    .leftJoin(storySpreadPresence, eq(storySpreads.id, storySpreadPresence.spreadId))
    .where(eq(storySpreads.storyId, storyId))
    .orderBy(asc(storySpreads.spreadIndex));

  if (!spreads.length) return [];

  // 2. Fetch Pages (Text & Images)
  const pageIds = [
    ...spreads.map(s => s.leftPageId).filter((id): id is string => !!id),
    ...spreads.map(s => s.rightPageId).filter((id): id is string => !!id)
  ];

  const pages = pageIds.length > 0 
    ? await db.select().from(storyPages).where(inArray(storyPages.id, pageIds))
    : [];

  // 3. Fetch Character & Location Metadata (FIXED: Using Join Tables)
  const allChars = await db
    .select({
      id: characters.id,
      name: characters.name,
      portraitImageUrl: characters.portraitImageUrl,
      referenceImageUrl: characters.referenceImageUrl,
    })
    .from(characters)
    .innerJoin(storyCharacters, eq(characters.id, storyCharacters.characterId))
    .where(eq(storyCharacters.storyId, storyId));

  const allLocs = await db
    .select({
      id: locations.id,
      name: locations.name,
      portraitImageUrl: locations.portraitImageUrl,
      referenceImageUrl: locations.referenceImageUrl,
    })
    .from(locations)
    .innerJoin(storyLocations, eq(locations.id, storyLocations.locationId))
    .where(eq(storyLocations.storyId, storyId));

  // 4. Assemble
  return spreads.map((s) => {
    // Resolve Location
    const loc = allLocs.find(l => l.id === s.primaryLocationId);
    
    // Resolve Characters from JSON
    const assignedChars = (s.charactersJson as SpreadChar[] || []).map(entry => {
        const char = allChars.find(c => c.id === entry.characterId);
        return char ? {
            name: char.name,
            role: entry.role,
            imageUrl: char.portraitImageUrl || char.referenceImageUrl
        } : null;
    }).filter(Boolean);

    // Resolve Pages
    const left = pages.find(p => p.id === s.leftPageId);
    const right = pages.find(p => p.id === s.rightPageId);

    return {
      id: s.id,
      index: s.index,
      sceneSummary: s.sceneSummary,
      illustrationPrompt: s.illustrationPrompt,
      mood: s.mood,
      primaryLocation: loc ? { name: loc.name, imageUrl: loc.portraitImageUrl || loc.referenceImageUrl } : null,
      assignedCharacters: assignedChars as any[],
      leftPage: left ? { text: left.text, imageUrl: left.imageUrl } : null,
      rightPage: right ? { text: right.text, imageUrl: right.imageUrl } : null,
    };
  });
}

// --- COMPONENT ---
export default async function DebugSpreadsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: storyId } = await params;

  if (!storyId) return <div className="p-10 text-red-500">Error: No Story ID provided</div>;

  const data = await getSpreadData(storyId);
  
  const story = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
    columns: { title: true }
  });

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 border-b border-slate-200 pb-4">
          <h1 className="text-3xl font-bold text-slate-900">{story?.title || "Untitled Story"}</h1>
          <p className="text-slate-500 font-mono text-xs mt-1">ID: {storyId} • {data.length} Spreads</p>
        </header>

        <div className="space-y-16">
          {data.length === 0 && (
            <div className="p-12 bg-white rounded-xl border-2 border-dashed border-slate-300 text-center text-slate-500">
                No spreads found. Run "Decide Scenes" (Phase A).
            </div>
          )}

          {data.map((spread) => (
            <div key={spread.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              
              {/* Header */}
              <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
                <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded">SPREAD {spread.index}</span>
                <div className="flex gap-2">
                    {spread.mood && <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Mood: {spread.mood}</span>}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                
                {/* 1. SCENE DATA (AI BRAIN) */}
                <div className="p-6 bg-slate-50/50 space-y-6">
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                            <Info className="w-3 h-3" /> Scene Plan
                        </h3>
                        <p className="text-sm text-slate-700 italic">{spread.sceneSummary || "No summary generated"}</p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                            <MapPin className="w-3 h-3" /> Location
                        </h3>
                        {spread.primaryLocation ? (
                            <div className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-lg">
                                <div className="w-8 h-8 rounded bg-slate-100 relative overflow-hidden">
                                    {spread.primaryLocation.imageUrl && <Image src={spread.primaryLocation.imageUrl} alt="" fill className="object-cover" />}
                                </div>
                                <span className="text-sm font-medium text-slate-800">{spread.primaryLocation.name}</span>
                            </div>
                        ) : <span className="text-xs text-red-400">No location assigned</span>}
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                            <User className="w-3 h-3" /> Characters ({spread.assignedCharacters.length})
                        </h3>
                        {spread.assignedCharacters.map((char, i) => (
                             <div key={i} className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-lg">
                                <div className="w-8 h-8 rounded-full bg-slate-100 relative overflow-hidden">
                                    {char.imageUrl && <Image src={char.imageUrl} alt="" fill className="object-cover" />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-slate-800">{char.name}</span>
                                    <span className="text-[10px] text-slate-400 uppercase">{char.role}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. LEFT PAGE */}
                <PageView text={spread.leftPage?.text} image={spread.leftPage?.imageUrl} label="Left Page" />

                {/* 3. RIGHT PAGE */}
                <PageView text={spread.rightPage?.text} image={spread.rightPage?.imageUrl} label="Right Page" />

              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageView({ text, image, label }: { text?: string, image?: string | null, label: string }) {
  return (
    <div className="flex flex-col h-full border-l border-slate-100">
       <div className="relative aspect-[16/9] bg-slate-200 group">
          {image ? (
            <Image src={image} alt={label} fill className="object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 flex-col gap-2">
                <ImageIcon className="w-6 h-6 opacity-20" />
                <span className="text-[10px] uppercase tracking-wide">No Image</span>
            </div>
          )}
          <span className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-md">
            {label}
          </span>
       </div>
       <div className="p-4 bg-white flex-1">
          <p className="text-sm text-slate-600 font-serif leading-relaxed">
            {text || <span className="text-slate-300 italic">No text</span>}
          </p>
       </div>
    </div>
  );
}