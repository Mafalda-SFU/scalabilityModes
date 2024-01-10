#!/usr/bin/env node

const {writeFile} = require('node:fs/promises');
const {sep} = require('node:path');
const {Readable} = require('node:stream');
const {text} = require('node:stream/consumers');
const {createGunzip} = require('node:zlib');

const PackageJson = require('@npmcli/package-json');
const eq = require('semver/functions/eq.js');
const lt = require('semver/functions/lt.js');
const simpleGit = require('simple-git');
const tar = require('tar-stream');


const repo = 'versatica/mediasoup'


function isNotRustRelease({tag_name})
{
  return !tag_name.startsWith('rust-')
}


(async function()
{
  const releases = await fetch(`https://api.github.com/repos/${repo}/releases`)
    .then(res => res.json())

  const {url} = releases.find(isNotRustRelease)

  const [{tag_name: version, tarball_url}, pkgJson] = await Promise.all([
    fetch(url)
    .then(res => res.json()),
    PackageJson.load('.')
  ])

  if(lt(version, pkgJson.content.version))
    throw new Error(
      `Published mediasoup version ${version} is older than version ` +
      `${pkgJson.content.version} from the package.json file. Maybe there's ` +
      `a mistake in the package.json version?`
    )

  if(eq(version, pkgJson.content.version)) return

  const {body} = await fetch(tarball_url)

  const extract = Readable.fromWeb(body).pipe(createGunzip()).pipe(tar.extract())

  for await (const entry of extract)
  {
    const {name, type} = entry.header

    let path = name.split(sep)
    path.shift()
    path = path.join(sep)

    if(path === 'node/tsconfig.json' || path === 'node/src/scalabilityModes.ts')
    {
      path = path.split(sep)
      path.shift()
      path = path.join(sep)

      const content = await text(entry);

      await writeFile(path, content, 'utf8')
      continue
    }

    entry.resume()
  }

  const git = simpleGit()
  const {files: {length}} = await git.status()
  if(!length) return

  const {
    content: {
      dependencies, devDependencies, optionalDependencies, peerDependencies
    }
  } = pkgJson

  pkgJson.update({
    dependencies,
    devDependencies,
    optionalDependencies,
    peerDependencies,
    version
  })

  await pkgJson.save()

  // Print new version
  console.log(version)
})()
