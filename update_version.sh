#!/bin/bash

# Script to update npm version and corresponding version in index.ts

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Run npm version patch to update package.json and create git tag
npm version patch

# Get the new version from package.json after patch
NEW_VERSION=$(node -p "require('./package.json').version")
echo "New version: $NEW_VERSION"

# Update the version in src/index.ts
sed -i "s/\.version('${CURRENT_VERSION}')/\.version('${NEW_VERSION}')/g" src/index.ts

echo "Version updated successfully in both package.json and src/index.ts"