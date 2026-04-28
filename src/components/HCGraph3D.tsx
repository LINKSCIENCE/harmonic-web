"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import type { NodeMetrics } from "@/lib/graph";

interface Props {
  nodes: NodeMetrics[];
  edges: Array<{ source: string; target: string }>;
}

const TIER_COLOR: Record<string, number> = {
  high: 0xe1ff01, // fluro
  medium: 0xb8d3d8, // blue
  low: 0xbfc0b6, // taupe
};
const ORPHAN_COLOR = 0xef4444;

function getColor(node: NodeMetrics): number {
  if (node.isOrphan) return ORPHAN_COLOR;
  return TIER_COLOR[node.tier] ?? TIER_COLOR.medium;
}

function urlPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname || "/";
  } catch {
    return url;
  }
}

interface SimNode {
  id: string;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  node: NodeMetrics;
  mesh: THREE.Mesh;
  glow: THREE.Mesh;
  label?: THREE.Sprite;
  spawnFrame: number;
  baseSize: number;
}

const SPAWN_START_FRAME = 8;
const SPAWN_STAGGER = 2;
const SPAWN_EASE_FRAMES = 18;
const EDGE_FADE_START = 50;
const EDGE_FADE_END = 110;
const FORCE_SIM_END = 260;
const EDGE_MAX_OPACITY = 0.18;

