import { Vector2, Vector3, type Camera, type IUniform } from 'three'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

/**
 * Screen-space crepuscular rays (GPU Gems–style radial blur toward the sun).
 * Composite after bloom; intensity fades when the sun leaves the view frustum.
 */
const GodRaysShader = {
  name: 'GodRaysShader',
  uniforms: {
    tDiffuse: { value: null },
    lightPosition: { value: new Vector2(0.5, 0.5) },
    exposure: { value: 0.1 },
    decay: { value: 0.96 },
    density: { value: 0.55 },
    weight: { value: 0.16 },
    clampMax: { value: 0.4 },
    intensity: { value: 0.65 },
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
    uniform vec2 lightPosition;
    uniform float exposure;
    uniform float decay;
    uniform float density;
    uniform float weight;
    uniform float clampMax;
    uniform float intensity;
    varying vec2 vUv;

    const int SAMPLES = 10;

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      if (intensity < 0.01) {
        gl_FragColor = base;
        return;
      }

      vec2 delta = (vUv - lightPosition) * (1.0 / float(SAMPLES)) * density;
      vec2 uv = vUv;
      float illum = 1.0;
      vec3 rays = vec3(0.0);

      for (int i = 0; i < SAMPLES; i++) {
        uv -= delta;
        vec3 s = texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
        float lum = max(max(s.r, s.g), s.b);
        // Prefer hot / bright samples (sun, bloom cores)
        float hot = smoothstep(0.55, 0.95, lum);
        illum *= decay;
        rays += s * hot * illum * weight;
      }

      rays = min(rays, vec3(clampMax));
      vec3 color = base.rgb + rays * exposure * intensity;
      gl_FragColor = vec4(color, base.a);
    }
  `,
}

export function createGodRaysPass(): ShaderPass {
  return new ShaderPass(GodRaysShader)
}

const _sunNdc = new Vector3()

export function updateGodRaysPass(
  pass: ShaderPass,
  camera: Camera,
  sunWorld: Vector3,
): void {
  _sunNdc.copy(sunWorld).project(camera)
  const u = pass.uniforms as Record<string, IUniform>
  const inFront = _sunNdc.z > -1 && _sunNdc.z < 1
  const onScreen = Math.abs(_sunNdc.x) < 1.35 && Math.abs(_sunNdc.y) < 1.35
  const sx = _sunNdc.x * 0.5 + 0.5
  const sy = _sunNdc.y * 0.5 + 0.5
  u.lightPosition.value.set(sx, sy)

  let intensity = 0
  if (inFront && onScreen) {
    const edge = Math.max(Math.abs(_sunNdc.x), Math.abs(_sunNdc.y))
    intensity = 1 - smoothstep(0.85, 1.35, edge)
  }
  u.intensity.value = intensity
}

function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
