import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

/**
 * Cinematic grade pass: vignette + mild chromatic aberration + saturation/contrast.
 * Sits after bloom/god-rays and before the final OutputPass.
 */
const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.42 },
    uChromatic: { value: 0.0026 },
    uSaturation: { value: 1.06 },
    uContrast: { value: 1.03 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uChromatic;
    uniform float uSaturation;
    uniform float uContrast;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      vec2 dir = uv - 0.5;
      float dist = length(dir);

      // Chromatic aberration — sample RGB with a tiny radial offset
      vec2 off = dir * uChromatic * dist;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;

      // Saturation
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(luma), col, uSaturation);

      // Contrast
      col = (col - 0.5) * uContrast + 0.5;

      // Vignette — soft falloff toward the corners
      float vig = smoothstep(0.78, 0.28, dist);
      col *= mix(1.0, vig, uVignette);

      // Extremely subtle time shimmer so the grade never feels frozen
      col += vec3(0.004) * sin(uTime * 0.6 + dist * 18.0);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

export function createCinematicPass(): ShaderPass {
  return new ShaderPass(CinematicShader)
}

export function updateCinematicPass(pass: ShaderPass, time: number): void {
  pass.uniforms.uTime.value = time
}
