BABEL := "../node_modules/.bin/babel"

.PHONY: watch
watch:
	rm -rf dist/*
	cd src && $(BABEL) ./*.js --watch --out-dir ../dist --presets=react,es2015,stage-0

.PHONY: build
build:
	rm -rf dist/*
	cd src && $(BABEL) ./*.js --out-dir ../dist --presets=react,es2015,stage-0

.PHONY: install
install:
	yarn install --no-lockfile --no-progress

.PHONY: reinstall
reinstall:
	rm yarn.lock || true
	rm src/sf/yarn.lock || true
	rm -rf ./node_modules
	yarn install --no-lockfile
