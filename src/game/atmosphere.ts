import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  ShaderMaterial,
  Vector3,
  type Side,
} from 'three'

/**
 * Sun-aware limb atmosphere inspired by O'Neil / GPU Gems scattering
 * (simplified for WebGL shells — not full raymarched Hillaire LUTs).
 * Refs: NVIDIA GPU Gems 2 Ch.16; Maxime Heckel atmosphere write-up.
 */
export interface AtmosphereMaterialOptions {
  color?: Color | string | number
  intensity?: number
  fresnelPower?: number
  falloff?: number
  side?: Side
  additive?: boolean
  time?: number
  mieStrength?: number
}

const atmosphereVertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vNormalW;
varying vec3 vWorldPos;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
  #include <logdepthbuf_vertex>
}
`

const atmosphereFragmentShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uIntensity;
uniform float uFresnelPower;
uniform float uFalloff;
uniform float uTime;
uniform float uMieStrength;
uniform vec3 uSunPosition;

varying vec3 vNormalW;
varying vec3 vWorldPos;

void main() {
  #include <logdepthbuf_fragment>

  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uSunPosition - vWorldPos);

  float ndv = max(dot(N, V), 0.0);
  float fresnel = pow(1.0 - ndv, uFresnelPower);
  float rim = smoothstep(uFalloff, 1.0, fresnel);

  // Rayleigh-ish limb + warm terminator (space view)
  float ndl = dot(N, L);
  float day = smoothstep(-0.15, 0.35, ndl);
  vec3 rayleigh = uColor * (0.55 + day * 0.65);
  vec3 sunset = vec3(1.0, 0.45, 0.18);
  float term = exp(-pow(ndl * 3.2, 2.0));
  rayleigh = mix(rayleigh, sunset, term * (1.0 - day) * 0.85);

  // Mie forward scatter toward sun
  float mie = pow(max(dot(V, -L), 0.0), 8.0) * uMieStrength;

  float shimmer = 0.94 + 0.06 * sin(uTime * 0.35 + ndv * 10.0);
  float alpha = rim * uIntensity * shimmer * (0.35 + day * 0.75);

  vec3 glow = rayleigh * (0.7 + fresnel * 0.9) + sunset * mie * 1.4;
  gl_FragColor = vec4(glow, alpha + mie * 0.25);
}
`

export function createAtmosphereMaterial(options: AtmosphereMaterialOptions = {}): ShaderMaterial {
  const {
    color = 0x3a9a9a,
    intensity = 0.7,
    fresnelPower = 2.6,
    falloff = 0.12,
    side = BackSide,
    additive = true,
    time = 0,
    mieStrength = 0.55,
  } = options

  const uColor = color instanceof Color ? color : new Color(color)

  return new ShaderMaterial({
    uniforms: {
      uColor: { value: uColor.clone() },
      uIntensity: { value: intensity },
      uFresnelPower: { value: fresnelPower },
      uFalloff: { value: falloff },
      uTime: { value: time },
      uMieStrength: { value: mieStrength },
      uSunPosition: { value: new Vector3(0, 0, 0) },
    },
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    transparent: true,
    depthWrite: false,
    side,
    blending: additive ? AdditiveBlending : undefined,
  })
}

export function createOuterHazeMaterial(options: AtmosphereMaterialOptions = {}): ShaderMaterial {
  return createAtmosphereMaterial({
    fresnelPower: 1.55,
    falloff: 0.02,
    intensity: 0.28,
    mieStrength: 0.35,
    side: DoubleSide,
    additive: true,
    ...options,
  })
}

export function updateAtmosphereTime(material: ShaderMaterial, time: number): void {
  if (material.uniforms.uTime) material.uniforms.uTime.value = time
}

export function setAtmosphereSun(material: ShaderMaterial, sunPosition: Vector3): void {
  if (material.uniforms.uSunPosition) {
    material.uniforms.uSunPosition.value.copy(sunPosition)
  }
}

export function setAtmosphereColor(material: ShaderMaterial, color: Color | string | number): void {
  if (material.uniforms.uColor) material.uniforms.uColor.value.set(color)
}
