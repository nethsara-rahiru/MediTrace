import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Page, Back, Heading, Card, Badge, Empty, Notice, Button } from '../../src/components/ui';
import { ProductCard } from '../../src/components/ProductCard';
import { useData } from '../../src/data/context';
import { colors } from '../../src/theme';
export default function HistoryDetail(){
 const {id}=useLocalSearchParams<{id:string}>(),{history,products}=useData();const scan=history.find(h=>h.id===Number(id));
 if(!scan)return <Page><Back/><Empty title="Scan unavailable" description="This record is not in the most recent local scan history."/></Page>;
 const product=products.find(p=>p.id===scan.product_id);
 return <Page><Back label="Scan history"/><Heading title="Recorded scan" subtitle={new Date(scan.scanned_at).toLocaleString('en-GB')}/><Card><Badge label={scan.status} tone={scan.product_id?'green':'amber'}/>{[['Barcode format',scan.format.toUpperCase()],['Identifier',scan.identifier],['Batch / lot',scan.batch],['Expiry decoded',scan.expiry],['Serial number',scan.serial],['Raw content',scan.raw]].map(([label,value])=><View key={label} style={{gap:5}}><Text style={{fontSize:11,color:colors.muted}}>{label}</Text><Text selectable style={{fontSize:14,color:colors.text,lineHeight:22}}>{value??'Not available'}</Text></View>)}</Card>{scan.notes&&<Notice tone="amber">{scan.notes}</Notice>}{product&&<ProductCard product={product}/>}<Notice>This is the recorded result at scan time. Viewing history does not create another scan or perform an online lookup.</Notice><Button title="Open scanner" onPress={()=>router.push('/scanner')}/></Page>;
}
