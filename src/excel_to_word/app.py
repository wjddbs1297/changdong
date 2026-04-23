import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import pandas as pd
from docxtpl import DocxTemplate
import os
import threading
import traceback

class Application(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("동아리 가입신청서 자동 생성기")
        self.geometry("600x350")
        self.configure(padx=20, pady=20)
        
        # 변수 설정
        self.excel_path = tk.StringVar()
        self.template_path = tk.StringVar()
        self.output_dir = tk.StringVar()
        
        # 기본 출력 경로를 바탕화면으로 설정
        self.output_dir.set(os.path.join(os.path.expanduser("~"), "Desktop", "동아리_가입신청서_결과"))

        self.create_widgets()

    def create_widgets(self):
        # 스타일
        style = ttk.Style()
        style.configure('TButton', font=('Malgun Gothic', 10))
        style.configure('TLabel', font=('Malgun Gothic', 10))
        
        # 제목
        title_label = ttk.Label(self, text="📝 엑셀 ➔ 워드 양식 자동 변환기", font=('Malgun Gothic', 16, 'bold'))
        title_label.grid(row=0, column=0, columnspan=3, pady=(0, 20))

        # 1. 엑셀 파일 선택
        ttk.Label(self, text="1. 엑셀 파일:").grid(row=1, column=0, sticky='w', pady=5)
        ttk.Entry(self, textvariable=self.excel_path, width=50, state='readonly').grid(row=1, column=1, padx=10)
        ttk.Button(self, text="찾아보기", command=self.select_excel).grid(row=1, column=2)

        # 2. 워드 템플릿 선택
        ttk.Label(self, text="2. 워드 템플릿:").grid(row=2, column=0, sticky='w', pady=5)
        ttk.Entry(self, textvariable=self.template_path, width=50, state='readonly').grid(row=2, column=1, padx=10)
        ttk.Button(self, text="찾아보기", command=self.select_template).grid(row=2, column=2)

        # 3. 저장 위치
        ttk.Label(self, text="3. 저장 폴더:").grid(row=3, column=0, sticky='w', pady=5)
        ttk.Entry(self, textvariable=self.output_dir, width=50, state='readonly').grid(row=3, column=1, padx=10)
        ttk.Button(self, text="찾아보기", command=self.select_output).grid(row=3, column=2)

        # 진행 상태
        self.progress = ttk.Progressbar(self, orient="horizontal", length=400, mode="determinate")
        self.progress.grid(row=4, column=0, columnspan=3, pady=20)
        
        self.status_label = ttk.Label(self, text="대기 중...")
        self.status_label.grid(row=5, column=0, columnspan=3)

        # 변환 버튼
        self.run_button = tk.Button(self, text="변환 시작🚀", font=('Malgun Gothic', 12, 'bold'), bg="#4CAF50", fg="white", command=self.start_conversion)
        self.run_button.grid(row=6, column=0, columnspan=3, pady=20, ipadx=20, ipady=5)

    def select_excel(self):
        path = filedialog.askopenfilename(filetypes=[("Excel files", "*.xlsx *.xls")])
        if path:
            self.excel_path.set(path)

    def select_template(self):
        path = filedialog.askopenfilename(filetypes=[("Word Template", "*.docx")])
        if path:
            self.template_path.set(path)

    def select_output(self):
        path = filedialog.askdirectory()
        if path:
            self.output_dir.set(path)

    def start_conversion(self):
        if not self.excel_path.get() or not self.template_path.get():
            messagebox.showwarning("경고", "엑셀 파일과 워드 템플릿 파일을 모두 선택해주세요.")
            return
            
        self.run_button.config(state='disabled')
        self.progress['value'] = 0
        self.status_label.config(text="변환 중...")
        
        # UI가 멈추지 않도록 새로운 쓰레드에서 변환 작업 실행
        thread = threading.Thread(target=self.process_files)
        thread.start()

    def process_files(self):
        try:
            excel_path = self.excel_path.get()
            template_path = self.template_path.get()
            output_dir = self.output_dir.get()

            # 저장 폴더가 없으면 생성
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)

            # 엑셀 데이터 읽기 (결측치는 빈 문자열로 처리)
            df = pd.read_excel(excel_path)
            df = df.fillna('')
            
            total_rows = len(df)
            success_count = 0

            for index, row in df.iterrows():
                try:
                    # 템플릿 열기
                    doc = DocxTemplate(template_path)
                    
                    # 엑셀의 열 이름(Header)을 변수로 하여 값을 딕셔너리로 변환
                    context = row.to_dict()
                    
                    # 값들 중 날짜 형식 등이 있으면 문자열로 변환
                    for key, value in context.items():
                        context[key] = str(value)
                    
                    # 워드 템플릿 변수에 값 렌더링
                    doc.render(context)
                    
                    # 파일명 식별을 위해 '동아리명' 열을 가져옴. 없으면 숫자로 대체
                    club_name = context.get('동아리명', f'신청서_{index+1}')
                    # 파일명에 사용할 수 없는 특수문자 제거
                    safe_club_name = "".join(c for c in club_name if c not in r'\/:*?"<>|')
                    output_path = os.path.join(output_dir, f"{safe_club_name}_가입신청서.docx")
                    
                    doc.save(output_path)
                    success_count += 1
                    
                except Exception as e:
                    print(f"[{index+1}행] 변환 실패: {e}")
                
                # 프로그레스 바 업데이트
                self.progress['value'] = ((index + 1) / total_rows) * 100
                self.update_idletasks()

            self.status_label.config(text=f"완료! 총 {success_count}개의 파일이 생성되었습니다.")
            messagebox.showinfo("완료", f"작업이 완료되었습니다.\n{output_dir} 폴더를 확인해주세요.")

        except Exception as e:
            error_msg = traceback.format_exc()
            messagebox.showerror("에러 발생", f"파일을 처리하는 중 문제가 발생했습니다.\n에러내용: {e}")
            self.status_label.config(text="변환 실패")
            print(error_msg)
        finally:
            self.run_button.config(state='normal')

if __name__ == "__main__":
    app = Application()
    app.mainloop()
