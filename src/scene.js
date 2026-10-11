import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createVehicle } from './vehicle.js';
import { batchMeshes } from './batching.js';
import { CrashEffects } from './crash-effects.js';
import { TrackWarp, StreamingGround, terrainHeight, roadWearTexture, trackSlope } from './track.js';
import { Atmosphere } from './atmosphere.js';

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
  const width=3200,depth=2800,nx=260,nz=200;
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
    color.setHSL(.19+c*.055,.20+Math.min(height/1100,.13),.09+height*.00017+grain);
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

export class HighwayScene {
  constructor(canvas) {
    this.canvas=canvas;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xb5c6ce);
    this.scene.fog=new THREE.FogExp2(0xb5c6ca,.00122);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.info.autoReset=false;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.93;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.camera=new THREE.PerspectiveCamera(47,1,.2,3800);
    this.camera.position.set(4.2,3.4,10.3);
    this.mobile=matchMedia('(pointer: coarse)').matches;
    this.mode='auto';this.dpr=Math.min(devicePixelRatio,1.5);
    this.frameSamples=[];this.runtime=0;this.worldDistance=0;this.breakTime=-100;this.hitTime=-100;
    this.lastDistance=0;this.lastImpact=0;this.adaptTime=0;
    this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.lookAt=new THREE.Vector3();this.smoothedTarget=new THREE.Vector3(-3.8,1.35,-9);this.positionTarget=new THREE.Vector3();this.wreckPosition=new THREE.Vector3();
    const hemi=new THREE.HemisphereLight(0xd8edf7,0x646754,.8);this.scene.add(hemi);
    const sun=new THREE.DirectionalLight(0xffeddb,2.4);
    sun.position.set(-34,54,-85);sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);
    sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;
    sun.shadow.camera.near=1;sun.shadow.camera.far=150;sun.shadow.bias=-.0004;sun.shadow.normalBias=.045;
    sun.target.position.set(0,0,0);this.scene.add(sun,sun.target);this.sun=sun;
    const fill=new THREE.DirectionalLight(0xcbdfee,.35);fill.position.set(10,8,18);this.scene.add(fill);
    this.atmosphere=new Atmosphere(this.scene,sun,hemi,fill);
    this.world=new THREE.Group();this.scene.add(this.world);this.warp=new TrackWarp();
    this.terrain={material:new THREE.MeshStandardMaterial({vertexColors:true,map:groundTexture(),roughness:.95,metalness:0})};
    this.ground=new StreamingGround(this.world,this.terrain.material);
    this.makeRoad();this.makeRoadside();this.makeGantry();
    this.car=createVehicle();this.scene.add(this.car.group);
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.05,6.2),new THREE.MeshBasicMaterial({map:contactTexture(),transparent:true,depthWrite:false,opacity:.62}));
    shadow.rotation.x=-Math.PI/2;shadow.position.set(0,.037,0);this.scene.add(shadow);this.contactShadow=shadow;
    this.effects=new CrashEffects(this.scene);
    this.makeDamagedRail();
    this.warp.apply(this.world,this.roadMaterial,roadWearTexture());
    this.resize();
  }

  makeRoad() {
    const material=new THREE.MeshStandardMaterial({color:0x333a40,map:asphaltFallback(),roughness:.74,metalness:.045});
    const road=new THREE.Mesh(new THREE.PlaneGeometry(14.2,1400,1,200),material);road.rotation.x=-Math.PI/2;road.position.set(0,.021,-600);road.receiveShadow=true;this.world.add(road);
    const opposite=new THREE.Mesh(new THREE.PlaneGeometry(14.2,1400,1,200),material);opposite.rotation.x=-Math.PI/2;opposite.position.set(-16,.021,-600);opposite.receiveShadow=true;this.world.add(opposite);
    this.roadMaterial=material;this.roadTextures=[material.map];
    const markings=new THREE.MeshStandardMaterial({color:0xe9e6d5,roughness:.86,metalness:0});
    const edgePositions=[];
    for(const x of [-6.1,6.1,-22.1,-9.9]) edgePositions.push({x,y:.031,z:-600});
    instance(new THREE.BoxGeometry(.125,.006,1400,1,1,200),markings,edgePositions,this.world);
    const dashPositions=[];
    for(let z=-1300;z<100;z+=12) for(const x of [-1.85,1.85,-17.85,-14.15]) dashPositions.push({x,y:.034,z});
    this.markings=instance(new THREE.BoxGeometry(.125,.007,4),markings,dashPositions,this.world);
    const stripPositions=[];
    for(let z=-1300;z<100;z+=1) for(const x of [6.62,-6.62,-9.4,-22.6]) stripPositions.push({x,y:.026,z});
    const rumble=new THREE.MeshStandardMaterial({color:0x4d565b,roughness:.95});
    this.rumbles=instance(new THREE.BoxGeometry(.34,.016,.10),rumble,stripPositions,this.world);
    const median=new THREE.Mesh(new THREE.BoxGeometry(1.75,.35,1400,1,1,200),new THREE.MeshStandardMaterial({color:0x9c9d91,roughness:.98}));median.position.set(-8,.1,-600);median.receiveShadow=true;this.world.add(median);
    const track=new THREE.Mesh(new THREE.PlaneGeometry(2.5,1400,1,200),new THREE.MeshStandardMaterial({color:0x393e39,roughness:.96}));track.rotation.x=-Math.PI/2;track.position.set(-8,.28,-600);this.world.add(track);
  }

  makeRoadside() {
    const steel=new THREE.MeshStandardMaterial({color:0xb8c3c5,metalness:.77,roughness:.37});
    const darkSteel=new THREE.MeshStandardMaterial({color:0x6d787b,metalness:.74,roughness:.44});
    const railX=[7.25,-7.25,-8.75,-23.25];this.rails={left:[],right:[]};this.railMaterial=steel;
    for(const x of railX) for(const y of [.67,.80]) {
      const rail=new THREE.Mesh(new THREE.BoxGeometry(.10,.12,1400,1,1,200),steel);rail.position.set(x,y,-600);rail.receiveShadow=true;this.world.add(rail);
      if(Math.abs(x)===7.25)this.rails[x>0?'right':'left'].push(rail);
    }
    const posts=[];
    for(let z=-1300;z<100;z+=4) for(const x of railX) posts.push({x,y:.43,z});
    this.posts=instance(new THREE.BoxGeometry(.10,.82,.10),darkSteel,posts,this.world);
    const reflector=new THREE.MeshBasicMaterial({color:0xe5e9d6});
    const refPositions=[];
    for(let z=-1300;z<100;z+=16) for(const x of [7.20,-7.20]) refPositions.push({x,y:.86,z});
    this.reflectors=instance(new THREE.BoxGeometry(.11,.10,.06),reflector,refPositions,this.world);
    const polePositions=[],armPositions=[],headPositions=[],lightPositions=[];
    for(let z=-1240;z<100;z+=42) for(const side of [-1,1]) {
      const x=side*8.9;
      polePositions.push({x,y:4.0,z});
      armPositions.push({x:x-side*1.14,y:7.95,z,rz:side*.065});
      headPositions.push({x:x-side*2.2,y:7.83,z});
      lightPositions.push({x:x-side*2.2,y:7.76,z});
    }
    this.poles=instance(new THREE.CylinderGeometry(.055,.105,8,8),darkSteel,polePositions,this.world);
    this.arms=instance(new THREE.BoxGeometry(2.5,.09,.11),darkSteel,armPositions,this.world);
    this.heads=instance(new THREE.BoxGeometry(.62,.11,.26),darkSteel,headPositions,this.world);
    this.lamps=instance(new THREE.BoxGeometry(.51,.012,.19),new THREE.MeshStandardMaterial({color:0xeaf7ed,emissive:0xe4f3cf,emissiveIntensity:1.1}),lightPositions,this.world);

    const random=seeded(481),trees=[];
    for(let i=0;i<400;i++) {
      const side=i%2?1:-1,x=side*(32+random()*115)-(side<0?25:0),z=80-random()*1170,size=3+random()*8;
      trees.push({x,y:size*.5+terrainHeight(x,-z),z,sx:size*.50,sy:size,ry:random()*Math.PI,s:-z});
    }
    const treesMaterial=new THREE.MeshStandardMaterial({map:treeTexture(),alphaTest:.42,side:THREE.DoubleSide,roughness:1});
    this.treeSlots=trees;this.treeDummy=new THREE.Object3D();
    this.trees=instance(new THREE.PlaneGeometry(1,1),treesMaterial,trees,this.world);
    const other=trees.map(p=>({...p,ry:p.ry+Math.PI/2}));
    this.treesCross=instance(new THREE.PlaneGeometry(1,1),treesMaterial,other,this.world);
    const bollardPositions=[];
    for(let z=-1200;z<100;z+=18) for(const x of [-6.85,6.85]) bollardPositions.push({x,y:.3,z});
    this.bollards=instance(new THREE.BoxGeometry(.10,.57,.08),new THREE.MeshStandardMaterial({color:0xd7dacb,roughness:.6}),bollardPositions,this.world);
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
    batchMeshes(group);group.position.z=-310;this.world.add(group);this.gantry=group;this.gantryDistance=310;
  }

  makeDamagedRail() {
    this.damagedRails=[];
    for(const side of [-1,1]) {
      const group=new THREE.Group(),bent=[];
      for(const y of [.67,.80]) {
        const geometry=new THREE.BoxGeometry(.1,.12,8,1,1,24);
        const p=geometry.attributes.position;
        for(let i=0;i<p.count;i++){const z=p.getZ(i),bend=Math.exp(-z*z/.9);p.setX(i,p.getX(i)+side*bend*.63);p.setY(i,p.getY(i)-bend*.14);}
        geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,this.railMaterial);mesh.position.set(side*7.25,y,0);group.add(mesh);bent.push(mesh);
        for(const end of [-1,1]) {
          const straight=new THREE.Mesh(new THREE.BoxGeometry(.1,.12,1400,1,1,200),this.railMaterial);
          straight.position.set(side*7.25,y,end*704);group.add(straight);
        }
      }
      group.visible=false;this.world.add(group);this.damagedRails.push({group,side,distance:0});
    }
  }

  async loadAssets() {
    const loader=new THREE.TextureLoader(),anisotropy=this.renderer.capabilities.getMaxAnisotropy();
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
      this.atmosphere.setDaylight(hdr,this.renderer);this.scene.background=null;
      this.scene.environmentRotation.y=1.8;
    })();
    const ground=(async()=>{
      const [color,normal]=await Promise.all([loader.loadAsync('/assets/terrain-color.jpg'),loader.loadAsync('/assets/terrain-normal.jpg')]);
      color.colorSpace=THREE.SRGBColorSpace;
      for(const t of [color,normal]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=anisotropy;}
      const m=this.terrain.material;m.map.dispose();m.map=color;m.normalMap=normal;m.normalScale=new THREE.Vector2(.5,.5);m.needsUpdate=true;
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
  }

  breakPedal(){this.breakTime=this.runtime;}

  setTime(mode){this.atmosphere.setTime(mode);}

  reset() {
    this.car.reset();this.effects.reset();this.worldDistance=0;this.lastDistance=0;this.lastImpact=0;this.breakTime=this.hitTime=-100;
    this.ground.reset();this.gantryDistance=310;
    for(const tree of this.treeSlots)tree.s=-tree.z;
    this.updateTrees(true);
    for(const rail of this.damagedRails)rail.group.visible=false;
    for(const rails of Object.values(this.rails))for(const mesh of rails)mesh.visible=true;
  }

  update(state,dt,paused=false) {
    this.runtime+=dt;
    const active=['running','countdown','broken'].includes(state.phase)&&!paused;
    const move=state.phase==='countdown'?state.speed*dt:Math.max(0,state.distance-this.lastDistance);
    this.lastDistance=state.distance;this.worldDistance+=move;
    this.warp.distance.value=this.worldDistance;
    this.ground.update(this.worldDistance);
    for(const texture of this.roadTextures)texture.offset.y=(this.worldDistance/3)%1;
    this.markings.position.z=this.worldDistance%12;this.rumbles.position.z=this.worldDistance%1;
    this.posts.position.z=this.worldDistance%4;this.reflectors.position.z=this.worldDistance%16;
    for(const mesh of [this.poles,this.arms,this.heads,this.lamps])mesh.position.z=this.worldDistance%42;
    this.updateTrees();
    this.bollards.position.z=this.worldDistance%18;
    if(this.worldDistance-this.gantryDistance>95)this.gantryDistance+=1100;
    this.gantry.position.z=this.worldDistance-this.gantryDistance;
    this.car.update(active?state.speed:0,state.braking&&!paused,this.runtime,state.phase,paused?0:dt,state);
    this.car.group.position.x=state.lateral;this.car.group.rotation.y=state.yaw;
    this.atmosphere.update(dt,this.renderer,state.lateral,Math.atan(trackSlope(this.worldDistance))-Math.atan(trackSlope(0)));
    this.scene.environmentRotation.y=1.8+Math.atan(trackSlope(this.worldDistance));
    this.contactShadow.position.x=state.lateral;this.contactShadow.rotation.z=state.yaw;
    if(state.impacts>this.lastImpact){
      this.lastImpact=state.impacts;this.hitTime=this.runtime;this.car.dent(state.impactSide,state.damage);
      this.effects.impact(state,state.impactSide*7.18,-1.2);
      const rail=this.damagedRails.find(r=>r.side===state.impactSide);rail.distance=this.worldDistance;rail.group.visible=true;
      for(const mesh of this.rails[state.impactSide>0?'right':'left'])mesh.visible=false;
    }
    for(const rail of this.damagedRails)if(rail.group.visible)rail.group.position.z=-1.2+this.worldDistance-rail.distance;

    const intro=state.phase==='ready',portrait=this.portrait;
    const t=this.runtime,braking=state.braking&&!paused;
    const shake=this.reducedMotion?0:Math.max(0,1-(t-this.breakTime)/.22)*.055+Math.max(0,1-(t-this.hitTime)/.6)*.23;
    const speedSway=active?Math.sin(t*19)*.002*Math.min(state.speed/30,1.5):0;
    const orbit=intro&&!portrait?Math.sin(t*.18)*.25:0;
    const crash=state.phase==='broken'||state.phase==='wrecked';
    const wreckView=state.phase==='wrecked'?Math.min(1,(state.crashTime-state.lastImpactAt)/1.2):0;
    this.positionTarget.set((portrait?2.8:4.0+orbit)+state.lateral*(crash?.88:1)+wreckView*3,portrait?3.25:3.4,THREE.MathUtils.lerp(portrait?12.5:10.9,7.4,wreckView));
    if(wreckView>0){
      const c=Math.cos(state.yaw),s=Math.sin(state.yaw);
      this.wreckPosition.set(state.lateral+8.2*c-4.8*s,portrait?3.7:3.3,-8.2*s-4.8*c);
      this.positionTarget.lerp(this.wreckPosition,wreckView);
    }
    this.positionTarget.y+=braking?.055:0;
    if(wreckView>0){
      // Orbit at a safe radius; a straight interpolation can pass through the wreck.
      const dx=this.camera.position.x-state.lateral,dz=this.camera.position.z;
      const angle=Math.atan2(dx,dz),goal=Math.atan2(this.positionTarget.x-state.lateral,this.positionTarget.z);
      const turn=Math.atan2(Math.sin(goal-angle),Math.cos(goal-angle));
      const next=angle+turn*(1-Math.exp(-dt*3.4));
      const radius=THREE.MathUtils.damp(Math.max(8.8,Math.hypot(dx,dz)),9.8,4,dt);
      this.camera.position.set(state.lateral+Math.sin(next)*radius,THREE.MathUtils.damp(this.camera.position.y,this.positionTarget.y,4,dt),Math.cos(next)*radius);
    }else this.camera.position.lerp(this.positionTarget,1-Math.exp(-dt*(crash?5:2.5)));
    this.camera.position.x+=Math.sin(t*103)*shake;this.camera.position.y+=Math.sin(t*87)*shake+speedSway;
    this.lookAt.set((portrait?-2.15:intro?-6.3:-3.8)+state.lateral,portrait?1.2:1.35,-9);
    if(wreckView>0)this.lookAt.lerp(this.wreckPosition.set(state.lateral,1.0,-.35),wreckView);
    this.smoothedTarget.lerp(this.lookAt,1-Math.exp(-dt*(wreckView>0?8:2.7)));
    this.camera.lookAt(this.smoothedTarget);
    const targetFov=(portrait?57:47)+(active?Math.min(state.speed/40,1)*2.4:0);
    this.camera.fov=THREE.MathUtils.damp(this.camera.fov,targetFov,3,dt);this.camera.updateProjectionMatrix();
    this.effects.update(state,dt,move,this.worldDistance,this.camera);
    this.renderer.info.reset();this.renderer.render(this.scene,this.camera);
    this.adaptTime+=dt;
    if(this.mode==='auto'&&dt<.12){
      this.frameSamples.push(dt);if(this.frameSamples.length>90)this.frameSamples.shift();
      if(this.adaptTime>3.5&&this.frameSamples.length===90){
        const average=this.frameSamples.reduce((a,b)=>a+b,0)/90,minDpr=this.mobile?.8:Math.min(.85,devicePixelRatio),maxDpr=devicePixelRatio;
        const next=average>.023?Math.max(minDpr,this.dpr-.10):average<.0175?Math.min(maxDpr,this.dpr+.05):this.dpr;
        if(Math.abs(next-this.dpr)>.02){this.dpr=next;this.resize();}
        this.adaptTime=0;this.frameSamples.length=0;
      }
    }
  }

  updateTrees(force=false) {
    let dirty=force;
    this.trees.position.z=this.treesCross.position.z=this.worldDistance;
    this.treeSlots.forEach((tree,i)=>{
      if(!force&&tree.s>=this.worldDistance-95)return;
      if(!force)tree.s+=1360;
      dirty=true;const d=this.treeDummy;
      d.position.set(tree.x,tree.sy*.5+terrainHeight(tree.x,tree.s),-tree.s);d.scale.set(tree.sx,tree.sy,1);
      d.rotation.set(0,tree.ry,0);d.updateMatrix();this.trees.setMatrixAt(i,d.matrix);
      d.rotation.y=tree.ry+Math.PI/2;d.updateMatrix();this.treesCross.setMatrixAt(i,d.matrix);
    });
    if(dirty){this.trees.instanceMatrix.needsUpdate=true;this.treesCross.instanceMatrix.needsUpdate=true;}
  }

  getStats(){return {drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,pixelRatio:this.dpr,quality:this.mode};}
}
