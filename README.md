# 과학 대시 · Science Dash (교사 관리 버전)

3학년 2학기 과학 1단원 물체와 물질 · 2단원 지구와 바다 · 3단원 소리의 성질 복습 게임 (단원마다 10단계, 3학년 1~7반)

- 학생 주소: `https://(내 주소)/`
- 선생님 주소: `https://(내 주소)/teacher`
- 전자칠판 주소: `https://(내 주소)/board?cls=1` (선생님 화면의 📺 전자칠판 버튼으로 열어도 돼요)

## Render에 올리기
1. GitHub에 새 저장소를 만들고 이 폴더의 파일(server.js, package.json, public 폴더, README.md)을 올려요.
2. Render → New → Web Service → 저장소 선택
   - Build Command: `npm install`
   - Start Command: `npm start`
3. Environment에 `TEACHER_PASSWORD` = 원하는 비밀번호 를 넣어요. (넣지 않으면 아무도 로그인할 수 없어요. Render 환경 그룹 teacher-password를 연결해 두었어요)

## 알아 두기
- 무료 서버는 한동안 안 쓰면 잠들었다가 첫 접속 때 30초~1분쯤 걸려 깨어나요. 수업 전에 선생님 화면을 먼저 열어 두세요.
- 무료 서버는 다시 시작되면 기록이 지워질 수 있어요. 선생님 화면 → 기록 관리에서 백업 파일을 받아 두고, 필요하면 불러오세요.
- public 폴더(index.html + assets 폴더)는 서버 없이 올려도(GitHub Pages 등) 혼자 하기 모드로 돌아가요. assets 폴더를 꼭 같이 올려 주세요.
- 서버 없이 쓸 때 학생은 단원을 고르지 않아요. 주소 끝에 `?unit=1`, `?unit=2`, `?unit=3`를 붙여 나눠 주세요. 붙이지 않으면 선생님이 정한 단원(기본 1단원)으로 바로 시작해요.
- 선생님 설정 화면(단원 정하기·문제 편집)은 주소 끝에 `?teacher`를 붙여 열어요.
- 첫 화면의 ‘교사 설정’: 서버로 쓸 때는 선생님 관리 화면(/teacher)으로 가요. 서버 없이 쓸 때는 선생님 비밀번호를 넣으면 단원 정하기·문제 편집 화면이 열려요.
