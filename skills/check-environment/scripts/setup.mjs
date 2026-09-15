#!/usr/bin/env node
// check-environment — environment detection + permission protocol
//
// Model: the agent runs `--check` FIRST (fully automatic, no user input
// needed). The output tells the agent what the machine has, what it does NOT
// have (unrecognized tools / commands), and what permission to ask the user
// for (install a missing tool, use a network registry, etc.). If the user
// denies permission, the agent MUST surface a clear "these tools/commands are
// not available" notice and fall back to alternatives — it never asks the user
// to hand-fill config values.
//
// Local config (optional, agent-written, NOT user-facing):
//   $HOME/.config/check-environment/config.json
// Used only for explicit user-approved overrides (e.g. user said "I will
// install node myself, use this path"). Nothing here is required to run.
//
// Usage:
//   node setup.mjs --check            print detected env + unrecognized + permission requests
//   node setup.mjs --report           human-readable version of --check
//   node setup.mjs --status           show current local config (redacts keys)
//   node setup.mjs --grant <json>     record a user-granted override (inline JSON)
//   node setup.mjs --grant key=value  same, single key (e.g. --grant nodePath=C:\node\node.exe)
//   node setup.mjs --grant-file <json> record overrides from a JSON file
//   node setup.mjs --revoke           clear all overrides
//   node setup.mjs --path <dir>       config dir override (default ~/.config/check-environment)

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const home = homedir();

function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const configDir = argValue("--path") || path.join(home, ".config", "check-environment");
const configFile = path.join(configDir, "config.json");

