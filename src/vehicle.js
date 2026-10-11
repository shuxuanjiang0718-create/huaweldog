import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { batchMeshes } from './batching.js';

function rounded(parent, material, size, position, radius = 0.05) {
  const segments = Math.max(...size) > .7 ? 2 : 1;
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, segments, radius), material);
  mesh.position.set(...position);
  mesh.castShadow = size[0] > .4 && (size[1] > .3 || size[2] > 2);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function skin(sections, material, parent, count = 40) {
  const vertices = [], indices = [], uv = [];
  sections.forEach(([z, width, base, top], j) => {
    for (let i = 0; i <= count; i++) {
      const a = i / count * Math.PI * 2;
      const sx = Math.sin(a), sy = Math.cos(a);
      const x = Math.sign(sx) * Math.pow(Math.abs(sx), 0.34) * width;
      const y = (base + top) / 2 + Math.sign(sy) * Math.pow(Math.abs(sy), 0.34) * (top - base) / 2;
      vertices.push(x, y, z); uv.push(i / count, j / (sections.length - 1));
      if (j > 0 && i < count) {
        const n = j * (count + 1) + i;
        indices.push(n, n + 1, n - count - 1, n + 1, n - count, n - count - 1);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}

function sidePanel(parent, x, points, material) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], i) => i ? shape.lineTo(z, y) : shape.moveTo(z, y));
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 10);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const z = positions.getX(i), y = positions.getY(i);
    positions.setXYZ(i, x, y, z);
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material); parent.add(mesh);
  return mesh;
}

function line(parent, points, material, radius = 0.01) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, radius, 6, false), material);
  parent.add(mesh); return mesh;
}

function plateTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 140;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#283c3b'; ctx.fillRect(0, 0, 512, 140);
  ctx.strokeStyle = '#82958d'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, 496, 124);
  ctx.font = '600 57px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#dce5cd';
  ctx.fillText('TEST · 01', 256, 93);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createVehicle() {
  const group = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x758583, metalness: 0.83, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.4 });
  const graphite = new THREE.MeshPhysicalMaterial({ color: 0x151b1d, metalness: 0.72, roughness: 0.24, clearcoat: 0.85, clearcoatRoughness: 0.16 });
  const black = new THREE.MeshStandardMaterial({ color: 0x080d10, roughness: 0.64, metalness: 0.2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x091820, metalness: 0.15, roughness: 0.045, clearcoat: 1, envMapIntensity: 1.65, side: THREE.DoubleSide });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb1babe, metalness: 1, roughness: 0.21 });
  const light = new THREE.MeshStandardMaterial({ color: 0xfc251a, emissive: 0xff160b, emissiveIntensity: 1.3, roughness: 0.2, metalness: 0.1 });
  const headlamp = new THREE.MeshStandardMaterial({ color: 0xdaf3f5, emissive: 0xc6edff, emissiveIntensity: 2.5, roughness: 0.1 });
  const seam = new THREE.MeshStandardMaterial({ color: 0x0a1113, metalness: 0.5, roughness: 0.7 });

  skin([
    [-2.73,.70,.65,1.11],[-2.68,.88,.57,1.22],[-2.48,1.035,.47,1.33],[-2.25,1.065,.46,1.37],
    [-1.8,1.065,.44,1.39],[-.9,1.064,.45,1.39],[.5,1.065,.46,1.4],[1.8,1.065,.48,1.4],
    [2.45,1.02,.49,1.4],[2.66,.99,.54,1.36],[2.73,.85,.62,1.25],
  ], paint, group);
  rounded(group, black, [2.05,.30,4.7], [0,.5,.08], .10);
  skin([
    [-2.26,.79,1.26,1.68],[-1.84,.96,1.25,2.0],[-1.59,.985,1.25,2.095],
    [-1.3,.99,1.25,2.11],[1.8,.99,1.25,2.11],[2.15,.965,1.26,2.085],[2.43,.92,1.28,1.97],
  ], paint, group);
  rounded(group, paint, [1.99,.115,3.94], [0,2.1,.26], .055);
  rounded(group, graphite, [1.80,.86,.047], [0,.94,2.695], .055);
  const rearGlass = rounded(group, glass, [1.785,.609,.037], [0,1.695,2.379], .05);
  rearGlass.rotation.x = -.125;
  rounded(group, chrome, [1.9,.013,.028], [0,1.37,2.696], .005);
  rounded(group, graphite, [1.95,.14,.10], [0,.51,2.672], .04);
  rounded(group, chrome, [1.82,.023,.05], [0,.436,2.62], .01);
  rounded(group, black, [1.64,.12,.075], [0,.40,2.585], .025);
  rounded(group, black, [.56,.15,.04], [0,.767,2.751], .02);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(.46,.126), new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: .35, metalness: .25 }));
  plate.position.set(0,.765,2.778); group.add(plate);

  // A continuous unbranded rear light, with a recessed lens and vertical ends.
  line(group, [[-.934,.87,2.72],[-.95,1.15,2.73],[-.92,1.245,2.737],[-.65,1.254,2.745],[.65,1.254,2.745],[.92,1.245,2.737],[.95,1.15,2.73],[.934,.87,2.72]], black,.044);
  line(group, [[-.934,.90,2.773],[-.945,1.15,2.779],[-.915,1.237,2.781],[-.60,1.245,2.789],[.60,1.245,2.789],[.915,1.237,2.781],[.945,1.15,2.779],[.934,.90,2.773]], light,.019);
  for (const side of [-1, 1]) {
    rounded(group, light, [.27,.024,.03], [side*.71,.57,2.70], .009);
  }

  for (const side of [-1, 1]) {
    const x = side * 1.006;
    sidePanel(group, x, [[-1.96,1.48],[-1.58,1.973],[-.67,2.013],[-.62,1.475]], glass);
    sidePanel(group, x, [[-.52,1.477],[-.54,2.019],[.53,2.019],[.53,1.477]], glass);
    sidePanel(group, x, [[.635,1.477],[.635,2.017],[1.91,2.0],[2.237,1.93],[2.30,1.477]], glass);
    line(group, [[side*1.014,1.454,-2.0],[side*1.021,1.454,-.5],[side*1.018,1.454,2.27]], chrome,.009);
    line(group, [[side*1.015,1.986,-1.6],[side*1.008,2.048,-.9],[side*1.007,2.048,1.92]], black,.018);
    for (const z of [-.56,.57,2.36]) {
      line(group, [[side*1.073,.55,z],[side*1.075,.9,z],[side*1.063,1.37,z]], seam,.006);
    }
    for (const z of [-.7,1.99]) rounded(group, chrome, [.022,.029,.17], [side*1.08,1.315,z], .01);
    rounded(group, chrome, [.025,.025,3.8], [side*1.055,.51,.25], .01);
    const mirror = rounded(group, graphite, [.29,.135,.32], [side*1.20,1.64,-1.71], .056);
    rounded(mirror, glass, [.26,.103,.024], [0,0,.167], .015);
    rounded(group, black, [.14,.046,.10], [side*1.068,1.6,-1.695], .02);
    // Roof rails, tyre arches and the fixed brake caliper.
    line(group, [[side*.79,2.165,-1.2],[side*.79,2.183,0],[side*.79,2.168,1.85]], chrome,.013);
    for (const z of [-1.8,1.84]) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(.491,.056,10,44,Math.PI), black);
      arch.rotation.y = Math.PI / 2; arch.rotation.z = Math.PI / 2;
      arch.position.set(side*1.076,.468,z); group.add(arch);
    }
  }
  const windshield = rounded(group, glass, [1.69,.7,.042], [0,1.708,-1.99], .06);
  windshield.rotation.x = .61;
  rounded(group, graphite, [1.75,.065,.048], [0,1.37,-2.272], .016);
  rounded(group, black, [1.84,.22,.058], [0,.8,-2.65], .03);
  for (const side of [-1,1]) {
    rounded(group, headlamp, [.55,.037,.062], [side*.62,1.16,-2.665], .018);
    rounded(group, chrome, [.038,.12,.055], [side*.91,.72,-2.59], .017);
  }
  // Panel seams, roof glass and rear wiper keep the vehicle readable close up.
  rounded(group, glass, [1.30,.024,1.74], [0,2.166,.1], .012);
  line(group, [[-.65,1.50,2.411],[-.05,1.51,2.419],[.04,1.52,2.419]], black,.009);
  rounded(group, graphite, [.088,.055,.19], [0,2.184,1.99], .025);

  const tire = new THREE.MeshStandardMaterial({ color: 0x0b0c0c, roughness: .91 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x9aa4a7, metalness: .95, roughness: .23 });
  const rimDark = new THREE.MeshStandardMaterial({ color: 0x171e20, metalness: .8, roughness: .3 });
  const brakeDisc = new THREE.MeshStandardMaterial({ color: 0x636b6e, metalness: .88, roughness: .45 });
  const wheels = [];
  const caliperMaterial = new THREE.MeshStandardMaterial({color:0x8d2e22,roughness:.42,metalness:.5});
  for (const side of [-1,1]) for (const z of [-1.8,1.84]) {
    const wheel = new THREE.Group(); wheel.position.set(side*1.053,.455,z); group.add(wheel); wheels.push(wheel);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.354,.093,14,64), tire);
    ring.rotation.y = Math.PI/2; ring.castShadow = true; wheel.add(ring);
    const sidewall = new THREE.Mesh(new THREE.CylinderGeometry(.367,.367,.223,64), tire);
    sidewall.rotation.z = Math.PI/2; wheel.add(sidewall);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,.018,48), brakeDisc);
    disc.rotation.z = Math.PI/2; disc.position.x = side*.12; wheel.add(disc);
    const darkHub = new THREE.Mesh(new THREE.CylinderGeometry(.27,.27,.023,48), rimDark);
    darkHub.rotation.z = Math.PI/2; darkHub.position.x = side*.142; wheel.add(darkHub);
    const outer = new THREE.Mesh(new THREE.TorusGeometry(.279,.014,8,48), rim);
    outer.rotation.y = Math.PI/2; outer.position.x = side*.16; wheel.add(outer);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(.257,.006,6,48), chrome);
    inner.rotation.y = Math.PI/2; inner.position.x = side*.175; wheel.add(inner);
    for (let i=0;i<12;i++) {
      const a = i*Math.PI/6;
      const spoke = rounded(wheel, rim, [.031,.23,.018], [side*.166,Math.cos(a)*.14,Math.sin(a)*.14],.007);
      spoke.rotation.x = a;
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.063,.063,.029,24), chrome);
    hub.rotation.z = Math.PI/2; hub.position.x = side*.185; wheel.add(hub);
    for (let i=0;i<5;i++) {
      const a = i*Math.PI*2/5;
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(.009,6,4), black);
      bolt.position.set(side*.203,Math.cos(a)*.046,Math.sin(a)*.046); wheel.add(bolt);
    }
    batchMeshes(wheel);
    const caliper = rounded(group, caliperMaterial, [.09,.13,.075], [side*1.185,.55,z+.195],.022);
    caliper.rotation.x = -.35;
  }

  const brakeGlow = new THREE.PointLight(0xff260e,0,4,2);
  brakeGlow.position.set(0,1.0,2.9); group.add(brakeGlow);
  const bodyMeshes = batchMeshes(group, new Set(wheels));
  const originals = bodyMeshes.map(mesh => ({mesh, positions:mesh.geometry.attributes.position.array.slice()}));
  const paintColor = paint.color.clone(), wheelPositions = wheels.map(w => w.position.clone());
  const crackMaterial = new THREE.MeshBasicMaterial({map:crackTexture(),transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
  const cracks = [];
  for(const side of [-1,1]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.5,.49),crackMaterial);
    pane.rotation.y=side*Math.PI/2;pane.position.set(side*1.009,1.75,1.25);pane.visible=false;group.add(pane);cracks.push(pane);
  }
  const rearCrack = new THREE.Mesh(new THREE.PlaneGeometry(1.69,.56),crackMaterial);
  rearCrack.position.set(0,1.7,2.414);rearCrack.rotation.x=-.125;rearCrack.visible=false;group.add(rearCrack);cracks.push(rearCrack);
  const wreckParts=new THREE.Group();wreckParts.visible=false;group.add(wreckParts);
  const engine=new THREE.MeshStandardMaterial({color:0x171e21,metalness:.72,roughness:.63});
  rounded(wreckParts,engine,[1.44,.30,.68],[0,1.21,-2.19],.06);
  const hood=rounded(wreckParts,paint,[1.7,.062,.90],[0,1.48,-2.11],.045);
  const tornBumper=rounded(wreckParts,graphite,[1.67,.21,.15],[.17,.41,-2.78],.033);
  const looseTrim=rounded(wreckParts,chrome,[1.67,.034,.058],[.2,.26,-2.81],.01);
  const radiator=new THREE.Group();radiator.position.set(0,1.22,-2.62);wreckParts.add(radiator);
  for(let i=0;i<9;i++)rounded(radiator,engine,[1.11,.016,.025],[0,i*.037-.14,0],.006);
  batchMeshes(radiator);
  const scrapeMaterial=new THREE.MeshBasicMaterial({map:scrapeTexture(),transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3});
  const scrapes=[];
  for(const side of [-1,1]) {
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(2.40,.52,16,4),scrapeMaterial);panel.rotation.y=side*Math.PI/2;
    panel.position.set(side*1.086,.99,-.45);panel.visible=false;group.add(panel);scrapes.push(panel);
  }
  let damage = 0;
  const dents=[0,0];

  function reset() {
    if(damage)for(const {mesh,positions} of originals){mesh.geometry.attributes.position.array.set(positions);mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();}
    for(const pane of cracks)pane.visible=false;
    wreckParts.visible=false;for(const panel of scrapes)panel.visible=false;
    wheels.forEach((w,i)=>{w.position.copy(wheelPositions[i]);w.rotation.set(0,0,0);});
    group.position.set(0,0,0);group.rotation.set(0,0,0);damage=0;dents.fill(0);paint.color.copy(paintColor);paint.roughness=.22;
  }

  function dent(side, amount) {
    damage=amount;
    dents[side>0?1:0]=amount;
    for(const {mesh,positions} of originals) {
      const p=mesh.geometry.attributes.position;
      for(let i=0;i<p.count;i++) {
        const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2];
        const front=Math.exp(-(((z+1.85)/1.45)**2));
        let xx=x,yy=y,zz=z;
        for(let d=0;d<2;d++){
          const impactSide=d===0?-1:1,edge=THREE.MathUtils.smoothstep(impactSide*x,.1,1.08);
          const crush=edge*(front+.16*Math.exp(-(((z-.4)/2)**2)))*dents[d]*Math.max(.32,1-Math.max(0,y-1.2)*.65);
          xx-=impactSide*crush*.80;
          yy+=crush*(Math.sin(z*21+x*17)*.065-.14)+(y>1.28&&z<-.8?crush*.24:0);
          zz+=crush*.69;
          // Buckled metal folds stay local to the impact, instead of scaling the entire car.
          xx+=impactSide*crush*Math.sin(z*13+y*9)*.062;
        }
        p.setXYZ(i,xx,yy,zz);
      }
      p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
    }
    for(const pane of cracks)pane.visible=true;
    wreckParts.visible=true;hood.rotation.set(-.22,side*.08,side*.17);hood.position.set(-side*.14,1.51,-1.94);
    tornBumper.rotation.set(.28,side*.19,side*.20);looseTrim.rotation.set(.1,side*.13,side*.26);
    scrapes[side>0?1:0].visible=true;
    paint.color.copy(paintColor).multiplyScalar(.79);paint.roughness=.37;
    wheels.forEach((w,i)=>{if(wheelPositions[i].x*side>0){w.position.x=wheelPositions[i].x-side*(wheelPositions[i].z<0?.23:.12);w.rotation.y=side*(wheelPositions[i].z<0?.72:.31);w.rotation.z=side*.24;w.position.y=.36;w.position.z=wheelPositions[i].z+(wheelPositions[i].z<0?.23:0);}});
  }
  return {
    group, wheels, light, brakeGlow, reset, dent,
    update(speed, braking, time, phase, dt, crash = null) {
      wheels.forEach((w,i) => { w.rotation.x -= speed * dt / .45 * (damage&&wheelPositions[i].z<0?.36:1); });
      const rolling = phase === 'running' || phase === 'countdown' || phase === 'broken';
      const bounce = rolling ? Math.sin(time*31)*.007*Math.min(speed/30,1.3) : 0;
      const hitAge=crash?crash.crashTime-crash.lastImpactAt:100;
      const kick=Math.max(0,1-hitAge/.55);
      const pitchTarget = braking ? -.045 : damage ? -.071-kick*.11 : rolling ? .009 : 0;
      group.rotation.x = THREE.MathUtils.damp(group.rotation.x,pitchTarget,12,dt);
      group.rotation.z = damage ? (crash?.impactSide??1)*(.025+Math.sin(hitAge*24)*kick*.075) : rolling ? Math.sin(time*2.8)*.0018 : 0;
      group.position.y = bounce-(damage?.065:0)+kick*.055*Math.sin(hitAge*28);
      if(damage){tornBumper.rotation.x=.28+Math.sin(time*13)*.055*Math.min(speed/9,1);looseTrim.rotation.z=(crash?.impactSide??1)*.26+Math.sin(time*18)*.04;}
      light.emissiveIntensity = damage ? Math.sin(time*9)>0?2.6:.2 : braking || phase === 'stopped' ? 4 : 1.15;
      brakeGlow.intensity = braking ? 7 : 0;
    },
  };
}

