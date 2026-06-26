const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "dist");

async function build() {
  fs.mkdirSync(path.join(DIST, "background"), { recursive: true });
  fs.mkdirSync(path.join(DIST, "content"), { recursive: true });
  fs.mkdirSync(path.join(DIST, "popup"), { recursive: true });

  const common = {
    bundle: true,
    format: "iife",
    target: "chrome110",
    platform: "browser",
    sourcemap: false,
    minify: false
  };

  await esbuild.build({
    ...common,
    entryPoints: ["src/content/content-entry.js"],
    outfile: "dist/content/content-entry.js"
  });

  await esbuild.build({
    ...common,
    entryPoints: ["src/background/service-worker.js"],
    outfile: "dist/background/service-worker.js"
  });

  await esbuild.build({
    ...common,
    entryPoints: ["src/popup/popup.js"],
    outfile: "dist/popup/popup.js"
  });

  fs.copyFileSync("src/popup/popup.html", "dist/popup/popup.html");
  fs.copyFileSync("src/popup/popup.css", "dist/popup/popup.css");

  console.log("Build complete.");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
