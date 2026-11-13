import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Pill } from 'lucide-react-native';
import { router } from 'expo-router';
import type { Product } from '../domain/types';
import { colors } from '../theme';
import { Badge } from './ui';
export function ProductCard({ product }: { product: Product }) {
 return <Pressable accessibilityRole="button" accessibilityLabel={`View ${product.name} ${product.strength}`} onPress={() => router.push(`/product/${product.id}`)} style={({pressed}) => [s.card,pressed && {opacity:.75}]}><View style={s.icon}><Pill color={colors.teal} size={23}/></View><View style={{flex:1,gap:7}}><Text style={s.name}>{product.name} <Text style={s.strength}>{product.strength}</Text></Text><Text style={s.generic}>{product.generic_name || 'Generic name not recorded'} · {product.dosage_form || 'Form not recorded'}</Text><View style={s.meta}><Text style={s.manufacturer}>{product.manufacturer || 'Manufacturer not recorded'}</Text><Badge label={product.verification==='source_checked' ? 'Source checked' : 'User-entered'} tone={product.verification==='source_checked' ? 'green' : 'amber'}/></View></View><ChevronRight color={colors.muted} size={18}/></Pressable>;
}
const s=StyleSheet.create({card:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.border,borderRadius:16,padding:18,flexDirection:'row',gap:15,alignItems:'center'},icon:{width:48,height:48,borderRadius:14,backgroundColor:colors.mint,alignItems:'center',justifyContent:'center'},name:{fontSize:16,fontWeight:'700',color:colors.navy},strength:{fontWeight:'400',color:colors.muted,fontSize:13},generic:{fontSize:12,color:colors.muted,lineHeight:18},meta:{flexDirection:'row',flexWrap:'wrap',gap:10,alignItems:'center'},manufacturer:{fontSize:11,color:colors.muted}});
