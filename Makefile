VERSION := $(shell grep '"version"' packages/opencode/package.json | cut -f 4 -d \")
DATE := $(shell date +%Y%m%d)
COMMIT_HASH := $(shell git rev-parse --short HEAD)
OPENCODE_VERSION := $(VERSION)-bhaak-$(DATE)-$(COMMIT_HASH)

build:
	rm -f ./packages/opencode/dist/opencode-darwin-arm64/bin/opencode
	bun install
	cd packages/opencode ; env OPENCODE_VERSION=${OPENCODE_VERSION} bun run build --single
	cp ./packages/opencode/dist/opencode-*/bin/opencode $(HOME)/bin/opencode-$(OPENCODE_VERSION)
	ln -sf $(HOME)/bin/opencode-$(OPENCODE_VERSION) $(HOME)/bin/opencode
	(test -f packages/core/src/models-snapshot.js && git checkout -q packages/core/src/models-snapshot.js) || true

rebase:
	git fetch --all
	git rebase -i upstream/beta
