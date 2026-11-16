import { getRandomBytesAsync, randomUUID } from 'expo-crypto';
export async function publicationCredentials() {
  const bytes = await getRandomBytesAsync(32);
  return {
    remoteId: randomUUID(),
    token: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''),
  };
}
