#!/bin/bash

PROJECT_ROOT=$(pwd)
IMAGE_PREFIX="splix-"

function branch_exists () {
    git rev-parse --verify "$1" &> /dev/null
}

function current_branch () {
    git branch --show-current
}

function read_server_file() {
    cat $PROJECT_ROOT/server.port
}

###
# COMMANDS
###

function pull () {
    for remote in `git branch --remote --list --format '%(refname:short)' -i`;
    do
        if [[ $remote != origin* ]] || [[ $remote == 'origin/HEAD' ]] || branch_exists ${remote/origin\//""}; then
            continue
        fi
        git branch --track ${remote/origin\//""} $remote
    done;
    git fetch --all
    git pull --all
}

function build-branch () {
    BRANCH="$1"
    IMAGE_NAME="$IMAGE_PREFIX$1"
    WORKING_BRANCH=$(current_branch)
    branch_exists "$BRANCH"  || (echo Branch "$BRANCH" does not exist. Did you pull ?; exit 1) || exit 1
    git switch "$BRANCH" || exit 1
    podman build -f Dockerfile -t $IMAGE_NAME
    git switch "$WORKING_BRANCH"
}

function run-branch () {
    BRANCH="$1"
    IMAGE_NAME="$IMAGE_PREFIX$1"
    WORKING_BRANCH=$(current_branch)
    branch_exists "$BRANCH"  || (echo Branch "$BRANCH" does not exist. Did you pull ?; exit 1) || exit 1
    podman image exists "$IMAGE_NAME"  || (echo Image "$IMAGE_NAME" does not exist. Did you build-branch?; exit 1) || exit 1
    git switch "$BRANCH" || exit 1
    PORT="$(read_server_file "$1")"
    podman container exists "$IMAGE_NAME" && echo Stopping previous $IMAGE_NAME: && podman stop "$IMAGE_NAME" && podman rm "$IMAGE_NAME"
    podman run --detach --publish "127.0.0.1:$PORT:8080" --name $IMAGE_NAME $IMAGE_NAME
    git switch "$WORKING_BRANCH"
} 

COMMAND="$1"
shift
case "$COMMAND" in
        pull)
                pull
                ;;
        build-branch)
            build-branch "$1"
            ;;
        run-branch)
            run-branch "$1"
            ;;    
        *)
                echo Availabale commands: pull, build-branch.
                exit 1
                ;;
esac