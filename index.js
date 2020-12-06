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

const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const WebSocket = require('ws');
const neodoc = require('neodoc');
const server = require('server');
const json = require('server/reply/json');
const status = require('server/reply/status');

const { version: VERSION } = require('./package.json');

const { get, post } = server.router;

const args = neodoc.run(`Run a fake Luogu paintboard server.

Usage:
  fake-luogu-paintboard-server [options]
  
Options:
  --port=<port>      The port of the HTTP server on localhost.
                     [env: PORT] [default: 3000]
  
  --wsport=<wsport>  The port of the WebSocket server on localhost.
                     [env: WSPORT] [default: 4000]
                     
  --cd=<cd>          Inteval between two paints of the same uid, in milliseconds.
                     [env: CD] [default: 10000]

  --height=<height>  The height of the board. [env: HEIGHT] [default: 400]

  --width=<width>    The width of the board.  [env: WIDTH]  [default: 800]

  --verbose          Be more verbose.         [env: VERBOSE]
`, { version: `v${VERSION}` });

const {
  '--port': port,
  '--wsport': wsport,
  '--cd': cd,
  '--width': width,
  '--height': height,
  '--verbose': verbose,
} = args;

const COLOR = [
  [0, 0, 0],
  [255, 255, 255],
  [170, 170, 170],
  [85, 85, 85],
  [254, 211, 199],
  [255, 196, 206],
  [250, 172, 142],
  [255, 139, 131],
  [244, 67, 54],
  [233, 30, 99],
  [226, 102, 158],
  [156, 39, 176],
  [103, 58, 183],
  [63, 81, 181],
  [0, 70, 112],
  [5, 113, 151],
  [33, 150, 243],
  [0, 188, 212],
  [59, 229, 219],
  [151, 253, 220],
  [22, 115, 0],
  [55, 169, 60],
  [137, 230, 66],
  [215, 255, 7],
  [255, 246, 209],
  [248, 203, 140],
  [255, 235, 59],
  [255, 193, 7],
  [255, 152, 0],
  [255, 87, 34],
  [184, 63, 39],
  [121, 85, 72],
];

const DEFAULT_COLOR = 2;
const REQUIRED_REFERER = 'https://www.luogu.com.cn/paintBoard';

const board = new Array(width).fill(0).map(() => new Array(height).fill(DEFAULT_COLOR));
const lastPaint = new Map();

const wsUrl = `ws://localhost:${wsport}`;

let homePage = 'Loading...';

fs.readFile(path.resolve(__dirname, 'paintBoard.html'), (err, data) => {
  if (err) throw err;
  homePage = data.toString().replace('$wsurl', wsUrl);
});

const wss = new WebSocket.Server({ port: wsport, path: '/ws' });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const msg = JSON.parse(message);
    if (msg.type === 'join_channel' && msg.channel === 'paintboard') {
      ws.send(JSON.stringify({ type: 'result' }));
    }
  });
});

function getBoard() {
  let result = '';
  board.forEach((column) => {
    column.forEach((cell) => {
      result += Number(cell).toString(COLOR.length);
    });
    result += '\n';
  });
  return result;
}

function paint(ctx) {
  function response(statusCode, message) {
    ctx.log.info(`${statusCode}: ${message}`);
    return json({ status: statusCode, data: message });
  }

  const uid = ctx.cookies?._uid;
  const clientId = ctx.cookies?.__client_id;
  if (!uid || !clientId) {
    return response(401, '没有登录（你需要在 Cookies 中包含 "_uid" 和 "__client_id"）');
  }

  const referer = ctx.headers?.referer;
  if (referer !== REQUIRED_REFERER) {
    return response(412, `Referer 应为 "${REQUIRED_REFERER}"`);
  }

  if (lastPaint.has(uid) && Date.now() - lastPaint.get(uid) < cd) {
    return response(500, `uid:${uid} 冷却中`);
  }

  const x = +ctx.data?.x;
  const y = +ctx.data?.y;
  const color = +ctx.data?.color;

  if (_.inRange(x, 0, width) && _.inRange(y, 0, height) && _.inRange(color, 0, COLOR.length)) {
    try {
      lastPaint.set(uid, Date.now());
      board[x][y] = color;
      return response(200, `成功（uid:${uid}, x:${x}, y:${y}, color:${color}）`);
    } finally {
      const broadcast = JSON.stringify({
        type: 'paintboard_update',
        x,
        y,
        color,
      });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(broadcast);
        }
      });
    }
  }

  return response(400, 'data 中的 x, y, color 不合法');
}

server({ port, security: { csrf: false }, log: verbose ? 'info' : 'warning' }, [
  get('/paintBoard', () => homePage),
  get('/paintBoard/board', getBoard),
  post('/paintBoard/paint', paint),
  get(() => status(404).send('Not Found')),
]).then(() => {
  // eslint-disable-next-line no-console
  console.log(`Homepage: http://localhost:${port}/paintBoard
WebSocket: ${wsUrl}/ws`);
});
