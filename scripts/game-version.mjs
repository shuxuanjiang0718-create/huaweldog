import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
export function gameVersion(root) {
  const files=[];
  function walk(folder){for(const item of readdirSync(path.join(root,folder),{withFileTypes:true})){const name=path.posix.join(folder,item.name);if(item.isDirectory())walk(name);else files.push(name);}}
  walk('src');walk('public');files.push('index.html','package.json','vite.config.js');files.sort();
  const hash=createHash('sha256');for(const name of files){hash.update(name);hash.update(readFileSync(path.join(root,name)));}
  const packageInfo=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'));
  return {name:packageInfo.name,version:packageInfo.version,sourceHash:hash.digest('hex'),builtAt:new Date().toISOString()};
}
