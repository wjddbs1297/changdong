document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const excelInput = document.getElementById('excelFile');
    const excelStatus = document.getElementById('excelStatus');
    const generateBtn = document.getElementById('generateBtn');
    const excelBox = document.getElementById('excelBox');
    const downloadSampleBtn = document.getElementById('downloadSampleBtn');

    const statusSection = document.getElementById('statusSection');
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');
    const logList = document.getElementById('logList');

    let excelData = null;

    // Excel Input Handler
    excelInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            excelStatus.textContent = "로딩 중...";

            const reader = new FileReader();
            reader.onload = function (evt) {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];

                    // Convert to JSON (array of objects)
                    excelData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                    if (excelData.length > 0) {
                        excelStatus.textContent = `${file.name} (총 ${excelData.length}건)`;
                        excelStatus.classList.add('success');

                        // Enable generate button
                        generateBtn.classList.remove('disabled');
                        generateBtn.disabled = false;
                    } else {
                        excelStatus.textContent = "엑셀 파일에 데이터가 없습니다.";
                        excelStatus.classList.remove('success');
                        excelData = null;
                        generateBtn.classList.add('disabled');
                    }
                } catch (err) {
                    console.error(err);
                    excelStatus.textContent = "엑셀 오류 발생. 샘플 엑셀을 확인하세요.";
                    excelStatus.classList.remove('success');
                    excelData = null;
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            excelStatus.textContent = "선택된 파일 없음";
            excelStatus.classList.remove('success');
            excelData = null;
            generateBtn.classList.add('disabled');
        }
    });

    // Drag and drop setup for Excel
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
        excelBox.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
    });

    ['dragenter', 'dragover'].forEach(ev => {
        excelBox.addEventListener(ev, () => excelBox.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(ev => {
        excelBox.addEventListener(ev, () => excelBox.classList.remove('dragover'), false);
    });

    excelBox.addEventListener('drop', (e) => {
        let dt = e.dataTransfer;
        if (dt.files.length > 0) {
            excelInput.files = dt.files;
            excelInput.dispatchEvent(new Event('change'));
        }
    });

    // Download Sample Excel
    downloadSampleBtn.addEventListener('click', () => {
        const headers = [
            "동아리명", "분야", "설립연도_년", "설립연도_월", "설립연도_일", "현재기수", "설립목적", "구성학교수", "구성학교명",
            "총인원", "남자수", "여자수", "중1", "중2", "중3", "고1", "고2", "고3", "대1", "대2", "대3_4", "해당없음수",
            "동아리소개", "동아리특기", "올해목표", "대표자명", "대표자학교_학년", "대표자주소", "대표자주민번호_앞자리기준", "대표자연락처", "대표자이메일",
            "제출연도", "제출월", "제출일"
        ];

        const sampleRows = [
            headers,
            [
                "코딩동아리 (예시)", "IT/과학", "2023", "3", "1", "2", "코딩 학습 및 프로젝트 진행", "1", "창동중학교",
                "10", "6", "4", "2", "1", "0", "3", "4", "0", "0", "0", "0", "0",
                "저희 동아리는 프로그래밍을 배우고 함께 프로젝트를 수행하는 동아리입니다. 누구나 환영합니다!", "2023 교내 해커톤 대상", "올해는 앱스토어에 직접 만든 앱을 최소 1개 등록하는 것이 저희의 큰 목표입니다.",
                "홍길동", "창동고 1학년", "서울시 도봉구 노해로 123", "050101", "010-1234-5678", "hong@example.com",
                "2024", "4", "5"
            ]
        ];

        const ws = XLSX.utils.aoa_to_sheet(sampleRows);

        // 열 너비 조정
        const wscols = headers.map(h => ({ wch: h.length > 8 ? h.length * 1.5 : 12 }));
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "데이터_입력");
        XLSX.writeFile(wb, "동아리_가입신청서_데이터입력샘플.xlsx");
    });

    // Logging utility
    function addLog(message, type = 'normal') {
        const li = document.createElement('li');
        li.textContent = message;
        if (type === 'success') li.classList.add('log-success');
        if (type === 'error') li.classList.add('log-error');
        logList.appendChild(li);
        logList.scrollTop = logList.scrollHeight;
    }

    // Generate process (Using wordGenerator.js)
    generateBtn.addEventListener('click', async () => {
        if (!excelData || excelData.length === 0) return;

        generateBtn.classList.add('disabled');
        generateBtn.disabled = true;
        statusSection.classList.remove('hidden');
        logList.innerHTML = '';

        const totalRows = excelData.length;
        let successCount = 0;

        const zipOutput = new JSZip();
        statusText.textContent = "변환을 진행하고 있습니다...";

        for (let i = 0; i < totalRows; i++) {
            const row = excelData[i];

            try {
                // Call wordGenerator.js function
                const blob = await window.generateClubWordDocument(row);

                const clubName = row['동아리명'] || `신청서_${i + 1}`;
                const safeFileName = clubName.replace(/[\\/:*?"<>|]/g, "") + "_가입신청서.docx";

                zipOutput.file(safeFileName, blob);

                successCount++;
                addLog(`[${i + 1}/${totalRows}] ${safeFileName} 생성 완료`, 'success');

            } catch (error) {
                console.error(error);
                addLog(`[${i + 1}/${totalRows}] ${i + 1}번째 생성 오류: ${error.message}`, 'error');
            }

            progressBar.style.width = `${((i + 1) / totalRows) * 100}%`;
            await new Promise(r => setTimeout(r, 10)); // UI 렌더링 딜레이
        }

        if (successCount > 0) {
            statusText.textContent = "압축 파일(ZIP) 저장 중...";
            addLog("결과물을 압축하고 있습니다...");

            zipOutput.generateAsync({ type: "blob" }).then(function (content) {
                saveAs(content, "동아리_신청서_자동완성결과.zip");
                statusText.textContent = `완료! 총 ${successCount}건 생성되었습니다.`;
                addLog(`모든 작업이 완료되었습니다. 결과물을 확인하세요! ✨`, 'success');
                generateBtn.classList.remove('disabled');
                generateBtn.disabled = false;
            });
        } else {
            statusText.textContent = "생성 오류 발생";
        }
    });
});
