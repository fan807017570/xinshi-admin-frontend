import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const legacyDist = resolve(root, 'legacy-dist')
const outputDist = resolve(root, 'dist')

if (!existsSync(legacyDist)) {
  throw new Error(`legacy dist not found: ${legacyDist}`)
}

rmSync(outputDist, { recursive: true, force: true })
cpSync(legacyDist, outputDist, { recursive: true })

console.log(`Copied exact legacy dist to ${outputDist}`)
