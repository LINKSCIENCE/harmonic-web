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

export default function HCSkyline3D({ nodes }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 520 });
  const animRef = useRef(0);
  const rotRef = useRef({ y: 0.7, autoRotate: true, x: 0.4, dist: 200 });
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

    // Group by cluster, take top 5 by HC per cluster
    const byCluster = new Map<string, NodeMetrics[]>();
    nodes.forEach((nd) => {
      const arr = byCluster.get(nd.cluster) ?? [];
      arr.push(nd);
      byCluster.set(nd.cluster, arr);
    });
    const clusters = [...byCluster.entries()]
      .map(([name, arr]) => ({ name, nodes: arr.sort((a, b) => b.harmonic - a.harmonic).slice(0, 8) }))
      .sort((a, b) => b.nodes.length - a.nodes.length)
      .slice(0, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size.w, size.h);
    renderer.setClearColor(0x2a2b29, 1);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x2a2b29, 0.004);
    scene.add(new THREE.AmbientLight(0x404040, 2));
    const point = new THREE.PointLight(0xe1ff01, 1, 600);
    point.position.set(50, 80, 50);
    scene.add(point);
    const blue = new THREE.PointLight(0xb8d3d8, 0.7, 400);
    blue.position.set(-60, 50, -50);
    scene.add(blue);

    const camera = new THREE.PerspectiveCamera(55, size.w / size.h, 1, 2000);
    camera.position.set(150, 120, 150);

    // Build skyline: clusters along X, top nodes per cluster along Z, height = HC
    const baseGroup = new THREE.Group();
    scene.add(baseGroup);

    const totalSpan = clusters.length * 35;
    clusters.forEach((cluster, ci) => {
      const x = -totalSpan / 2 + ci * 35;

      // Cluster label
      const labelCanvas = document.createElement("canvas");
      labelCanvas.width = 256;
      labelCanvas.height = 48;
      const lctx = labelCanvas.getContext("2d")!;
      lctx.font = "bold 22px system-ui";
      lctx.fillStyle = "#eeeade";
      lctx.textAlign = "center";
      lctx.fillText(`/${cluster.name}`.slice(0, 18), 128, 30);
      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true });
      const labelSprite = new THREE.Sprite(labelMat);
      labelSprite.scale.set(28, 5, 1);
      labelSprite.position.set(x, -8, 0);
      baseGroup.add(labelSprite);

      cluster.nodes.forEach((node, ni) => {
        const z = -((cluster.nodes.length - 1) * 8) / 2 + ni * 8;
        const height = Math.max(4, node.harmonic * 80);
        const color = node.isOrphan ? 0xef4444 : TIER_COLOR[node.tier];
        const geo = new THREE.BoxGeometry(7, height, 6);
        geo.translate(0, height / 2, 0);
        const mat = new THREE.MeshPhongMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.25,
          shininess: 60,
        });
        const bar = new THREE.Mesh(geo, mat);
        bar.position.set(x, 0, z);
        baseGroup.add(bar);

        // Glow
        const glowGeo = new THREE.BoxGeometry(8.5, height + 1.5, 7.5);
        glowGeo.translate(0, (height + 1.5) / 2, 0);
        const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.copy(bar.position);
        baseGroup.add(glow);
      });
    });

    // Floor grid
    const grid = new THREE.GridHelper(totalSpan + 60, 20, 0x4a4b47, 0x3a3b39);
    grid.position.y = -0.5;
    scene.add(grid);

    function animate() {
      const rot = rotRef.current;
      if (rot.autoRotate) rot.y += 0.0025;
      const d = rot.dist;
      camera.position.x = Math.sin(rot.y) * Math.cos(rot.x) * d;
      camera.position.y = Math.sin(rot.x) * d + 30;
      camera.position.z = Math.cos(rot.y) * Math.cos(rot.x) * d;
      camera.lookAt(0, 20, 0);
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
          rotRef.current.x = Math.max(0.1, Math.min(1.2, rotRef.current.x + (e.clientY - mouseRef.current.prevY) * 0.005));
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
          rotRef.current.dist = Math.max(80, Math.min(500, rotRef.current.dist * (e.deltaY > 0 ? 1.08 : 0.92)));
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
