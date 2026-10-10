import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { createVehicle } from './vehicle.js';

function seeded(seed = 41) {
  return () => { seed = (Math.imul(seed,1664525)+1013904223)|0; return (seed>>>0)/4294967296; };
}

function noise2(x,z) {
  const hash=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};
  const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
  const sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),sx),THREE.MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),sx),sz);
}

function groundTexture() {
  const c=document.createElement('canvas');c.width=c.height=512;
  const ctx=c.getContext('2d'),data=ctx.createImageData(512,512),random=seeded(871);
  for(let i=0;i<data.data.length;i+=4){const shade=175+random()*66;data.data[i]=shade;data.data[i+1]=shade;data.data[i+2]=shade;data.data[i+3]=255;}
  ctx.putImageData(data,0,0);
  const texture=new THREE.CanvasTexture(c);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(450,380);
  return texture;
}

function asphaltFallback() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d'), data = ctx.createImageData(512,512), random = seeded(79);
  for (let i=0;i<data.data.length;i+=4) {
    const shade = 64+random()*33;
    data.data[i]=shade;data.data[i+1]=shade+3;data.data[i+2]=shade+5;data.data[i+3]=255;
  }
  ctx.putImageData(data,0,0);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(6,360);
  return texture;
}

function contactTexture() {
  const c=document.createElement('canvas');c.width=c.height=128;
  const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,10,64,64,64);
  g.addColorStop(0,'rgba(0,0,0,.65)');g.addColorStop(.55,'rgba(0,0,0,.45)');g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);
}

function makeTerrain(scene) {
  const width=3200,depth=2800,nx=240,nz=180;
  const geometry=new THREE.PlaneGeometry(width,depth,nx,nz);
  geometry.rotateX(-Math.PI/2);geometry.translate(0,0,-1100);
  const positions=geometry.attributes.position,colors=[];
  const color=new THREE.Color();
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),z=positions.getZ(i),ax=Math.abs(x);
    const far=THREE.MathUtils.smoothstep(-z,150,1800);
    const valley=THREE.MathUtils.smoothstep(ax,22,170);
    const a=noise2(x*.0025+20,z*.0025+30);
    const b=noise2(x*.0065+90,z*.0065+20);
    const c=noise2(x*.019+15,z*.019+27);
    const d=noise2(x*.049+21,z*.049+5);
    const height=Math.pow(a*.60+b*.25+c*.11+d*.04,1.8)*(75+far*560)*valley;
    positions.setY(i,height-.13);
    const grain=Math.sin(x*1.5+z*2.1)*.008;
    color.setHSL(.17+c*.045,.16+Math.min(height/1100,.13),.055+height*.00019+grain);
    colors.push(color.r,color.g,color.b);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const grainMap=groundTexture();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,map:grainMap,bumpMap:grainMap,bumpScale:.16,roughness:.94,metalness:0});
  const terrain=new THREE.Mesh(geometry,material);terrain.receiveShadow=true;scene.add(terrain);
  return terrain;
}

