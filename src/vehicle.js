import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function rounded(parent, material, size, position, radius = 0.05) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 4, radius), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
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
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x858c87, metalness: 0.87, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.3 });
  const graphite = new THREE.MeshPhysicalMaterial({ color: 0x151b1d, metalness: 0.72, roughness: 0.24, clearcoat: 0.85, clearcoatRoughness: 0.16 });
  const black = new THREE.MeshStandardMaterial({ color: 0x080d10, roughness: 0.64, metalness: 0.2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x101d25, metalness: 0.24, roughness: 0.055, clearcoat: 1, envMapIntensity: 1.8, side: THREE.DoubleSide });
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
    const caliper = rounded(group, new THREE.MeshStandardMaterial({color:0x8d2e22,roughness:.42,metalness:.5}), [.09,.13,.075], [side*1.185,.55,z+.195],.022);
    caliper.rotation.x = -.35;
  }

  const brakeGlow = new THREE.PointLight(0xff260e,0,4,2);
  brakeGlow.position.set(0,1.0,2.9); group.add(brakeGlow);
  return {
    group, wheels, light, brakeGlow,
    update(speed, braking, time, phase, dt) {
      wheels.forEach(w => { w.rotation.x -= speed * dt / .45; });
      const rolling = phase === 'running' || phase === 'countdown';
      const bounce = rolling ? Math.sin(time*31)*.007*Math.min(speed/30,1.3) : 0;
      const pitchTarget = braking ? -.035 : rolling ? .009 : 0;
      group.rotation.x = THREE.MathUtils.damp(group.rotation.x,pitchTarget,5,dt);
      group.rotation.z = rolling ? Math.sin(time*2.8)*.0018 : 0;
      group.position.y = bounce;
      light.emissiveIntensity = braking || phase === 'stopped' ? 4 : 1.15;
      brakeGlow.intensity = braking ? 7 : 0;
    },
  };
}
