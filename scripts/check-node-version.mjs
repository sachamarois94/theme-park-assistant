#!/usr/bin/env node

const major = Number(process.versions.node.split(".")[0]);

if (Number.isNaN(major)) {
  console.error(`Unable to parse Node version: ${process.versions.node}`);
  process.exit(1);
}

if (major < 20 || major >= 25) {
  console.error(
    [
      `Unsupported Node version: v${process.versions.node}.`,
      "Use Node 20.x, 22.x, or 24.x for this project.",
      "Quick run without nvm: npx -y node@22 ./node_modules/next/dist/bin/next dev"
    ].join("\n")
  );
  process.exit(1);
}
