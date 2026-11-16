// Web and Node use the platform's cryptographically secure generator.
export async function publicationCredentials() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return {
    remoteId: globalThis.crypto.randomUUID(),
    token: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''),
  };
}
