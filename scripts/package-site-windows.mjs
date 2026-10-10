// Static Sites packager for this Windows checkout. Uses native tar without Bash.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const workspace=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const [sourceArgument,archiveArgument]=process.argv.slice(2);
if(!sourceArgument||!archiveArgument)throw new Error('Expected source directory and archive path.');
const source=realpathSync(sourceArgument),archive=resolve(archiveArgument);
const artifactRoot=join(workspace,'artifacts');
if(source!==workspace||!archive.startsWith(artifactRoot+sep))throw new Error('Package paths must stay inside this workspace.');
const manifest=JSON.parse(readFileSync(join(source,'.openai','hosting.json'),'utf8'));
if(manifest.project_id!=='appgprj_6aca0e59eaf48191b4272e988aa31c08'||manifest.static?.directory!=='dist')throw new Error('Unexpected Sites identity or static layout.');
if(!statSync(join(source,'dist','index.html')).isFile())throw new Error('Build the game before packaging.');
mkdirSync(artifactRoot,{recursive:true});
const stage=mkdtempSync(join(artifactRoot,'site-v11-'));
cpSync(join(source,'dist'),join(stage,'dist'),{recursive:true});
mkdirSync(join(stage,'dist','.openai'),{recursive:true});
cpSync(join(source,'.openai','hosting.json'),join(stage,'dist','.openai','hosting.json'));
const tar=spawnSync('tar',['-czf',archive,'-C',stage,'dist'],{windowsHide:true,encoding:'utf8'});
if(tar.error||tar.status!==0)throw new Error(tar.error?.message||tar.stderr||'Native tar failed.');
const listing=spawnSync('tar',['-tzf',archive],{windowsHide:true,encoding:'utf8'});
if(listing.status!==0||!listing.stdout.split(/\r?\n/).includes('dist/.openai/hosting.json'))throw new Error('Packaged hosting manifest is missing.');
console.log(archive);