export default function HCGraph3D({ nodes, edges }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const edgeLinesRef = useRef<THREE.LineSegments | null>(null);
  const frameRef = useRef(0);
  const animRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0, isDown: false, prevX: 0, prevY: 0 });
  const rotRef = useRef({ x: 0.3, y: 0, autoRotate: true, dist: 280 });
  const [selectedNode, setSelectedNode] = useState<NodeMetrics | null>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseVec = useRef(new THREE.Vector2());

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setSize({ w: width, h: Math.min(width * 0.62, 620) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container || nodes.length === 0) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size.w, size.h);
    renderer.setClearColor(0x2a2b29, 1);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x2a2b29, 0.003);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, size.w / size.h, 1, 2000);
    camera.position.set(0, 0, 280);
    cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0x404040, 2));
    const pointLight = new THREE.PointLight(0xe1ff01, 1, 500);
    pointLight.position.set(50, 50, 100);
    scene.add(pointLight);
    const blueLight = new THREE.PointLight(0xb8d3d8, 0.8, 400);
    blueLight.position.set(-80, -50, 80);
    scene.add(blueLight);

    // Background dust
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(500 * 3);
    for (let i = 0; i < 500 * 3; i++) starPositions[i] = (Math.random() - 0.5) * 800;
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x4a4b47, size: 0.8, transparent: true, opacity: 0.45 });
    scene.add(new THREE.Points(starGeo, starMat));

    // Sort by HC descending so high-authority spawns first → dramatic reveal
    const sortedNodes = [...nodes].sort((a, b) => b.harmonic - a.harmonic);

    const simNodes: SimNode[] = [];
    const nodeGroup = new THREE.Group();
    scene.add(nodeGroup);

    sortedNodes.forEach((node, i) => {
      const angle1 = (2 * Math.PI * i) / sortedNodes.length;
      const angle2 = Math.random() * Math.PI;
      const radius = 90 + Math.random() * 50;
      const pos = new THREE.Vector3(
        Math.cos(angle1) * Math.sin(angle2) * radius,
        Math.cos(angle2) * radius * 0.6,
        Math.sin(angle1) * Math.sin(angle2) * radius
      );

      const baseSize = 2 + node.harmonic * 9 + Math.min(node.inDegree, 20) * 0.2;
      const color = getColor(node);
      const spawnFrame = SPAWN_START_FRAME + i * SPAWN_STAGGER;

      const geo = new THREE.SphereGeometry(baseSize, 14, 14);
      const mat = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.3,
        shininess: 80,
        transparent: true,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.scale.setScalar(0.01);
      mesh.userData = { nodeId: node.url };
      nodeGroup.add(mesh);

      const glowGeo = new THREE.SphereGeometry(baseSize * 1.8, 12, 12);
      const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.copy(pos);
      glow.scale.setScalar(0.01);
      nodeGroup.add(glow);

      // Labels for top HC nodes + orphans
      let label: THREE.Sprite | undefined;
      if (node.harmonic > 0.45 || node.isOrphan || i < 5) {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext("2d")!;
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.fillStyle = node.isOrphan ? "#ef4444" : node.tier === "high" ? "#e1ff01" : "#eeeade";
        ctx.textAlign = "center";
        const labelText = (urlPath(node.url) || "/").slice(0, 28);
        ctx.fillText(labelText, 128, 28);
        ctx.font = "13px system-ui";
        ctx.fillStyle = "#bfc0b6";
        const subline = node.isOrphan ? "ORPHAN" : `HC ${node.harmonic.toFixed(2)}`;
        ctx.fillText(subline, 128, 50);
        const tex = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0 });
        label = new THREE.Sprite(spriteMat);
        label.scale.set(28, 7, 1);
        label.position.copy(pos);
        label.position.y -= baseSize + 5;
        nodeGroup.add(label);
      }

      simNodes.push({ id: node.url, pos, vel: new THREE.Vector3(0, 0, 0), node, mesh, glow, label, spawnFrame, baseSize });
    });

    simNodesRef.current = simNodes;

    // Edges
    const edgePositions: number[] = [];
    edges.forEach((edge) => {
      const s = simNodes.find((n) => n.id === edge.source);
      const t = simNodes.find((n) => n.id === edge.target);
      if (!s || !t) return;
      edgePositions.push(s.pos.x, s.pos.y, s.pos.z, t.pos.x, t.pos.y, t.pos.z);
    });
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(edgePositions, 3));
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xb8d3d8,
      transparent: true,
      opacity: 0,
      linewidth: 1,
    });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    scene.add(edgeLines);
    edgeLinesRef.current = edgeLines;

    frameRef.current = 0;
    const easeOutBack = (t: number) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };

    function animate() {
      const frame = frameRef.current++;
      const sNodes = simNodesRef.current;

      sNodes.forEach((n) => {
        const t = Math.max(0, Math.min(1, (frame - n.spawnFrame) / SPAWN_EASE_FRAMES));
        if (t <= 0) {
          n.mesh.scale.setScalar(0.01);
          n.glow.scale.setScalar(0.01);
          (n.mesh.material as THREE.MeshPhongMaterial).opacity = 0;
          (n.glow.material as THREE.MeshBasicMaterial).opacity = 0;
          if (n.label) (n.label.material as THREE.SpriteMaterial).opacity = 0;
          return;
        }
        if (t >= 1) return;
        const eased = easeOutBack(t);
        n.mesh.scale.setScalar(Math.max(eased, 0.05));
        n.glow.scale.setScalar(Math.max(eased * 1.1, 0.05));
        (n.mesh.material as THREE.MeshPhongMaterial).opacity = 0.9 * t;
        (n.glow.material as THREE.MeshBasicMaterial).opacity = 0.08 * t;
        if (n.label) (n.label.material as THREE.SpriteMaterial).opacity = 0.85 * t;
      });
      sNodes.forEach((n) => {
        const t = (frame - n.spawnFrame) / SPAWN_EASE_FRAMES;
        if (t >= 1 && t < 2) {
          n.mesh.scale.setScalar(1);
          n.glow.scale.setScalar(1);
          (n.mesh.material as THREE.MeshPhongMaterial).opacity = 0.9;
          if (n.label) (n.label.material as THREE.SpriteMaterial).opacity = 0.85;
        }
      });

      if (frame <= EDGE_FADE_END) {
        const t = Math.max(0, Math.min(1, (frame - EDGE_FADE_START) / (EDGE_FADE_END - EDGE_FADE_START)));
        (edgeLines.material as THREE.LineBasicMaterial).opacity = EDGE_MAX_OPACITY * t;
      }

      if (frame < FORCE_SIM_END) {
        const alpha = 0.5 * Math.pow(0.98, frame);
        sNodes.forEach((n) => n.vel.add(n.pos.clone().multiplyScalar(-0.001)));
        for (let i = 0; i < sNodes.length; i++) {
          for (let j = i + 1; j < sNodes.length; j++) {
            const diff = sNodes[i].pos.clone().sub(sNodes[j].pos);
            const dist = diff.length() || 1;
            const force = diff.normalize().multiplyScalar((400 / (dist * dist)) * alpha);
            sNodes[i].vel.add(force);
            sNodes[j].vel.sub(force);
          }
        }
        edges.forEach((edge) => {
          const s = sNodes.find((n) => n.id === edge.source);
          const t = sNodes.find((n) => n.id === edge.target);
          if (!s || !t) return;
          const diff = t.pos.clone().sub(s.pos);
          const dist = diff.length() || 1;
          const force = diff.normalize().multiplyScalar((dist - 50) * 0.003 * alpha);
          s.vel.add(force);
          t.vel.sub(force);
        });
        sNodes.forEach((n) => {
          n.vel.multiplyScalar(0.8);
          n.pos.add(n.vel);
          n.mesh.position.copy(n.pos);
          n.glow.position.copy(n.pos);
          if (n.label) {
            n.label.position.copy(n.pos);
            n.label.position.y -= n.baseSize + 5;
          }
        });
        const positions = edgeLines.geometry.attributes.position as THREE.BufferAttribute;
        let idx = 0;
        edges.forEach((edge) => {
          const s = sNodes.find((n) => n.id === edge.source);
          const t = sNodes.find((n) => n.id === edge.target);
          if (!s || !t) return;
          positions.setXYZ(idx, s.pos.x, s.pos.y, s.pos.z);
          positions.setXYZ(idx + 1, t.pos.x, t.pos.y, t.pos.z);
          idx += 2;
        });
        positions.needsUpdate = true;
      }

      const rot = rotRef.current;
      if (rot.autoRotate) rot.y += 0.0018;
      const d = rot.dist;
      camera.position.x = Math.sin(rot.y) * Math.cos(rot.x) * d;
      camera.position.y = Math.sin(rot.x) * d;
      camera.position.z = Math.cos(rot.y) * Math.cos(rot.x) * d;
      camera.lookAt(0, 0, 0);

      // Pulse for orphans (problem highlight)
      sNodes.forEach((n) => {
        if (n.node.isOrphan) {
          const pulse = 0.06 + Math.sin(frame * 0.07) * 0.05;
          (n.glow.material as THREE.MeshBasicMaterial).opacity = pulse;
        }
      });

      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(animate);
    }

    animate();
    return () => {
      cancelAnimationFrame(animRef.current);
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [nodes, edges, size.w, size.h]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseRef.current.isDown = true;
    mouseRef.current.prevX = e.clientX;
    mouseRef.current.prevY = e.clientY;
    rotRef.current.autoRotate = false;
  }, []);
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (mouseRef.current.isDown) {
        const dx = e.clientX - mouseRef.current.prevX;
        const dy = e.clientY - mouseRef.current.prevY;
        rotRef.current.y += dx * 0.005;
        rotRef.current.x = Math.max(-1.2, Math.min(1.2, rotRef.current.x + dy * 0.005));
        mouseRef.current.prevX = e.clientX;
        mouseRef.current.prevY = e.clientY;
      }
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseVec.current.x = ((e.clientX - rect.left) / size.w) * 2 - 1;
      mouseVec.current.y = -((e.clientY - rect.top) / size.h) * 2 + 1;
    },
    [size.w, size.h]
  );
  const handleMouseUp = useCallback(() => {
    mouseRef.current.isDown = false;
  }, []);
  const handleClick = useCallback(() => {
    if (!cameraRef.current || !sceneRef.current) return;
    raycasterRef.current.setFromCamera(mouseVec.current, cameraRef.current);
    const meshes = simNodesRef.current.map((n) => n.mesh);
    const hits = raycasterRef.current.intersectObjects(meshes);
    if (hits.length > 0) {
      const id = hits[0].object.userData.nodeId;
      const sn = simNodesRef.current.find((n) => n.id === id);
      if (sn) setSelectedNode(sn.node);
    } else setSelectedNode(null);
  }, []);
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.08 : 0.92;
    rotRef.current.dist = Math.max(80, Math.min(700, rotRef.current.dist * factor));
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        ref={canvasContainerRef}
        className="rounded-2xl overflow-hidden cursor-grab border border-[var(--wldm-black)]"
        style={{ width: "100%", height: size.h, boxShadow: "4px 4px 0 var(--wldm-black)" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          mouseRef.current.isDown = false;
        }}
        onClick={handleClick}
        onWheel={handleWheel}
      />

      {/* Legend */}
      <div className="absolute top-3 left-3 flex gap-2 text-[11px] font-[family-name:var(--font-chakra-petch)] font-semibold uppercase tracking-wider">
        <span className="bg-[#2a2b29]/90 border border-[#4a4b47] rounded px-2 py-1 text-[#e1ff01]">● High HC</span>
        <span className="bg-[#2a2b29]/90 border border-[#4a4b47] rounded px-2 py-1 text-[#b8d3d8]">● Medium</span>
        <span className="bg-[#2a2b29]/90 border border-[#4a4b47] rounded px-2 py-1 text-[#bfc0b6]">● Low</span>
        <span className="bg-[#2a2b29]/90 border border-[#4a4b47] rounded px-2 py-1 text-red-400">● Orphan</span>
      </div>

      {/* Controls */}
      <div className="absolute bottom-3 left-3 flex gap-2 text-[10px] text-[#bfc0b6]">
        <span className="bg-[#2a2b29]/90 border border-[#4a4b47] rounded px-2 py-1">Drag · rotate</span>
        <span className="bg-[#2a2b29]/90 border border-[#4a4b47] rounded px-2 py-1">Scroll · zoom</span>
        <span className="bg-[#2a2b29]/90 border border-[#4a4b47] rounded px-2 py-1">Click · details</span>
        <button
          onClick={() => {
            rotRef.current.autoRotate = !rotRef.current.autoRotate;
          }}
          className="bg-[#2a2b29]/90 border border-[#4a4b47] rounded px-2 py-1 cursor-pointer hover:border-[#e1ff01] text-[#eeeade]"
        >
          Auto-rotate
        </button>
      </div>

      {/* Selected node panel */}
      {selectedNode && (
        <div className="absolute top-3 right-3 bg-[#2a2b29]/95 border border-[#4a4b47] rounded-lg p-4 max-w-xs backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-sm font-bold font-[family-name:var(--font-chakra-petch)]"
              style={{
                color: selectedNode.isOrphan
                  ? "#ef4444"
                  : selectedNode.tier === "high"
                  ? "#e1ff01"
                  : selectedNode.tier === "medium"
                  ? "#b8d3d8"
                  : "#bfc0b6",
              }}
            >
              {urlPath(selectedNode.url)}
            </span>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-[#bfc0b6] hover:text-[#eeeade] text-xs cursor-pointer ml-2"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-[#bfc0b6] mb-2 break-all">{selectedNode.title || "(no title)"}</p>
          <div className="space-y-1 text-xs text-[#bfc0b6]">
            <p>
              HC <span className="text-[#eeeade] font-semibold">{selectedNode.harmonic.toFixed(3)}</span>
            </p>
            <p>
              PageRank <span className="text-[#eeeade] font-semibold">{selectedNode.pagerank.toFixed(4)}</span>
            </p>
            <p>
              Links in/out <span className="text-[#eeeade] font-semibold">{selectedNode.inDegree} / {selectedNode.outDegree}</span>
            </p>
            <p>
              Cluster <span className="text-[#eeeade] capitalize">/{selectedNode.cluster}</span>
            </p>
            <p>
              Tier{" "}
              <span
                className="font-semibold uppercase"
                style={{
                  color: selectedNode.tier === "high" ? "#e1ff01" : selectedNode.tier === "medium" ? "#b8d3d8" : "#bfc0b6",
                }}
              >
                {selectedNode.tier}
                {selectedNode.isOrphan ? " · ORPHAN" : ""}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
