# Antigravity-quota+ko-pack (한국어 패치 & 모델 잔여 한도 게이지)

Google Antigravity 데스크톱 앱(v2.29.0 / Electron 44.5.1 기준)을 위한 **무의존성(Zero-dependency) 한국어 언어팩 & ChatGPT 스타일 실시간 모델 잔여 한도(Quota) 인디케이터 패치**입니다.

Node.js나 Python이 설치되어 있지 않은 PC에서도 **Antigravity 자체 내장 런타임(`Antigravity.exe`)**을 활용해 원클릭으로 설치·복원·업데이트할 수 있도록 제작되었습니다.

---

## 주요 특징

- **ChatGPT 스타일 이중 호(Dual-Arc) 모델 잔여 한도 인디케이터**:
  - 좌하단 `설정(Settings)` 버튼 바로 위에 **Gemini**, **Claude 및 GPT**, **Argon(`Ar`)** 모델군의 잔여 한도 게이지와 **원형 새로고침 버튼**을 가로로 배치합니다.
  - **상단 작은 호**: 5시간 잔여 한도 (`5시간 한도 · NN% 남음`)
  - **하단 넓은 호**: 주간 잔여 한도 (`주간 한도 · NN% 남음`) — Argon 단독 쿼타는 5시간 한도가 없으므로 통일감 있게 하단 주간 한도 호만 표시합니다.
  - **자동 및 수동 새로고침**: 앱 실행 시 자동으로 모델 잔여 한도를 1회 새로고침하여 최신 상태로 동기화하며, 우측 새로고침 아이콘 클릭 시 언제든 즉시 갱신됩니다.
- **광범위한 UI 번역**:
  - 정적 UI 문자열 **3,954개** + 동적 문장 패턴 **244개** 내장 (메뉴, 설정, 모델 및 사용량 한도 안내, 에이전트 상태, 권한 확인, 마켓플레이스, 플러그인, Git/워크스페이스, 툴팁, 토스트, 트레이 메뉴, 네이티브 다이얼로그 포함)
- **가독성 높은 한국어 타이포그래피**:
  - `Pretendard Variable` / `IBM Plex Sans KR` / `Noto Sans KR` 기반의 선명하고 둥근 한글 폰트 및 웨이트 보정이 자동 적용됩니다.
- **안전한 콘텐츠 보호**:
  - AI 응답 마크다운(`[data-markdown-root]`), 사용자 채팅 메시지, 코드 블록(`pre`, `code`), 수식(`.katex`), 터미널(`.xterm`), 에디터, 사용자 입력창은 **절대 변형하지 않습니다.**
- **즉시 한/영 전환 (`Ctrl+Alt+K` & 대화 형식 설정)**:
  - 앱 사용 중 언제든 **`Ctrl+Alt+K`** (macOS: `Cmd+Alt+K`)를 누르면 **새로고침 없이 즉시 한국어 ↔ 영어**가 전환됩니다.
  - **설정(Settings) > 대화 형식(Appearance)** 메뉴 내의 `표시 언어 (Display Language)` 드롭다운 또는 **시스템 트레이 아이콘 우클릭 메뉴**(`한국어 UI (Ctrl+Alt+K)`)에서도 전환할 수 있습니다.
- **비침습적(Non-invasive) ASAR 패치 & 자동 백업**:
  - `language_server.exe` 바이너리는 전혀 수정하지 않으며, `resources/app.asar`만 `resources/app.asar.bak`으로 자동 백업한 뒤 경량 런타임 훅을 주입합니다.

---

## 설치 및 사용 방법

### Windows (원클릭)
1. **`install-ko.bat`**을 더블클릭합니다.
2. 이미 실행 중인 Antigravity가 있다면 창에서 새로고침하거나 앱을 다시 시작하면 한국어 UI가 적용됩니다.
3. 원본 복원이 필요할 때는 **`uninstall-ko.bat`**을 더블클릭하면 백업본(`app.asar.bak`)으로 즉시 복구됩니다.

### macOS / Linux
```bash
chmod +x install-ko.sh
./install-ko.sh install     # 한국어 패치 설치
./install-ko.sh status      # 설치 상태 확인
./install-ko.sh uninstall   # 원본 복원
```

### 사용자 지정 설치 경로 지정
기본 경로 외의 위치에 Antigravity가 설치되어 있다면 `--app-dir` 옵션을 전달하세요:
```powershell
.\install-ko.bat --app-dir "D:\Apps\Antigravity"
```

---

## 앱 업데이트 대응 및 사용자 번역 추가

Antigravity가 새 버전으로 자동 업데이트되면 `app.asar`가 초기화됩니다. 이때는:

1. **`update-strings.bat`**을 실행하면:
   - 새 버전의 `language_server`에서 새로 추가된 UI 문자열을 자동 스캔하여 `locales/untranslated.json`에 기록하고,
   - `locales/ko-custom.json`에 작성한 사용자 정의 번역을 `locales/ko.json`에 병합한 뒤,
   - 패치를 자동으로 다시 설치합니다.
2. 원하는 번역 문구를 직접 수정하거나 추가하려면:
   - 패키지 내 `locales/ko-custom.json` 또는 사용자 홈 폴더의 `~/.gemini/antigravity/ko-custom.json`에 `{"English": "한국어"}` 형태로 추가하면 즉시 우선 적용됩니다.

---

## 디렉터리 구조

```text
antigravity-ko/
├── install-ko.bat          # [Windows] 원클릭 한국어 패치 설치
├── uninstall-ko.bat        # [Windows] 원클릭 패치 제거 및 원본 복원
├── update-strings.bat      # [Windows] 앱 업데이트 후 신규 문자열 추출 및 재설치
├── install-ko.sh           # [macOS/Linux] 설치/제거/상태확인 스크립트
├── locales/
│   ├── ko.json             # 한국어 번역 사전 (정적 3,730개 + 동적 패턴 206개)
│   └── ko-custom.json      # 사용자 정의 번역 오버라이드 파일
├── src/
│   ├── ko-i18n.js          # 렌더러/Preload DOM & 속성 실시간 번역 엔진
│   └── ko-main.js          # Electron 메인 프로세스 (트레이/메뉴/다이얼로그) 번역 훅
├── lib/
│   ├── asar.js             # 무의존성 순수 JS ASAR 파서/리패커
│   └── fuses.js            # Electron Fuse 검사 유틸리티
├── tools/
│   ├── patch.js            # 패치 설치 / 제거 / 상태 확인 CLI
│   ├── update-strings.js   # 신규 버전 UI 번들 추출 및 미번역 문자열 스캔 도구
│   ├── build-dict.js       # 사전 병합 및 빌드 스크립트
│   ├── audit-dict.js       # 사전 품질 검증 스크립트
│   └── extract-ui-zip.js   # language_server 내장 UI 아카이브 추출기
└── docs/
    └── TRANSLATION_GUIDE.md # 한국어 용어집 및 번역 스타일 가이드
```
