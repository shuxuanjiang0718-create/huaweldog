import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { batchMeshes } from './batching.js';

function box(parent,material,size,position,radius=.025,shadow=false) {
  const mesh=new THREE.Mesh(radius?new RoundedBoxGeometry(...size,1,radius):new THREE.BoxGeometry(...size),material);
  mesh.position.set(...position);mesh.castShadow=shadow;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function cylinder(parent,material,radius,height,position,shadow=false) {
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,16),material);mesh.position.set(...position);mesh.castShadow=shadow;parent.add(mesh);return mesh;
}
function labelTexture(text,subtitle='') {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#292722';ctx.fillRect(0,0,1024,256);ctx.strokeStyle='#bca373';ctx.lineWidth=6;ctx.strokeRect(11,11,1002,234);
  ctx.fillStyle='#ede3c8';ctx.textAlign='center';ctx.font='500 83px "Microsoft YaHei",sans-serif';ctx.fillText(text,512,subtitle?121:157);
  if(subtitle){ctx.fillStyle='#afaa9c';ctx.font='29px Arial';ctx.fillText(subtitle,512,188);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function plaque(parent,text,position,width,subtitle='') {
  box(parent,new THREE.MeshStandardMaterial({color:0x554630,metalness:.75,roughness:.3}),[width+.07,.39,.065],position,.02);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,.32),new THREE.MeshStandardMaterial({map:labelTexture(text,subtitle),roughness:.5}));
  mesh.position.set(position[0],position[1],position[2]+.037);parent.add(mesh);return mesh;
}
function paperTexture() {
  const c=document.createElement('canvas');c.width=256;c.height=384;const ctx=c.getContext('2d');ctx.fillStyle='#e9e5d8';ctx.fillRect(0,0,256,384);
  ctx.fillStyle='#737874';ctx.fillRect(35,38,160,6);ctx.fillRect(75,68,110,4);
  for(let i=0;i<16;i++)ctx.fillRect(30,100+i*13,190-(i%4)*17,2);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function faceTexture() {
  const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#c29b82';ctx.fillRect(0,0,512,256);
  const g=ctx.createRadialGradient(256,135,20,256,135,120);g.addColorStop(0,'#d6b099');g.addColorStop(1,'#c19b83');ctx.fillStyle=g;ctx.fillRect(0,0,512,256);
  for(const x of [220,292]){ctx.strokeStyle='#685446';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-11,105);ctx.lineTo(x+10,103);ctx.stroke();ctx.fillStyle='#eee5d8';ctx.beginPath();ctx.ellipse(x,117,9,3.5,0,0,6.28);ctx.fill();ctx.fillStyle='#36322d';ctx.beginPath();ctx.arc(x,117,3,0,6.28);ctx.fill();}
  ctx.strokeStyle='#9a715e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(254,120);ctx.lineTo(250,141);ctx.lineTo(259,143);ctx.stroke();
  ctx.strokeStyle='#865951';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(243,161);ctx.quadraticCurveTo(256,165,269,161);ctx.stroke();
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function person(parent,position,{judge=false,rotation=0,gray=false}={}) {
  const group=new THREE.Group();group.position.set(...position);group.rotation.y=rotation;parent.add(group);
  const skin=new THREE.MeshStandardMaterial({color:0xcaa48b,roughness:.7});
  const cloth=new THREE.MeshStandardMaterial({color:judge?0x17151a:0x303c48,roughness:.92});
  const shirt=new THREE.MeshStandardMaterial({color:0xe4e3d9,roughness:1});
  const hair=new THREE.MeshStandardMaterial({color:gray?0x73716b:0x25231f,roughness:1});
  const shoes=new THREE.MeshStandardMaterial({color:0x171c1e,roughness:.47});
  box(group,cloth,[.51,.58,.29],[0,1.02,0],.095,true);
  box(group,shirt,[.17,.33,.014],[0,1.13,.156],.02);
  const tie=box(group,new THREE.MeshStandardMaterial({color:judge?0x895c53:0x744038,roughness:.8}),[.039,.23,.023],[0,1.06,.167],.012);tie.rotation.z=.03;
  for(const side of [-1,1]) {
    const lapel=box(group,cloth,[.1,.35,.035],[side*.12,1.12,.16],.012);lapel.rotation.z=side*.20;
    const leg=box(group,cloth,[.18,.37,.20],[side*.135,.40,.19],.05,true);
    box(group,cloth,[.18,.21,.43],[side*.135,.65,.10],.05,true);
    box(group,shoes,[.18,.13,.32],[side*.135,.155,.24],.035,true);
    const arm=new THREE.Group();arm.position.set(side*.31,1.14,.015);group.add(arm);
    const sleeve=box(arm,cloth,[.17,.36,.19],[0,-.17,.04],.055,true);sleeve.rotation.x=-.35;
    box(arm,cloth,[.15,.16,.36],[0,-.29,.23],.045,true);
    const hand=box(arm,skin,[.13,.07,.17],[0,-.23,.41],.028);
    for(let i=0;i<4;i++)box(arm,skin,[.023,.047,.068],[side*.034+(i-1.5)*.028,-.225,.49],.011);
    if(side>0)group.userData.arm=arm;
  }
  cylinder(group,skin,.085,.17,[0,1.37,0],true);
  const head=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),new THREE.MeshStandardMaterial({map:faceTexture(),roughness:.74}));
  // Spherical UV puts the authored facial features on the +Z-facing half.
  head.scale.set(.16,.216,.17);head.position.set(0,1.59,0);head.rotation.y=-Math.PI/2;head.castShadow=true;group.add(head);
  const hairGeometry=new THREE.SphereGeometry(1,24,16,0,Math.PI*2,0,Math.PI*.58);
  const hairVertices=hairGeometry.attributes.position;
  for(let i=0;i<hairVertices.count;i++){
    const front=THREE.MathUtils.smoothstep(hairVertices.getZ(i),-.15,.75);
    hairVertices.setY(i,Math.max(hairVertices.getY(i),-.25+front*.66));
  }
  hairGeometry.computeVertexNormals();
  const hairMesh=new THREE.Mesh(hairGeometry,hair);hairMesh.scale.set(.166,.22,.178);hairMesh.position.set(0,1.625,-.016);group.add(hairMesh);
  const eyeWhite=new THREE.MeshStandardMaterial({color:0xddd4c7,roughness:.44});
  const iris=new THREE.MeshStandardMaterial({color:0x37312a,roughness:.35});
  for(const side of [-1,1]){
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.023,12,8),eyeWhite);eye.scale.set(1,.39,.35);eye.position.set(side*.057,1.621,.151);group.add(eye);
    const pupil=new THREE.Mesh(new THREE.SphereGeometry(.0085,12,8),iris);pupil.scale.z=.35;pupil.position.set(side*.057,1.621,.159);group.add(pupil);
    const brow=box(group,hair,[.050,.009,.011],[side*.057,1.653,.148],.004);brow.rotation.z=side*.08;
  }
  for(const side of [-1,1]){const ear=new THREE.Mesh(new THREE.SphereGeometry(.033,12,8),skin);ear.scale.set(.55,1.3,.7);ear.position.set(side*.158,1.565,0);group.add(ear);}
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.031,12,10),skin);nose.scale.set(.6,1.1,1.4);nose.position.set(0,1.565,.151);group.add(nose);
  if(judge){for(const side of [-1,1]){const trim=box(group,new THREE.MeshStandardMaterial({color:0x8b4140,roughness:.75}),[.018,.39,.017],[side*.2,1.06,.167],.004);trim.rotation.z=side*.08;}}
  const arm=group.userData.arm;batchMeshes(group,new Set([arm,head]));batchMeshes(arm);
  return {group,arm,head};
}

