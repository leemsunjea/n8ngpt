# FastAPI Chat Application with Docker

이 프로젝트는 FastAPI를 사용한 채팅 애플리케이션을 Docker 컨테이너로 실행하기 위한 설정을 포함하고 있습니다.

## 사전 요구사항

- Docker 설치 ([Docker 설치 가이드](https://docs.docker.com/get-docker/))
- Docker Compose (Docker Desktop에 기본 포함)
- .env 파일 (아래 참조)

## .env 파일 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 변수들을 설정하세요:

```
OPENAI_API_KEY=your_openai_api_key_here
# 기타 필요한 환경 변수들
```

## Docker를 사용한 빌드 및 실행

### 1. Docker 이미지 빌드

```bash
docker build -t fastapi-chat-app .
```

### 2. Docker 컨테이너 실행

```bash
docker run -d --name chat-app -p 8000:8000 --env-file .env fastapi-chat-app
```

### 3. 애플리케이션 접속

웹 브라우저에서 다음 주소로 접속하세요:
```
http://localhost:8000
```

## Docker Compose를 사용한 실행 (추천)

`docker-compose.yml` 파일이 제공되는 경우, 다음 명령어로 간단히 실행할 수 있습니다:

```bash
docker-compose up -d
```

## 개발 모드

개발 중에는 호스트의 코드 변경사항을 즉시 반영하기 위해 볼륨 마운트를 사용할 수 있습니다:

```bash
docker run -d --name chat-app -p 8000:8000 --env-file .env -v $(pwd):/app fastapi-chat-app
```

## 로그 확인

컨테이너 로그를 확인하려면 다음 명령어를 사용하세요:

```bash
docker logs -f chat-app
```

## 중지 및 정리

컨테이너를 중지하고 제거하려면:

```bash
docker stop chat-app
docker rm chat-app
```

## 문제 해결

- 포트 충돌이 발생하는 경우 `-p` 옵션의 포트 번호를 변경하세요.
- 환경 변수가 제대로 로드되지 않는 경우 `.env` 파일의 형식을 확인하세요.
- 빌드나 실행 중 오류가 발생하면 로그를 확인하세요.
