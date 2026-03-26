// types-worlds.ts
// Drop into: src/types/worlds.ts

// ============================================================================
// READER TYPES
// ============================================================================

export interface Reader {
    id: string;
    userId: string;
    name: string;
    age: number | null;
    pronouns: string | null;
    personalityNotes: string | null;
    interests: string[];
    fears: string[];
    readingLevel: string | null;
    referenceImageUrl: string | null;
    referenceImagePublicId: string | null;
    dateOfBirth: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface ReaderInsight {
    id: string;
    readerId: string;
    insightType: ReaderInsightType;
    content: string;
    confidence: number;
    isActive: boolean;
    sourceConversationId: string | null;
    sourceStoryId: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
  }
  
  export type ReaderInsightType =
    | "interest"
    | "fear"
    | "life_event"
    | "milestone"
    | "personality"
    | "reading_progress"
    | "emotional_need"
    | "social"
    | "preference";
  
  export interface ReaderWithInsights extends Reader {
    insights: ReaderInsight[];
  }
  
  // For feeding into story generation prompts
  export interface ReaderContext {
    name: string;
    age: number | null;
    pronouns: string | null;
    personalityNotes: string | null;
    interests: string[];
    fears: string[];
    readingLevel: string | null;
    activeInsights: Array<{
      type: ReaderInsightType;
      content: string;
    }>;
  }
  
  // ============================================================================
  // WORLD TYPES
  // ============================================================================
  
  export interface World {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    styleGuideId: string | null;
    tonality: string | null;
    ageRange: string | null;
    themes: string[];
    coverImageUrl: string | null;
    coverImagePublicId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface WorldWithDetails extends World {
    readers: Array<{
      reader: Reader;
      role: string;
    }>;
    characters: WorldCharacter[];
    locations: WorldLocation[];
    stories: WorldStory[];
    narrativeMemory: NarrativeMemory[];
  }
  
  export interface WorldCharacter {
    id: string;
    worldId: string;
    characterId: string;
    isRecurring: boolean;
    firstAppearanceStoryId: string | null;
    characterArc: string | null;
    sortOrder: number;
    notes: string | null;
    // Populated from join with characters table:
    character?: {
      id: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
    };
  }
  
  export interface WorldLocation {
    id: string;
    worldId: string;
    locationId: string;
    isRecurring: boolean;
    firstAppearanceStoryId: string | null;
    notes: string | null;
    sortOrder: number;
    // Populated from join with locations table:
    location?: {
      id: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
    };
  }
  
  export interface WorldStory {
    id: string;
    title: string;
    bookNumber: number | null;
    status: string;
    coverImageUrl: string | null;
    createdAt: Date;
  }
  
  // ============================================================================
  // NARRATIVE MEMORY TYPES
  // ============================================================================
  
  export interface NarrativeMemory {
    id: string;
    worldId: string;
    storyId: string;
    bookNumber: number;
    summary: string;
    characterDevelopments: CharacterDevelopment[];
    plotPoints: PlotPoint[];
    callbacks: NarrativeCallback[];
    emotionalThemes: string[];
    createdAt: Date;
  }
  
  export interface CharacterDevelopment {
    characterId: string;
    development: string;
  }
  
  export interface PlotPoint {
    point: string;
    isOngoing: boolean;
  }
  
  export interface NarrativeCallback {
    reference: string;
    context: string;
  }
  
  // For feeding into story generation prompts — the compressed "previously on..."
  export interface WorldContext {
    worldName: string;
    worldDescription: string | null;
    tonality: string | null;
    themes: string[];
    reader: ReaderContext;
    recurringCharacters: Array<{
      name: string;
      description: string | null;
      arc: string | null;
      imageUrl: string | null;
    }>;
    recurringLocations: Array<{
      name: string;
      description: string | null;
      imageUrl: string | null;
    }>;
    previousBooks: Array<{
      bookNumber: number;
      title: string;
      summary: string;
      characterDevelopments: CharacterDevelopment[];
      ongoingPlotPoints: string[];
      callbacks: NarrativeCallback[];
      emotionalThemes: string[];
    }>;
    nextBookNumber: number;
  }
  
  // ============================================================================
  // FORM / API TYPES
  // ============================================================================
  
  export interface CreateReaderInput {
    name: string;
    age?: number;
    pronouns?: string;
    personalityNotes?: string;
    interests?: string[];
    fears?: string[];
    readingLevel?: string;
    dateOfBirth?: Date;
  }
  
  export interface UpdateReaderInput extends Partial<CreateReaderInput> {
    id: string;
  }
  
  export interface CreateWorldInput {
    name: string;
    description?: string;
    readerId: string; // primary reader
    readerRole?: string;
    tonality?: string;
    ageRange?: string;
    themes?: string[];
  }
  
  export interface CreateWorldFromChatOutput {
    reader: CreateReaderInput;
    world: Omit<CreateWorldInput, "readerId">;
    initialCharacters: Array<{
      name: string;
      description: string;
      isRecurring: boolean;
    }>;
    initialLocations: Array<{
      name: string;
      description: string;
      isRecurring: boolean;
    }>;
    firstBookPremise: string;
  }
  
  export interface PromoteCharacterToWorldInput {
    worldId: string;
    characterId: string;
    isRecurring?: boolean;
    characterArc?: string;
    notes?: string;
  }
  
  export interface PromoteLocationToWorldInput {
    worldId: string;
    locationId: string;
    isRecurring?: boolean;
    notes?: string;
  }