// Tool registry: what each tool does, its fallback when missing, and whether
// it warrants asking the user for install permission. Required tools (node,
// git) always warrant a permission request; optional ones have graceful
// fallbacks and only ask when they materially affect the task.
const TOOL_CATALOG = {
  node: {
    label: "Node.js runtime",
    impact: "required — nothing else in this skill works without it",
    required: true,
    fallback: null,
    permission:
      "Install Node.js (e.g. via winget install OpenJS.NodeJS.LTS / nvm-windows), or provide a nodePath override",
    envVars: ["NVM_HOME", "NVM_DIR", "FNM_DIR", "VOLTA_HOME", "NODE_HOME", "NODEJS_HOME", "NVM_SYMLINK"],
    candidates: [
      "%ProgramFiles%\\nodejs\\node.exe",
      "%ProgramFiles(x86)%\\nodejs\\node.exe",
      "%LOCALAPPDATA%\\Volta\\bin\\node.exe",
      "%USERPROFILE%\\scoop\\apps\\nodejs\\current\\node.exe",
      "%APPDATA%\\nvm\\current\\node.exe",
      "%USERPROFILE%\\.bun\\bin\\node.exe",
      "/usr/local/bin/node",
      "/opt/homebrew/bin/node",
      "/usr/bin/node",
      "$HOME/.nvm/versions/node/current/bin/node",
      "$HOME/.local/share/fnm/node-versions/current/bin/node",
      "$HOME/.volta/bin/node",
    ],
  },
  git: {
    label: "Git",
    impact: "required for git-based workflows",
    required: true,
    fallback: null,
    permission: "Install Git (winget install Git.Git) or use a git-less workflow",
    envVars: ["GIT_HOME", "GIT_INSTALL_ROOT"],
    candidates: [
      "%ProgramFiles%\\Git\\cmd\\git.exe",
      "%ProgramFiles(x86)%\\Git\\cmd\\git.exe",
      "%USERPROFILE%\\scoop\\apps\\git\\current\\cmd\\git.exe",
      "%LOCALAPPDATA%\\Programs\\Git\\cmd\\git.exe",
      "/usr/local/bin/git",
      "/opt/homebrew/bin/git",
      "/usr/bin/git",
    ],
  },
  pnpm: {
    label: "pnpm",
    impact: "package manager for pnpm-lock.yaml projects",
    required: false,
    fallback: "npm with --no-install, or npx --no-install",
    permission: "Enable package manager pnpm (npm i -g pnpm)",
    envVars: ["PNPM_HOME"],
    candidates: [
      "%LOCALAPPDATA%\\pnpm\\pnpm.cmd",
      "%LOCALAPPDATA%\\pnpm\\pnpm.exe",
      "%APPDATA%\\npm\\pnpm.cmd",
      "%USERPROFILE%\\scoop\\apps\\pnpm\\current\\pnpm.exe",
      "/usr/local/lib/node_modules/pnpm/bin/pnpm.cjs",
      "$HOME/.local/share/pnpm/pnpm.cjs",
    ],
  },
  npm: {
    label: "npm",
    impact: "package manager (comes with Node.js)",
    required: false,
    fallback: "pnpm / yarn / bun",
    permission: null,
    envVars: ["NPM_HOME"],
    candidates: [
      "%ProgramFiles%\\nodejs\\npm.cmd",
      "%APPDATA%\\npm\\npm.cmd",
      "/usr/local/bin/npm",
      "/usr/bin/npm",
    ],
  },
  yarn: {
    label: "yarn",
    impact: "package manager",
    required: false,
    fallback: "npm / pnpm / bun",
    permission: null,
    envVars: ["YARN_HOME"],
    candidates: [
      "%ProgramFiles%\\nodejs\\yarn.cmd",
      "%APPDATA%\\npm\\yarn.cmd",
      "%LOCALAPPDATA%\\yarn\\bin\\yarn.cmd",
      "/usr/local/bin/yarn",
      "/usr/bin/yarn",
    ],
  },
  bun: {
    label: "bun",
    impact: "package manager / JS runtime",
    required: false,
    fallback: "npm / pnpm / yarn",
    permission: null,
    envVars: ["BUN_INSTALL"],
    candidates: [
      "%USERPROFILE%\\.bun\\bin\\bun.exe",
      "%USERPROFILE%\\scoop\\apps\\bun\\current\\bun.exe",
      "/usr/local/bin/bun",
      "/opt/homebrew/bin/bun",
      "$HOME/.bun/bin/bun",
    ],
  },
  rg: {
    label: "ripgrep (rg)",
    impact: "fast content search",
    required: false,
    fallback: "built-in search / findstr (Windows) / grep (posix) / Select-String",
    permission: "Install ripgrep for fast search (winget install BurntSushi.ripgrep.MSVC)",
    envVars: ["RG_HOME"],
    candidates: [
      "%USERPROFILE%\\scoop\\shims\\rg.exe",
      "%LOCALAPPDATA%\\Microsoft\\WinGet\\Links\\rg.exe",
      "%USERPROFILE%\\.cargo\\bin\\rg.exe",
      "/usr/local/bin/rg",
      "/opt/homebrew/bin/rg",
      "$HOME/.cargo/bin/rg",
    ],
  },
  python: {
    label: "Python",
    impact: "for Python scripts",
    required: false,
    fallback: "node scripts",
    permission: null,
    // macOS/Linux ship `python3` but not always `python`.
    aliases: ["python3", "py"],
    envVars: ["PYTHON_HOME", "PYTHONHOME"],
    candidates: [
      "%LOCALAPPDATA%\\Programs\\Python\\Python312\\python.exe",
      "%LOCALAPPDATA%\\Programs\\Python\\Python311\\python.exe",
      "%LOCALAPPDATA%\\Programs\\Python\\Python310\\python.exe",
      "%ProgramFiles%\\Python312\\python.exe",
      "%ProgramFiles%\\Python311\\python.exe",
      "%USERPROFILE%\\scoop\\apps\\python\\current\\python.exe",
      "/usr/local/bin/python3",
      "/opt/homebrew/bin/python3",
      "/usr/bin/python3",
    ],
  },
  pwsh: {
    label: "PowerShell 7 (pwsh)",
    impact: "modern PowerShell for .ps1 execution",
    required: false,
    fallback: "Windows PowerShell 5.1",
    permission: "Install PowerShell 7 (winget install Microsoft.PowerShell)",
    envVars: ["PWSH_HOME"],
    candidates: [
      "%ProgramFiles%\\PowerShell\\7\\pwsh.exe",
      "%ProgramFiles(x86)%\\PowerShell\\7\\pwsh.exe",
      "%LOCALAPPDATA%\\Microsoft\\WindowsApps\\pwsh.exe",
      "/usr/local/bin/pwsh",
      "/opt/homebrew/bin/pwsh",
    ],
  },
};

