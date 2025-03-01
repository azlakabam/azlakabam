#!/bin/bash

COMMAND=$1
shift
case $COMMAND in
        pull)
                git pull --all
                ;;
        *)
                echo Availabale commands: pull.
                exit 1
                ;;
esac