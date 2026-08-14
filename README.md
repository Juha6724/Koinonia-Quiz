# Koinonia Quiz

교회 앞 iPad 키오스크에서 실행하는 스피드퀴즈 웹앱입니다. 참가자가 이름을 입력하고 연습 문제를 거친 뒤, 실제 문제를 가장 빠르게 맞히면 오늘의 랭킹에 기록됩니다.

## 주요 흐름

1. 이름 입력 및 게임 설명
   - "퀴즈가 나오자마자 빛의 속도로 정답을 클릭하세요! 가장 빨리 퀴즈를 맞춘 사람에게 선물을 드립니다"
2. Start 버튼으로 연습 라운드 시작
3. 문제/이미지형 카드와 4개 선택지 표시
4. 첫 문제 후 "처음은 연습게임!" 안내
5. 실제 라운드에서 정답이면 소요 시간을 오늘 랭킹에 등록
6. 랭킹 화면을 10초 보여준 뒤 처음 화면으로 자동 복귀
7. 관리자 PIN으로 오늘 랭킹 초기화
8. `/admin` 관리자 페이지에서 퀴즈 생성, 수정, 삭제

## 디자인 방향

- Toss 스타일의 큰 여백, 흰 카드, 부드러운 그림자
- Gemini 레퍼런스에서 영감을 받은 보라/블루 그라데이션
- iPad 현장 사용을 위한 큰 버튼과 읽기 쉬운 타이포그래피

## 개발 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 됩니다.

## Supabase 연결

1. Supabase 프로젝트를 생성합니다.
2. SQL editor에서 `supabase/schema.sql` 내용을 실행합니다.
3. Vercel 또는 로컬 `.env.local`에 아래 환경변수를 설정합니다.

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
ADMIN_RESET_PIN="admin-pin"
```

Supabase 환경변수가 없으면 앱은 브라우저 localStorage에 랭킹을 저장하는 기기 저장 모드로 동작합니다. 실제 행사/배포에서는 Supabase 환경변수를 설정하는 것을 권장합니다.

## 관리자 페이지

배포된 사이트 뒤에 `/admin`을 붙이면 관리자 페이지로 들어갈 수 있습니다.

```text
https://your-domain.vercel.app/admin
```

관리자 페이지에서는 `ADMIN_RESET_PIN` 값을 입력한 뒤 퀴즈를 만들거나 수정할 수 있습니다.

- 문제 문장
- 선택지 형태: 글자 선택지 또는 사진 선택지
- 글자 선택지 4개 또는 사진 선택지 4개
- 정답 선택
- 게임 사용 여부

사진 선택지는 태블릿/휴대폰에서는 사진앱에서, 컴퓨터에서는 파일 선택창에서 불러올 수 있습니다. 이미지는 브라우저에서 압축된 뒤 저장됩니다.

Supabase의 `quizzes` 테이블에 활성 퀴즈가 있으면 메인 게임은 그 퀴즈를 우선 사용합니다. 퀴즈가 없거나 Supabase가 연결되지 않으면 코드에 포함된 기본 퀴즈로 동작합니다.

관리자 페이지에 처음 들어갔을 때 Supabase의 `quizzes` 테이블이 비어 있으면 교회용 기본 템플릿 퀴즈가 자동으로 생성됩니다. 다른 교회에서 사용할 때도 이 기본 퀴즈의 선택지만 바꾸거나 새 퀴즈를 추가하면 됩니다.

## Vercel 배포

1. GitHub 저장소를 Vercel에 Import합니다.
2. Framework Preset은 Next.js로 둡니다.
3. Supabase 환경변수를 Vercel Project Settings > Environment Variables에 등록합니다.
4. 배포 후 iPad에서 Vercel 도메인을 전체 화면으로 열어 사용합니다.