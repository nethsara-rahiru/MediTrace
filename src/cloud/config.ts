import { publicProject } from './project';
import type { CatalogConfig } from './catalog';
export function resolveCatalogConfig(urlOverride?: string, keyOverride?: string): CatalogConfig {
  const urlValue = urlOverride?.trim(),
    keyValue = keyOverride?.trim();
  const override = Boolean(urlValue || keyValue);
  const url = override ? urlValue : publicProject.url;
  const key = override ? keyValue : publicProject.key;
  if (!url || !key)
    throw new Error(
      'Set both EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, or remove both to use the built-in MedTrace connection.',
    );
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !key.startsWith('sb_publishable_'))
    throw new Error('Check the Supabase project URL and publishable key in the app configuration.');
  return { url, key };
}
// Expo substitutes explicit environment overrides. Fresh checkouts use the public project.
export function catalogConfig() {
  return resolveCatalogConfig(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
