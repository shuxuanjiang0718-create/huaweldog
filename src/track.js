import * as THREE from 'three';

// One continuous centreline shared by the roadway, scenery and surface shaders.
// A camera-relative frame keeps the car near the origin without resetting the world.
export function trackCenter(s) { return 48 * Math.sin(s / 230 + .35) + 22 * Math.sin(s / 510 - .7); }
export function trackSlope(s) { return 48 / 230 * Math.cos(s / 230 + .35) + 22 / 510 * Math.cos(s / 510 - .7); }
export function trackPoint(s, lateral, reference) {
  const h = Math.atan(trackSlope(s)), r = Math.atan(trackSlope(reference));
  const x = trackCenter(s) - trackCenter(reference) + lateral * Math.cos(h);
  const z = reference - s + lateral * Math.sin(h);
  return { x: Math.cos(r) * x + Math.sin(r) * z, z: -Math.sin(r) * x + Math.cos(r) * z };
}

function terrainHash(a,b) { const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n); }
function terrainNoise(a,b) {
  const ix=Math.floor(a),iz=Math.floor(b),fx=a-ix,fz=b-iz;
  const sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(terrainHash(ix,iz),terrainHash(ix+1,iz),sx),THREE.MathUtils.lerp(terrainHash(ix,iz+1),terrainHash(ix+1,iz+1),sx),sz);
}
export function terrainHeight(x, s) {
  const valley=THREE.MathUtils.smoothstep(Math.min(Math.abs(x),Math.abs(x+16)),22,165);
  const height=Math.pow(terrainNoise(x*.004+20,s*.004+30)*.66+terrainNoise(x*.011+90,s*.011+20)*.27+terrainNoise(x*.035+15,s*.035+27)*.07,1.8);
  return height * (105+THREE.MathUtils.smoothstep(Math.abs(x),180,900)*460) * valley - .13;
}

const warpGLSL = `
uniform float uTrackDistance;
varying float vTrackS;
varying float vTrackX;
float roadCentre(float s){return 48.0*sin(s/230.0+0.35)+22.0*sin(s/510.0-0.7);}
float roadSlope(float s){return (48.0/230.0)*cos(s/230.0+0.35)+(22.0/510.0)*cos(s/510.0-0.7);}
vec3 roadWarp(vec3 p){
  float s=uTrackDistance-p.z, a=atan(roadSlope(s)), r=atan(roadSlope(uTrackDistance));
  float x=roadCentre(s)-roadCentre(uTrackDistance)+p.x*cos(a),z=p.z+p.x*sin(a);
  return vec3(cos(r)*x+sin(r)*z,p.y,-sin(r)*x+cos(r)*z);
}
`;

export class TrackWarp {
  constructor() { this.distance={value:0};this.materials=new Set(); }
  apply(root, asphaltMaterial = null, wear = null) {
    root.traverse(object => {
      if(!object.isMesh)return;
      // Shader displacement invalidates the original straight-road bounding box.
      // Streaming keeps the total world budget bounded instead.
      object.frustumCulled=false;
      const materials=Array.isArray(object.material)?object.material:[object.material];
      for(const material of materials) {
        if(this.materials.has(material))continue;
        this.materials.add(material);
        material.onBeforeCompile = shader => {
          shader.uniforms.uTrackDistance=this.distance;
          shader.vertexShader=warpGLSL+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',THREE.ShaderChunk.project_vertex
            .replace('mvPosition = modelViewMatrix * mvPosition;',`mvPosition = modelMatrix * mvPosition;
              vTrackS=uTrackDistance-mvPosition.z;vTrackX=mvPosition.x;
              mvPosition.xyz=roadWarp(mvPosition.xyz);mvPosition=viewMatrix*mvPosition;`));
          shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',THREE.ShaderChunk.worldpos_vertex
            .replace('worldPosition = modelMatrix * worldPosition;','worldPosition = modelMatrix * worldPosition;worldPosition.xyz=roadWarp(worldPosition.xyz);'));
          if(shader.vertexShader.includes('#include <defaultnormal_vertex>')) {
            shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
              vec4 roadNormalPosition=vec4(position,1.0);
              #ifdef USE_INSTANCING
                roadNormalPosition=instanceMatrix*roadNormalPosition;
              #endif
              roadNormalPosition=modelMatrix*roadNormalPosition;
              float turn=atan(roadSlope(uTrackDistance))-atan(roadSlope(uTrackDistance-roadNormalPosition.z));
              vec3 roadNormal=inverseTransformDirection(transformedNormal,viewMatrix);
              roadNormal=vec3(cos(turn)*roadNormal.x+sin(turn)*roadNormal.z,roadNormal.y,-sin(turn)*roadNormal.x+cos(turn)*roadNormal.z);
              transformedNormal=mat3(viewMatrix)*roadNormal;`);
          }
          if(material===asphaltMaterial&&wear) {
            shader.uniforms.uRoadWear={value:wear};
            shader.fragmentShader='uniform sampler2D uRoadWear;varying float vTrackS;varying float vTrackX;\n'+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
              float wearShade=texture2D(uRoadWear,vec2((vTrackX+7.1)/14.2,vTrackS/96.0)).r;
              diffuseColor.rgb*=mix(0.61,1.08,wearShade);`);
          }
        };
        material.customProgramCacheKey=()=>`track-warp-2-${material===asphaltMaterial?'road':'world'}`;
        material.needsUpdate=true;
      }
    });
  }
}

