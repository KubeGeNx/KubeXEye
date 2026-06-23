SHELL := /bin/bash
.DEFAULT_GOAL := help

RUN_DIR := .run
DEV_PID    := $(RUN_DIR)/dev.pid
DEV_LOG    := $(RUN_DIR)/dev.log
PROXY_PID  := $(RUN_DIR)/kube-proxy.pid
PROXY_LOG  := $(RUN_DIR)/kube-proxy.log
SERVE_PID  := $(RUN_DIR)/serve.pid
SERVE_LOG  := $(RUN_DIR)/serve.log
DEV_PORT        ?= 5173
KUBE_PROXY_PORT ?= 8001
SERVE_PORT      ?= 8080

.PHONY: help install build run dev start stop restart proxy proxy-stop \
        serve serve-start serve-stop \
        preview lint typecheck test test-watch coverage clean distclean status logs

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install npm dependencies
	npm install

build: install ## Type-check and produce a production build (dist/)
	npm run build

run: install ## Start the Vite dev server in the foreground (Ctrl+C to stop)
	@echo "Make sure the kube-proxy replacement is running in another terminal (make proxy) or backgrounded (make start)"
	npm run dev -- --port $(DEV_PORT)

dev: run ## Alias for 'run'

start: install ## Start the kube-proxy replacement + Vite dev server in the background
	@mkdir -p $(RUN_DIR)
	@if [ -f $(PROXY_PID) ] && kill -0 $$(cat $(PROXY_PID)) 2>/dev/null; then \
		echo "kube-proxy already running (pid $$(cat $(PROXY_PID)))"; \
	else \
		echo "Starting kube-proxy (server/proxyServer.ts) on :$(KUBE_PROXY_PORT) (log: $(PROXY_LOG))"; \
		KUBE_PROXY_PORT=$(KUBE_PROXY_PORT) nohup npm run server > $(PROXY_LOG) 2>&1 & echo $$! > $(PROXY_PID); \
	fi
	@if [ -f $(DEV_PID) ] && kill -0 $$(cat $(DEV_PID)) 2>/dev/null; then \
		echo "Dev server already running (pid $$(cat $(DEV_PID)))"; \
	else \
		echo "Starting Vite dev server on :$(DEV_PORT) (log: $(DEV_LOG))"; \
		nohup npm run dev -- --port $(DEV_PORT) > $(DEV_LOG) 2>&1 & echo $$! > $(DEV_PID); \
	fi
	@echo "UI: http://localhost:$(DEV_PORT)  |  Logs: make logs  |  Stop: make stop"

stop: serve-stop ## Stop all background processes (dev server, kube-proxy, and unified server)
	@if [ -f $(DEV_PID) ]; then \
		PID=$$(cat $(DEV_PID)); \
		if kill -0 $$PID 2>/dev/null; then kill $$PID && echo "Stopped dev server (pid $$PID)"; fi; \
		rm -f $(DEV_PID); \
	else echo "Dev server not running (no pid file)"; fi
	@if [ -f $(PROXY_PID) ]; then \
		PID=$$(cat $(PROXY_PID)); \
		if kill -0 $$PID 2>/dev/null; then kill $$PID && echo "Stopped kube-proxy (pid $$PID)"; fi; \
		rm -f $(PROXY_PID); \
	else echo "kube-proxy not running (no pid file)"; fi

restart: stop start ## Restart the background dev server and kube-proxy

proxy: ## Run the bundled kube-proxy replacement in the foreground (Ctrl+C to stop) — reads kubeconfig directly, no 'kubectl' binary required
	KUBE_PROXY_PORT=$(KUBE_PROXY_PORT) npm run server

proxy-stop: ## Stop only the background kube-proxy
	@if [ -f $(PROXY_PID) ]; then \
		PID=$$(cat $(PROXY_PID)); \
		if kill -0 $$PID 2>/dev/null; then kill $$PID && echo "Stopped kube-proxy (pid $$PID)"; fi; \
		rm -f $(PROXY_PID); \
	else echo "kube-proxy not running (no pid file)"; fi

