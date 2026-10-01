import { rankingClubId } from './clubRanking';

export const PERFORMANCE_PROGRAMS = [
    { id: 'together', label: '함께해요 프로젝트', clubs: ['유스', '프리즘', '에이블', '루센트', '유니티', 'XOXO'] },
    { id: 'seoul', label: '서울시 동아리 지원사업', clubs: ['크레이브', '청온화', '아르페'] },
] as const;
export type PerformanceProgram = 'all' | typeof PERFORMANCE_PROGRAMS[number]['id'];

// Exact IDs/names only. ABLE/에이블/ABLE2026 use the established alias.
export function matchesPerformanceProgram(program: PerformanceProgram, ...identities: (string | undefined)[]) {
    if (program === 'all') return true;
    const group = PERFORMANCE_PROGRAMS.find(item => item.id === program);
    return !!group && group.clubs.some(name => identities.some(identity => identity !== undefined && rankingClubId(identity.normalize('NFC')) === rankingClubId(name)));
}
