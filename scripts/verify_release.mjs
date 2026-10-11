// Verify the embedded game and desktop shell, not merely the loose build directory.
import {readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import asar from '@electron/asar';
import {gameVersion} from './game-version.mjs';
const root=process.cwd(),archive=path.join(root,'release','win-unpacked','resources','app.asar');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const expected=gameVersion(root),embedded=JSON.parse(asar.extractFile(archive,'dist/game-version.json'));
if(expected.sourceHash!==embedded.sourceHash)throw new Error('Embedded game is stale');
const checked=[];
function compare(folder){
  for(const entry of readdirSync(path.join(root,folder),{withFileTypes:true})){
    const file=path.posix.join(folder,entry.name);
    if(entry.isDirectory())compare(file);
    else{
      const original=readFileSync(path.join(root,file)),packed=asar.extractFile(archive,path.join(...file.split('/')));
      if(digest(original)!==digest(packed))throw new Error('Packaged file mismatch: '+file);
      checked.push(file);
    }
  }
}
compare('dist');compare('desktop');
const browser=JSON.parse(readFileSync(path.join(root,'artifacts','browser-report-v12.json')));
const performance=JSON.parse(readFileSync(path.join(root,'artifacts','performance-v12.json')));
if(browser.build.sourceHash!==expected.sourceHash||browser.passed!==browser.total||browser.errors.length)throw new Error('Current browser QA is missing');
if(performance.build.sourceHash!==expected.sourceHash||performance.errors.length)throw new Error('Current profiling is missing');
const desktop=JSON.parse(readFileSync(path.join(root,'artifacts','desktop-offline-report-v12.json')));
const sync=JSON.parse(readFileSync(path.join(root,'artifacts','desktop-sync-report-v12.json')));
const normal=JSON.parse(readFileSync(path.join(root,'artifacts','desktop-normal-performance-v12.json')));
for(const report of [desktop,sync])if(report.build.sourceHash!==expected.sourceHash||report.passed!==report.total||report.errors.length)throw new Error('Current desktop QA is missing');
if(sync.sync.restored!==expected.sourceHash||normal.build.sourceHash!==expected.sourceHash||normal.errors.length)throw new Error('Desktop release parity failed');
const exe=path.join(root,'release',`1612-Critical-Stop-${expected.version}-Windows-x64.exe`);
const assets=JSON.parse(readFileSync(path.join(root,'public','assets','sources.json'),'utf8').replace(/^\uFEFF/,''));
for(const asset of assets){const bytes=readFileSync(path.join(root,'public','assets',asset.file));if(digest(bytes)!==asset.sha256||bytes.length!==asset.bytes)throw new Error('Asset mismatch: '+asset.file);}
const report={version:expected.version,sourceHash:expected.sourceHash,executable:exe,exeBytes:statSync(exe).size,exeSha256:digest(readFileSync(exe)),asarSha256:digest(readFileSync(archive)),embeddedFilesChecked:checked,assetsVerified:assets.length,browserChecks:browser.total,desktopChecks:desktop.total,syncChecks:sync.total,normalWindowPerformance:normal.measurement};
writeFileSync(path.join(root,'artifacts','release-integrity-v12.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
