import * as THREE from 'three';

function cloudTexture() {
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(64,64,4,64,64,62);g.addColorStop(0,'#ffffffa0');g.addColorStop(.35,'#ffffff70');g.addColorStop(.75,'#ffffff22');g.addColorStop(1,'#ffffff00');
  ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);
}

export class CrashEffects {
  constructor(scene) {
    this.scene=scene;this.dummy=new THREE.Object3D();this.color=new THREE.Color();this.randomSeed=17;
    this.sparks=this.pool(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xffd885,toneMapped:false}),64);
    this.debris=this.pool(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x3c484b,metalness:.7,roughness:.42}),26);
    this.smoke=this.pool(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:cloudTexture(),transparent:true,depthWrite:false,opacity:.85,color:0x92998f}),28);
    this.marks=new THREE.InstancedMesh(new THREE.BoxGeometry(.18,.002,1),new THREE.MeshBasicMaterial({color:0x141919,transparent:true,opacity:.38,depthWrite:false}),180);
    this.marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.marks.frustumCulled=false;scene.add(this.marks);
    this.tracks=Array.from({length:180},()=>({x:0,z:0,yaw:0,distance:0,length:0}));this.trackIndex=0;this.trackTime=0;
    this.previousTracks=[{valid:false,x:0,z:0,distance:0},{valid:false,x:0,z:0,distance:0}];
    this.smokeTime=0;this.sparkTime=0;this.reset();
  }
  random(){this.randomSeed=(Math.imul(this.randomSeed,1664525)+1013904223)|0;return (this.randomSeed>>>0)/4294967296;}
  pool(geometry,material,count) {
    const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(mesh);
    return {mesh,slots:Array.from({length:count},()=>({life:0,total:1,x:0,y:0,z:0,vx:0,vy:0,vz:0,size:1,spin:0,angle:0})),cursor:0};
  }
  reset() {
    for(const pool of [this.sparks,this.debris,this.smoke]){pool.mesh.visible=false;for(const p of pool.slots)p.life=0;pool.cursor=0;}
    for(const p of this.tracks)p.length=0;this.marks.visible=false;this.trackIndex=0;this.trackTime=0;this.smokeTime=0;this.sparkTime=0;
    for(const p of this.previousTracks)p.valid=false;
  }
  emit(pool,x,y,z,kind,speed,side=1) {
    const p=pool.slots[pool.cursor];pool.cursor=(pool.cursor+1)%pool.slots.length;
    Object.assign(p,{x,y,z,total:kind==='smoke'?2.4:kind==='spark'?.30+this.random()*.5:2+this.random(),size:kind==='smoke'?.6+this.random()*.4:kind==='spark'?.009:.035+this.random()*.11,spin:(this.random()-.5)*15,angle:this.random()*6});
    p.life=p.total;
    if(kind==='smoke'){p.vx=(this.random()-.5)*.7;p.vy=.8+this.random()*.5;p.vz=.2;}
    else{p.vx=-side*(.5+this.random()*5);p.vy=1+this.random()*(kind==='spark'?3:4);p.vz=-speed*.15+this.random()*4;}
    pool.mesh.visible=true;
  }
  impact(state,worldX,worldZ) {
    for(let i=0;i<42;i++)this.emit(this.sparks,worldX,.7,worldZ,'spark',state.speed,state.impactSide);
    for(let i=0;i<16;i++)this.emit(this.debris,worldX,.7,worldZ,'debris',state.speed,state.impactSide);
    for(let i=0;i<8;i++)this.emit(this.smoke,worldX,.65,worldZ,'smoke',state.speed);
  }
  update(state,dt,travel,distance,camera) {
    const crashed=state.impacts>0;
    if(!crashed&&state.phase!=='broken'&&!this.marks.visible)return;
    if(crashed) {
      this.smokeTime+=dt;
      const c=Math.cos(state.yaw),s=Math.sin(state.yaw),engineX=state.lateral-s*2,engineZ=-c*2;
      while(this.smokeTime>.09){this.smokeTime-=.09;this.emit(this.smoke,engineX,.85,engineZ,'smoke',0);}
      if(state.phase==='broken'&&state.crashTime-state.lastImpactAt<.5) {
        this.sparkTime+=dt;
        while(this.sparkTime>.035){this.sparkTime-=.035;this.emit(this.sparks,state.impactSide*7.18,.55,-.8,'spark',state.speed,state.impactSide);}
      }
    }
    for(const [pool,kind] of [[this.sparks,'spark'],[this.debris,'debris'],[this.smoke,'smoke']]) {
      let alive=0;
      for(let i=0;i<pool.slots.length;i++) {
        const p=pool.slots[i];p.life=Math.max(0,p.life-dt);
        if(p.life>0) {
          alive++;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt+travel;p.angle+=p.spin*dt;
          if(kind!=='smoke'){p.vy-=9.81*dt;if(p.y<.035){p.y=.035;p.vy=Math.abs(p.vy)*.27;p.vx*=.65;p.vz*=.65;}}
          this.dummy.position.set(p.x,p.y,p.z);
          if(kind==='smoke') {
            this.dummy.quaternion.copy(camera.quaternion);const growth=p.size*(1+(p.total-p.life)*1.15);this.dummy.scale.setScalar(growth*Math.min(p.life/.7,1));
          }else{this.dummy.rotation.set(p.angle,p.angle*.45,p.angle*.7);this.dummy.scale.set(p.size,kind==='spark'?.006:p.size*.4,kind==='spark'?.10+p.life*.18:p.size*1.4);}
        }else this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();pool.mesh.setMatrixAt(i,this.dummy.matrix);
      }
      pool.mesh.visible=alive>0;pool.mesh.instanceMatrix.needsUpdate=true;
    }
    if(state.phase==='broken') {
      this.trackTime+=dt;
      if(this.trackTime>.055){
        this.trackTime=0;
        for(let i=0;i<2;i++){
          const side=i===0?-1:1,previous=this.previousTracks[i];
          const x=state.lateral+side*.91*Math.cos(state.yaw)+1.65*Math.sin(state.yaw);
          const z=1.65*Math.cos(state.yaw)-side*.91*Math.sin(state.yaw);
          if(previous.valid){
            const previousZ=previous.z+distance-previous.distance,dx=x-previous.x,dz=z-previousZ;
            const mark=this.tracks[this.trackIndex];this.trackIndex=(this.trackIndex+1)%this.tracks.length;
            mark.x=(x+previous.x)*.5;mark.z=(z+previousZ)*.5;mark.yaw=Math.atan2(dx,dz);mark.distance=distance;mark.length=Math.hypot(dx,dz)+.035;
          }
          previous.x=x;previous.z=z;previous.distance=distance;previous.valid=true;
        }
      }
    }
    let visible=false;
    for(let i=0;i<this.tracks.length;i++){
      const p=this.tracks[i];this.dummy.position.set(p.x,.032,p.z+distance-p.distance);this.dummy.rotation.set(0,p.yaw,0);this.dummy.scale.set(1,1,p.length);this.dummy.updateMatrix();this.marks.setMatrixAt(i,this.dummy.matrix);visible ||=p.length>0;
    }
    this.marks.visible=visible;this.marks.instanceMatrix.needsUpdate=true;
  }
}
