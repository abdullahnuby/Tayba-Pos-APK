import { existsSync, readdirSync, rmSync, mkdirSync, copyFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const androidRes = resolve(root, 'android', 'app', 'src', 'main', 'res')
const sourceRoot = resolve(root, 'resources', 'android-icons')
if (!existsSync(androidRes)) throw new Error(`Android resources directory not found: ${androidRes}`)
if (!existsSync(sourceRoot)) throw new Error(`Android icon source directory not found: ${sourceRoot}`)
for (const dir of ['mipmap-anydpi-v26', 'mipmap-anydpi-v33']) { const p=resolve(androidRes,dir); if(!existsSync(p)) continue; for(const f of ['ic_launcher.xml','ic_launcher_round.xml']) { const file=resolve(p,f); if(existsSync(file)) rmSync(file) } }
for (const dir of readdirSync(androidRes)) { if(!dir.startsWith('mipmap-')) continue; const p=resolve(androidRes,dir); for(const f of ['ic_launcher_foreground.xml','ic_launcher_foreground.png','ic_launcher_background.xml']) { const file=join(p,f); if(existsSync(file)) rmSync(file) } }
for (const density of readdirSync(sourceRoot)) { const srcDir=resolve(sourceRoot,density); const dstDir=resolve(androidRes,density); if(!existsSync(srcDir)) continue; mkdirSync(dstDir,{recursive:true}); for(const f of ['ic_launcher.png','ic_launcher_round.png']) { const src=resolve(srcDir,f); if(existsSync(src)) copyFileSync(src,resolve(dstDir,f)) } }
console.log('Android launcher icon resources forced to Tayba POS logo.')
