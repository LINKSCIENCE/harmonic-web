"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { NodeMetrics } from "@/lib/graph";

interface Props {
  nodes: NodeMetrics[];
}

const TIER_COLOR: Record<string, number> = {
  high: 0xe1ff01,
  medium: 0xb8d3d8,
  low: 0xbfc0b6,
};

export default function QualityScatter3D({ nodes }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 520 });
  const animRef = useRef(0);
  const rotRef = useRef({ y: 0.5, x: 0.4, autoRotate: true, dist: 240 });
  const mouseRef = useRef({ isDown: false, prevX: 0, prevY: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setSize({ w: width, h: Math.min(width * 0.55, 520) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const container = canvasRef.current;
    if (!container || nodes.length === 0) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size.w, size.h);
    renderer.setClearColor(0x2a2b29, 1);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x2a2b29, 0.003);
    scene.add(new THREE.AmbientLight(0x404040, 2));
    const point = new THREE.PointLight(0xe1ff01, 1, 600);
    point.position.set(50, 80, 50);
    scene.add(point);
    const blue = new THREE.PointLight(0xb8d3d8, 0.7, 400);
    blue.position.set(-60, 50, -50);
    scene.add(blue);

    const camera = new THREE.PerspectiveCamera(55, size.w / size.h, 1, 2000);

    // Normalize axes
    const maxIn = Math.max(...nodes.map((n) => n.inDegree), 1);
    const maxOut = Math.max(...nodes.map((n) => n.outDegree), 1);
    const maxBc = Math.max(...nodes.map((n) => n.betweenness), 1e-9);
    const SPAN = 100;

    const grid = new THREE.GridHelper(SPAN * 2, 10, 0x4a4b47, 0x3a3b39);
    grid.position.y = -SPAN;
    scene.add(grid);

    // Axis labels via canvas sprites
    function makeAxisLabel(text: string, pos: THREE.Vector3) {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 64;
      const cx = c.getContext("2d")!;
      cx.font = "bold 22px system-ui";
      cx.fillStyle = "#eeeade";
      cx.textAlign = "center";
      cx.fillText(text, 128, 32);
      const tex = new THREE.CanvasTexture(c);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      sprite.scale.set(28, 7, 1);
      sprite.position.copy(pos);
      scene.add(sprite);
    }
    makeAxisLabel("OUT-LINKS →", new THREE.Vector3(SPAN + 25, -SPAN, 0));
    makeAxisLabel("IN-LINKS →", new THREE.Vector3(0, SPAN + 15, 0));
    makeAxisLabel("BETWEENNESS →", new THREE.Vector3(0, -SPAN, SPAN + 25));

    nodes.forEach((node) => {
      const x = (node.outDegree / maxOut) * SPAN * 2 - SPAN;
      const y = (node.inDegree / maxIn) * SPAN * 2 - SPAN;
      const z = (node.betweenness / maxBc) * SPAN * 2 - SPAN;
      const baseSize = 2 + node.harmonic * 8;
      const color = node.isOrphan ? 0xef4444 : TIER_COLOR[node.tier];
      const geo = new THREE.SphereGeometry(baseSize, 12, 12);
      const mat = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.3,
        shininess: 80,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      scene.add(mesh);
      // Glow
      const glowGeo = new THREE.SphereGeometry(baseSize * 1.6, 10, 10);
      const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1 });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(x, y, z);
      scene.add(glow);
    });

    function animate() {
      const rot = rotRef.current;
      if (rot.autoRotate) rot.y += 0.0025;
      const d = rot.dist;
      camera.position.x = Math.sin(rot.y) * Math.cos(rot.x) * d;
      camera.position.y = Math.sin(rot.x) * d + 30;
      camera.position.z = Math.cos(rot.y) * Math.cos(rot.x) * d;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(animate);
    }
    animate();
    return () => {
      cancelAnimationFrame(animRef.current);
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [nodes, size.w, size.h]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        ref={canvasRef}
        className="rounded-2xl overflow-hidden cursor-grab border border-[var(--wldm-black)]"
        style={{ width: "100%", height: size.h, boxShadow: "4px 4px 0 var(--wldm-black)" }}
        onMouseDown={(e) => {
          mouseRef.current.isDown = true;
          mouseRef.current.prevX = e.clientX;
          mouseRef.current.prevY = e.clientY;
          rotRef.current.autoRotate = false;
        }}
        onMouseMove={(e) => {
          if (!mouseRef.current.isDown) return;
          rotRef.current.y += (e.clientX - mouseRef.current.prevX) * 0.005;
          rotRef.current.x = Math.max(-1.2, Math.min(1.2, rotRef.current.x + (e.clientY - mouseRef.current.prevY) * 0.005));
          mouseRef.current.prevX = e.clientX;
          mouseRef.current.prevY = e.clientY;
        }}
        onMouseUp={() => {
          mouseRef.current.isDown = false;
        }}
        onMouseLeave={() => {
          mouseRef.current.isDown = false;
        }}
        onWheel={(e) => {
          e.preventDefault();
          rotRef.current.dist = Math.max(80, Math.min(600, rotRef.current.dist * (e.deltaY > 0 ? 1.08 : 0.92)));
        }}
      />
      <div className="absolute bottom-3 left-3 flex gap-2 text-[10px] text-[#bfc0b6]">
        <span className="bg-[#2a2b29]/90 border border-[#4a4b47] rounded px-2 py-1">Drag · rotate</span>
        <span className="bg-[#2a2b29]/90 border border-[#4a4b47] rounded px-2 py-1">Scroll · zoom</span>
        <button
          onClick={() => {
            rotRef.current.autoRotate = !rotRef.current.autoRotate;
          }}
          className="bg-[#2a2b29]/90 border border-[#4a4b47] rounded px-2 py-1 text-[#eeeade] hover:border-[#e1ff01] cursor-pointer"
        >
          Auto-rotate
        </button>
      </div>
    </div>
  );
}
