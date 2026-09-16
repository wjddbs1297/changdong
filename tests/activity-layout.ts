import { buildActivityLogHtml, createActivityLogPdf, type ActivityLogData } from '../src/components/ActivityModal';
const data: ActivityLogData = {
    userName:'긴 이름 테스트 청소년동아리 <합주팀>', roomName:'밴드 합주 연습실',
    dateStr:'2026-09-16',timeStr:'10:00 ~ 13:00',today:'2026. 09. 16',
    activityContent: Array.from({length:28},(_,i)=>`${i+1}. 공연 준비를 위해 합주와 파트 연습을 진행했습니다. 서로의 의견을 나누고 박자와 음정을 확인했습니다.`).join('\n') + '\n' + '띄어쓰기없는매우긴활동내용'.repeat(20),
    suggestion:'연습실 장비 확인을 부탁드립니다.\n마이크와 앰프를 점검해주세요.',
    headcount:{elemM:0,elemF:0,midM:10,midF:10,highM:10,highF:10,u24M:0,u24F:0},
    participants:Array.from({length:40},(_,i)=>i===0?'긴이름참여자테스트':`참여자${i+1}`),signature:'',
};
const preview = document.querySelector<HTMLIFrameElement>('#preview')!;
preview.srcdoc = buildActivityLogHtml(data,false);
document.querySelector('#check')!.addEventListener('click',async()=>{
    const result=document.querySelector('#result')!;
    result.textContent='검사 중';
    const doc=preview.contentDocument!;
    await doc.fonts.ready;
    const overflows:string[]=[];
    for(const td of doc.querySelectorAll('td')) {
        const bounds=td.getBoundingClientRect();
        const walker=doc.createTreeWalker(td,NodeFilter.SHOW_TEXT);
        while(walker.nextNode()) {
            if(!walker.currentNode.textContent?.trim()) continue;
            const range=doc.createRange(); range.selectNodeContents(walker.currentNode);
            for(const rect of range.getClientRects()) {
                if(rect.left<bounds.left-1||rect.right>bounds.right+1||rect.top<bounds.top-1||rect.bottom>bounds.bottom+1) overflows.push(td.textContent||'');
            }
        }
    }
    const original = HTMLCanvasElement.prototype.toDataURL;
    const captured: string[] = [];
    HTMLCanvasElement.prototype.toDataURL = function (...args) {
        const url = original.apply(this,args);
        if(this.width>=1300 && this.height>100) captured.push(url);
        return url;
    };
    const pdf=await createActivityLogPdf(data).finally(()=>{HTMLCanvasElement.prototype.toDataURL=original;});
    const shortPdf=await createActivityLogPdf({...data,activityContent:'공연을 준비하며 합주와 파트별 연습을 진행했습니다.',participants:['테스트가','테스트나']});
    result.textContent=`${!overflows.length && pdf.getNumberOfPages()>1 && shortPdf.getNumberOfPages()===1 ? 'PASS':'FAIL'}: 넘침 ${overflows.length}곳, 긴 문서 ${pdf.getNumberOfPages()}쪽, 일반 문서 ${shortPdf.getNumberOfPages()}쪽\n${overflows.join('\n')}`;
    preview.style.display='none';
    for(const url of captured) {
        const image=document.createElement('img'); image.src=url; image.style.cssText='width:340px;vertical-align:top;border:1px solid #999;margin:8px'; document.body.appendChild(image);
    }
});
