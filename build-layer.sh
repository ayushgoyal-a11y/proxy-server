#!/bin/bash

set -e

rm -rf layer
mkdir -p layer/extensions

cp -r extension/* layer/extensions/

chmod +x layer/extensions/extension.js

cd layer
zip -r extension-layer.zip .