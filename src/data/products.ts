import type { SQLiteDatabase } from 'expo-sqlite';
import type { Ingredient, Product, ProductInput } from '../domain/types';
import { normalizeIdentifier } from '../domain/identifiers';
const select = `SELECT p.*, COALESCE(s.description,'') AS source FROM products p LEFT JOIN data_sources s ON s.id=p.source_id`;
async function hydrate(db: SQLiteDatabase, row: Omit<Product,'ingredients'|'barcodes'>): Promise<Product> {
 const ingredients = await db.getAllAsync<Ingredient>('SELECT i.name, pi.strength FROM product_ingredients pi JOIN ingredients i ON i.id=pi.ingredient_id WHERE pi.product_id=? ORDER BY i.name',row.id);
 const barcodes = await db.getAllAsync<{ identifier: string }>('SELECT identifier FROM barcodes WHERE product_id=?',row.id);
 return { ...row, ingredients, barcodes: barcodes.map(b => b.identifier) };
}
export async function listProducts(db: SQLiteDatabase, search = '', category = 'All', manufacturer = 'All'): Promise<Product[]> {
 const q = search.trim().toLowerCase();
 const rows = await db.getAllAsync<Product>(`${select} WHERE (?='' OR instr(lower(p.name||' '||p.generic_name||' '||p.strength),?)>0 OR EXISTS(SELECT 1 FROM product_ingredients pi JOIN ingredients i ON i.id=pi.ingredient_id WHERE pi.product_id=p.id AND instr(lower(i.name),?)>0)) AND (?='All' OR p.category=?) AND (?='All' OR p.manufacturer=?) ORDER BY p.name COLLATE NOCASE`,q,q,q,category,category,manufacturer,manufacturer);
 return Promise.all(rows.map(row => hydrate(db,row)));
}
export async function getProduct(db: SQLiteDatabase, id: number): Promise<Product | null> {
 const row=await db.getFirstAsync<Product>(`${select} WHERE p.id=?`,id);
 return row ? hydrate(db,row) : null;
}
export async function findProduct(db: SQLiteDatabase, identifier: string): Promise<Product | null> {
 const row=await db.getFirstAsync<{ product_id: number }>('SELECT product_id FROM barcodes WHERE identifier=?',identifier);
 return row ? getProduct(db,row.product_id) : null;
}
export async function saveProduct(db: SQLiteDatabase, input: ProductInput, existingId?: number): Promise<number> {
 if (!input.name.trim()) throw new Error('Enter the product name.');
 if (!input.source.trim()) throw new Error('Describe where the product information came from.');
 const identifiers = [...new Set(input.barcodes.map(b => normalizeIdentifier(b)).filter(Boolean))];
 if (identifiers.some(b => b.length > 256 || /^https?:\/\//i.test(b))) throw new Error('Use a product identifier rather than a website address.');
 let id=existingId ?? 0;
 await db.withTransactionAsync(async () => {
   for (const identifier of identifiers) {
     const duplicate = await db.getFirstAsync<{ product_id: number }>('SELECT product_id FROM barcodes WHERE identifier=?',identifier);
     if (duplicate && duplicate.product_id !== existingId) throw new Error('An identifier is already associated with another product.');
   }
   await db.runAsync('INSERT OR IGNORE INTO data_sources(description) VALUES (?)',input.source.trim());
   const source = await db.getFirstAsync<{ id: number }>('SELECT id FROM data_sources WHERE description=?',input.source.trim());
   const values = [input.name.trim(), input.generic_name.trim(), input.strength.trim(), input.dosage_form.trim(), input.manufacturer.trim(), input.country.trim(), input.category.trim() || 'Uncategorised', input.pack_size.trim(), input.storage.trim(), input.warnings.trim(), input.indications.trim(), input.prescription.trim(), source!.id, input.verified_at, input.verification];
   if (existingId) await db.runAsync('UPDATE products SET name=?,generic_name=?,strength=?,dosage_form=?,manufacturer=?,country=?,category=?,pack_size=?,storage=?,warnings=?,indications=?,prescription=?,source_id=?,verified_at=?,verification=? WHERE id=?',...values,existingId);
   else { const r=await db.runAsync('INSERT INTO products(name,generic_name,strength,dosage_form,manufacturer,country,category,pack_size,storage,warnings,indications,prescription,source_id,verified_at,verification) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',...values); id=r.lastInsertRowId; }
   await db.runAsync('DELETE FROM barcodes WHERE product_id=?',id);
   await db.runAsync('DELETE FROM product_ingredients WHERE product_id=?',id);
   for (const identifier of identifiers) await db.runAsync('INSERT INTO barcodes(identifier,product_id) VALUES (?,?)',identifier,id);
   const seen = new Set<string>();
   for (const ingredient of input.ingredients) {
     const name=ingredient.name.trim().toLowerCase();
     if (!name || seen.has(name)) continue;
     seen.add(name);
     await db.runAsync('INSERT OR IGNORE INTO ingredients(name) VALUES (?)',name);
     const row=await db.getFirstAsync<{ id: number }>('SELECT id FROM ingredients WHERE name=? COLLATE NOCASE',name);
     await db.runAsync('INSERT INTO product_ingredients(product_id,ingredient_id,strength) VALUES (?,?,?)',id,row!.id,ingredient.strength.trim());
   }
 });
 return id;
}
