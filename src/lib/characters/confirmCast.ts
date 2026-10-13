import { db } from '@/db';
import { characters, storyCharacters, stories } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { isAppearanceApproved, isCastReady } from './readiness';

// Both completion endpoints use the same validation. Story text confirmation
// is deliberately unrelated to approval of the character appearances.
export async function confirmCast(storyId: string) {
  return db.transaction(async (tx) => {
    const cast = await tx.select({
      id: characters.id, name: characters.name,
      portraitImageUrl: characters.portraitImageUrl, locked: characters.locked,
    }).from(storyCharacters).innerJoin(characters, eq(storyCharacters.characterId, characters.id))
      .where(eq(storyCharacters.storyId, storyId)).for('update');
    if (!isCastReady(cast)) {
      return { ok: false, missing: cast.filter(c => !isAppearanceApproved(c)).map(c => c.name) };
    }
    await tx.update(stories).set({
      completedSteps: sql`CASE WHEN COALESCE(${stories.completedSteps}, '[]'::jsonb) @> '["characters"]'::jsonb THEN ${stories.completedSteps} ELSE COALESCE(${stories.completedSteps}, '[]'::jsonb) || '["characters"]'::jsonb END`,
      updatedAt: new Date(),
    }).where(eq(stories.id, storyId));
    return { ok: true, missing: [] };
  });
}
