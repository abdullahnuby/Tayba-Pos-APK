import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const run = (cmd, args) => {
  console.log(`\\n> ${cmd} ${args.join(' ')}`)
  execFileSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
}

run('npm', ['run', 'build'])

if (!existsSync(resolve(root, 'android'))) {
  run('npx', ['cap', 'add', 'android'])
}

run('npx', ['cap', 'sync', 'android'])

const androidRoot = resolve(root, 'android')
const gradlew = process.platform === 'win32' ? resolve(androidRoot, 'gradlew.bat') : resolve(androidRoot, 'gradlew')
if (existsSync(gradlew)) {
  run(gradlew, ['assembleDebug'])
} else {
  const gradleCmd = process.platform === 'win32' ? 'gradle.bat' : 'gradle'
  run(gradleCmd, ['assembleDebug'])
}

console.log('\\nAPK: android/app/build/outputs/apk/debug/app-debug.apk')
