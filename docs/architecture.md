# Architecture

이 프로젝트는 Raspberry Pi를 개인 OpenClaw 운영 호스트로 두고, 외부 Mac과 모바일 클라이언트가 Tailscale을 통해 안전하게 접근하는 구조를 기준으로 합니다.

![OpenClaw Raspberry Pi Architecture](assets/openclaw-pi-architecture.svg)

## System Shape

Raspberry Pi는 항상 켜져 있는 개인 AI gateway 역할을 합니다. OpenClaw gateway, Control UI, Obsidian Vault, Quartz build, 운영 플러그인이 같은 호스트 안에서 협력합니다.

외부 Mac은 로컬 개발, repo 관리, Control UI 접근, SSH 운영을 담당합니다. Mac이 직접 공개 인터넷으로 Pi를 노출하지 않고, Tailscale tailnet을 통해 private operator channel로 접근하는 것이 기본 모델입니다.

모바일과 WebChat, Telegram 같은 채널은 일상적인 개인비서 진입점입니다. 사용자는 채팅으로 요청하고, OpenClaw의 main agent가 요청을 받아 specialist agent 또는 도구로 라우팅합니다.

## Main Components

- **Raspberry Pi Host**: OpenClaw gateway와 개인 지식베이스를 오래 켜두는 홈 서버.
- **OpenClaw Gateway**: 메시지, 세션, Control UI, 도구 호출을 묶는 control plane.
- **Control UI**: 세션, 로그, 상태, 플러그인 패널을 보는 운영 화면.
- **Tailscale**: 외부 Mac과 모바일이 Pi에 안전하게 접근하는 private network boundary.
- **Obsidian Vault**: 개인 지식과 프로젝트 문서의 source of truth.
- **Quartz**: Vault의 public-safe 문서를 static site로 빌드하는 publishing layer.
- **Specialist Agents**: dev, research, obsidian, outing, portfolio 등 역할별 개인비서.
- **Pi Plugins**: host health, 백업, 상태 점검, 운영 자동화 같은 Raspberry Pi 특화 확장.

## Data and Control Flow

1. 사용자가 WebChat, Telegram, Control UI, 또는 외부 Mac에서 OpenClaw에 접근한다.
2. Tailscale 또는 channel auth가 접근 경계를 담당한다.
3. OpenClaw gateway가 세션과 메시지를 받아 main agent로 전달한다.
4. main agent는 요청의 성격에 따라 specialist agent, plugin, local script, Vault 작업으로 라우팅한다.
5. Obsidian Vault에 정리된 내용은 필요할 때 Quartz로 빌드되어 static output이 된다.
6. 공개 공유가 필요한 내용은 GitHub repo나 Quartz output으로 분리하고, private data는 Vault/private 영역 또는 로컬 설정에 남긴다.

## Security Posture

- Gateway와 Control UI는 loopback 또는 tailnet-only를 기본값으로 한다.
- 공개 인터넷 노출은 의도된 webhook 또는 검토된 static output만 허용한다.
- 플러그인은 read-only부터 시작한다.
- Host health 기능은 CPU, memory, disk, temperature 같은 숫자만 반환하고, process arguments, private IP, token, account ID는 숨긴다.
- Quartz에 들어가는 문서는 public-safe 기준으로 검토한다.

## Plugin Direction

첫 번째 플러그인은 `host-health`입니다. 목표는 Control UI 안에서 Raspberry Pi 상태를 작은 카드로 보는 것입니다.

초기 지표:

- Uptime
- Load average
- Memory usage
- Disk usage
- CPU temperature
- OpenClaw service state

나중에 붙일 후보:

- Backup status
- Quartz build status
- Vault size and last update
- Tailscale connectivity
- Gateway health summary

