#!/usr/bin/env node

const {ok} = require('node:assert');
const {writeFile} = require('node:fs/promises');
const {sep} = require('node:path');
const {Readable} = require('node:stream');
const {text} = require('node:stream/consumers');
const {createGunzip} = require('node:zlib');

const {extract} = require('tar-stream');


const repo = 'versatica/mediasoup'


const {argv: [,, version]} = process;


ok(version, 'version is required');


(async function()
{
  const response = await fetch(
    `https://api.github.com/repos/${repo}/tarball/${version}`
  )

  ok(response.ok, response.statusText)

  const extractor = Readable.fromWeb(response.body).pipe(createGunzip()).pipe(extract())

  for await (const entry of extractor)
  {
    const {header: {name}} = entry

    let path = name.split(sep)
    path.shift()
    path = path.join(sep)

    if(
      path === 'node/tsconfig.json' ||
      path === 'node/src/scalabilityModesTypes.ts' ||
      path === 'node/src/scalabilityModesUtils.ts'
    ) {
      path = path.split(sep)
      path.shift()
      path = path.join(sep)

      const content = await text(entry);

      await writeFile(path, content, 'utf8')
      continue
    }

    entry.resume()
  }
})()
