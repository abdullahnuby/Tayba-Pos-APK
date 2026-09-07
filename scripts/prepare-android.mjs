import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const run = (cmd, args) => {
  console.log(`\\n> ${cmd} ${args.join(' ')}`)
  execFileSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
}

if (!existsSync(resolve(root, 'node_modules'))) {
  run('npm', ['install'])
}

run('npm', ['run', 'build'])

if (!existsSync(resolve(root, 'android'))) {
  run('npx', ['cap', 'add', 'android'])
}

run('npx', ['cap', 'sync', 'android'])
console.log('\\nAndroid project is ready. Open it with: npx cap open android')
