#!/bin/bash

forPush="--for-push"

cleanup() {
  git stash pop -q
  rm .script
  echo "Stash Applied"
}

echo "Started"
trap '[[ $? -ne 0 ]] && cleanup' EXIT

if [[ $1 == $forPush ]]; then
    touch .script
    git stash push -uqm "Backup of auto commit functionality"
    echo "Stash Stored"
fi


npm run prettier:fix
echo "Prettier Completed"
npm run lint:fix
echo "Eslint Completed"
npm run ts
echo "Typescript Completed"
# npm run test
# echo "Jest Completed"


if [[ $1 == $forPush ]]; then
    git add .
    if ! git diff-index --quiet HEAD; then
      git commit -m "refactor: code reformatted" -q
      echo "Commit Completed"
    fi
    cleanup
fi

echo "Done"
