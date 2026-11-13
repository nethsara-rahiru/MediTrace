import type { InventoryItem } from './types';
export type IngredientOverlap = { ingredient: string; medicines: { productId: number; name: string }[] };
export function ingredientOverlaps(items: InventoryItem[]): IngredientOverlap[] {
 const map=new Map<string,Map<number,string>>();
 for (const item of items.filter(i=>i.quantity>0)) for (const ingredient of item.ingredients) {
   const key=ingredient.name.trim().toLowerCase(); if(!key)continue;
   if(!map.has(key))map.set(key,new Map());
   map.get(key)!.set(item.product_id,item.name);
 }
 return [...map.entries()].filter(([,products])=>products.size>1).map(([ingredient,products])=>({ingredient,medicines:[...products].map(([productId,name])=>({productId,name}))}));
}
