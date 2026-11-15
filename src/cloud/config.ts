// Expo substitutes these public values into the app bundle. Never use a secret key.
export function catalogConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !key.startsWith('sb_publishable_'))
    throw new Error('Check the Supabase project URL and publishable key in the app configuration.');
  return { url, key };
}