export class CourtroomScene {
  constructor(renderer) {
    this.renderer=renderer;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x282727);this.scene.fog=new THREE.Fog(0x4d514b,22,50);
    this.camera=new THREE.PerspectiveCamera(48,1,.1,70);this.camera.position.set(5.8,3.2,10.3);
    this.target=new THREE.Vector3(0,1.9,-6.8);this.camera.lookAt(this.target);this.elapsed=0;this.time=0;
    this.room=new THREE.Group();this.scene.add(this.room);
    const wood=new THREE.MeshStandardMaterial({color:0xd3bca4,roughness:.38,metalness:.025});
    const paleWood=new THREE.MeshStandardMaterial({color:0xa08460,roughness:.47});
    const darkWood=new THREE.MeshStandardMaterial({color:0x28251f,roughness:.42});
    const plaster=new THREE.MeshStandardMaterial({color:0xcec8ba,roughness:.98});
    const marble=new THREE.MeshStandardMaterial({color:0xaaa89c,roughness:.42,metalness:.015});
    const brass=new THREE.MeshStandardMaterial({color:0xb49b66,metalness:.84,roughness:.28});
    const black=new THREE.MeshStandardMaterial({color:0x242626,roughness:.56});
    this.wood=wood;this.paleWood=paleWood;
    box(this.room,marble,[20,.12,24],[0,-.06,0],0);
    // Floor joints and subtle scuffs are geometry/texture details in the live scene.
    for(let x=-9;x<=9;x+=1.5)box(this.room,darkWood,[.009,.002,24],[x,.002,0],0);
    for(let z=-12;z<=12;z+=1.5)box(this.room,darkWood,[20,.002,.009],[0,.002,z],0);
    box(this.room,plaster,[20,6,.25],[0,3,-11.9],0,true);
    box(this.room,plaster,[20,6,.25],[0,3,11.9],0,true);
    box(this.room,plaster,[.25,6,24],[9.9,3,0],0,true);
    box(this.room,plaster,[20,.18,24],[0,6.05,0],0);
    box(this.room,wood,[20,2.25,.10],[0,1.12,-11.70],.02);
    box(this.room,wood,[20,2.25,.10],[0,1.12,11.70],.02);
    box(this.room,darkWood,[2.65,3.05,.08],[0,1.525,11.58],.02);
    for(const x of [-1.4,1.4])box(this.room,paleWood,[.13,3.18,.12],[x,1.59,11.49],.02);
    box(this.room,paleWood,[2.93,.13,.12],[0,3.18,11.49],.02);
    box(this.room,brass,[.03,.17,.035],[.13,1.36,11.52],.01);
    box(this.room,wood,[.10,2.25,24],[9.73,1.12,0],.02);
    box(this.room,wood,[.25,1.7,24],[-9.9,.85,0],.02);
    box(this.room,plaster,[.25,4.3,2.2],[-9.9,3.85,-10.85],0,true);
    box(this.room,plaster,[.25,4.3,2.5],[-9.9,3.85,10.75],0,true);
    for(const z of [-9.1,-4.3,.5,5.3]) {
      box(this.room,plaster,[.24,4.3,1.2],[-9.9,3.85,z],0,true);
      for(const y of [1.86,5.31])box(this.room,paleWood,[.28,.14,3.64],[-9.83,y,z+2.15],.025);
      for(const zz of [z+.41,z+3.88])box(this.room,paleWood,[.28,3.40,.12],[-9.83,3.57,zz],.02);
      const glass=new THREE.MeshStandardMaterial({color:0xdde3cf,emissive:0xc3c8b2,emissiveIntensity:.43,roughness:.14,transparent:true,opacity:.58});
      box(this.room,glass,[.025,3.25,3.37],[-9.96,3.57,z+2.15],0);
      box(this.room,paleWood,[.28,3.27,.052],[-9.75,3.57,z+2.15],.006);
      box(this.room,paleWood,[.28,.065,3.44],[-9.75,3.62,z+2.15],.006);
    }
    box(this.room,plaster,[.25,.75,24],[-9.9,5.66,0],0,true);
    // Recessed wall panels, skirting, columns and coffered ceiling.
    for(let x=-8.6;x<=8.7;x+=1.9) {
      box(this.room,darkWood,[1.65,1.65,.055],[x,1.1,-11.63],.02);
      box(this.room,wood,[1.51,1.50,.05],[x,1.1,-11.58],.012);
      for(const y of [.32,1.88])box(this.room,paleWood,[1.65,.031,.022],[x,y,-11.52],.008);
    }
    for(const x of [-7.1,7.1]) {
      cylinder(this.room,marble,.34,5.32,[x,2.85,-10.95],true);
      box(this.room,marble,[.93,.24,.92],[x,.12,-10.95],.035,true);
      box(this.room,marble,[.96,.26,.90],[x,5.61,-10.95],.035,true);
    }
    for(const z of [-8,-2,4,10])box(this.room,paleWood,[19.5,.18,.14],[0,5.84,z],.025);
    for(const x of [-6.4,0,6.4])box(this.room,paleWood,[.14,.18,23.8],[x,5.84,0],.02);
    for(const z of [-6,2,8]) {
      box(this.room,brass,[2.30,.06,.5],[0,5.59,z],.015);
      box(this.room,new THREE.MeshStandardMaterial({color:0xf0e7c5,emissive:0xffe1ac,emissiveIntensity:.85}),[2.16,.023,.39],[0,5.55,z],.008);
    }
    box(this.room,darkWood,[9.2,.88,4.4],[0,.44,-9],.045,true);
    box(this.room,wood,[9.4,.12,.70],[0,.10,-6.53],.03);
    box(this.room,wood,[8.45,1.46,.66],[0,1.12,-7.02],.055,true);
    box(this.room,wood,[8.8,.13,.98],[0,1.88,-7.03],.05,true);
    box(this.room,brass,[8.72,.023,.94],[0,1.925,-7.03],.008);
    for(let x=-3.5;x<=3.51;x+=1.4) {
      box(this.room,darkWood,[1.24,1.06,.025],[x,1.09,-6.68],.01);
      box(this.room,wood,[1.09,.91,.025],[x,1.09,-6.65],.012);
    }
    plaque(this.room,'法官 · 土不为',[0,1.65,-6.59],1.47);
    const seal=new THREE.Group();seal.position.set(0,3.63,-11.43);this.room.add(seal);
    cylinder(seal,brass,.48,.045,[0,0,0]).rotation.x=Math.PI/2;
    box(seal,darkWood,[.81,.044,.026],[0,.11,.04],.01);
    box(seal,darkWood,[.036,.53,.026],[0,0,.045],.01);
    for(const side of [-1,1]) {
      box(seal,darkWood,[.011,.18,.022],[side*.25,0,.05],.004);
      const bowl=new THREE.Mesh(new THREE.TorusGeometry(.13,.012,8,24,Math.PI),darkWood);bowl.rotation.z=Math.PI;bowl.position.set(side*.25,-.115,.05);seal.add(bowl);
    }
    const title=new THREE.Mesh(new THREE.PlaneGeometry(3.0,.70),new THREE.MeshStandardMaterial({map:labelTexture('法庭','COURTROOM  /  1612'),roughness:.6}));title.position.set(0,2.77,-11.45);this.room.add(title);
    const leather=new THREE.MeshStandardMaterial({color:0x282627,roughness:.71});
    const chair=(x,y,z,width=.68,rotation=0)=>{
      const frame=new THREE.Group();frame.position.set(x,y,z);frame.rotation.y=rotation;this.room.add(frame);
      box(frame,wood,[width+.12,.9,.09],[0,1.1,-.12],.05,true);box(frame,leather,[width,.74,.06],[0,1.13,-.05],.055);
      box(frame,leather,[width,.12,.54],[0,.63,.05],.05);
      for(const dx of [-width*.42,width*.42])for(const dz of [-.13,.25])box(frame,darkWood,[.053,.58,.053],[dx,.29,dz],.008);
    };
    chair(0,.96,-8.24,.9);
    const actors=new THREE.Group();this.scene.add(actors);this.judge=person(actors,[0,1.02,-8.1],{judge:true,gray:true});
    const paper=new THREE.MeshStandardMaterial({map:paperTexture(),roughness:.95});
    for(const side of [-1,1]) {
      const x=side*3.45;
      box(this.room,wood,[3.55,.79,1.28],[x,.40,-2.4],.03,true);
      box(this.room,paleWood,[3.69,.12,1.43],[x,.85,-2.4],.035,true);
      for(let offset=-1.15;offset<=1.16;offset+=1.15){box(this.room,darkWood,[1.03,.58,.017],[x+offset,.41,-1.75],.01);box(this.room,wood,[.96,.50,.02],[x+offset,.41,-1.72],.01);}
      plaque(this.room,side>0?'起诉方 · 卑界':'被告 · 懂车皇',[x,.66,-1.65],1.60);
      const sheet=box(this.room,paper,[.30,.004,.42],[x-.55,.92,-2.27],.001);sheet.rotation.y=.17;
      box(this.room,leather,[.40,.025,.30],[x+.48,.92,-2.25],.006);
      cylinder(this.room,black,.044,.23,[x+.48,1.04,-2.26]);
      const mic=cylinder(this.room,black,.008,.38,[x+.12,1.12,-2.23]);mic.rotation.z=-.25;
      cylinder(this.room,black,.024,.045,[x+.165,1.30,-2.23]).rotation.x=Math.PI/2;
      chair(x,0,-1.25,.68,Math.PI);
    }
    this.plaintiff=person(actors,[3.45,0,-1.4],{rotation:Math.PI});
    this.defendant=person(actors,[-3.45,0,-1.4],{rotation:Math.PI,gray:false});
    // The public gallery is farther away; its people use the same bounded geometry budget.
    for(const z of [4.6,7.0,9.4])for(const x of [-4.8,4.8]) {
      box(this.room,wood,[5.2,.15,.60],[x,.53,z],.035,true);box(this.room,wood,[5.2,.76,.11],[x,.98,z+.26],.035,true);
      for(const dx of [-2.25,2.25])box(this.room,wood,[.12,.55,.50],[x+dx,.28,z],.015);
    }
    for(let i=0;i<4;i++)person(actors,[i%2?5.0:-5.0,0,4.6+Math.floor(i/2)*2.4],{rotation:Math.PI,gray:i===2});
    // Gavel, strike block and case papers remain real geometry during the camera sequence.
    cylinder(this.room,wood,.17,.036,[.83,1.98,-6.93]);
    this.gavel=new THREE.Group();this.gavel.position.set(.83,2.22,-6.94);this.scene.add(this.gavel);
    const handle=cylinder(this.gavel,darkWood,.018,.29,[0,0,0]);handle.rotation.z=.72;
    const head=cylinder(this.gavel,wood,.056,.17,[.10,-.12,0]);head.rotation.z=Math.PI/2;
    for(const x of [.032,.164]){const ring=cylinder(this.gavel,brass,.057,.015,[x,-.12,0]);ring.rotation.z=Math.PI/2;}
    const file=box(this.room,paper,[.33,.006,.42],[-.50,1.971,-6.93],.001);file.rotation.y=.07;
    batchMeshes(this.room);batchMeshes(this.gavel);
    const hemi=new THREE.HemisphereLight(0xe9e3d8,0x62635c,1.6);this.scene.add(hemi);
    this.sun=new THREE.DirectionalLight(0xffe0b3,3.05);this.sun.position.set(-11,8,3);this.sun.target.position.set(1,0,-7);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:.1,far:45});this.sun.shadow.normalBias=.018;this.sun.shadow.bias=-.0003;this.scene.add(this.sun,this.sun.target);
    const fill=new THREE.PointLight(0xe0e9ee,38,24,2);fill.position.set(4,5,-3);this.scene.add(fill);
    const benchLight=new THREE.PointLight(0xffdbaa,14,12,2);benchLight.position.set(0,5,-8);this.scene.add(benchLight);
    this.goalPosition=new THREE.Vector3();this.goalLook=new THREE.Vector3();this.resize();
  }
  async loadAssets() {
    const loader=new THREE.TextureLoader();
    const assets=await Promise.allSettled([['color','map'],['normal','normalMap'],['roughness','roughnessMap']].map(async([file,key])=>{
      const texture=await loader.loadAsync(`/assets/court-wood-${file}.jpg`);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1.8,1.8);texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
      if(key==='map')texture.colorSpace=THREE.SRGBColorSpace;this.wood[key]=texture;this.wood.normalScale=new THREE.Vector2(.19,.19);this.wood.needsUpdate=true;
    }));return assets.filter(a=>a.status==='rejected').map(a=>String(a.reason));
  }
  prepare(environment) {
    this.scene.environment=environment;this.scene.environmentIntensity=.28;
    const generator=new THREE.PMREMGenerator(this.renderer);
    this.environmentTarget=generator.fromScene(this.scene,.025,.1,60,{size:128,position:new THREE.Vector3(0,2,-4)});
    this.scene.environment=this.environmentTarget.texture;this.scene.environmentIntensity=.62;generator.dispose();
  }
  resize() {const canvas=this.renderer.domElement;this.camera.aspect=canvas.clientWidth/canvas.clientHeight;this.portrait=this.camera.aspect<.86;this.camera.fov=this.portrait?62:48;this.camera.updateProjectionMatrix();}
  reset() {this.elapsed=0;this.camera.position.set(this.portrait?3.1:5.8,this.portrait?3.1:3.2,this.portrait?13:10.3);this.target.set(0,1.9,-6.8);this.camera.lookAt(this.target);}
  update(dt) {
    this.elapsed+=dt;const t=this.elapsed;
    const closeup=t>2.55&&t<7.2;
    this.goalPosition.set(closeup?2.0:this.portrait?3.0:5.1,closeup?1.86:this.portrait?3.1:2.85,closeup?-4.55:this.portrait?12.6:8.4);
    this.goalLook.set(closeup?3.45:0,closeup?1.48:1.73,closeup?-1.4:-6.65);
    const ease=1-Math.exp(-dt*(closeup?3.0:1.4));this.camera.position.lerp(this.goalPosition,ease);this.target.lerp(this.goalLook,ease);this.camera.lookAt(this.target);
    const strike=Math.max(0,1-Math.abs(t-2.05)/.29);
    this.gavel.position.y=2.26-strike*.16;this.gavel.rotation.z=-.2+strike*.54;
    this.judge.arm.rotation.x=-.12+strike*.20;
    this.plaintiff.head.rotation.x=Math.sin(t*4)*.018;this.plaintiff.arm.rotation.x=closeup?-.24-Math.sin(t*3.7)*.07:0;
    this.renderer.toneMappingExposure=.94;this.renderer.info.reset();this.renderer.render(this.scene,this.camera);
    return {stage:t<2.15?'opening':t<3.3?'judge':'charge',gavel:t>2.04&&t-dt<=2.04};
  }
}
