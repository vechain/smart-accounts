SHELL := /bin/bash

help:
	@egrep -h '\s#@\s' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?#@ "}; {printf "\033[36m  %-30s\033[0m %s\n", $$1, $$2}'

# Thor solo
solo-up: #@ Start Thor solo
	docker compose -f packages/contracts/docker-compose.yaml up -d --wait
solo-down: #@ Stop Thor solo
	docker compose -f packages/contracts/docker-compose.yaml down
solo-clean: #@ Clean Thor solo
	docker compose -f packages/contracts/docker-compose.yaml down -v --remove-orphans
