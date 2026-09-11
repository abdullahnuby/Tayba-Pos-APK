import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const androidRes = resolve(root, 'android', 'app', 'src', 'main', 'res')
const sourceRoot = resolve(root, 'resources', 'android-launcher-icons')

if (!existsSync(androidRes)) throw new Error('Android resources directory does not exist: ' + androidRes)
if (!existsSync(sourceRoot)) throw new Error('Android launcher icon sources are missing: ' + sourceRoot)

// Remove every old Capacitor/default launcher resource so Android cannot select it.
for (const dir of readdirSync(androidRes, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue
  const dirPath = join(androidRes, dir.name)
  for (const file of readdirSync(dirPath)) {
    if (/^ic_launcher(_round|_foreground|_background)?\.(png|webp|xml)$/.test(file)) {
      rmSync(join(dirPath, file), { force: true })
    }
  }
}

const densities = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi']
for (const density of densities) {
  const target = join(androidRes, density)
  mkdirSync(target, { recursive: true })
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) {
    cpSync(join(sourceRoot, density, name), join(target, name), { force: true })
  }
}

// Prevent Android 8+ adaptive-icon XML resources from overriding the PNGs.
for (const anydpi of ['mipmap-anydpi', 'mipmap-anydpi-v26']) {
  const dir = join(androidRes, anydpi)
  if (!existsSync(dir)) continue
  for (const file of readdirSync(dir)) {
    if (/^ic_launcher(_round|_foreground|_background)?\.(xml|png|webp)$/.test(file)) {
      rmSync(join(dir, file), { force: true })
    }
  }
}

// Force both manifest references to the PNG launcher resources.
const manifest = resolve(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
if (existsSync(manifest)) {
  let text = (await import('node:fs')).readFileSync(manifest, 'utf8')
  text = text.replace(/android:icon="[^"]*"/g, 'android:icon="@mipmap/ic_launcher"')
  text = text.replace(/android:roundIcon="[^"]*"/g, 'android:roundIcon="@mipmap/ic_launcher_round"')
  ;(await import('node:fs')).writeFileSync(manifest, text, 'utf8')
}

console.log('Tayba POS Android launcher icon installed from resources/android-launcher-icons')
