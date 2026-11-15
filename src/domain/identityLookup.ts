import type { CatalogRecord } from '../cloud/catalog';
export type IdentityLookup = {
  identifier: string;
  status: 'matched' | 'not_found' | 'ambiguous' | 'unavailable' | 'withdrawn';
  checkedAt: string;
  message: string;
  record?: CatalogRecord;
};
