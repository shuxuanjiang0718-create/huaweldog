const {app,BrowserWindow,protocol,Menu,ipcMain} = require('electron');
const fs=require('node:fs');const fsp=require('node:fs/promises');const path=require('node:path');const {spawn}=require('node:child_process');
const os=require('node:os');
const link=require('./workspace.json');
const qa=process.argv.includes('--qa-offscreen');
const offline=process.argv.includes('--offline');
const argument=(name)=>{const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:null;};
if(qa)app.commandLine.appendSwitch('remote-debugging-port',argument('--qa-port')||'9356');
protocol.registerSchemesAsPrivileged([{scheme:'game',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
let win,root,pendingRoot,building=false,rebuildAgain=false,buildTimer,buildProcess,revision=0;
const watchers=[];const gameName='critical-stop-1612';
if(!qa&&!app.requestSingleInstanceLock())app.exit(0);
app.on('second-instance',()=>{if(win&&!win.isDestroyed()){if(win.isMinimized())win.restore();win.focus();}});
const bundled=path.join(__dirname,'..','dist');
const workspace=path.resolve(argument('--workspace')||link.root);
const validProject=()=>{
  try{return JSON.parse(fs.readFileSync(path.join(workspace,'package.json'),'utf8')).name===gameName&&fs.existsSync(path.join(workspace,'node_modules','vite','bin','vite.js'));}catch{return false;}
};
const manifest=folder=>{try{const m=JSON.parse(fs.readFileSync(path.join(folder,'game-version.json'),'utf8'));return m.name===gameName&&/^[0-9a-f]{64}$/.test(m.sourceHash)&&fs.existsSync(path.join(folder,'index.html'))?m:null;}catch{return null;}};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.hdr':'application/octet-stream'};

async function cacheBuild(source) {
  const m=manifest(source);if(!m)throw new Error('Incomplete game build');
  const destination=path.join(app.getPath('userData'),'game-cache',m.sourceHash);
  await fsp.mkdir(path.dirname(destination),{recursive:true});
  if(!manifest(destination))await fsp.cp(source,destination,{recursive:true});
  await fsp.writeFile(path.join(app.getPath('userData'),'latest-game.json'),JSON.stringify({sourceHash:m.sourceHash}));
  return destination;
}
function latestCache() {
  try {const m=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'latest-game.json'),'utf8'));if(!/^[0-9a-f]{64}$/.test(m.sourceHash))return null;const folder=path.join(app.getPath('userData'),'game-cache',m.sourceHash);return manifest(folder)?folder:null;}catch{return null;}
}

async function rebuild() {
  if(!validProject()||app.isQuitting)return;
  if(building){rebuildAgain=true;return;}
  building=true;rebuildAgain=false;
  const output=path.join(workspace,'.local',`desktop-build-${process.pid}-${++revision}`);
  const logFile=path.join(app.getPath('userData'),'sync-build.log');
  await fsp.mkdir(path.dirname(output),{recursive:true});
  const log=fs.createWriteStream(logFile,{flags:'w'});
  // Electron ships Node. No npm, shell interpolation, or external Node install is required
  // to compile this already-authorized local project's installed Vite dependency.
  const child=spawn(process.execPath,[path.join(workspace,'node_modules','vite','bin','vite.js'),'build','--outDir',output],{
    cwd:workspace,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']
  });
  buildProcess=child;child.stdout.pipe(log);child.stderr.pipe(log);
  try{os.setPriority(child.pid,os.constants.priority.PRIORITY_BELOW_NORMAL);}catch{}
  const code=await new Promise(resolve=>{child.once('error',error=>{log.write(String(error));resolve(-1);});child.once('exit',resolve);});
  log.end();buildProcess=null;
  try {
    if(code===0&&manifest(output)) {
      const next=await cacheBuild(output);
      if(manifest(next)?.sourceHash!==manifest(root)?.sourceHash){pendingRoot=next;if(win&&!win.isDestroyed())win.webContents.send('game-update-ready');}
    }
  }catch(error){await fsp.appendFile(logFile,'\n'+String(error)).catch(()=>{});}
  // Only our uniquely named staging directory, inside this project's .local, is disposable.
  const stagingBase=path.resolve(workspace,'.local'),relative=path.relative(stagingBase,path.resolve(output));
  if(!relative.startsWith('..')&&!path.isAbsolute(relative)&&/^desktop-build-\d+-\d+$/.test(relative))await fsp.rm(output,{recursive:true,force:true}).catch(()=>{});
  building=false;if(rebuildAgain&&!app.isQuitting)rebuild();
}
function watchSource() {
  const schedule=()=>{clearTimeout(buildTimer);buildTimer=setTimeout(rebuild,1100);};
  for(const folder of ['src','public']) {
    try{watchers.push(fs.watch(path.join(workspace,folder),{recursive:true},schedule));}catch{}
  }
  try{watchers.push(fs.watch(workspace,(_,file)=>{if(['index.html','vite.config.js','package.json','package-lock.json'].includes(String(file)))schedule();}));}catch{}
  // Catch edits made while the executable was closed as well as future save events.
  buildTimer=setTimeout(rebuild,1600);
}

app.whenReady().then(async()=>{
  if(qa)app.setPath('userData',argument('--qa-data')||path.join(workspace,'.local','desktop-qa'));
  await fsp.mkdir(app.getPath('userData'),{recursive:true});
  const local=path.join(workspace,'dist');
  root=!offline&&validProject()&&manifest(local)?local:(!offline&&latestCache())||bundled;
  if(!manifest(root))throw new Error('Game files are missing. Please rebuild the Windows package.');
  protocol.handle('game',async request=>{
    try {
      const url=new URL(request.url);if(url.host!=='local')return new Response('Not found',{status:404});
      const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
      const asset=path.resolve(root,relative),check=path.relative(root,asset);
      if(check.startsWith('..')||path.isAbsolute(check))return new Response('Forbidden',{status:403});
      const body=await fsp.readFile(asset);
      return new Response(body,{headers:{'Content-Type':mime[path.extname(asset)]||'application/octet-stream','Cache-Control':'no-store'}});
    }catch{return new Response('Not found',{status:404});}
  });
  Menu.setApplicationMenu(null);
  win=new BrowserWindow({width:1440,height:900,minWidth:640,minHeight:420,useContentSize:true,show:false,title:'1612 · 临界刹停',backgroundColor:'#152028',autoHideMenuBar:true,
    icon:path.join(__dirname,'icon.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:!qa,offscreen:qa,webgl:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('game://local/'))event.preventDefault();});
  win.webContents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key==='F11'){event.preventDefault();win.setFullScreen(!win.isFullScreen());}});
  ipcMain.handle('game-update-status',event=>event.sender===win?.webContents&&!!pendingRoot);
  ipcMain.on('game-apply-update',event=>{
    if(event.sender!==win?.webContents||!pendingRoot)return;
    root=pendingRoot;pendingRoot=null;win.webContents.reloadIgnoringCache();
  });
  win.once('ready-to-show',()=>{if(!qa)win.show();});
  await win.loadURL('game://local/index.html');
  if(!offline&&validProject()&&!process.argv.includes('--no-sync'))watchSource();
}).catch(error=>{console.error(error);app.exit(1);});
app.on('before-quit',()=>{app.isQuitting=true;clearTimeout(buildTimer);for(const watcher of watchers)watcher.close();buildProcess?.kill();});
app.on('window-all-closed',()=>app.quit());
