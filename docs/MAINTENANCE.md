# Antigravity-quota+ko-pack 유지보수 및 구조 안내

## 1. 버전 업데이트 대응 구조 (v2.31.2+)
Antigravity가 새 버전으로 자동 업데이트되면 `resources/app.asar`가 순정 아카이브로 교체되면서 패치가 해제될 수 있습니다. 이를 방지하고 최소한의 수동 개입으로 유지되도록 다음 구조가 적용되어 있습니다.

### 자동 복구 (`ensure` & 이중 자동 재패치)
- **`node tools/patch.js ensure`**: 현재 `app.asar`의 패치 여부를 확인하고, 해제되어 있으면 `update-strings` 병합 후 자동으로 재설치합니다. 이미 패치되어 있으면 아무 작업도 하지 않습니다.
- **`src/ko-main.js` 업데이트 직후 자동 복구**: 패치된 상태에서 `electron-updater`가 업데이트를 다운로드하고 재시작(`quitAndInstall` / `will-quit`)할 때, 분리된 백그라운드 감시자가 새 `app.asar` 교체를 감지해 즉시 `ensure --quiet`를 실행합니다.
- **`node tools/patch.js enable-autopatch`** (Windows): 로그인 시 실행되는 시작프로그램(`AgyQuotaKoAutoPatch.vbs`)과 함께 **5분 주기 비관리자 작업 스케줄러(`AgyQuotaKoAutoPatch`)**를 등록해, 어떤 경로로 업데이트되더라도 재부팅 없이 자동 복구됩니다. (해제: `disable-autopatch`)

### 버전 무관 ASAR 훅 앵커 (`tools/patch.js`)
- **`patchMainJs`**: `Object.assign(console, ...)` → `require("electron")` / `__importStar(require("electron"))` 정규식 → `"use strict";` 직후 순으로 폴백 삽입합니다.
- **`patchPreloadJs`**: `electron_1` 하드코딩 대신 `require("electron")`이 바인딩된 변수명을 동적 추출합니다.

---

## 2. 쿼타 게이지 & 무소음 리프레시 (`src/ko-i18n.js`)
- **설정 창 팝업 제거 및 WebSocket RPC 직접 호출**: `triggerQuotaRefresh()`는 더 이상 `Settings` 창을 열었다 닫지 않습니다.
  - Antigravity v2.31+의 `Jetski Web` UI는 Connect-RPC 요청을 `fetch`가 아닌 다중화 **`WebSocket` (`/connect-websocket`)** 으로 전송하며, 인증 헤더로 **`x-codeium-csrf-token`** (`window.__APP_CONFIG__.csrfToken` / `agy_session_csrf_token` / `csrfToken` 쿠키)을 요구합니다.
  - `installMainWorldQuotaInterceptor()`는 `window.WebSocket` 및 `WebSocket.prototype.send`를 후킹해 활성 WebSocket 연결과 인증 헤더를 즉시 캡처하고, 리프레시 시 해당 WebSocket(또는 신규 `/connect-websocket` 연결 및 `x-codeium-csrf-token` 포함 HTTP `fetch` 폴백)으로 `/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary` 프레임을 직접 전송합니다.
  - 사용자가 이미 `Settings > Models` 화면을 열어둔 경우에만 화면 내 새로고침 버튼 클릭 및 DOM 스크래핑을 병행합니다.
- **다중 폴백 셀렉터**:
  - `findSettingsButton()`, `findModelsNavItem()`, `ensureSettingsLanguageRow()` 모두 `data-testid` 외에 텍스트·라벨·섹션 구조 기반 폴백을 갖추어 소규모 마크업 변경에 내성을 갖습니다.

---

## 3. 주요 CLI 명령어
```powershell
node tools/patch.js status            # 패치 적용 상태 및 사전 통계 확인
node tools/patch.js install           # 패치 수동 설치
node tools/patch.js ensure            # 미적용 시 자동 병합 + 재설치
node tools/patch.js enable-autopatch  # Windows 로그인 시 자동 복구 등록
node tools/patch.js disable-autopatch # 자동 복구 해제
node tools/patch.js uninstall         # 원본 app.asar 복원
node tools/update-strings.js          # language_server 신규 문자열 스캔 및 병합
node tools/audit-dict.js              # 번역 사전 무결성 검사
```
