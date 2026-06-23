"use client";

import { useEffect, useRef } from "react";

export default function BottomShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) return;

    // Vertex shader source
    const vsSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Fragment shader source (minimalist, elegant, slow flowing waves)
    const fsSource = `
      precision mediump float;
      uniform float u_time;
      uniform vec2 u_resolution;

      // Pseudo-random noise
      float noise(vec2 p) {
        return sin(p.x * 12.9898 + p.y * 78.233) * 43758.5453;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        
        // Slow waving offsets
        float wave1 = sin(uv.x * 6.0 + u_time * 0.4) * 0.12;
        float wave2 = cos(uv.x * 3.5 - u_time * 0.25) * 0.08;
        float boundary = 0.4 + wave1 + wave2;

        // Subtle gradient blending
        // Base background matches the page background (#fefefe)
        vec3 bg = vec3(0.996, 0.996, 0.996); 
        
        // Fluid gradients: soft lavender/purple and soft sky blue
        vec3 col1 = vec3(0.96, 0.93, 0.99); // Soft lavender
        vec3 col2 = vec3(0.92, 0.95, 0.99); // Soft sky blue
        
        float dist = uv.y - boundary;
        vec3 col = bg;
        
        if (uv.y < boundary + 0.4) {
          float t = smoothstep(boundary + 0.4, boundary - 0.2, uv.y);
          // Blend lavender and blue across the x coordinate
          vec3 blend = mix(col1, col2, sin(uv.x * 3.0 + u_time * 0.1) * 0.5 + 0.5);
          col = mix(bg, blend, t * 0.7); // Subtle opacity
        }

        // Add very fine film grain noise for a premium feel
        float grain = (fract(noise(gl_FragCoord.xy + u_time) * 0.01) - 0.5) * 0.01;
        col += vec3(grain);

        // Soft fade out at the top of the canvas
        float alpha = smoothstep(1.0, 0.1, uv.y);

        gl_FragColor = vec4(col, alpha);
      }
    `;

    // Helper: compile shader
    const compileShader = (source: string, type: number) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Create vertices (full screen quad)
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const timeLoc = gl.getUniformLocation(program, "u_time");
    const resLoc = gl.getUniformLocation(program, "u_resolution");

    let animationFrameId: number;
    const startTime = performance.now();

    const resize = () => {
      const width = canvas.parentElement?.clientWidth || window.innerWidth;
      const height = 120; // fixed height
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      const time = (performance.now() - startTime) / 1000;
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(timeLoc, time);
      gl.uniform2f(resLoc, canvas.width, canvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return (
    <div className="absolute left-0 right-0 bottom-0 h-[120px] overflow-hidden pointer-events-none z-0">
      <canvas ref={canvasRef} className="block opacity-60" />
    </div>
  );
}
