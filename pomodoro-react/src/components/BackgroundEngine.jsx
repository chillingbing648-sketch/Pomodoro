import { useEffect, useMemo, useRef } from "react";
import { getBackground } from "../data/backgrounds";

function ParticleLayer({ type }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext("2d");
    let frameId;
    let particles = [];
    let width = 0;
    let height = 0;
    let lastTime = performance.now();

    const countFor = (kind) => {
      if (kind === "rain") return 95;
      if (kind === "petals") return 34;
      if (kind === "stars") return 115;
      return 0;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = countFor(type);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: type === "stars" ? Math.random() * 1.8 + 0.35 : Math.random() * 3 + 1,
        speed: type === "rain" ? Math.random() * 420 + 360 : Math.random() * 20 + 8,
        drift: (Math.random() - 0.5) * (type === "petals" ? 24 : 5),
        rotation: Math.random() * Math.PI,
        opacity: Math.random() * 0.55 + 0.15,
      }));
    };

    const draw = (now) => {
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      context.clearRect(0, 0, width, height);

      for (const particle of particles) {
        particle.y += particle.speed * delta;
        particle.x += particle.drift * delta;
        particle.rotation += delta;

        if (particle.y > height + 20) particle.y = -20;
        if (particle.x > width + 20) particle.x = -20;
        if (particle.x < -20) particle.x = width + 20;

        context.save();
        context.globalAlpha = particle.opacity;

        if (type === "rain") {
          context.strokeStyle = "rgba(180,215,255,.45)";
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(particle.x - 4, particle.y + particle.size * 5);
          context.stroke();
        } else if (type === "petals") {
          context.fillStyle = "rgba(245,190,220,.7)";
          context.translate(particle.x, particle.y);
          context.rotate(particle.rotation);
          context.beginPath();
          context.ellipse(0, 0, particle.size * 1.8, particle.size, 0, 0, Math.PI * 2);
          context.fill();
        } else {
          context.fillStyle = "rgba(220,230,255,.85)";
          context.beginPath();
          context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          context.fill();
        }

        context.restore();
      }

      frameId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    frameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, [type]);

  return <canvas className="background-particles" aria-hidden="true" ref={canvasRef} />;
}

export default function BackgroundEngine({ backgroundId }) {
  const background = useMemo(() => getBackground(backgroundId), [backgroundId]);

  useEffect(() => {
    document.documentElement.dataset.background = background.id;
    return () => {
      delete document.documentElement.dataset.background;
    };
  }, [background.id]);

  return (
    <div
      className={`background-engine ${background.className}`}
      aria-hidden="true"
    >
      <div className="background-atmosphere" />
      {(background.type === "rain" ||
        background.type === "petals" ||
        background.type === "stars") && (
        <ParticleLayer type={background.type} />
      )}
      <div className="background-vignette" />
    </div>
  );
}
