#!/usr/bin/env bun

const targets = [
  { target: "bun-darwin-arm64", outfile: "matter-darwin-arm64" },
  { target: "bun-darwin-x64", outfile: "matter-darwin-x64" },
  { target: "bun-linux-arm64", outfile: "matter-linux-arm64" },
  { target: "bun-linux-x64", outfile: "matter-linux-x64" },
  { target: "bun-windows-x64", outfile: "matter-windows-x64.exe" },
] as const;

const selected = process.argv[2];

for (const { target, outfile } of targets) {
  if (selected && !target.includes(selected)) continue;

  console.log(`Building ${outfile}...`);
  const proc = Bun.spawn(
    [
      "bun",
      "build",
      "--compile",
      `--target=${target}`,
      "./src/cli.tsx",
      "--outfile",
      `./dist/${outfile}`,
      "--minify",
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  const code = await proc.exited;
  if (code !== 0) {
    console.error(`Failed to build ${outfile} (exit code ${code})`);
    process.exit(1);
  }
  console.log(`  -> dist/${outfile}`);
}

console.log("Build complete.");
