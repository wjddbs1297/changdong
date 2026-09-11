const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const rows = [Array(26).fill('')];
const users = [['id','name'],['User01','Club A'],['User02','Duplicate'],['User03','Duplicate']];
const cache = new Map();
let serial = 0;
const sheet = {
  getDataRange: () => ({getValues: () => rows.map(r => r.slice())}),
  getRange: (r,c) => ({setValue: v => {rows[r-1][c-1]=v;}, setValues: vv => vv.forEach((v,j)=>v.forEach((x,k)=>rows[r-1+j][c-1+k]=x))}),
  deleteRow: r => rows.splice(r-1,1),
};
const ctx = vm.createContext({console,
  SpreadsheetApp: {flush(){},openById:()=>({getSheetByName:n=>n==='Users'?{getDataRange:()=>({getValues:()=>users})}:sheet})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  Utilities:{getUuid:()=>String(++serial)},
  CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
});
vm.runInContext(readFileSync(require('node:path').join(__dirname,'../GAS_FINAL_DEPLOY.js'),'utf8'),ctx);
ctx.formatDateSafe=v=>v;
ctx.formatTimeSafe=v=>v;
ctx.sendResponse=(data,success=true)=>({data,success});
ctx.getOperatingHoursForDate=()=>({start:9,end:21,closed:false});
function add(id,owner,name,start='10:00') {
  const r=Array(26).fill('');
  [id,owner,name,'2026-10-01',start,'11:00','room'].forEach((v,i)=>r[i]=v);
  rows.push(r);
}
add('','User01','Club A');
add('','','Club A','12:00');
add('','','Duplicate');
add('existing','User03','Club A');
const authUser={id:'User01',role:'user'};
const bookings=ctx.getBookingsData({userId:'User01',authUser});
assert.equal(bookings.length,2);
assert.ok(bookings.every(b=>b.id.startsWith('BK_IMPORT_')));
assert.equal(rows[2][1],'User01');
assert.equal(rows[3][1],''); // ambiguous name must not acquire an owner
assert.equal(rows[4][1],'User03'); // existing owner is authoritative
const firstId=rows[1][0];
ctx.repairImportedBookingIdentity(sheet);
assert.equal(rows[1][0],firstId);
assert.equal(ctx.updateBooking({bookingId:firstId,userId:'User02',authUser:{id:'User02',role:'user'},date:'2026-10-02',startTime:'10:00',duration:1,roomId:'room'}).success,false);
assert.equal(ctx.updateBooking({bookingId:firstId,userId:'User01',authUser,date:'2026-10-02',startTime:'10:00',duration:1,roomId:'room'}).success,true);
assert.equal(rows[1][3],'2026-10-02');
assert.equal(ctx.cancelBooking({bookingId:firstId,userId:'User02',authUser:{id:'User02',role:'user'}}).success,false);
assert.equal(ctx.cancelBooking({bookingId:firstId,userId:'User01',authUser}).success,true);
assert.ok(!rows.some(r=>r[0]===firstId));
console.log('PASS: imported IDs persist, unique names resolve, ambiguous/existing owners preserved, owner edit/cancel succeeds, other clubs denied.');