function treeTexture() {
  const c=document.createElement('canvas');c.width=256;c.height=512;
  const ctx=c.getContext('2d'),random=seeded(119);
  ctx.fillStyle='#574a36';ctx.fillRect(125,63,7,434);
  for(let i=0;i<42;i++) {
    const y=20+i*10,spread=(9+i*2.2)*(i>33?1-(i-33)*.065:1);
    for(const side of [-1,1]) {
      const length=spread*(.75+random()*.3);
      ctx.strokeStyle='#3d4c38';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(128,y-16);ctx.quadraticCurveTo(128+side*length*.4,y+10,128+side*length,y+random()*12);ctx.stroke();
      for(let j=0;j<40;j++) {
        const t=random(),x=128+side*length*t+(random()-.5)*18,yy=y+Math.sin(t*2)*6+(random()-.5)*23;
        ctx.fillStyle=`rgb(${36+random()*23},${49+random()*30},${34+random()*23})`;
        ctx.beginPath();ctx.ellipse(x,yy,2+random()*6,1+random()*4,-side*.3,0,Math.PI*2);ctx.fill();
      }
    }
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function instance(geometry,material,positions,scene) {
  const mesh=new THREE.InstancedMesh(geometry,material,positions.length);
  const dummy=new THREE.Object3D();
  positions.forEach((p,i)=>{
    dummy.position.set(p.x??0,p.y??0,p.z??0);
    dummy.rotation.set(p.rx??0,p.ry??0,p.rz??0);
    dummy.scale.set(p.sx??1,p.sy??1,p.sz??1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);return mesh;
}

function signTexture() {
  const c=document.createElement('canvas');c.width=1024;c.height=256;
  const ctx=c.getContext('2d');ctx.fillStyle='#1b574b';ctx.fillRect(0,0,1024,256);
  ctx.strokeStyle='#d6e5d8';ctx.lineWidth=5;ctx.strokeRect(12,12,1000,232);
  ctx.fillStyle='#eef3e7';ctx.textAlign='center';ctx.font='500 64px "Microsoft YaHei", sans-serif';
  ctx.fillText('前方试验路段',512,104);ctx.font='24px Arial';ctx.fillText('BRAKE TEST  /  01',512,152);
  for(const x of [196,512,828]) {ctx.fillRect(x-3,184,6,32);ctx.beginPath();ctx.moveTo(x-12,207);ctx.lineTo(x,222);ctx.lineTo(x+12,207);ctx.stroke();}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

const FinishShader={
  uniforms:{tDiffuse:{value:null},time:{value:0},speed:{value:0},danger:{value:0},resolution:{value:new THREE.Vector2(1,1)}},
  vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:`
    uniform sampler2D tDiffuse; uniform float time; uniform float speed; uniform float danger;
    uniform vec2 resolution; varying vec2 vUv;
    float random(vec2 co){return fract(sin(dot(co,vec2(12.9898,78.233))+time)*43758.5453);}
    void main(){
      vec2 fromCenter=vUv-vec2(.5,.56);
      float edge=smoothstep(.16,.66,length(fromCenter));
      float motion=clamp(speed/55.,0.,1.)*edge*.010;
      vec3 color=texture2D(tDiffuse,vUv).rgb*.56;
      color+=texture2D(tDiffuse,vUv-fromCenter*motion).rgb*.25;
      color+=texture2D(tDiffuse,vUv-fromCenter*motion*2.).rgb*.19;
      float vignette=1.-dot(fromCenter,fromCenter)*.19;
      color*=vignette;
      color+=(random(vUv*resolution)-.5)*.0025;
      color+=vec3(.06,.0,.0)*danger*edge;
      gl_FragColor=vec4(color,1.);
    }
  `,
};

export class HighwayScene {
  constructor(canvas) {
    this.canvas=canvas;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xb5c6ce);
    this.scene.fog=new THREE.FogExp2(0xb5c6ca,.00142);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.93;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.camera=new THREE.PerspectiveCamera(47,1,.2,3800);
    this.camera.position.set(4.2,3.4,10.3);
    this.mobile=matchMedia('(pointer: coarse)').matches;
    this.mode='auto';this.dpr=Math.min(devicePixelRatio,this.mobile?1.2:1.4);
    this.frameSamples=[];this.runtime=0;this.worldDistance=0;this.breakTime=-100;
    this.lookAt=new THREE.Vector3();this.smoothedTarget=new THREE.Vector3(-3.8,1.35,-9);this.positionTarget=new THREE.Vector3();
    const hemi=new THREE.HemisphereLight(0xd8edf7,0x646754,.8);this.scene.add(hemi);
    const sun=new THREE.DirectionalLight(0xffeddb,2.4);
    sun.position.set(-34,54,-85);sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);
    sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=24;sun.shadow.camera.bottom=-24;
    sun.shadow.camera.near=1;sun.shadow.camera.far=150;sun.shadow.bias=-.0004;sun.shadow.normalBias=.045;
    sun.target.position.set(0,0,0);this.scene.add(sun,sun.target);this.sun=sun;
    const fill=new THREE.DirectionalLight(0xcbdfee,.35);fill.position.set(10,8,18);this.scene.add(fill);
    this.terrain=makeTerrain(this.scene);
    this.makeRoad();this.makeRoadside();this.makeGantry();
    this.car=createVehicle();this.scene.add(this.car.group);
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.05,6.2),new THREE.MeshBasicMaterial({map:contactTexture(),transparent:true,depthWrite:false,opacity:.62}));
    shadow.rotation.x=-Math.PI/2;shadow.position.set(0,.037,0);this.scene.add(shadow);

    const renderTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});
    this.composer=new EffectComposer(this.renderer,renderTarget);
    this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.22,.45,1.55);
    this.bloom.enabled=false;this.composer.addPass(this.bloom);
    this.finish=new ShaderPass(FinishShader);this.composer.addPass(this.finish);
    this.composer.addPass(new OutputPass());
    this.fxaa=new ShaderPass(FXAAShader);this.composer.addPass(this.fxaa);
    this.resize();
  }

  makeRoad() {
    const material=new THREE.MeshStandardMaterial({color:0x333a40,map:asphaltFallback(),roughness:.74,metalness:.045});
    const road=new THREE.Mesh(new THREE.PlaneGeometry(14.2,1400),material);road.rotation.x=-Math.PI/2;road.position.set(0,.021,-600);road.receiveShadow=true;this.scene.add(road);
    const opposite=new THREE.Mesh(new THREE.PlaneGeometry(14.2,1400),material);opposite.rotation.x=-Math.PI/2;opposite.position.set(-16,.021,-600);opposite.receiveShadow=true;this.scene.add(opposite);
    this.roadMaterial=material;this.roadTextures=[material.map];
    const markings=new THREE.MeshStandardMaterial({color:0xe9e6d5,roughness:.86,metalness:0});
    const edgePositions=[];
    for(const x of [-6.1,6.1,-22.1,-9.9]) edgePositions.push({x,y:.031,z:-600});
    instance(new THREE.BoxGeometry(.125,.006,1400),markings,edgePositions,this.scene);
    const dashPositions=[];
    for(let z=-1300;z<100;z+=12) for(const x of [-1.85,1.85,-17.85,-14.15]) dashPositions.push({x,y:.034,z});
    this.markings=instance(new THREE.BoxGeometry(.125,.007,4),markings,dashPositions,this.scene);
    const stripPositions=[];
    for(let z=-1300;z<100;z+=1) for(const x of [6.62,-6.62,-9.4,-22.6]) stripPositions.push({x,y:.026,z});
    const rumble=new THREE.MeshStandardMaterial({color:0x4d565b,roughness:.95});
    this.rumbles=instance(new THREE.BoxGeometry(.34,.016,.10),rumble,stripPositions,this.scene);
    const median=new THREE.Mesh(new THREE.BoxGeometry(1.75,.35,1400),new THREE.MeshStandardMaterial({color:0x9c9d91,roughness:.98}));median.position.set(-8,.1,-600);median.receiveShadow=true;this.scene.add(median);
    const track=new THREE.Mesh(new THREE.PlaneGeometry(2.5,1400),new THREE.MeshStandardMaterial({color:0x393e39,roughness:.96}));track.rotation.x=-Math.PI/2;track.position.set(-8,.28,-600);this.scene.add(track);
  }

  makeRoadside() {
    const steel=new THREE.MeshStandardMaterial({color:0xb8c3c5,metalness:.77,roughness:.37});
    const darkSteel=new THREE.MeshStandardMaterial({color:0x6d787b,metalness:.74,roughness:.44});
    const railX=[7.25,-7.25,-8.75,-23.25];
    for(const x of railX) for(const y of [.67,.80]) {
      const rail=new THREE.Mesh(new THREE.BoxGeometry(.10,.12,1400),steel);rail.position.set(x,y,-600);rail.receiveShadow=true;this.scene.add(rail);
    }
    const posts=[];
    for(let z=-1300;z<100;z+=4) for(const x of railX) posts.push({x,y:.43,z});
    this.posts=instance(new THREE.BoxGeometry(.10,.82,.10),darkSteel,posts,this.scene);
    const reflector=new THREE.MeshBasicMaterial({color:0xe5e9d6});
    const refPositions=[];
    for(let z=-1300;z<100;z+=16) for(const x of [7.20,-7.20]) refPositions.push({x,y:.86,z});
    this.reflectors=instance(new THREE.BoxGeometry(.11,.10,.06),reflector,refPositions,this.scene);
    const polePositions=[],armPositions=[],headPositions=[],lightPositions=[];
    for(let z=-1240;z<100;z+=42) for(const side of [-1,1]) {
      const x=side*8.9;
      polePositions.push({x,y:4.0,z});
      armPositions.push({x:x-side*1.14,y:7.95,z,rz:side*.065});
      headPositions.push({x:x-side*2.2,y:7.83,z});
      lightPositions.push({x:x-side*2.2,y:7.76,z});
    }
    this.poles=instance(new THREE.CylinderGeometry(.055,.105,8,8),darkSteel,polePositions,this.scene);
    this.arms=instance(new THREE.BoxGeometry(2.5,.09,.11),darkSteel,armPositions,this.scene);
    this.heads=instance(new THREE.BoxGeometry(.62,.11,.26),darkSteel,headPositions,this.scene);
    this.lamps=instance(new THREE.BoxGeometry(.51,.012,.19),new THREE.MeshStandardMaterial({color:0xeaf7ed,emissive:0xe4f3cf,emissiveIntensity:1.1}),lightPositions,this.scene);

    const random=seeded(481),trees=[];
    for(let i=0;i<400;i++) {
      const side=i%2?1:-1,x=side*(32+random()*115)-(side<0?25:0),z=80-random()*1170,size=3+random()*8;
      trees.push({x,y:size*.5-.1,z,sx:size*.50,sy:size,ry:random()*Math.PI});
    }
    const treesMaterial=new THREE.MeshStandardMaterial({map:treeTexture(),alphaTest:.42,side:THREE.DoubleSide,roughness:1});
    this.trees=instance(new THREE.PlaneGeometry(1,1),treesMaterial,trees,this.scene);
    const other=trees.map(p=>({...p,ry:p.ry+Math.PI/2}));
    this.treesCross=instance(new THREE.PlaneGeometry(1,1),treesMaterial,other,this.scene);
    const bollardPositions=[];
    for(let z=-1200;z<100;z+=18) for(const x of [-6.85,6.85]) bollardPositions.push({x,y:.3,z});
    this.bollards=instance(new THREE.BoxGeometry(.10,.57,.08),new THREE.MeshStandardMaterial({color:0xd7dacb,roughness:.6}),bollardPositions,this.scene);
  }

  makeGantry() {
    const group=new THREE.Group(),metal=new THREE.MeshStandardMaterial({color:0x9ea9ab,metalness:.72,roughness:.43});
    for(const x of [-7.9,7.9]) {
      const column=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,8.3,10),metal);column.position.set(x,4.15,0);group.add(column);
      const footing=new THREE.Mesh(new THREE.BoxGeometry(.7,.6,.7),new THREE.MeshStandardMaterial({color:0xa7aaa0,roughness:1}));footing.position.set(x,.3,0);group.add(footing);
    }
    for(const y of [7.5,8.1]){const beam=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,15.8,8),metal);beam.rotation.z=Math.PI/2;beam.position.y=y;group.add(beam);}
    for(let x=-7.5;x<7.7;x+=.7) {
      const joint=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.9,6),metal);joint.position.set(x,7.8,0);joint.rotation.z=x%1.4<.7?.85:-.85;group.add(joint);
    }
    const sign=new THREE.Mesh(new THREE.BoxGeometry(6.7,1.64,.11),new THREE.MeshStandardMaterial({color:0x264941,roughness:.62}));sign.position.set(0,6.9,.05);group.add(sign);
    const face=new THREE.Mesh(new THREE.PlaneGeometry(6.62,1.59),new THREE.MeshStandardMaterial({map:signTexture(),roughness:.66}));face.position.set(0,6.9,.12);group.add(face);
    group.position.z=-310;this.scene.add(group);this.gantry=group;
  }

  async loadAssets() {
    const loader=new THREE.TextureLoader(),anisotropy=Math.min(12,this.renderer.capabilities.getMaxAnisotropy());
    const loads=[
      ['asphalt-color.jpg','map',true],['asphalt-normal.jpg','normalMap',false],['asphalt-roughness.jpg','roughnessMap',false],
    ].map(async([file,key,color])=>{
      const t=await loader.loadAsync(`/assets/${file}`);
      if(color)t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;
      t.repeat.set(14.2/3,1400/3);t.anisotropy=anisotropy;
      if(key==='map'){const old=this.roadMaterial.map;old.dispose();this.roadTextures=this.roadTextures.filter(texture=>texture!==old);}
      this.roadMaterial[key]=t;this.roadTextures.push(t);
      this.roadMaterial.needsUpdate=true;
    });
    const environment=(async()=>{
      const hdr=await new HDRLoader().loadAsync('/assets/daylight.hdr');
      hdr.mapping=THREE.EquirectangularReflectionMapping;
      const pmrem=new THREE.PMREMGenerator(this.renderer);
      this.environmentTarget=pmrem.fromEquirectangular(hdr);this.scene.environment=this.environmentTarget.texture;
      this.scene.environmentIntensity=.65;this.scene.background=hdr;this.scene.backgroundIntensity=.75;
      this.scene.backgroundRotation.y=1.8;this.scene.environmentRotation.y=1.8;pmrem.dispose();
    })();
    const ground=(async()=>{
      const [color,normal]=await Promise.all([loader.loadAsync('/assets/terrain-color.jpg'),loader.loadAsync('/assets/terrain-normal.jpg')]);
      color.colorSpace=THREE.SRGBColorSpace;
      for(const t of [color,normal]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(320,280);t.anisotropy=anisotropy;}
      const m=this.terrain.material;m.map.dispose();m.map=color;m.bumpMap=null;m.normalMap=normal;m.normalScale=new THREE.Vector2(.6,.6);m.needsUpdate=true;
    })();
    const results=await Promise.allSettled([...loads,environment,ground]);
    this.roadMaterial.normalScale=new THREE.Vector2(.28,.28);
    return results.filter(r=>r.status==='rejected').map(r=>String(r.reason));
  }

  resize() {
    const w=this.canvas.clientWidth||innerWidth,h=this.canvas.clientHeight||innerHeight;
    this.portrait=w/h<.86;
    this.camera.aspect=w/h;this.camera.fov=this.portrait?57:47;this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.dpr);this.renderer.setSize(w,h,false);
    this.composer.setPixelRatio(this.dpr);this.composer.setSize(w,h);
    this.fxaa.uniforms.resolution.value.set(1/(w*this.dpr),1/(h*this.dpr));
    this.finish.uniforms.resolution.value.set(w*this.dpr,h*this.dpr);
  }

  setQuality(mode) {
    this.mode=mode;
    this.dpr=Math.min(devicePixelRatio,mode==='high'?(this.mobile?1.65:2):mode==='low'?.85:(this.mobile?1.2:1.4));
    this.bloom.enabled=mode==='high';
    this.sun.shadow.mapSize.set(mode==='high'?2048:1024,mode==='high'?2048:1024);
    this.sun.shadow.map?.dispose();this.sun.shadow.map=null;
    this.resize();this.frameSamples=[];
  }

  breakPedal(){this.breakTime=this.runtime;}

  update(state,dt,paused=false) {
    this.runtime+=dt;
    const active=(state.phase==='running'||state.phase==='countdown')&&!paused;
    const move=active?state.speed*dt:0;this.worldDistance+=move;
    for(const texture of this.roadTextures)texture.offset.y=-(this.worldDistance/3)%1;
    this.markings.position.z=this.worldDistance%12;this.rumbles.position.z=this.worldDistance%1;
    this.posts.position.z=this.worldDistance%4;this.reflectors.position.z=this.worldDistance%16;
    for(const mesh of [this.poles,this.arms,this.heads,this.lamps])mesh.position.z=this.worldDistance%42;
    this.trees.position.z=this.treesCross.position.z=this.worldDistance%320;
    this.bollards.position.z=this.worldDistance%18;
    this.gantry.position.z=-310+this.worldDistance%700;
    this.car.update(active?state.speed:0,state.braking&&!paused,this.runtime,state.phase,paused?0:dt);

    const intro=state.phase==='ready',portrait=this.portrait;
    const t=this.runtime,braking=state.braking&&!paused;
    const shake=Math.max(0,1-(t-this.breakTime)/.42)*.095;
    const speedSway=active?Math.sin(t*19)*.002*Math.min(state.speed/30,1.5):0;
    const orbit=intro&&!portrait?Math.sin(t*.18)*.25:0;
    this.positionTarget.set(portrait?2.8:4.0+orbit,portrait?3.25:3.4,portrait?12.5:10.9);
    this.positionTarget.y+=braking?.055:0;
    this.camera.position.lerp(this.positionTarget,1-Math.exp(-dt*2.5));
    this.camera.position.x+=Math.sin(t*103)*shake;this.camera.position.y+=Math.sin(t*87)*shake+speedSway;
    this.lookAt.set(portrait?-2.15:intro?-6.3:-3.8,portrait?1.2:1.35,-9);
    this.smoothedTarget.lerp(this.lookAt,1-Math.exp(-dt*2.7));
    this.camera.lookAt(this.smoothedTarget);
    const targetFov=(portrait?57:47)+(active?Math.min(state.speed/40,1)*2.4:0);
    this.camera.fov=THREE.MathUtils.damp(this.camera.fov,targetFov,3,dt);this.camera.updateProjectionMatrix();
    this.finish.uniforms.time.value=t;this.finish.uniforms.speed.value=active?state.speed:0;
    this.finish.uniforms.danger.value=state.phase==='broken'?.35:Math.max(0,(state.pressure-1250)/362)*.25;
    this.composer.render();
  }

  getStats(){return {drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,pixelRatio:this.dpr,quality:this.mode};}
}
