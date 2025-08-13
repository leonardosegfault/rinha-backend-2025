#!/bin/bash

rm "$UNIX_SOCK"

npm start &

while [ ! -S "$UNIX_SOCK" ]; do
  sleep 0.1
done

chmod 777 "$UNIX_SOCK"

wait