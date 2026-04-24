const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, TableBorders, BorderStyle, WidthType, AlignmentType, VerticalAlign, HeadingLevel } = docx;

// 데이터 파싱 헬퍼 함수
function getVal(row, key, defaultVal = '') {
    return row[key] ? String(row[key]).trim() : defaultVal;
}

// 테두리 두께 및 색상 
const bStyle = {
    top: { style: BorderStyle.SINGLE, size: 3, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 3, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 3, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 3, color: "000000" }
};
const tbBorders = {
    top: { style: BorderStyle.SINGLE, size: 8, color: "000000" }, // 외부 굵은 테두리
    bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 3, color: "707070" },
    insideVertical: { style: BorderStyle.SINGLE, size: 3, color: "707070" }
};

// Paragraph 렌더링 헬퍼
function createPara(text, bold = false, align = AlignmentType.LEFT, size = 20) {
    return new Paragraph({
        alignment: align,
        children: [
            new TextRun({
                text: text,
                bold: bold,
                size: size, // 10pt = 20 (half-points)
                font: "맑은 고딕"
            })
        ],
        spacing: { after: 60, before: 60, line: 300 } // 줄간격
    });
}

// 줄바꿈이 있는 Paragraph 렌더링 헬퍼
function createMultiLinePara(text, bold = false, align = AlignmentType.LEFT, size = 20) {
    const lines = text.split('\n');
    const runs = [];
    lines.forEach((line, index) => {
        runs.push(new TextRun({ text: line, bold: bold, size: size, font: "맑은 고딕" }));
        if (index < lines.length - 1) {
            runs.push(new TextRun({ break: 1 }));
        }
    });

    return new Paragraph({
        alignment: align,
        children: runs,
        spacing: { after: 60, before: 60, line: 300 }
    });
}

// Cell 렌더링 헬퍼
function createCell({ text = "", bold = false, align = AlignmentType.CENTER, vAlign = VerticalAlign.CENTER, widthPercent, bgColor = "", rowSpan = 1, colSpan = 1, multiLine = false, customPara = null }) {
    let para;
    if (customPara) {
        para = customPara;
    } else if (multiLine) {
        para = createMultiLinePara(text, bold, align);
    } else {
        para = createPara(text, bold, align);
    }

    return new TableCell({
        children: [para],
        verticalAlign: vAlign,
        shading: bgColor ? { fill: bgColor } : undefined,
        width: widthPercent ? { size: widthPercent, type: WidthType.PERCENTAGE } : undefined,
        rowSpan: rowSpan > 1 ? rowSpan : undefined,
        columnSpan: colSpan > 1 ? colSpan : undefined,
        margins: { top: 100, bottom: 100, left: 150, right: 150 }
    });
}

