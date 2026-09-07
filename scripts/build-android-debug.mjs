import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const run = (cmd, args) => {
  console.log(`\\n> ${cmd} ${args.join(' ')}`)
  execFileSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
}


function patchAndroidManifest() {
  const manifest = resolve(root, 'android/app/src/main/AndroidManifest.xml')
  if (!existsSync(manifest)) return
  let xml = readFileSync(manifest, 'utf8')
  if (!xml.includes('android:largeHeap="true"')) {
    xml = xml.replace('<application', '<application android:largeHeap="true"')
    writeFileSync(manifest, xml, 'utf8')
    console.log('Android manifest: enabled largeHeap for large SQLite backups')
  }
}

run('npm', ['run', 'build'])

if (!existsSync(resolve(root, 'android'))) {
  run('npx', ['cap', 'add', 'android'])
}

run('npx', ['cap', 'sync', 'android'])
patchAndroidManifest()

const androidRoot = resolve(root, 'android')
const gradlew = process.platform === 'win32' ? resolve(androidRoot, 'gradlew.bat') : resolve(androidRoot, 'gradlew')
if (existsSync(gradlew)) {
  run(gradlew, ['assembleDebug'])
} else {
  const gradleCmd = process.platform === 'win32' ? 'gradle.bat' : 'gradle'
  run(gradleCmd, ['assembleDebug'])
}

console.log('\\nAPK: android/app/build/outputs/apk/debug/app-debug.apk')
