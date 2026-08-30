"use client";

import { useEffect, useRef } from "react";

// Valley of the Mind Shader Background
// Inspired by Dave Katague / 21st.dev
// Clean, low-overhead WebGL canvas with subtle FBM topography and domain-warped motion

const VERT = `attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAG = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_colors[4];
uniform float u_isDark;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = rot * p * 2.02 + vec2(12.3, 4.5);
    a *= 0.5;
  }
  return v;
}

vec3 palette(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.33) {
    return mix(u_colors[0], u_colors[1], smoothstep(0.0, 0.33, t));
  } else if (t < 0.66) {
    return mix(u_colors[1], u_colors[2], smoothstep(0.33, 0.66, t));
  } else {
    return mix(u_colors[2], u_colors[3], smoothstep(0.66, 1.0, t));
  }
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

  float t = u_time * 0.12;

  // Domain warp for topographic valley contour
  vec2 q = vec2(
    fbm(p * 1.8 + vec2(t * 0.3, -t * 0.2)),
    fbm(p * 1.8 + vec2(-t * 0.2, t * 0.3) + vec2(5.2, 1.3))
  );

  vec2 r = vec2(
    fbm(p * 2.4 + 2.0 * q + vec2(1.7, 9.2) + vec2(t * 0.15, -t * 0.1)),
    fbm(p * 2.4 + 2.0 * q + vec2(8.3, 2.8) + vec2(-t * 0.1, t * 0.15))
  );

  float f = fbm(p * 1.5 + 2.5 * r + vec2(t * 0.08, t * 0.05));

  // Valley contour ridge
  float ridge = 0.5 + 0.5 * sin(f * 6.28318 + p.y * 2.0 + t * 0.4);
  float contour = mix(f, ridge, 0.45);

  vec3 col = palette(contour);

  // Subtle vignette
  float d = length(uv - 0.5);
  col *= 1.0 - 0.25 * smoothstep(0.3, 0.9, d);

  // Subtle grain
  float grain = (hash21(gl_FragCoord.xy + u_time) - 0.5) * 0.025;
  col += grain;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

interface ValleyOfTheMindShaderProps {
  className?: string;
}

export function ValleyOfTheMindShader({ className }: ValleyOfTheMindShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      powerPreference: "low-power",
    });

    if (!gl) return;

    // Create shader program
    const vertShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertShader) return;
    gl.shaderSource(vertShader, VERT);
    gl.compileShader(vertShader);

    const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragShader) return;
    gl.shaderSource(fragShader, FRAG);
    gl.compileShader(fragShader);

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Shader link error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Full screen triangle
    const quad = new Float32Array([-1, -1, 3, -1, -1, 3]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_resolution");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uColors = gl.getUniformLocation(program, "u_colors");
    const uIsDark = gl.getUniformLocation(program, "u_isDark");

    // Palette Colors
    // Dark mode: Refined charcoal, deep graphite, slate-900, dark neutral
    const darkPalette = new Float32Array([
      0.045, 0.045, 0.052, // #0c0c0d Deepest dark
      0.075, 0.078, 0.088, // #131417 Soft charcoal
      0.110, 0.115, 0.128, // #1c1d21 Mid zinc-graphite
      0.155, 0.160, 0.175, // #28292d Highlight ridge
    ]);

    // Light mode: Warm off-white, zinc-100, soft silver, light mist
    const lightPalette = new Float32Array([
      0.965, 0.968, 0.975, // #f6f7f9 Softest light
      0.925, 0.930, 0.940, // #eceef0
      0.880, 0.885, 0.898, // #e1e2e5
      0.830, 0.835, 0.850, // #d4d5d9 Subtle valley depth
    ]);

    let animationFrameId: number;
    const startTime = performance.now();
    let isDark = document.documentElement.classList.contains("dark");

    const updateTheme = () => {
      isDark = document.documentElement.classList.contains("dark");
    };

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const resize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.floor(canvas.clientWidth * dpr);
      const height = Math.floor(canvas.clientHeight * dpr);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const render = (time: number) => {
      if (!gl || !canvas) return;

      const elapsed = (time - startTime) * 0.001;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, elapsed);
      gl.uniform1f(uIsDark, isDark ? 1.0 : 0.0);
      gl.uniform3fv(uColors, isDark ? darkPalette : lightPalette);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      resizeObserver.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className || "absolute inset-0 w-full h-full pointer-events-none"}
      style={{ display: "block" }}
    />
  );
}
export default ValleyOfTheMindShader;
