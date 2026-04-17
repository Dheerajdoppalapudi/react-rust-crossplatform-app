#!/bin/bash
cd "$(dirname "$0")"
source ../backend/env/bin/activate
export DYLD_LIBRARY_PATH=/opt/homebrew/opt/cairo/lib
python3 "$@"