status: ## Show whether the background dev server / kube-proxy / unified server are running
	@if [ -f $(DEV_PID) ] && kill -0 $$(cat $(DEV_PID)) 2>/dev/null; then \
		echo "dev server    : running (pid $$(cat $(DEV_PID)), port $(DEV_PORT))"; \
	else echo "dev server    : stopped"; fi
	@if [ -f $(PROXY_PID) ] && kill -0 $$(cat $(PROXY_PID)) 2>/dev/null; then \
		echo "kube-proxy    : running (pid $$(cat $(PROXY_PID)), port $(KUBE_PROXY_PORT))"; \
	else echo "kube-proxy    : stopped"; fi
	@if [ -f $(SERVE_PID) ] && kill -0 $$(cat $(SERVE_PID)) 2>/dev/null; then \
		echo "unified server: running (pid $$(cat $(SERVE_PID)), port $(SERVE_PORT))"; \
	else echo "unified server: stopped"; fi

logs: ## Tail the background dev server, kube-proxy, and unified server logs
	@touch $(DEV_LOG) $(PROXY_LOG) $(SERVE_LOG)
	tail -f $(DEV_LOG) $(PROXY_LOG) $(SERVE_LOG)

## ── Production / unified server ──────────────────────────────────────────────
## Runs the frontend + kube-proxy as a single process (no Vite, no kubectl).
## Multi-cluster switching works via the X-Kube-Context header, driven by the
## cluster dropdown in the UI.  Access the app at http://localhost:$(SERVE_PORT).
##
##   Quick start:  make serve
##   Background:   make serve-start  /  make serve-stop
##   Custom port:  make serve SERVE_PORT=9090

serve: build ## Build and serve the app + kube-proxy as a single process (foreground, port $(SERVE_PORT))
	KUBE_PROXY_PORT=$(SERVE_PORT) npm run server

serve-start: build ## Build and start the unified server in the background (port $(SERVE_PORT))
	@mkdir -p $(RUN_DIR)
	@if [ -f $(SERVE_PID) ] && kill -0 $$(cat $(SERVE_PID)) 2>/dev/null; then \
		echo "Unified server already running (pid $$(cat $(SERVE_PID)), port $(SERVE_PORT))"; \
	else \
		echo "Building and starting unified server on :$(SERVE_PORT) (log: $(SERVE_LOG))"; \
		KUBE_PROXY_PORT=$(SERVE_PORT) nohup npm run server > $(SERVE_LOG) 2>&1 & echo $$! > $(SERVE_PID); \
		echo "UI: http://localhost:$(SERVE_PORT)  |  Logs: make logs  |  Stop: make serve-stop"; \
	fi

serve-stop: ## Stop the background unified server started by 'make serve-start'
	@if [ -f $(SERVE_PID) ]; then \
		PID=$$(cat $(SERVE_PID)); \
		if kill -0 $$PID 2>/dev/null; then kill $$PID && echo "Stopped unified server (pid $$PID)"; fi; \
		rm -f $(SERVE_PID); \
	else echo "Unified server not running (no pid file)"; fi

preview: build ## Serve the production build locally via Vite preview (dev use only — prefer 'make serve' for production)
	npm run preview

lint: install ## Run ESLint
	npm run lint

typecheck: install ## Type-check without emitting a build (follows tsconfig project references)
	npx tsc -b --noEmit

test: install ## Run the test suite once (Vitest + React Testing Library)
	npm test

test-watch: install ## Run the test suite in watch mode
	npm run test:watch

coverage: install ## Run the test suite and generate a V8 coverage report (coverage/)
	npm run coverage

clean: ## Remove build output, caches, run/log artifacts, and tsc incremental files (keeps node_modules)
	rm -rf dist .vite $(RUN_DIR) tsconfig.tsbuildinfo tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo

distclean: clean stop ## Stop background processes and remove node_modules too
	rm -rf node_modules
