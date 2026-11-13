import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ScanLine, ChevronRight } from 'lucide-react-native';
import { Page, Heading, Field, Chips, Card, Badge, Empty, Button } from '../src/components/ui';
import { useData } from '../src/data/context';
import { colors } from '../src/theme';
export default function History(){
 const {history}=useData();const [query,setQuery]=useState(''),[filter,setFilter]=useState('All');const q=query.toLowerCase().trim();
 const rows=history.filter(h=>(filter==='All'||h.status===filter)&&[h.name,h.identifier,h.raw,h.status].join(' ').toLowerCase().includes(q));
 return <Page><Heading title="Scan history" subtitle="A local record of your most recent 200 scans, including unknown codes."/><Field label="Search scan history" placeholder="Product name, identifier or scan content…" value={query} onChangeText={setQuery}/><Chips items={['All','Catalog match','Unknown product','Needs review','Website QR']} value={filter} onChange={setFilter}/>{rows.map(h=><Pressable accessibilityRole="button" key={h.id} onPress={()=>router.push(`/history/${h.id}`)}><Card><View style={{flexDirection:'row',gap:14,alignItems:'center'}}><ScanLine size={24} color={colors.teal}/><View style={{flex:1,gap:6}}><Text style={{color:colors.navy,fontSize:15,fontWeight:'700'}}>{h.name??h.identifier??'Unidentified code'}</Text><Text style={{color:colors.muted,fontSize:11}}>{new Date(h.scanned_at).toLocaleString('en-GB')} · {h.format.toUpperCase()}</Text></View><ChevronRight color={colors.muted} size={17}/></View><Badge label={h.status} tone={h.product_id?'green':'amber'}/></Card></Pressable>)}{!rows.length&&<Empty title="No scans to show" description="Scan a package or enter an identifier manually. Recognised and unknown results will appear here." action={<Button title="Open scanner" onPress={()=>router.push('/scanner')}/>}/>}</Page>;
}
