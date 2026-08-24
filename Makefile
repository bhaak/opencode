VERSION := $(shell grep '"version"' packages/cli/package.json | cut -f 4 -d \")
DATE := $(shell date +%Y%m%d)
COMMIT_HASH := $(shell git rev-parse --short HEAD)
OPENCODE_VERSION := $(VERSION)-bhaak-$(DATE)-$(COMMIT_HASH)

build:
	rm -rf ./packages/cli/dist
	bun install
	cd packages/cli ; env OPENCODE_VERSION=${OPENCODE_VERSION} bun run build --single
	cp ./packages/cli/dist/cli-*/bin/opencode2 $(HOME)/bin/opencode2-$(OPENCODE_VERSION)
	ln -sf $(HOME)/bin/opencode2-$(OPENCODE_VERSION) $(HOME)/bin/opencode
	(test -f packages/core/src/models-snapshot.js && git checkout -q packages/core/src/models-snapshot.js) || true

rebase:
	git fetch --all
	git rebase -i upstream/beta
