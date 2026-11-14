import type { Ingredient, Product } from '../types';

export type Method =
  | 'database'
  | 'history'
  | 'gs1'
  | 'labelled'
  | 'pattern'
  | 'fuzzy'
  | 'template'
  | 'user'
  | 'ai'
  | 'none';
export type FieldStatus = 'missing' | 'unverified' | 'user_confirmed' | 'source_checked';
export type ExtractedField<T> = {
  value: T | null;
  originalValue: string | null;
  method: Method;
  confidence: 'none' | 'low' | 'medium' | 'high';
  verification: FieldStatus;
  source: string | null;
  origin: 'payload' | 'catalog' | 'history' | 'manual';
  locator: string | null;
};
export const scalarKeys = [
  'productName',
  'strength',
  'dosageForm',
  'batchNumber',
  'manufacturingDate',
  'expiryDate',
  'manufacturer',
  'manufacturerAddress',
  'gtin',
  'serialNumber',
] as const;
export type ScalarKey = (typeof scalarKeys)[number];
export type FieldKey = ScalarKey | 'activeIngredients';
export const fieldKeys: FieldKey[] = [...scalarKeys, 'activeIngredients'];
export type Fields = { [K in ScalarKey]: ExtractedField<string> } & {
  activeIngredients: ExtractedField<Ingredient[]>;
};
export const productKeys: FieldKey[] = [
  'productName',
  'strength',
  'dosageForm',
  'activeIngredients',
  'manufacturer',
  'manufacturerAddress',
];
export const packageKeys: FieldKey[] = [
  'batchNumber',
  'manufacturingDate',
  'expiryDate',
  'gtin',
  'serialNumber',
];
export type Token = { locator: string; label: string; raw: string; kind: string };
export type Candidate = {
  key: string;
  productId: number | null;
  name: string;
  strength: string | null;
  dosageForm: string | null;
  score: number;
  reason: string;
};
export type Extraction = {
  version: 1;
  raw: string;
  format: string;
  kind: 'identifier' | 'gs1' | 'labelled' | 'json' | 'text' | 'url' | 'unsupported';
  fields: Fields;
  tokens: Token[];
  additionalInformation: { label: string; value: string }[];
  candidates: Candidate[];
  predictedProductId: number | null;
  issues: string[];
  signature: string | null;
  templateId: number | null;
  identityConflict: boolean;
};
export type Identity = {
  productId: number | null;
  name: string;
  strength: string | null;
  dosageForm: string | null;
  override: boolean;
};
export type Session = {
  id: number;
  raw: string;
  format: string;
  state: 'pending' | 'rejected' | 'identity_confirmed' | 'saved';
  original: Extraction;
  reviewed: Extraction | null;
  identity: Identity | null;
  packageId: number | null;
  rejectionCount: number;
};
export type TemplateRule = { field: FieldKey; locator: string };
export type FormatTemplate = {
  id: number;
  signature: string;
  rules: TemplateRule[];
  verification: 'candidate' | 'locally_confirmed';
  confirmations: number;
};
export type ExtractionContext = {
  products: Product[];
  templates?: FormatTemplate[];
  previous?: { extraction: Extraction; productId: number | null };
};
export function missing<T>(): ExtractedField<T> {
  return {
    value: null,
    originalValue: null,
    method: 'none',
    confidence: 'none',
    verification: 'missing',
    source: null,
    origin: 'payload',
    locator: null,
  };
}
export function emptyFields(): Fields {
  return Object.fromEntries(fieldKeys.map((k) => [k, missing()])) as Fields;
}
export function evidence<T>(
  value: T,
  raw: string | null,
  method: Method,
  locator: string | null = null,
  confidence: ExtractedField<T>['confidence'] = 'medium',
): ExtractedField<T> {
  return {
    value,
    originalValue: raw,
    method,
    confidence,
    verification: 'unverified',
    source: method === 'user' ? 'User correction' : 'Scanned packaging content',
    origin: method === 'user' ? 'manual' : 'payload',
    locator,
  };
}
