import {
  Color,
  ShaderMaterial,
  Vector3,
  type Texture,
} from 'three'

/**
 * Day/night terminator + warm twilight — technique used by AAA space titles
 * and Three.js solar-system demos (sun-relative Lambert, not flat emissive fill).
 */
export function createPlanetSurfaceMaterial(opts: {
  map: Texture
  bumpMap?: Texture
  nightColor?: number
}): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uMap: { value: opts.map },
      uBump: { value: opts.bumpMap ?? opts.map },
      uSunPosition: { value: new Vector3() },
      uNightColor: { value: new Color(opts.nightColor ?? 0x0a1428) },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPos = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D uMap;
      uniform sampler2D uBump;
      uniform vec3 uSunPosition;
      uniform vec3 uNightColor;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;

      void main() {
        #include <logdepthbuf_fragment>
        vec3 albedo = texture2D(uMap, vUv).rgb;
        float bump = texture2D(uBump, vUv).r;
        vec3 N = normalize(vNormalW);
        // cheap bump tilt
        N = normalize(N + vec3((bump - 0.5) * 0.35, 0.0, (bump - 0.5) * 0.15));

        vec3 L = normalize(uSunPosition - vWorldPos);
        float ndl = dot(N, L);
        float day = smoothstep(-0.08, 0.22, ndl);
        float wrap = max(ndl * 0.5 + 0.5, 0.0);

        vec3 dayLit = albedo * (0.12 + wrap * 0.95);
        // city-light flecks on night side
        float lights = step(0.78, fract(sin(dot(vUv * 40.0, vec2(12.9898, 78.233))) * 43758.5453));
        lights *= smoothstep(0.45, 0.05, day) * (0.4 + 0.6 * bump);
        vec3 nightLit = mix(uNightColor, albedo * 0.15, 0.35) + vec3(1.0, 0.85, 0.45) * lights * 0.55;

        float term = exp(-pow(ndl * 2.8, 2.0));
        vec3 twilight = vec3(1.0, 0.42, 0.18) * term * 0.35;

        vec3 col = mix(nightLit, dayLit, day) + twilight * day;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  })
}

export function createCloudShellMaterial(cloudMap: Texture, tint: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uMap: { value: cloudMap },
      uSunPosition: { value: new Vector3() },
      uTint: { value: new Color(tint) },
      uTime: { value: 0 },
      uOpacity: { value: 0.42 },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPos = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D uMap;
      uniform vec3 uSunPosition;
      uniform vec3 uTint;
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        #include <logdepthbuf_fragment>
        vec2 uv = vUv + vec2(uTime * 0.003, 0.0);
        float c = texture2D(uMap, uv).r;
        float ndl = max(dot(normalize(vNormalW), normalize(uSunPosition - vWorldPos)), 0.0);
        float a = c * uOpacity * (0.35 + ndl * 0.75);
        if (a < 0.02) discard;
        gl_FragColor = vec4(uTint * (0.7 + ndl * 0.5), a);
      }
    `,
  })
}

export function setSurfaceSun(material: ShaderMaterial, sun: Vector3, time = 0): void {
  if (material.uniforms.uSunPosition) material.uniforms.uSunPosition.value.copy(sun)
  if (material.uniforms.uTime) material.uniforms.uTime.value = time
}
