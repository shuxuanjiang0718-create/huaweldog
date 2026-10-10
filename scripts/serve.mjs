import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, dirname, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..','dist');
const portArgument=process.argv.indexOf('--port');
const port=Number(portArgument>=0?process.argv[portArgument+1]:5178);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid port');
if(!existsSync(resolve(root,'index.html')))throw new Error('Build the game first with npm run build.');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.hdr':'application/octet-stream'};
const server=createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  let stat;
  try{stat=statSync(path);}catch{res.writeHead(404);res.end('Not found');return;}
  if(!stat.isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache'});
  if(req.method==='HEAD'){res.end();return;}
  const stream=createReadStream(path);stream.on('error',()=>res.destroy());stream.pipe(res);
});
server.on('error',error=>{
  console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Close the previous game server, or use --port 5179.`:error.message);
  process.exitCode=1;
});
server.listen(port,'0.0.0.0',()=>{
  const url=`http://localhost:${port}/`;
  console.log(`1612 - Critical Stop\nLocal: ${url}`);
  for(const addresses of Object.values(networkInterfaces()))for(const a of addresses??[]){
    if(a.family==='IPv4'&&!a.internal)console.log(`Network: http://${a.address}:${port}/`);
  }
  console.log('Keep this window open while playing. Ctrl+C stops the server.');
  if(process.argv.includes('--open')&&process.platform==='win32'){
    const child=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,detached:true,stdio:'ignore'});
    child.on('error',()=>{});child.unref();
  }
});
