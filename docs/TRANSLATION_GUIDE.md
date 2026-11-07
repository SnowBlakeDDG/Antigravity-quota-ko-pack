# Antigravity 한국어 번역 가이드

## 출력 형식
- 입력: 영어 UI 문자열의 JSON 배열.
- 출력: `{ "영어 원문": "한국어 번역", ... }` 형태의 JSON 객체 (UTF-8, 들여쓰기 1칸).
- 키는 입력 문자열과 **완전히 동일**해야 함 (공백/구두점/대소문자 포함).
- 사용자에게 보이지 않는 문자열(내부 로그, 개발자 에러, 식별자, 정규식, 코드 토큰, 프로그래밍 언어 이름, 브랜드명 단독 등)은 **출력에서 생략**.
- 번역할 필요가 없는 문자열(예: "GitHub", "JSON", "MCP")도 생략.

## 스타일
- 버튼/메뉴/탭/라벨: 짧은 명사형 또는 동사 기본형 ("Save" → "저장", "Open folder" → "폴더 열기", "Delete" → "삭제").
- 문장/설명: 정중한 "~합니다/~하세요" 체. 과도한 존댓말("~하시겠습니까?")은 확인 질문에만 사용.
- 상태 표시: "Loading..." → "로딩 중...", "Saving" → "저장 중", "Done" → "완료".
- 제목은 Title Case 무시하고 자연스러운 한국어로.
- 영어 단어 그대로 쓰는 게 자연스러운 개발 용어는 음차 (커밋, 브랜치, 터미널, 프롬프트, 토큰).

## 반드시 지킬 것
- 앞뒤 공백, 문장 부호, 줄바꿈을 원문과 동일한 위치에 유지. (예: `" or "` → `" 또는 "`, `"? This action cannot be undone."` → `"? 이 작업은 되돌릴 수 없습니다."`)
- 이 문자열들은 문장 조각일 수 있음 (React가 `"Delete ", name, "? This..."` 처럼 쪼갬). 조각끼리 이어 붙였을 때 대략 자연스럽게 읽히도록 번역하되, 각 조각을 독립적으로 번역해야 함.
- `{}`, `{0}`, `%s`, `$1` 등 플레이스홀더, 키보드 단축키(Ctrl+K, ⌘, Shift), 파일 경로, URL, 코드, 따옴표 안의 명령어/설정 키는 그대로 유지.
- 제품/서비스명 유지: Antigravity, Gemini, Google, Chrome, Claude, GPT, MCP, GitHub, GitLab, Jetski, Cascade, Windsurf, VS Code, WSL, SSH, Docker, Drive, Docs, Colab, Cloud, Vertex AI 등.

## 용어집 (일관성 필수)
| English | 한국어 |
|---|---|
| Agent | 에이전트 |
| Agent Manager | 에이전트 관리자 |
| Subagent | 서브에이전트 |
| Conversation | 대화 |
| New conversation | 새 대화 |
| Workspace | 워크스페이스 |
| Project | 프로젝트 |
| Settings | 설정 |
| Preferences | 환경설정 |
| Customizations | 커스터마이징 |
| Plugin | 플러그인 |
| Skill | 스킬 |
| Rule | 규칙 |
| Workflow | 워크플로 |
| Hook | 훅 |
| Artifact | 아티팩트 |
| MCP server | MCP 서버 |
| Sidecar | 사이드카 |
| Model | 모델 |
| Terminal | 터미널 |
| Browser | 브라우저 |
| Playground | 플레이그라운드 |
| Inbox | 받은편지함 |
| Task | 작업 |
| Step | 단계 |
| Review | 검토 |
| Approve / Accept | 승인 / 수락 |
| Reject / Decline | 거부 / 거절 |
| Proceed | 진행 |
| Always Proceed | 항상 진행 |
| Allow / Deny | 허용 / 거부 |
| Sandbox | 샌드박스 |
| Permission | 권한 |
| Quota | 할당량 |
| Credits | 크레딧 |
| Plan (subscription) | 요금제 |
| Plan (agent plan) | 계획 |
| Sign in / Log in | 로그인 |
| Sign out / Log out | 로그아웃 |
| Account | 계정 |
| Marketplace | 마켓플레이스 |
| Install / Uninstall | 설치 / 제거 |
| Enable / Disable | 사용 / 사용 안 함 (토글 라벨), 활성화 / 비활성화 (동작) |
| Remote Control | 원격 제어 |
| This Computer | 이 컴퓨터 |
| Commit | 커밋 |
| Branch | 브랜치 |
| Pull request | 풀 리퀘스트 |
| Diff | 변경 사항 |
| Changes | 변경 사항 |
| Checkpoint | 체크포인트 |
| Revert | 되돌리기 |
| Undo / Redo | 실행 취소 / 다시 실행 |
| Retry | 다시 시도 |
| Copy / Copied | 복사 / 복사됨 |
| Paste | 붙여넣기 |
| Attach / Attachment | 첨부 / 첨부 파일 |
| Upload / Download | 업로드 / 다운로드 |
| Search | 검색 |
| Filter | 필터 |
| Sort | 정렬 |
| Pin / Unpin | 고정 / 고정 해제 |
| Archive | 보관 |
| Rename | 이름 바꾸기 |
| Delete / Remove | 삭제 / 제거 |
| Cancel | 취소 |
| Close | 닫기 |
| Confirm | 확인 |
| OK | 확인 |
| Continue | 계속 |
| Back / Next | 뒤로 / 다음 |
| Learn more | 자세히 알아보기 |
| Feedback | 피드백 |
| Notification | 알림 |
| Theme / Dark / Light | 테마 / 다크 / 라이트 |
| Keyboard shortcuts | 단축키 |
| Prompt | 프롬프트 |
| Context | 컨텍스트 |
| Token | 토큰 |
| Mention | 멘션 |
| Command | 명령 |
| Run / Running | 실행 / 실행 중 |
| Stop | 중지 |
| Pause / Resume | 일시중지 / 재개 |
| Pending | 대기 중 |
| Failed | 실패 |
| Error | 오류 |
| Warning | 경고 |
| Trajectory | 실행 기록 |
| Knowledge | 지식 |
| Memory | 메모리 |
| Environment | 환경 |
| Secret | 시크릿 |
| Folder / File | 폴더 / 파일 |
| Open in ... | ...에서 열기 |
| Update available | 업데이트 가능 |
| Restart | 다시 시작 |
| Reload | 새로고침 |