// 1. 신청서 (Image 2) 생성 함수
function generateApplicationFormPart(row) {
    const p1 = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 400 },
        children: [
            new TextRun({ text: "시립창동청소년센터 소속 동아리 신청서", bold: true, size: 36, font: "맑은 고딕" }) // 18pt
        ]
    });

    // 상단 우측 결재 표 (담당, 팀장)
    const signTable = new Table({
        width: { size: 30, type: WidthType.PERCENTAGE },
        alignment: AlignmentType.RIGHT,
        rows: [
            new TableRow({
                children: [
                    createCell({ text: "결\n재", rowSpan: 2, widthPercent: 10, bgColor: "F2F2F2", multiLine: true }),
                    createCell({ text: "담\n당", widthPercent: 45, bgColor: "F2F2F2", multiLine: true }),
                    createCell({ text: "팀\n장", widthPercent: 45, bgColor: "F2F2F2", multiLine: true })
                ]
            }),
            new TableRow({
                height: { value: 800, rule: "exact" }, // 결재 도장 찍을 칸 넓게
                children: [
                    createCell({ text: "" }),
                    createCell({ text: "" })
                ]
            })
        ]
    });

    // 메인 정보 표
    const mainTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tbBorders,
        rows: [
            // Row 1
            new TableRow({
                children: [
                    createCell({ text: "동아리명", bold: true, bgColor: "EBEBEB", widthPercent: 20 }),
                    createCell({ text: getVal(row, '동아리명'), widthPercent: 40 }),
                    createCell({ text: "분  야", bold: true, bgColor: "EBEBEB", widthPercent: 15 }),
                    createCell({ text: getVal(row, '분야'), widthPercent: 25 })
                ]
            }),
            // Row 2 : 대표자 인적사항 타이틀
            new TableRow({
                children: [
                    createCell({ text: "대표자 인적사항", bold: true, bgColor: "FAFAFA", colSpan: 4, align: AlignmentType.LEFT })
                ]
            }),
            // Row 3
            new TableRow({
                children: [
                    createCell({ text: "성  명", bold: true, bgColor: "EBEBEB" }),
                    createCell({ text: getVal(row, '대표자명') }),
                    createCell({ text: "학교(학년)", bold: true, bgColor: "EBEBEB" }),
                    createCell({ text: getVal(row, '대표자학교_학년') })
                ]
            }),
            // Row 4
            new TableRow({
                children: [
                    createCell({ text: "주  소", bold: true, bgColor: "EBEBEB" }),
                    createCell({ text: getVal(row, '대표자주소') }),
                    createCell({ text: "주민번호", bold: true, bgColor: "EBEBEB" }),
                    createCell({ text: getVal(row, '대표자주민번호_앞자리기준') + " - " }) // 뒷자리 가림
                ]
            }),
            // Row 5
            new TableRow({
                children: [
                    createCell({ text: "연 락 처", bold: true, bgColor: "EBEBEB" }),
                    createCell({ text: getVal(row, '대표자연락처') }),
                    createCell({ text: "E · mail", bold: true, bgColor: "EBEBEB" }),
                    createCell({ text: getVal(row, '대표자이메일') })
                ]
            }),
            // Row 6
            new TableRow({
                children: [
                    createCell({ text: "동아리인원", bold: true, bgColor: "EBEBEB" }),
                    createCell({ text: getVal(row, '총인원') + " 명", colSpan: 3, align: AlignmentType.LEFT })
                ]
            }),
            // Row 7 : 혜택 / 준수사항 (1개의 큰 셀 안에 여러 Paragraphs)
            new TableRow({
                children: [
                    createCell({
                        colSpan: 4,
                        align: AlignmentType.LEFT,
                        vAlign: VerticalAlign.TOP,
                        customPara: new Paragraph({
                            spacing: { before: 100, after: 100, line: 360 },
                            children: [
                                new TextRun({ text: "※ 동아리가입시 혜택", bold: true, size: 20, font: "맑은 고딕" }),
                                new TextRun({ break: 1 }),
                                new TextRun({ text: "  - 동아리인증서 발급, 대외활동시 장비 및 활동사업지원", size: 18, font: "맑은 고딕" }),
                                new TextRun({ break: 1 }),
                                new TextRun({ text: "  - 각종 발표회 · 경연대회 지원 및 추천", size: 18, font: "맑은 고딕" }),
                                new TextRun({ break: 1 }),
                                new TextRun({ text: "  - 우수동아리 선정시 교육지원 및 포상", size: 18, font: "맑은 고딕" }),
                                new TextRun({ break: 1 }),
                                new TextRun({ text: "  - 청소년동아리 정기회의 운영 및 워크숍(캠프) 등 참석", size: 18, font: "맑은 고딕" }),
                                new TextRun({ break: 1, break: 1 }), // 빈 줄 추가
                                new TextRun({ text: "※ 동아리 준수사항", bold: true, size: 20, font: "맑은 고딕" }),
                                new TextRun({ break: 1 }),
                                new TextRun({ text: "  - 행사 및 센터내에서는 지도교사를 포함하여 흡연을 금한다. (흡연발생시 활동중지)", size: 18, font: "맑은 고딕" }),
                                new TextRun({ break: 1 }),
                                new TextRun({ text: "  - 사용한 장소는 깨끗이 정리한다. (2회 이상 정리가 안 된 경우 별도 조치)", size: 18, font: "맑은 고딕" }),
                                new TextRun({ break: 1 }),
                                new TextRun({ text: "  - 동아리 시설사용시 반드시 사전협의후 승인을 받아 사용한다.", size: 18, font: "맑은 고딕" }),
                                new TextRun({ break: 1 }),
                                new TextRun({ text: "  - 동아리 전체행사 및 회의에 적극 참여한다.", size: 18, font: "맑은 고딕" }),
                                new TextRun({ break: 1 }),
                                new TextRun({ text: "  - 필수 참가 활동 (연합회의, 오프닝 멤버스, 상상충전200%, 상상나들이, 상상문화놀이터, SSA)", size: 18, font: "맑은 고딕", color: "FF0000" }),
                                new TextRun({ break: 1, break: 1 }),
                                new TextRun({ text: "※ 동아리 활동 계획서 및 동아리 회원명단 첨부", bold: true, size: 20, font: "맑은 고딕" })
                            ]
                        })
                    })
                ]
            }),
            // Row 8 : 서약서 및 날짜
            new TableRow({
                children: [
                    createCell({
                        colSpan: 4,
                        align: AlignmentType.CENTER,
                        vAlign: VerticalAlign.CENTER,
                        customPara: new Paragraph({
                            spacing: { before: 400, after: 400, line: 400 },
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: "상기 사항 및 청소년동아리 이용수칙을 확인 및 동의하고", size: 22, font: "맑은 고딕" }),
                                new TextRun({ break: 1 }),
                                new TextRun({ text: "시립창동청소년센터 동아리로 가입함을 확인합니다.", size: 22, font: "맑은 고딕" }),
                                new TextRun({ break: 2 }), // 2줄 띄움
                                new TextRun({ text: `              ${getVal(row, '제출연도')} 년      ${getVal(row, '제출월')} 월      ${getVal(row, '제출일')} 일`, size: 22, font: "맑은 고딕" }),
                                new TextRun({ break: 1 }),
                                new TextRun({ text: `                                                      신청인 :  ${getVal(row, '대표자명')}  (인)`, size: 22, font: "맑은 고딕" }),
                                new TextRun({ break: 4 }), // 아주 많이 띄움
                                new TextRun({ text: "서울특별시립 창동청소년센터", bold: true, size: 36, font: "맑은 고딕" })
                            ]
                        })
                    })
                ]
            })
        ]
    });

    return [signTable, new Paragraph({ text: "" }), p1, mainTable];
}

