.PHONY: build test test-js test-python test-e2e

build:
	pnpm --filter @carta/web-client build

test: test-js test-python

test-js:
	pnpm -r --parallel test

test-python:
	python3 -m pytest packages/cli/tests/ -v

test-e2e:
	pnpm --filter @carta/web-client test:e2e