const DEFAULTS = {
  shell: null,             // auto-detect: powershell5.1 | powershell7 | git-bash | posix
  packageManager: null,    // auto-detect from lockfile
  nodePath: null,          // custom node executable (else PATH)
  npmRegistry: null,       // e.g. https://registry.npmmirror.com
  executionPolicyBypass: true, // Windows: always use -ExecutionPolicy Bypass for .ps1
  preferLocalBin: true,    // prefer project node_modules/.bin over npx
  apiKeys: {},             // optional: { zhipu: "..." } — never shipped
};

function loadConfig() {
  if (existsSync(configFile)) {
    try {
      let raw = readFileSync(configFile, "utf8");
      // PS 5.1 `-Encoding UTF8` writes a BOM; JSON.parse would reject it and
      // silently drop user-granted overrides. Strip it (same as --grant-file).
      if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULTS };
    }
  }
  return { ...DEFAULTS };
}

function saveConfig(cfg) {
  mkdirSync(configDir, { recursive: true });
  writeFileSync(configFile, JSON.stringify(cfg, null, 2), "utf8");
}

function detectLockfile(dir) {
  const lfs = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lockb", "bun.lock"];
  // Walk up from cwd (max 6 levels) until we find a package.json — mirrors
  // probe.ps1/probe.sh so a lockfile in a parent dir is not missed when run
  // from a subdirectory.
  let d = dir;
  for (let depth = 0; depth < 6; depth++) {
    if (existsSync(path.join(d, "package.json"))) {
      for (const lf of lfs) {
        if (existsSync(path.join(d, lf))) return lf;
      }
      return null; // package.json but no lockfile — manager not pinned
    }
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return null;
}

function detectShell() {
  if (process.platform !== "win32") return "posix";
  const shell = (process.env.SHELL || "").toLowerCase();
  if (/git.*bash/.test(shell) || /(bash|zsh|sh)$/.test(shell)) return "git-bash";
  // Determine the ACTUAL running PowerShell edition, not merely whether pwsh
  // exists on PATH. Reporting "powershell7" just because pwsh is installed would
  // falsely assure the agent that `&&`/`||` work — when the real executing shell
  // may be 5.1 and break.
  //
  // Signal must work for BOTH install types of pwsh 7:
  //   • MSI:        PSHOME="C:\Program Files\PowerShell\7", and PSModulePath
  //                 contains "...\PowerShell\7\Modules" / "...\PowerShell\Modules".
  //   • WinGet/MSIX: PSHOME is often EMPTY, home is a custom dir like "~\pwsh7",
  //                 and PSModulePath contains "...\pwsh7\Modules" — but it ALSO
  //                 still registers "C:\Program Files\PowerShell\Modules".
  // Windows PowerShell 5.1 only ever has "...\WindowsPowerShell\Modules" (folder
  // "WindowsPowerShell") and "...\v1.0\Modules". So a Modules dir whose PARENT
  // folder is exactly "powershell" (case-insensitive, not "windowspowershell")
  // reliably indicates pwsh 7 — present in MSI and MSIX alike, absent in 5.1.
  const psModulePath = (process.env.PSMODULEPATH || "").toLowerCase();
  const runningSeven = psModulePath
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .some((seg) => {
      const norm = seg.replace(/[\\/]?modules[\\/]?$/i, "");
      const folder = norm.split(/[\\/]/).pop() || "";
      return folder === "powershell";
    });
  if (runningSeven) return "powershell7";
  // pwsh 7 may exist on PATH, but the active shell that runs commands is 5.1.
  return "powershell5.1";
}

// Expand %VAR% (win32) and $VAR (posix) inside a candidate path using the
// current process env. Leaves anything unset as-is so existsSync fails cleanly.
function expandEnv(str) {
  if (!str) return str;
  if (process.platform === "win32") {
    return str.replace(/%([^%]+)%/g, (m, name) => process.env[name] || m);
  }
  return str.replace(/\$([A-Z_][A-Z0-9_]*)/g, (m, name) => process.env[name] || m);
}

// Does the candidate path exist (and is a file)?
function existsFile(p) {
  try {
    return existsSync(p);
  } catch {
    return false;
  }
}

// Discover a tool's executable path using, in order:
//   1. PATH (where/which) — the normal case (also tries aliases like python3).
//   2. Env vars that point AT an install dir (NVM_HOME, PNPM_HOME, ...).
//   3. Well-known install locations (version managers, scoop, Program Files).
// Returns { path, via, name } or null. Never mutates the environment.
function discoverTool(name, cat) {
  // 1. PATH — primary name, then aliases (python3/py when `python` is absent).
  const names = [name, ...(cat.aliases || [])];
  for (const n of names) {
    const onPath = toolPath(n);
    if (onPath) return { path: onPath, via: "PATH", name: n };
  }

  // 2. env-var dirs: probe <dir>/<name>(.exe/.cmd) and <dir>/bin/<name>.
  for (const ev of cat.envVars || []) {
    const dir = process.env[ev];
    if (!dir) continue;
    const d = expandEnv(dir);
    for (const sub of ["", "bin", "Scripts"]) {
      for (const n of names) {
        for (const exe of exeNames(n)) {
          const cand = path.join(d, sub, exe);
          if (existsFile(cand)) return { path: cand, via: `env ${ev}`, name: n };
        }
      }
    }
  }

  // 3. well-known locations.
  for (const c of cat.candidates || []) {
    const cand = expandEnv(c);
    if (existsFile(cand)) return { path: cand, via: "known location", name };
  }
  return null;
}

// Executable file name candidates for a tool name on the current platform.
function exeNames(name) {
  if (process.platform === "win32") {
    return [name + ".exe", name + ".cmd", name + ".ps1", name];
  }
  return [name];
}

function toolPath(name) {
  const r = spawnSync(
    process.platform === "win32" ? "where.exe" : "which",
    [name],
    { encoding: "utf8", timeout: 3000 }
  );
  if (r.status !== 0) return null;
  const lines = (r.stdout || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  // where.exe may list an extensionless shim first (e.g. ...\npm\pnpm),
  // which can't be spawned directly — prefer a real .exe/.cmd/.ps1/.bat.
  if (process.platform === "win32") {
    const exe = lines.find((l) => /\.(exe|cmd|ps1|bat)$/i.test(l));
    if (exe) return exe;
  }
  return lines[0];
}

// Run <exe> --version (or -V) and return the first line. On win32, a bare
// .exe spawns directly (no shell, so spaces in the path are fine). .cmd/.ps1
// shims need cmd /c — embed the command (exe + args) in the single /c argument
// and run WITHOUT shell:true, which avoids Node's DEP0190 (args + shell:true)
// and correctly handles paths with spaces.
function versionOfExe(exe, versionArgs) {
  const isShim = process.platform === "win32" && /\.(cmd|ps1|bat)$/i.test(exe);
  if (isShim) {
    // Build the ENTIRE command as a single string (exe quoted + args) and run
    // it with shell:true but an EMPTY args array. Node only emits DEP0190 when
    // shell:true is combined with a non-empty args array, so this form avoids
    // the warning while letting cmd.exe parse the quoted exe path (spaces like
    // "Program Files" stay intact). Verministic quoting of the exe uses "".
    const full = `"${exe.replace(/"/g, '""')}" ${versionArgs.join(" ")}`.trim();
    const r = spawnSync(full, [], { encoding: "utf8", timeout: 5000, windowsHide: true, shell: true });
    if (r.status !== 0) return null;
    const line = (r.stdout || "").split(/\r?\n/)[0].trim();
    return line.length > 80 ? line.slice(0, 80) : line || "ok";
  }
  const r = spawnSync(exe, versionArgs, { encoding: "utf8", timeout: 5000, windowsHide: true });
  if (r.status !== 0) return null;
  const line = (r.stdout || "").split(/\r?\n/)[0].trim();
  return line.length > 80 ? line.slice(0, 80) : line || "ok";
}

function check() {
  const cwd = process.cwd();
  const cfg = loadConfig();
  const tools = {};
  for (const name of Object.keys(TOOL_CATALOG)) {
    const cat = TOOL_CATALOG[name];
    // Config nodePath override: the user said "node lives at this exact
    // path" (version manager, custom install). Honor it before discovery so
    // a granted nodePath is never reported missing.
    let d = null;
    if (name === "node" && cfg.nodePath) {
      const p = expandEnv(cfg.nodePath);
      d = existsFile(p) ? { path: p, via: "config nodePath" } : null;
    }
    if (!d) d = discoverTool(name, cat);
    const verArgs = name === "python" ? ["-V"] : ["--version"];
    // Version: best-effort. PATH exec (via cmd /c for shims) and non-PATH
    // absolute paths both run directly.
    const version = d ? versionOfExe(d.path, verArgs) : null;
    tools[name] = {
      found: !!d,
      onPath: !!(d && d.via === "PATH"),
      via: d ? d.via : null,
      path: d ? d.path : null,
      version,
    };
  }

  // Node-bundled managers (npm/yarn/pnpm/bun) live next to node. If node was
  // found off-PATH (granted nodePath / version manager), probe node's bin dir
  // for them — otherwise a version-managed node would look "manager-less".
  if (tools.node.found) {
    const nodeDir = path.dirname(tools.node.path);
    for (const mgr of ["npm", "yarn", "pnpm", "bun"]) {
      if (tools[mgr].found) continue;
      const found = exeNames(mgr).map((e) => path.join(nodeDir, e)).find(existsFile);
      if (found) {
        tools[mgr] = {
          found: true,
          onPath: false,
          via: `node bin dir (${path.basename(nodeDir)})`,
          path: found,
          version: versionOfExe(found, ["--version"]),
        };
      }
    }
  }

  const lockfile = cfg.packageManager ? null : detectLockfile(cwd);
  const detectedShell = detectShell();

  // unrecognized = tools/commands this machine cannot resolve AT ALL
  // (not on PATH, not in a known version-manager dir, no env var points to it).
  const unrecognized = [];
  // availableOffPath = installed but NOT on PATH — agent can use the absolute
  // path directly, or ask the user to add it to PATH.
  const availableOffPath = [];
  for (const name of Object.keys(TOOL_CATALOG)) {
    const t = tools[name];
    const cat = TOOL_CATALOG[name];
    if (t.found) {
      if (!t.onPath) {
        availableOffPath.push({
          tool: name,
          label: cat.label,
          path: t.path,
          via: t.via,
          note:
            t.via === "config nodePath"
              ? `User-granted override at ${t.path}. Use this absolute path.`
              : `Installed at ${t.path} but not on PATH. Use the absolute path, or ask the user to add it to PATH.`,
        });
      }
      continue;
    }
    const entry = {
      tool: name,
      label: cat.label,
      impact: cat.impact,
      required: cat.required,
      fallback: cat.fallback,
      askPermission: cat.permission ? true : false,
      permission: cat.permission,
    };
    // Skip npm/pwsh-only-if-needed noise unless they matter for THIS cwd.
    if (name === "npm" && tools.pnpm.found) continue;
    if (name === "pwsh" && detectedShell === "powershell5.1" && process.platform === "win32") continue;
    unrecognized.push(entry);
  }

  // Explicit permission requests — one per action the agent should ask the
  // user to authorize (install missing tool / network / registry override).
  const permissionRequests = unrecognized
    .filter((u) => u.askPermission)
    .map((u) => ({
      tool: u.tool,
      action: u.permission,
      reason: u.impact,
      ifDenied: u.fallback
        ? `Use fallback: ${u.fallback}`
        : `Stop and explain that ${u.label} is unavailable`,
    }));

  return {
    os: process.platform,
    arch: process.arch,
    cwd,
    shell: detectedShell,
    lockfile: lockfile || cfg.packageManager || null,
    tools,
    availableOffPath,
    unrecognized,
    permissionRequests,
    // convenience: everything OK?
    ready: unrecognized.filter((u) => u.required).length === 0,
    configFile,
  };
}

function redact(cfg) {
  const c = JSON.parse(JSON.stringify(cfg));
  if (c.apiKeys) {
    for (const k of Object.keys(c.apiKeys)) c.apiKeys[k] = "***";
  }
  return c;
}

function humanReport(r) {
  const lines = [
    `OS: ${r.os} / ${r.arch}   Shell: ${r.shell}   Cwd: ${r.cwd}`,
    `Lockfile: ${r.lockfile || "none (no project root detected)"}`,
    "",
    "Tools detected:",
  ];
  for (const [name, t] of Object.entries(r.tools)) {
    lines.push(`  ${t.found ? "[ok]" : "[?]"}  ${name.padEnd(8)} ${t.version || ""}`.trimEnd());
  }
  if (r.availableOffPath.length) {
    lines.push("", "Installed but NOT on PATH (use absolute path, or ask user to add to PATH):");
    for (const a of r.availableOffPath) {
      lines.push(`  - ${a.label} (${a.tool}) at ${a.path}`);
      lines.push(`      via: ${a.via}`);
    }
  }
  if (r.unrecognized.length) {
    lines.push("", "Unrecognized tools / commands (NOT available on this machine):");
    for (const u of r.unrecognized) {
      lines.push(`  - ${u.label} (${u.tool}): ${u.impact}`);
      if (u.fallback) lines.push(`      fallback: ${u.fallback}`);
    }
  } else {
    lines.push("", "All catalogued tools present.");
  }
  if (r.permissionRequests.length) {
    lines.push("", "Permission requests (ask the user before doing these):");
    for (const p of r.permissionRequests) {
      lines.push(`  - ${p.action}`);
      lines.push(`      if denied: ${p.ifDenied}`);
    }
  } else {
    lines.push("", "No permission needed.");
  }
  lines.push("", `Ready: ${r.ready ? "yes" : "no (required tools missing)"}`);
  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes("--check")) {
    console.log(JSON.stringify(check(), null, 2));
    return;
  }
  if (args.includes("--report")) {
    console.log(humanReport(check()));
    return;
  }
  if (args.includes("--status")) {
    const cfg = loadConfig();
    console.log("config file:", configFile);
    console.log(JSON.stringify(redact(cfg), null, 2));
    return;
  }
  // --grant records a user-approved override. Accepts a JSON file path (after
  // --grant-file) or key=value / inline JSON (after --grant).
  const grantFileIdx = args.indexOf("--grant-file");
  const grantIdx = args.indexOf("--grant");
  if (grantFileIdx >= 0) {
    const cfg = loadConfig();
    const file = args[grantFileIdx + 1];
    let patch;
    try {
      let raw = readFileSync(file, "utf8");
      if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
      patch = JSON.parse(raw);
    } catch (e) {
      console.error("Failed to read/parse --grant-file:", e.message);
      process.exit(1);
    }
    for (const k of Object.keys(patch)) {
      if (k === "apiKeys") cfg.apiKeys = { ...cfg.apiKeys, ...patch.apiKeys };
      else cfg[k] = patch[k];
    }
    saveConfig(cfg);
    console.log("Override granted. Saved to", configFile);
    return;
  }
  if (grantIdx >= 0) {
    const cfg = loadConfig();
    const val = args[grantIdx + 1];
    if (val && val.startsWith("{")) {
      try {
        let raw = val;
        if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
        const patch = JSON.parse(raw);
        for (const k of Object.keys(patch)) {
          if (k === "apiKeys") cfg.apiKeys = { ...cfg.apiKeys, ...patch.apiKeys };
          else cfg[k] = patch[k];
        }
      } catch (e) {
        console.error("Invalid JSON for --grant:", e.message);
        console.error("Hint: on Windows PowerShell, use --grant-file <path.json> instead (inline quotes get stripped).");
        process.exit(1);
      }
    } else if (val && val.includes("=")) {
      const [k, ...rest] = val.split("=");
      const v = rest.join("=");
      // Coerce obvious literals so `--grant executionPolicyBypass=false` stays
      // a boolean rather than the string "false".
      let value = v;
      if (v === "true") value = true;
      else if (v === "false") value = false;
      else if (v === "null") value = null;
      else if (/^-?\d+(\.\d+)?$/.test(v)) value = Number(v);
      // apiKeys.<name> writes into the nested apiKeys object.
      if (k.startsWith("apiKeys.")) {
        cfg.apiKeys = { ...cfg.apiKeys, [k.slice("apiKeys.".length)]: value };
      } else {
        cfg[k] = value;
      }
    } else {
      console.error("usage: --grant key=value  OR  --grant '{json}'  OR  --grant-file <path.json>");
      process.exit(1);
    }
    saveConfig(cfg);
    console.log("Override granted. Saved to", configFile);
    return;
  }
  if (args.includes("--revoke")) {
    saveConfig({ ...DEFAULTS });
    console.log("All overrides cleared:", configFile);
    return;
  }
  // --path alone (no action) or unknown args → usage.
  console.error(
    "usage: node setup.mjs --check | --report | --status | --grant key=value | --grant '<json>' | --grant-file <json> | --revoke [--path dir]"
  );
  process.exit(1);
}

main();
