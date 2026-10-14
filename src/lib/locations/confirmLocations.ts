import { db } from '@/db';
import { locations, storyLocations, stories } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { isAppearanceApproved, isCastReady } from '../characters/readiness';

// Both completion endpoints use the same validation. Story text confirmation
// is deliberately unrelated to approval of the location appearances.
export async function confirmLocations(storyId: string) {
  return db.transaction(async (tx) => {
    const cast = await tx.select({
      id: locations.id, name: locations.name,
      portraitImageUrl: locations.portraitImageUrl, locked: locations.locked,
    }).from(storyLocations).innerJoin(locations, eq(storyLocations.locationId, locations.id))
      .where(eq(storyLocations.storyId, storyId)).for('update');
    if (!isCastReady(cast)) {
      return { ok: false, missing: cast.filter(c => !isAppearanceApproved(c)).map(c => c.name) };
    }
    await tx.update(stories).set({
      completedSteps: sql`CASE WHEN COALESCE(${stories.completedSteps}, '[]'::jsonb) @> '["locations"]'::jsonb THEN ${stories.completedSteps} ELSE COALESCE(${stories.completedSteps}, '[]'::jsonb) || '["locations"]'::jsonb END`,
      updatedAt: new Date(),
    }).where(eq(stories.id, storyId));
    return { ok: true, missing: [] };
  });
}
