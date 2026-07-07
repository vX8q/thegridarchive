.PHONY: build test lint run dev ci docker js-test smoke check-data

build:
	go build -trimpath -o server.exe ./cmd/server/
	go build -trimpath -o fetch-wikidata.exe ./cmd/fetch-driver-wikidata/

test:
	go test ./... -count=1 -race 2>/dev/null || go test ./...

lint:
	golangci-lint run ./... 2>/dev/null || go vet ./...

run: build
	./server.exe

# Локальная разработка: сервер + live-данные в одном процессе (go run).
dev:
	go run ./cmd/server

# Локальная проверка перед коммитом: тесты + линтер.
ci: test lint js-test check-data

js-test:
	node scripts/js-test.mjs

smoke:
	node scripts/smoke-phase31.mjs
	node scripts/smoke-tier-ab.mjs

check-data:
	node scripts/check-data.mjs

docker:
	docker build -t tga:latest .
	docker run --rm -p 8080:8080 -v "$(PWD)/data:/app/data" tga:latest
