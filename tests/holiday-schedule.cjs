const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const cache = new Map();
const fixtures = [
 ['2026-10-01','국군의날','기념일\n기념일을 숨기려면 설정을 변경하세요.'],
 ['2026-10-03','개천절','공휴일'],['2026-10-05','쉬는 날 개천절','공휴일'],
 ['2026-09-24','추석 연휴','공휴일'],['2026-09-25','추석','공휴일'],['2026-09-26','추석 연휴','공휴일'],
 ['2026-02-16','설날 연휴','공휴일'],['2026-02-17','설날','공휴일'],['2026-02-18','설날 연휴','공휴일'],
 ['2026-12-24','크리스마스 이브','기념일'],['2026-12-25','크리스마스','공휴일'],
];
const ctx = vm.createContext({
 CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},
 CalendarApp:{getCalendarById:()=>({getEvents:()=>fixtures.map(([date,title,description])=>({getStartTime:()=>date,getTitle:()=>title,getDescription:()=>description}))})},
 Utilities:{formatDate:d=>d},
});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../GAS_FINAL_DEPLOY.js'),'utf8'),ctx);
cache.set('kr_holidays_v1_2026',JSON.stringify({available:true,holidays:[{date:'2026-10-01',name:'국군의날'}]}));
assert.equal(ctx.getHolidayCalendarForYear(2026).holidays.length,9);
for(const date of ['2026-10-01','2026-12-24']) {
 const hours=ctx.getOperatingHoursForDate(date); assert.equal(hours.start,9); assert.equal(hours.end,21); assert.equal(hours.closed,false);
}
for(const date of ['2026-10-03','2026-10-05','2026-12-25','2026-10-04']) {
 const hours=ctx.getOperatingHoursForDate(date); assert.equal(hours.start,10); assert.equal(hours.end,17); assert.equal(hours.closed,false);
}
for(const date of ['2026-09-24','2026-09-25','2026-09-26','2026-02-16','2026-02-17','2026-02-18']) assert.equal(ctx.getOperatingHoursForDate(date).closed,true);
assert.equal(ctx.isMajorHolidayClosure('쉬는 날 설날'),false);
assert.equal(ctx.isMajorHolidayClosure('추석 대체공휴일'),false);
assert.equal(ctx.isPublicHolidayEvent({getDescription:()=> 'Observance\nPublic holidays settings'}),false);
assert.equal(ctx.isPublicHolidayEvent({getDescription:()=> 'Public holiday'}),true);
console.log('PASS: observances excluded, public/substitute holidays and Sundays 10-17, Seollal/Chuseok closed, old cache bypassed.');
