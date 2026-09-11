import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const androidRes = resolve(root, 'android', 'app', 'src', 'main', 'res')
const source = resolve(root, 'resources', 'icon.png')

if (!existsSync(source)) throw new Error(`Missing launcher source: ${source}`)
if (!existsSync(androidRes)) throw new Error(`Android resources not found: ${androidRes}`)

const densityDirs = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi']

// Remove every generated Capacitor launcher variant first. This also removes
// adaptive-icon XML that could keep pointing at the old/default icon.
for (const entry of readdirSync(androidRes, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('mipmap-')) continue
  for (const file of readdirSync(resolve(androidRes, entry.name))) {
    if (/^ic_launcher(?:_round)?(?:\..+)?$/i.test(file) || /^ic_launcher_(foreground|background|monochrome)(?:\..+)?$/i.test(file)) {
      unlinkSync(resolve(androidRes, entry.name, file))
    }
  }
}

// Put the real Tayba artwork directly on the resources Android resolves for
// android:icon and android:roundIcon. Keeping the same 1024px source in each
// density is intentional: Android scales density resources as needed, while
// avoiding any dependency on an external image-processing package in CI.
for (const dir of densityDirs) {
  const targetDir = resolve(androidRes, dir)
  mkdirSync(targetDir, { recursive: true })
  copyFileSync(source, resolve(targetDir, 'ic_launcher.png'))
  copyFileSync(source, resolve(targetDir, 'ic_launcher_round.png'))
}

// Ensure the manifest explicitly resolves both launcher entries to the PNGs.
const manifest = resolve(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
if (existsSync(manifest)) {
  let text = readFileSync(manifest, 'utf8')
  text = text.replace(/android:icon="[^"]+"/g, 'android:icon="@mipmap/ic_launcher"')
  text = text.replace(/android:roundIcon="[^"]+"/g, 'android:roundIcon="@mipmap/ic_launcher_round"')
  if (!/android:icon="@mipmap\/ic_launcher"/.test(text)) {
    text = text.replace(/(<application\b)/, '$1\n        android:icon="@mipmap/ic_launcher"\n        android:roundIcon="@mipmap/ic_launcher_round"')
  }
  writeFileSync(manifest, text, 'utf8')
}

// Hard verification: no launcher XML/foreground resource may remain.
const leftovers = []
for (const entry of readdirSync(androidRes, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('mipmap-')) continue
  for (const file of readdirSync(resolve(androidRes, entry.name))) {
    if (/^ic_launcher(?:_round|_foreground|_background|_monochrome)?\.xml$/i.test(file)) leftovers.push(`${entry.name}/${file}`)
  }
}
if (leftovers.length) throw new Error(`Old adaptive launcher resources remain: ${leftovers.join(', ')}`)

console.log('FORCED ANDROID LAUNCHER ICON: resources/icon.png -> mipmap/ic_launcher + ic_launcher_round')
