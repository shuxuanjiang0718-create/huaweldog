import * as THREE from 'three';

export class Atmosphere {
  constructor(scene, sun, hemi, fill) {
    this.scene=scene;this.sun=sun;this.hemi=hemi;this.fill=fill;this.target=0;this.amount=0;
    this.daySun=new THREE.Vector3(-.31,.66,-1).normalize();this.duskSun=new THREE.Vector3(-.26,.105,-1).normalize();
    this.material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uDay:{value:null},uLoaded:{value:0},uWarm:{value:0},uRotation:{value:0},uSun:{value:this.daySun.clone()}},
      vertexShader:'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`
        precision highp float;
        uniform sampler2D uDay;uniform float uLoaded;uniform float uWarm;uniform float uRotation;uniform vec3 uSun;varying vec3 vDirection;
        void main(){
          vec3 dir=normalize(vDirection);float altitude=max(dir.y,0.0);
          vec2 uv=vec2(atan(dir.z,dir.x)/6.2831853+0.5+(1.8+uRotation)/6.2831853,asin(clamp(dir.y,-1.0,1.0))/3.14159265+0.5);
          vec3 photograph=texture2D(uDay,uv).rgb;
          vec3 day=mix(mix(vec3(.61,.77,.86),vec3(.20,.49,.74),sqrt(altitude)),photograph*.74,uLoaded);
          float cloud=clamp((dot(photograph,vec3(.2126,.7152,.0722))-.32)*.65,0.0,.62)*uLoaded;
          vec3 dusk=mix(vec3(1.0,.56,.25),vec3(.20,.25,.39),smoothstep(0.0,.7,altitude));
          dusk=mix(dusk,vec3(.94,.61,.30),cloud);
          vec3 sky=mix(day,dusk,uWarm);
          float alignment=clamp(dot(dir,normalize(uSun)),-1.0,1.0),angle=acos(alignment);
          float radius=mix(.009,.017,uWarm),disc=1.0-smoothstep(radius*.965,radius*1.02,angle);
          vec3 right=normalize(cross(vec3(0.0,1.0,0.0),uSun)),up=normalize(cross(uSun,right));
          vec2 surface=vec2(dot(dir,right),dot(dir,up))/radius;
          float limb=sqrt(max(0.0,1.0-dot(surface,surface)));
          float grain=.035*sin(surface.x*91.0+sin(surface.y*63.0))*sin(surface.y*83.0);
          float spots=.24*exp(-dot(surface-vec2(.23,.17),surface-vec2(.23,.17))*420.0)+.16*exp(-dot(surface+vec2(.14,.25),surface+vec2(.14,.25))*550.0);
          vec3 sunColour=mix(vec3(5.0,4.5,2.8),vec3(2.7,1.7,.55),uWarm)*(0.56+limb*.44+grain-spots);
          vec3 aureole=mix(vec3(1.0,.78,.40),vec3(1.0,.40,.12),uWarm);
          sky+=aureole*(exp(-angle*16.0)*.16+exp(-angle*85.0)*.65)*(1.0-disc);
          sky=mix(sky,sunColour,disc);
          gl_FragColor=vec4(sky,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    this.dome=new THREE.Mesh(new THREE.SphereGeometry(1800,32,16),this.material);this.dome.frustumCulled=false;this.dome.renderOrder=-100;scene.add(this.dome);
    this.fogDay=new THREE.Color(0xbacbd1);this.fogDusk=new THREE.Color(0xd6aa76);
    this.dayLight=new THREE.Color(0xfff0d8);this.duskLight=new THREE.Color(0xffb864);
    this.dayHemi=new THREE.Color(0xd3e7ef);this.duskHemi=new THREE.Color(0xffc286);
    this.dayGround=new THREE.Color(0x777b61);this.duskGround=new THREE.Color(0x79553a);
    this.direction=new THREE.Vector3();this.envDusk=false;
  }
  setDaylight(hdr, renderer) {
    this.material.uniforms.uDay.value=hdr;this.material.uniforms.uLoaded.value=1;
    const pmrem=new THREE.PMREMGenerator(renderer);
    this.dayEnvironment=pmrem.fromEquirectangular(hdr);
    // Bake dusk reflections once, never rebuild a cubemap in the frame loop.
    const warm=this.material.uniforms.uWarm.value;this.material.uniforms.uWarm.value=1;this.material.uniforms.uSun.value.copy(this.duskSun);
    const bakingScene=new THREE.Scene();const sky=this.dome.clone();bakingScene.add(sky);
    this.duskEnvironment=pmrem.fromScene(bakingScene,.025,.1,3000);
    this.material.uniforms.uWarm.value=warm;this.material.uniforms.uSun.value.copy(this.daySun);
    this.scene.environment=this.dayEnvironment.texture;pmrem.dispose();
  }
  setTime(mode) {this.target=mode==='dusk'?1:0;}
  update(dt, renderer, lateral=0,heading=0) {
    this.amount=THREE.MathUtils.damp(this.amount,this.target,3.5,dt);if(Math.abs(this.target-this.amount)<.0002)this.amount=this.target;
    const t=this.amount;this.material.uniforms.uWarm.value=t;
    this.direction.copy(this.daySun).lerp(this.duskSun,t).normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP,heading);this.material.uniforms.uSun.value.copy(this.direction);this.material.uniforms.uRotation.value=heading;
    this.sun.position.copy(this.direction).multiplyScalar(102);this.sun.position.x+=lateral;this.sun.target.position.x=lateral;
    this.sun.color.copy(this.dayLight).lerp(this.duskLight,t);this.sun.intensity=2.6-t*.5;
    this.hemi.color.copy(this.dayHemi).lerp(this.duskHemi,t);this.hemi.groundColor.copy(this.dayGround).lerp(this.duskGround,t);this.hemi.intensity=.85-t*.13;
    this.fill.color.setRGB(.76+t*.13,.86-t*.1,.92-t*.35);this.fill.intensity=.33;
    this.scene.fog.color.copy(this.fogDay).lerp(this.fogDusk,t);this.scene.fog.density=.0016;
    this.scene.environmentIntensity=.78-t*.28;renderer.toneMappingExposure=.95+t*.02;
    if(this.dayEnvironment&&this.envDusk!==(t>.5)){this.envDusk=t>.5;this.scene.environment=this.envDusk?this.duskEnvironment.texture:this.dayEnvironment.texture;}
  }
}
