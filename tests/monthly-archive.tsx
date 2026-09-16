// Local-only Vite test page. Does not read or modify production data.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { unzipSync, strFromU8 } from 'fflate';
import { AuthProvider } from '../src/contexts/AuthContext';
import { dataService } from '../src/services/DataService';
import { AdminLogs } from '../src/pages/AdminLogs';
import '../src/index.css';
const club = {id:'User01',name:'테스트 동아리',role:'user' as const,status:'Active' as const};
dataService.restoreSession = async () => ({user:{...club,id:'Admin',role:'admin'},mustChangePin:false});
dataService.getConfig = async () => ({users:[club],rooms:[{id:'room',name:'밴드 연습실'}]});
dataService.getAllBookings = async () => [
    ...[1,2].map(n=>({id:String(n),userId:club.id,userName:club.name,roomId:'room',date:`2026-07-0${n}`,startTime:'10:00',endTime:'11:00',createdAt:'',activityContent:'여름 공연을 준비하며 합주 연습과 파트별 연습을 진행했습니다.',participants:'테스트가, 테스트나',headcount:{elemM:0,elemF:0,midM:1,midF:1,highM:0,highF:0,u24M:0,u24F:0}})),
    {id:'3',userId:club.id,userName:club.name,roomId:'room',date:'2026-07-03',startTime:'10:00',endTime:'11:00',createdAt:''},
];
document.addEventListener('click', async event => {
    const target = event.target;
    if (!(target instanceof HTMLAnchorElement) || !target.download.endsWith('.zip')) return;
    event.preventDefault();
    const bytes = new Uint8Array(await (await fetch(target.href)).arrayBuffer());
    const files = unzipSync(bytes);
    const names = Object.keys(files);
    const valid = names.length === 2 && Object.values(files).every(file=>strFromU8(file.slice(0,5))==='%PDF-');
    document.getElementById('result')!.textContent = `${valid ? 'PASS' : 'FAIL'}: ${target.download}\n${names.join('\n')}\n${bytes.length} bytes`;
});
createRoot(document.getElementById('root')!).render(<AuthProvider><AdminLogs /></AuthProvider>);
