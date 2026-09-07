import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const androidRoot = resolve(root, 'android')
const appGradle = resolve(androidRoot, 'app', 'build.gradle')
const keyProps = resolve(androidRoot, 'keystore.properties')

const run = (cmd, args) => {
  console.log(`\\n> ${cmd} ${args.join(' ')}`)
  execFileSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}

if (!existsSync(androidRoot)) {
  throw new Error('android/ is missing. Run: npm run android:prepare')
}
if (!existsSync(appGradle)) {
  throw new Error('android/app/build.gradle is missing.')
}
if (!existsSync(keyProps)) {
  throw new Error(
    'android/keystore.properties is missing. Create the release keystore first; see ANDROID_RELEASE.md.'
  )
}

const propsText = readFileSync(keyProps, 'utf8')
const required = ['storeFile=', 'storePassword=', 'keyAlias=', 'keyPassword=']
for (const key of required) {
  if (!propsText.split(/\\r?\\n/).some((line) => line.trim().startsWith(key))) {
    throw new Error(`Missing ${key} in android/keystore.properties`)
  }
}

let gradle = readFileSync(appGradle, 'utf8')
const versionCode = 1
const versionName = '1.0.0'

gradle = gradle.replace(/versionCode\s+[^\n]+/, `versionCode ${versionCode}`)
gradle = gradle.replace(/versionName\s+[^\n]+/, `versionName "${versionName}"`)

if (!gradle.includes("def keystorePropertiesFile = rootProject.file('keystore.properties')")) {
  const marker = 'android {'
  const inject = `def keystorePropertiesFile = rootProject.file('keystore.properties')\ndef keystoreProperties = new Properties()\nif (keystorePropertiesFile.exists()) {\n    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))\n}\n\n`
  gradle = gradle.replace(marker, inject + marker)
}

if (!gradle.includes('signingConfigs {')) {
  const marker = 'buildTypes {'
  const inject = `signingConfigs {\n        release {\n            storeFile file(keystoreProperties['storeFile'])\n            storePassword keystoreProperties['storePassword']\n            keyAlias keystoreProperties['keyAlias']\n            keyPassword keystoreProperties['keyPassword']\n        }\n    }\n\n    `
  if (gradle.includes(marker)) gradle = gradle.replace(marker, inject + marker)
  else throw new Error('Could not find buildTypes block in android/app/build.gradle')
}

const releaseBlock = /buildTypes\\s*\\{([\\s\\S]*?)\\n\\s*\\}/m
if (releaseBlock.test(gradle)) {
  const current = gradle.match(releaseBlock)?.[1] ?? ''
  if (current.includes('release {') && !/release\\s*\\{[\\s\\S]*?signingConfig\s+signingConfigs\.release/.test(current)) {
    gradle = gradle.replace(/(release\\s*\\{)/, '$1\\n            signingConfig signingConfigs.release')
  }
}

writeFileSync(appGradle, gradle, 'utf8')

const gradlew = process.platform === 'win32' ? resolve(androidRoot, 'gradlew.bat') : resolve(androidRoot, 'gradlew')
if (!existsSync(gradlew)) throw new Error('Gradle wrapper not found in android/')

const gradleArgs = ['assembleRelease', '--no-daemon', '--console=plain']
run(gradlew, gradleArgs)

console.log('\\nRelease APK: android/app/build/outputs/apk/release/app-release.apk')
console.log('Version: 1.0.0 (versionCode 1)')
