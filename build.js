// build.js — Minify app.js and styles.css for production
const fs = require("fs");
const path = require("path");

async function build() {
  const { minify } = require("terser");
  const lightningcss = require("lightningcss");

  const dist = path.join(__dirname, "dist");
  if (!fs.existsSync(dist)) fs.mkdirSync(dist, { recursive: true });

  // --- Minify JS ---
  console.log("Minifying app.js...");
  const jsSource = fs.readFileSync("app.js", "utf8");
  const jsResult = await minify(jsSource, {
    compress: { drop_console: false, passes: 2 },
    mangle: true,
    format: { comments: false },
  });
  fs.writeFileSync(path.join(dist, "app.js"), jsResult.code);
  const jsBefore = (jsSource.length / 1024).toFixed(1);
  const jsAfter = (jsResult.code.length / 1024).toFixed(1);
  console.log(`  app.js: ${jsBefore}KB → ${jsAfter}KB`);

  // --- Minify CSS ---
  console.log("Minifying styles.css...");
  const cssSource = fs.readFileSync("styles.css");
  const cssResult = lightningcss.transform({
    filename: "styles.css",
    code: cssSource,
    minify: true,
    targets: lightningcss.browserslistToTargets(["last 2 Chrome versions", "last 2 Safari versions", "last 2 Firefox versions"]),
  });
  fs.writeFileSync(path.join(dist, "styles.css"), cssResult.code);
  const cssBefore = (cssSource.length / 1024).toFixed(1);
  const cssAfter = (cssResult.code.length / 1024).toFixed(1);
  console.log(`  styles.css: ${cssBefore}KB → ${cssAfter}KB`);

  // --- Copy other static files ---
  const staticFiles = ["index.html", "manifest.json", "offline.html", "sw.js", "vercel.json"];
  for (const file of staticFiles) {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join(dist, file));
    }
  }

  // Copy directories
  const staticDirs = ["assets", "photobooth", "api"];
  for (const dir of staticDirs) {
    if (fs.existsSync(dir)) {
      copyDir(dir, path.join(dist, dir));
    }
  }

  console.log("\nBuild complete! Output: ./dist/");
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
