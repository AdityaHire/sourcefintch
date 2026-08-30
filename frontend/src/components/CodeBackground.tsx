import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  size: number;
  opacity: number;
  color: string;
}

const CODE_FRAGMENTS = [
  'async function queryRepo(query: string)',
  'const { points } = await qdrant.search()',
  'interface CodeCitation { file: string; line: number }',
  'const ast = ts.createSourceFile(path, content)',
  'embeddings.generate(semanticVector)',
  'git clone --depth 1 https://github.com/...',
  'yield* streamChatCompletion(context)',
  'SELECT chunk_id, file_path FROM code_chunks',
  'fastapi.post("/api/rag/ask")',
  'cosineSimilarity(vecA, vecB) > 0.82',
  'type ASTNode = FunctionDecl | ClassDecl | Import',
  'tokenCount = encoder.encode(chunk).length',
];

const COLORS = [
  'rgba(129, 140, 248, ', // indigo-400
  'rgba(168, 85, 247, ',  // purple-500
  'rgba(56, 189, 248, ',  // sky-400
  'rgba(148, 163, 184, ', // slate-400
  'rgba(52, 211, 153, ',  // emerald-400
];

export default function CodeBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Initialize particles
    const particleCount = Math.min(22, Math.max(12, Math.floor(width / 70)));
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.25 - 0.1,
        text: CODE_FRAGMENTS[Math.floor(Math.random() * CODE_FRAGMENTS.length)],
        size: Math.random() * 2 + 11,
        opacity: Math.random() * 0.16 + 0.08,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }

    // Grid dots
    const drawGrid = () => {
      const spacing = 48;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
      for (let x = 0; x < width; x += spacing) {
        for (let y = 0; y < height; y += spacing) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw subtle background grid
      drawGrid();

      // Draw and update drifting code particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around boundaries
        if (p.x < -200) p.x = width + 50;
        if (p.x > width + 200) p.x = -50;
        if (p.y < -50) p.y = height + 50;
        if (p.y > height + 50) p.y = -50;

        ctx.font = `${p.size}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = `${p.color}${p.opacity})`;
        ctx.fillText(p.text, p.x, p.y);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 bg-zinc-950">
      {/* Canvas Layer */}
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

      {/* Ambient Radial Lighting Glows */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 right-1/4 w-[600px] h-[400px] bg-violet-600/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Vertical Gradient Overlays for perfect foreground contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950/60 to-zinc-950 pointer-events-none" />
    </div>
  );
}
