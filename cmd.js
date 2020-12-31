#!/usr/bin/env node

/**
* @license
* Copyright 2020 Yufan You
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

const neodoc = require('neodoc');

const { createServer } = require('./lib');
const constants = require('./constants');
const { version: VERSION } = require('./package.json');

const args = neodoc.run(`Run a fake Luogu paintboard server.

Usage:
  fake-luogu-paintboard-server [options]
  
Options:
  --port=<port>      The port of the HTTP server on localhost.
                     [env: PORT] [default: ${constants.port}]
  
  --wsport=<wsport>  The port of the WebSocket server on localhost.
                     [env: WSPORT] [default: ${constants.wsport}]

  --noRestrict       Don't require cookies and referer and no CD time.
                     [env: NORESTRICT]

  --cd=<cd>          Interval between two paints of the same uid, in milliseconds.
                     [env: CD] [default: ${constants.cd}]

  --height=<height>  The height of the board. [env: HEIGHT] [default: ${constants.height}]

  --width=<width>    The width of the board.  [env: WIDTH]  [default: ${constants.width}]

  --verbose          Be more verbose.         [env: VERBOSE]
`, { version: `v${VERSION}` });

const {
  '--port': port,
  '--wsport': wsport,
  '--noRestrict': noRestrict,
  '--cd': cd,
  '--width': width,
  '--height': height,
  '--verbose': verbose,
} = args;

createServer({
  port, wsport, noRestrict, cd, width, height, verbose,
}).then(({ homePageUrl, wsUrl }) => {
  // eslint-disable-next-line no-console
  console.log(`Homepage: ${homePageUrl}
WebSocket: ${wsUrl}`);
});