export function roadWearTexture() {
  const c=document.createElement('canvas');c.width=512;c.height=2048;
  const ctx=c.getContext('2d');ctx.fillStyle='#d8d8d8';ctx.fillRect(0,0,512,2048);
  let seed=39;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
  // Sparse joints and repaired cracks give motion a readable metre-scale reference.
  for(let i=0;i<19;i++) {
    const y=80+random()*1870,x=random()*500;
    ctx.strokeStyle=`rgba(38,41,40,${.11+random()*.21})`;ctx.lineWidth=1.2+random()*2;
    ctx.beginPath();ctx.moveTo(x,y);
    for(let k=1;k<8;k++)ctx.lineTo(x+(random()-.5)*100+k*15,y+k*8+random()*20);
    ctx.stroke();
  }
  for(let i=0;i<6;i++) {
    const x=80+random()*350,y=100+random()*1600;
    ctx.fillStyle='#bbbbbb';ctx.fillRect(x,y,23+random()*30,80+random()*90);
    ctx.strokeStyle='#929292';ctx.lineWidth=1;ctx.strokeRect(x,y,24,90);
  }
  for(const x of [177,202,310,337]) {
    const g=ctx.createLinearGradient(x-5,0,x+5,0);g.addColorStop(0,'#ffffff00');g.addColorStop(.5,'#33333320');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(x-5,0,10,2048);
  }
  const texture=new THREE.CanvasTexture(c);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
}

export class StreamingGround {
  constructor(group, material) {
    this.material=material;this.tiles=[];this.tileLength=320;
    for(let start=-320;start<1280;start+=320) {
      const geometry=new THREE.PlaneGeometry(2300,this.tileLength,128,24);geometry.rotateX(-Math.PI/2);geometry.translate(0,0,-this.tileLength/2);
      const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;mesh.frustumCulled=false;group.add(mesh);
      const tile={mesh,start};this.tiles.push(tile);this.fill(tile);
    }
  }
  fill(tile) {
    const p=tile.mesh.geometry.attributes.position,uv=tile.mesh.geometry.attributes.uv;
    const colors=tile.mesh.geometry.attributes.color??new THREE.BufferAttribute(new Float32Array(p.count*3),3),color=new THREE.Color();
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i),s=tile.start-p.getZ(i),h=terrainHeight(x,s);
      p.setY(i,h);uv.setXY(i,x/7,s/7);
      color.setHSL(.18+Math.sin(s*.008+x*.01)*.016,.16,.22+Math.min(h/1600,.10));colors.setXYZ(i,color.r,color.g,color.b);
    }
    tile.mesh.geometry.setAttribute('color',colors);p.needsUpdate=true;colors.needsUpdate=true;uv.needsUpdate=true;tile.mesh.geometry.computeVertexNormals();
  }
  update(distance) {
    for(const tile of this.tiles) {
      if(tile.start+this.tileLength<distance-95){tile.start+=this.tileLength*this.tiles.length;this.fill(tile);}
      tile.mesh.position.z=distance-tile.start;
    }
  }
  reset() {this.tiles.forEach((tile,i)=>{tile.start=(i-1)*this.tileLength;this.fill(tile);tile.mesh.position.z=-tile.start;});}
}