function crackTexture() {
  const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');
  let seed=691;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
  const ox=332,oy=127;
  for(let i=0;i<23;i++) {
    const angle=i/23*Math.PI*2,extent=75+rand()*250;ctx.beginPath();ctx.moveTo(ox,oy);
    for(let j=1;j<=6;j++){const r=j/6*extent;ctx.lineTo(ox+Math.cos(angle)*r+(rand()-.5)*14,oy+Math.sin(angle)*r+(rand()-.5)*14);}
    ctx.strokeStyle=`rgba(223,237,239,${.3+rand()*.5})`;ctx.lineWidth=.6+rand();ctx.stroke();
  }
  for(let r=12;r<85;r+=13){ctx.beginPath();for(let i=0;i<=23;i++){const a=i/23*Math.PI*2,rr=r+(rand()-.5)*14;const x=ox+Math.cos(a)*rr,y=oy+Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.strokeStyle='#dae7e54f';ctx.lineWidth=.65;ctx.stroke();}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function scrapeTexture() {
  const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');
  let seed=29;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
  for(let i=0;i<150;i++) {
    const x=random()*850,y=58+random()*148;
    ctx.strokeStyle=i%3?'#bdc2bc9c':'#101916ae';ctx.lineWidth=.4+random()*2;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+30+random()*240,y+(random()-.5)*14);ctx.stroke();
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
