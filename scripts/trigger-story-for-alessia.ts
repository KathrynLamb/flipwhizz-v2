

const PROJECT_ID = 'ea1c17d0-ddea-43f3-ba22-729d7d477e46';
const SESSION_ID = 'e1e69adb-ba87-43aa-b573-a13f6ff8cd2a';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function triggerStoryCreation() {
  console.log('🚀 Triggering story creation for Alessia...');

  const res = await fetch(`${BASE_URL}/api/stories/create-from-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: PROJECT_ID,
      sessionId: SESSION_ID,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('❌ Failed:', data);
    process.exit(1);
  }

  console.log('✅ Success:', data);
  console.log('📖 Story ID:', data.storyId);
}

triggerStoryCreation();