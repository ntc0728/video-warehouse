#!/usr/bin/env bash
# check-environment probe script (POSIX sh / git-bash) — shared/portable version
# Outputs a JSON snapshot of the current environment. Read-only, ~1s.
# Portable: walks up from cwd for project root; reads optional $HOME/.config/
# check-environment/config.json overrides (written by setup.mjs). No hard-coded
# user paths beyond standard HOME config locations.
set +e

ts="$(date '+%Y-%m-%d %H:%M:%S' 2>/dev/null)"
os="$(uname -s 2>/dev/null)"
cwd="$(pwd 2>/dev/null)"

# --- optional config overrides ---
cfg_dir="$HOME/.config/check-environment"
cfg_npm_registry=""
cfg_node_path=""
if [ -f "$cfg_dir/config.json" ]; then
  # Read via node (strips BOM the same way setup.mjs does) so a config written
  # by PowerShell `-Encoding UTF8` doesn't silently fail JSON.parse.
  cfg_json="$(node -e "let r=require('fs').readFileSync(process.env.CFG,'utf8');if(r.charCodeAt(0)===0xfeff)r=r.slice(1);try{const j=JSON.parse(r);console.log(JSON.stringify(j))}catch(e){console.log('{}')}" 2>/dev/null)"
  cfg_npm_registry="$(printf '%s' "$cfg_json" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).npmRegistry||'')}catch(e){}})" 2>/dev/null)"
  cfg_node_path="$(printf '%s' "$cfg_json" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).nodePath||'')}catch(e){}})" 2>/dev/null)"
fi

# nodePath override: a version-managed/custom node not on PATH. Prepend its
# dir so `command -v node` and version checks see it (mirrors probe.ps1).
if [ -n "$cfg_node_path" ] && [ -x "$cfg_node_path" ]; then
  export PATH="$(dirname "$cfg_node_path"):$PATH"
fi

getver() { command -v "$1" >/dev/null 2>&1 && "$1" --version 2>/dev/null | head -n 1; }

tools_json=""
for t in node npm npx pnpm yarn bun git rg fd python3 python pwsh; do
  p="$(command -v "$t" 2>/dev/null)"
  if [ -n "$p" ]; then
    v="$(getver "$t")"
    tools_json="${tools_json}${tools_json:+,}\"$t\":{\"found\":true,\"path\":\"$p\",\"version\":\"$v\"}"
  else
    tools_json="${tools_json}${tools_json:+,}\"$t\":{\"found\":false,\"path\":null,\"version\":null}"
  fi
done

registry=""
if [ -n "$cfg_npm_registry" ]; then
  registry="$cfg_npm_registry"
else
  registry="$(npm config get registry 2>/dev/null)"
fi

# --- walk up from cwd to find project root (package.json) ---
lockfile=""
has_pkg="false"
dir="$cwd"
for _ in 1 2 3 4 5 6; do
  if [ -f "$dir/package.json" ]; then
    has_pkg="true"
    cwd="$dir"
    for lf in pnpm-lock.yaml package-lock.json yarn.lock bun.lockb bun.lock; do
      if [ -f "$dir/$lf" ]; then lockfile="$lf"; break; fi
    done
    break
  fi
  parent="$(dirname "$dir" 2>/dev/null)"
  [ -z "$parent" ] || [ "$parent" = "$dir" ] && break
  dir="$parent"
done

cat <<EOF
{
  "timestamp": "$ts",
  "os": "$os",
  "platform": "$os",
  "shell": "bash",
  "encoding": { "forcedUtf8": true },
  "tools": { $tools_json },
  "npmRegistry": "$registry",
  "gitBash": null,
  "bashOrSh": "$(command -v bash 2>/dev/null || command -v sh 2>/dev/null)",
  "config": {
    "file": "$cfg_dir/config.json",
    "loaded": $( [ -f "$cfg_dir/config.json" ] && echo true || echo false )
  },
  "project": {
    "cwd": "$cwd",
    "hasPackage": "$has_pkg",
    "lockfile": "$lockfile"
  }
}
EOF