// 2. 활동 계획서 (Image 1) 생성 함수
function generateActivityPlanPart(row) {
    const title = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 400 },
        children: [
            new TextRun({ text: "동아리 활동 계획서", bold: true, size: 36, font: "맑은 고딕" })
        ]
    });

    const bodyTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tbBorders,
        rows: [
            // Row 1
            new TableRow({
                children: [
                    createCell({ text: "1. 동 아 리 명", bgColor: "E6E6FA", widthPercent: 25 }),
                    createCell({ text: getVal(row, '동아리명'), widthPercent: 75, align: AlignmentType.LEFT })
                ]
            }),
            // Row 2
            new TableRow({
                children: [
                    createCell({ text: "2. 설 립 연 도", bgColor: "E6E6FA" }),
                    createCell({ text: `          ${getVal(row, '설립연도_년')}  년      ${getVal(row, '설립연도_월')}  월      ${getVal(row, '설립연도_일')}  일         (현재   ${getVal(row, '현재기수')}  기)`, align: AlignmentType.CENTER })
                ]
            }),
            // Row 3
            new TableRow({
                children: [
                    createCell({ text: "3. 설 립 목 적", bgColor: "E6E6FA" }),
                    createCell({ text: getVal(row, '설립목적'), align: AlignmentType.LEFT })
                ]
            }),
            // Row 4
            new TableRow({
                children: [
                    createCell({ text: "4. 구 성 학 교", bgColor: "E6E6FA" }),
                    createCell({ text: `총    ${getVal(row, '구성학교수')}    개교\n학교명 : ${getVal(row, '구성학교명')}`, multiLine: true, align: AlignmentType.LEFT })
                ]
            }),
            // Row 5
            new TableRow({
                children: [
                    createCell({ text: "5. 회 원 수", bgColor: "E6E6FA" }),
                    createCell({
                        align: AlignmentType.LEFT,
                        customPara: new Paragraph({
                            spacing: { before: 100, after: 100, line: 300 },
                            children: [
                                new TextRun({ text: `총      ${getVal(row, '총인원')}      명`, font: "맑은 고딕", size: 20 }),
                                new TextRun({ break: 1 }),
                                new TextRun({ text: `▶성별 구분 : 남자   ${getVal(row, '남자수')}   명 / 여자   ${getVal(row, '여자수')}   명`, font: "맑은 고딕", size: 20 }),
                                new TextRun({ break: 1 }),
                                new TextRun({ text: `▶학년별구분 : 중학생   (1학년   ${getVal(row, '중1')}   명 / 2학년   ${getVal(row, '중2')}   명 / 3학년   ${getVal(row, '중3')}   명)`, font: "맑은 고딕", size: 20 }),
                                new TextRun({ break: 1 }),
                                new TextRun({ text: `                      고등학생 (1학년   ${getVal(row, '고1')}   명 / 2학년   ${getVal(row, '고2')}   명 / 3학년   ${getVal(row, '고3')}   명)`, font: "맑은 고딕", size: 20 }),
                                new TextRun({ break: 1 }),
                                new TextRun({ text: `                      대학생   (1학년   ${getVal(row, '대1')}   명 / 2학년   ${getVal(row, '대2')}   명 / 3,4학년   ${getVal(row, '대3_4')}   명)`, font: "맑은 고딕", size: 20 }),
                                new TextRun({ break: 1 }),
                                new TextRun({ text: `                      해당없음 (   ${getVal(row, '해당없음수')}   명)`, font: "맑은 고딕", size: 20 })
                            ]
                        })
                    })
                ]
            }),
            // Row 6
            new TableRow({
                height: { value: 3000, rule: "atLeast" }, // 자세하게 작성 - 최소 높이 
                children: [
                    createCell({ text: "6. 동아리 소개\n(자세하게 작성)", bgColor: "E6E6FA", multiLine: true }),
                    createCell({ text: getVal(row, '동아리소개'), vAlign: VerticalAlign.TOP, align: AlignmentType.LEFT, multiLine: true })
                ]
            }),
            // Row 7
            new TableRow({
                height: { value: 3000, rule: "atLeast" },
                children: [
                    createCell({ text: "7. 동아리 특기\n및 수상경력", bgColor: "E6E6FA", multiLine: true }),
                    createCell({ text: getVal(row, '동아리특기'), vAlign: VerticalAlign.TOP, align: AlignmentType.LEFT, multiLine: true })
                ]
            }),
            // Row 8
            new TableRow({
                height: { value: 3000, rule: "atLeast" },
                children: [
                    createCell({ text: "8. 올해 꼭 이루고\n싶은 동아리 목표!", bgColor: "E6E6FA", multiLine: true }),
                    createCell({
                        vAlign: VerticalAlign.TOP,
                        align: AlignmentType.LEFT,
                        customPara: new Paragraph({
                            children: [
                                new TextRun({ text: getVal(row, '올해목표'), font: "맑은 고딕", size: 20 }),
                                // 꼼수: 아래쪽에 안내문구 달기 위해 break 5번
                                new TextRun({ break: 5 }),
                                new TextRun({ text: "                                        *목표 달성 여부는 연말 우수 동아리 선정에 반영됩니다.", font: "맑은 고딕", size: 16, color: "555555" })
                            ]
                        })
                    })
                ]
            })
        ]
    });

    return [title, bodyTable];
}

window.generateClubWordDocument = async function (row) {
    // 신청서 파트
    const applicationElements = generateApplicationFormPart(row);
    // 계획서 파트 (페이지 분리 추가)
    const planElements = generateActivityPlanPart(row);

    // 페이지 분리
    const pageBreak = new Paragraph({
        children: [new docx.PageBreak()]
    });

    // 전체 문서 묶기
    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 }
                }
            },
            children: [...applicationElements, pageBreak, ...planElements]
        }]
    });

    return await Packer.toBlob(doc);
};
