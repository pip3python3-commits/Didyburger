// Post stack: scene (MSAA + depth) -> bloom -> look shader [depth of field, light shafts, painterly Kuwahara, whip blur,
// ghost/double-exposure, iris, speed lines, rage veins, cracks, chromatic aberration, grade, vignette, flash] -> output.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const LookShader = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null }, tGhost: { value: null }, res: { value: new THREE.Vector2(720, 1280) },
    cNear: { value: 0.1 }, cFar: { value: 2000 },
    whip: { value: 0 }, flash: { value: 0 }, flashCol: { value: new THREE.Color(1, 0.96, 0.9) }, vig: { value: 0.55 }, sat: { value: 1.12 },
    contrast: { value: 1.08 }, paint: { value: 1.0 }, shadowTint: { value: new THREE.Color('#34202B') },
    dof: { value: 0 }, focus: { value: 10 }, rays: { value: 0 }, sunUV: { value: new THREE.Vector2(0.5, 0.9) }, rayCol: { value: new THREE.Color('#ffe2b0') },
    ghost: { value: 0 }, iris: { value: 0 }, irisC: { value: new THREE.Vector2(0.5, 0.5) }, speed: { value: 0 }, veins: { value: 0 }, veinCol: { value: new THREE.Color('#e0202a') },
    crack: { value: 0 }, crackC: { value: new THREE.Vector2(0.5, 0.4) }, chroma: { value: 0 }, time: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: /* glsl */`
    #include <packing>
    uniform sampler2D tDiffuse, tDepth, tGhost; uniform vec2 res; uniform float cNear, cFar;
    uniform float whip, flash, vig, sat, contrast, paint, dof, focus, rays, ghost, iris, speed, veins, crack, chroma, time;
    uniform vec3 shadowTint, flashCol, rayCol, veinCol; uniform vec2 sunUV, irisC, crackC;
    varying vec2 vUv;
    float lum(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
    float viewZ(vec2 uv){ float d = texture2D(tDepth, uv).x; return -perspectiveDepthToViewZ(d, cNear, cFar); }
    vec3 src(vec2 uv){
      if (chroma > 0.001) { vec2 o = (uv-0.5)*chroma*0.02; return vec3(texture2D(tDiffuse, uv+o).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv-o).b); }
      return texture2D(tDiffuse, uv).rgb;
    }
    vec3 kuwahara(vec2 uv){
      vec2 px = 1.0/res; vec3 m[4]; float v[4];
      for(int k=0;k<4;k++){
        float sx = (k==0||k==3) ? -1. : 1.; float sy = (k<2) ? -1. : 1.;
        vec3 s=vec3(0.); float s2=0.;
        for(int j=0;j<3;j++) for(int i=0;i<3;i++){ vec3 c = texture2D(tDiffuse, uv + vec2(sx*float(i), sy*float(j))*px).rgb; s += c; s2 += lum(c)*lum(c); }
        s /= 9.; m[k]=s; v[k]=s2/9. - lum(s)*lum(s);
      }
      vec3 best=m[0]; float bv=v[0];
      for(int k=1;k<4;k++) if(v[k]<bv){ bv=v[k]; best=m[k]; }
      return best;
    }
    void main(){
      vec2 uv = vUv;
      vec3 base = mix(src(uv), kuwahara(uv), paint);
      // depth of field: circle of confusion from view depth vs focus distance, 16-tap golden spiral
      if (dof > 0.001) {
        float z = viewZ(uv);
        float coc = clamp(abs(z - focus) / max(z, 0.1) * dof, 0.0, 1.0);
        if (coc > 0.02) {
          vec3 acc = base; float wsum = 1.0; float r = coc * 14.0;
          for (int i = 0; i < 16; i++) {
            float fi = float(i); float a = fi * 2.39996; float rr = sqrt((fi + 0.5) / 16.0) * r;
            vec2 o = vec2(cos(a), sin(a)) * rr / res;
            float zs = viewZ(uv + o); float cs = clamp(abs(zs - focus) / max(zs, 0.1) * dof, 0.0, 1.0);
            float w = (zs < z) ? cs * 0.6 : 1.0;          // don't bleed sharp background over blurred foreground
            acc += texture2D(tDiffuse, uv + o).rgb * w; wsum += w;
          }
          base = mix(base, acc / wsum, smoothstep(0.02, 0.25, coc));
        }
      }
      if (whip > 0.002) { vec3 acc = vec3(0.); for(int i=-5;i<=5;i++) acc += texture2D(tDiffuse, uv + vec2(float(i)/5.*whip*0.09, 0.)).rgb; base = mix(base, acc/11., clamp(whip*1.6, 0., 1.)); }
      // light shafts toward the sun's screen position
      if (rays > 0.001) {
        vec2 d = (uv - sunUV) / 28.0; vec2 p = uv; float decay = 1.0; vec3 acc = vec3(0.);
        for (int i = 0; i < 28; i++) { p -= d; vec3 c = texture2D(tDiffuse, clamp(p, 0.001, 0.999)).rgb; acc += max(c - 0.62, 0.0) * decay; decay *= 0.94; }
        base += acc * rayCol * rays * 0.22;
      }
      if (speed > 0.001) { vec2 q = uv - 0.5; float a = atan(q.y, q.x); float n = step(0.82, noise(vec2(a * 60.0, time * 8.0))); float m = smoothstep(0.18, 0.6, length(q * vec2(1.0, res.y/res.x*0.6))); base = mix(base, vec3(1.0), n * m * speed * 0.8); }
      if (veins > 0.001) { vec2 q = uv * vec2(res.x/res.y, 1.0) * 6.0; float r = abs(noise(q + time*0.2) - 0.5) + abs(noise(q*2.1 - time*0.15) - 0.5) * 0.5; float line = 1.0 - smoothstep(0.0, 0.035, r); float edge = smoothstep(0.25, 0.75, length((uv-0.5)*vec2(1.0,0.8))*1.6); base = mix(base, base * vec3(1.2,0.7,0.72), veins * 0.4); base += veinCol * line * edge * veins * 1.6; }
      if (crack > 0.001) { vec2 q = (uv - crackC) * vec2(res.x/res.y, 1.0); float a = atan(q.y, q.x), r = length(q); float k = floor(a / 6.2832 * 11.0 + 0.5); float ca = (k / 11.0) * 6.2832 + (noise(vec2(k, r * 12.0)) - 0.5) * 0.25; float dd = abs(sin(a - ca)) * r; float line = (1.0 - smoothstep(0.001, 0.0028, dd)) * step(r, crack * 0.28) * step(0.03, r); base = mix(base, vec3(0.12,0.05,0.08), line * 0.85); }
      if (ghost > 0.001) { vec3 g = texture2D(tGhost, (uv - 0.5) * (1.0 - ghost*0.04) + 0.5).rgb; base = mix(base, max(base, g) * 0.6 + g * 0.4, ghost); }
      float l = lum(base);
      base += shadowTint * (1.0 - smoothstep(0.0, 0.18, l)) * 0.35;
      base = (base - 0.18) * contrast + 0.18;
      base = mix(vec3(lum(base)), base, sat);
      vec2 q = (uv - 0.5) * vec2(1.0, 0.82);
      base *= 1.0 - vig * pow(dot(q,q)*2.2, 1.35);
      if (iris > 0.001) { float rr = length((uv - irisC) * vec2(res.x/res.y, 1.0)); float R = (1.0 - iris) * 1.2; base *= smoothstep(R, R - 0.01, rr); }
      base = mix(base, flashCol, flash);
      gl_FragColor = vec4(max(base, vec3(0.)), 1.);
    }`,
};

export function createLook(renderer, scene, camera, w, h, opts = {}) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: opts.msaa ?? 4 });
  rt.depthTexture = new THREE.DepthTexture(w, h); rt.depthTexture.type = THREE.UnsignedIntType;
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1); composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(Math.round(w / 2), Math.round(h / 2)), 0.35, 0.55, 0.82);
  composer.addPass(bloom);
  const pass = new ShaderPass(LookShader);
  pass.uniforms.res.value.set(w, h); pass.uniforms.paint.value = opts.paint ?? 1.0;
  composer.addPass(pass);
  composer.addPass(new OutputPass());
  // ghost: a still of another moment, rendered on demand into its own target
  const ghostRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 0 });
  pass.uniforms.tGhost.value = ghostRT.texture;
  return {
    composer, u: pass.uniforms, bloom, ghostRT,
    render() {
      pass.uniforms.tDepth.value = composer.readBuffer.depthTexture;
      pass.uniforms.cNear.value = camera.near; pass.uniforms.cFar.value = camera.far;
      composer.render();
    },
    captureGhost() { renderer.setRenderTarget(ghostRT); renderer.render(scene, camera); renderer.setRenderTarget(null); },
  };
}
