"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import * as THREE from "three";

function GameFallback() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-zinc-950">
      <div className="w-12 h-12 rounded-full border-4 border-pink-900 border-t-pink-400 animate-spin" />
    </main>
  );
}

interface Particle { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; }
interface Tracer { mesh: THREE.Mesh; life: number; }
interface Enemy { mesh: THREE.Group; orbitalRing: THREE.Mesh; health: number; maxHealth: number; velocity: THREE.Vector3; respawnTimer: number; }
interface NPC { mesh: THREE.Group; name: string; dialogues: string[]; currentDialogueIndex: number; }
interface Surface { x: number; z: number; y: number; w: number; d: number; h: number; }

// ── Map Constants ────────────────────────────────────────────────────────────
const MAP_SIZE = 120;
const STEP_UP_MAX = 0.55; // max height player can auto step-up in a single frame

// Platforms: y = box centre. topY = y + h/2.
const PLATFORMS: Surface[] = [
  { x:  0,  z: -10, y:  0.5, w:  8, d:  8, h: 1.0 }, // P1  topY=1.0
  { x:-15,  z: -20, y:  1.6, w:  8, d:  8, h: 1.2 }, // P2  topY=2.2
  { x:  0,  z: -30, y:  2.8, w: 10, d:  8, h: 1.4 }, // P3  topY=3.5
  { x: 15,  z: -20, y:  4.0, w:  8, d:  8, h: 1.6 }, // P4  topY=4.8
  { x: -8,  z:  12, y:  1.8, w:  8, d:  8, h: 1.0 }, // P6  topY=2.3
  { x: 10,  z:  16, y:  3.2, w:  8, d:  8, h: 1.2 }, // P7  topY=3.8
  { x:  0,  z:  28, y:  4.5, w: 12, d: 10, h: 1.5 }, // P8  topY=5.25
];

// Stairs: pillar blocks that rise from the scene floor (y=-0.5) to topY.
// Formula: h = topY + 0.5, centre_y = (topY - 0.5) / 2
// Every stair's topY is ≤ previous topY + STEP_UP_MAX so the player walks up seamlessly.
const STEPS: Surface[] = [
  // ── Stairway 1 : Ground → P1 (topY 1.0) ────────────────────────────────
  { x: 0, z: -5.0, y:-0.075, w:3.5, d:1.4, h:0.85 }, // top 0.35
  { x: 0, z: -6.5, y: 0.100, w:3.5, d:1.4, h:1.20 }, // top 0.70
  // Walk onto P1 (diff=0.30 ✓)

  // ── Stairway 2 : P1 → P2 (topY 2.2) ────────────────────────────────────
  { x: -4,  z:-13, y: 0.400, w:2.5, d:2.5, h:1.80 }, // top 1.30
  { x: -8,  z:-16, y: 0.550, w:2.5, d:2.5, h:2.10 }, // top 1.60
  { x:-11,  z:-18, y: 0.700, w:2.5, d:2.5, h:2.40 }, // top 1.90
  // Walk onto P2 (diff=0.30 ✓)

  // ── Stairway 3 : P2 → P3 (topY 3.5) ────────────────────────────────────
  { x:-10, z:-23, y: 1.000, w:2.5, d:2.5, h:3.00 }, // top 2.50
  { x: -6, z:-26, y: 1.200, w:2.5, d:2.5, h:3.40 }, // top 2.90
  { x: -2, z:-28, y: 1.375, w:2.5, d:2.5, h:3.75 }, // top 3.25
  // Walk onto P3 (diff=0.25 ✓)

  // ── Stairway 4 : P3 → P4 (topY 4.8) ────────────────────────────────────
  { x:  5, z:-28, y: 1.625, w:2.5, d:2.5, h:4.25 }, // top 3.75
  { x:  9, z:-25, y: 1.825, w:2.5, d:2.5, h:4.65 }, // top 4.15
  { x: 12, z:-22, y: 2.000, w:2.5, d:2.5, h:5.00 }, // top 4.50
  // Walk onto P4 (diff=0.30 ✓)

  // ── Stairway 5 : Ground → P6 (topY 2.3) ────────────────────────────────
  { x:-3, z: 5, y:-0.050, w:2.5, d:1.5, h:0.90 }, // top 0.40
  { x:-4, z: 7, y: 0.150, w:2.5, d:1.5, h:1.30 }, // top 0.80
  { x:-5, z: 9, y: 0.350, w:2.5, d:1.5, h:1.70 }, // top 1.20
  { x:-6, z:11, y: 0.575, w:2.5, d:1.5, h:2.15 }, // top 1.65
  { x:-7, z:12, y: 0.750, w:2.5, d:1.5, h:2.50 }, // top 2.00
  // Walk onto P6 (diff=0.30 ✓)

  // ── Stairway 6 : P6 → P7 (topY 3.8) ────────────────────────────────────
  { x:2, z:13, y:1.075, w:2.5, d:2.0, h:3.15 }, // top 2.65
  { x:5, z:14, y:1.275, w:2.5, d:2.0, h:3.55 }, // top 3.05
  { x:8, z:15, y:1.475, w:2.5, d:2.0, h:3.95 }, // top 3.45
  // Walk onto P7 (diff=0.35 ✓)

  // ── Stairway 7 : P7 → P8 (topY 5.25) ───────────────────────────────────
  { x: 8, z:18, y:1.825, w:2.5, d:2.0, h:4.65 }, // top 4.15
  { x: 5, z:21, y:2.025, w:2.5, d:2.0, h:5.05 }, // top 4.55
  { x: 2, z:24, y:2.200, w:2.5, d:2.0, h:5.40 }, // top 4.90
  // Walk onto P8 (diff=0.35 ✓)
];

// All walkable surfaces combined (used by getSurfaceHeight)
const ALL_SURFACES: Surface[] = [...PLATFORMS, ...STEPS];

interface WeaponConfig {
  name: string; cooldown: number; adsFov: number; recoil: number;
  automatic: boolean; aimable: boolean; shootSynthFreq: number; shootSynthType: OscillatorType;
}
const WEAPONS: WeaponConfig[] = [
  { name:"Blaster", cooldown:0.25, adsFov:48, recoil:0.06,  automatic:false, aimable:true,  shootSynthFreq:900,  shootSynthType:"sine"     },
  { name:"Minigun", cooldown:0.08, adsFov:70, recoil:0.025, automatic:true,  aimable:false, shootSynthFreq:750,  shootSynthType:"triangle"  },
  { name:"Sniper",  cooldown:1.5,  adsFov:15, recoil:0.22,  automatic:false, aimable:true,  shootSynthFreq:1100, shootSynthType:"sawtooth"  },
];

// ── Helper: highest surface Y under the player position ─────────────────────
function getSurfaceHeight(px: number, pz: number): number {
  let h = 0;
  const buf = 0.42;
  for (const s of ALL_SURFACES) {
    if (px > s.x - s.w/2 - buf && px < s.x + s.w/2 + buf &&
        pz > s.z - s.d/2 - buf && pz < s.z + s.d/2 + buf) {
      const top = s.y + s.h/2;
      if (top > h) h = top;
    }
  }
  return h;
}

// ── Build a glassmorphic surface mesh + neon edge outline ────────────────────
function addSurface(scene: THREE.Scene, s: Surface, color: number, edgeColor: number) {
  const geo = new THREE.BoxGeometry(s.w, s.h, s.d);
  const mat = new THREE.MeshPhysicalMaterial({
    color, emissive: 0x1a020e, roughness: 0.1, metalness: 0.1,
    transparent: true, opacity: 0.72, transmission: 0.5, thickness: 1.2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(s.x, s.y, s.z);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  scene.add(mesh);

  const edges = new THREE.EdgesGeometry(geo);
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.75 }));
  line.position.copy(mesh.position);
  scene.add(line);
}

function GameContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = searchParams.get("user") || "";

  const [points, setPoints]           = useState(0);
  const [shots, setShots]             = useState(0);
  const [timeLeft, setTimeLeft]       = useState(60);
  const [health, setHealth]           = useState(100);
  const [gameState, setGameState]     = useState<"start"|"playing"|"gameover"|"win">("start");
  const [isLocked, setIsLocked]       = useState(false);
  const [isAiming, setIsAiming]       = useState(false);
  const [redScreenFlash, setRedScreenFlash] = useState(false);
  const [activeWeaponIndex, setActiveWeaponIndex] = useState(0);
  const [npcDialogue, setNpcDialogue] = useState<string|null>(null);
  const [npcName, setNpcName]         = useState<string|null>(null);
  const [nearbyNpcPrompt, setNearbyNpcPrompt] = useState<string|null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const requestRef   = useRef<number|null>(null);

  const sceneRef    = useRef<THREE.Scene|null>(null);
  const cameraRef   = useRef<THREE.PerspectiveCamera|null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer|null>(null);
  const targetsGroupRef      = useRef<THREE.Group|null>(null);
  const gunGroupRef          = useRef<THREE.Group|null>(null);
  const blasterRef           = useRef<THREE.Group|null>(null);
  const minigunRef           = useRef<THREE.Group|null>(null);
  const minigunBarrelsRef    = useRef<THREE.Group|null>(null);
  const sniperRef            = useRef<THREE.Group|null>(null);
  const enemiesRef           = useRef<Enemy[]>([]);
  const npcsRef              = useRef<NPC[]>([]);

  // Physics
  const playerPositionYRef   = useRef(0);
  const playerVelocityYRef   = useRef(0);
  const isGroundedRef        = useRef(true);
  const horizontalVelocityRef= useRef(new THREE.Vector3());
  const bobTimeRef           = useRef(0);
  const landingShockRef      = useRef(0);

  // Input state
  const keysRef              = useRef({ w:false, a:false, s:false, d:false, shift:false, space:false, ctrl:false });
  const mouseMoveRef         = useRef({ movementX:0, movementY:0 });
  const isLockedRef          = useRef(false);
  const isAimingRef          = useRef(false);
  const leftClickHeldRef     = useRef(false);
  const activeWeaponIndexRef = useRef(0);
  const particlesRef         = useRef<Particle[]>([]);
  const tracersRef           = useRef<Tracer[]>([]);
  const gunRecoilRef         = useRef(0);
  const weaponCooldownRef    = useRef(0);
  const cameraKickRef        = useRef(0);
  const cameraTargetKickRef  = useRef(0);

  // ── Audio synth helpers ────────────────────────────────────────────────────
  const playTone = (freq: number, endFreq: number, type: OscillatorType, gainVal: number, dur: number) => {
    try {
      const A = window.AudioContext || (window as any).webkitAudioContext;
      if (!A) return;
      const ctx = new A();
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type  = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + dur);
      g.gain.setValueAtTime(gainVal, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch {}
  };

  const synthShootSound  = () => { const c = WEAPONS[activeWeaponIndexRef.current]; playTone(c.shootSynthFreq, 150, c.shootSynthType, c.name==="Minigun"?0.07:0.15, 0.15); };
  const synthHitSound    = () => { playTone(523, 1047, "sine", 0.20, 0.28); playTone(659, 1319, "triangle", 0.12, 0.28); };
  const synthDamageSound = () => { playTone(180, 50, "sawtooth", 0.25, 0.25); };
  const synthEndSound    = () => { playTone(220, 110, "sawtooth", 0.20, 0.5); };

  // ── Heart geometry ─────────────────────────────────────────────────────────
  const createHeartGeometry = () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(-2, 2.5, -6, 5.5, -6, 9);
    shape.bezierCurveTo(-6, 13.5, -1, 17, 3, 13.5);
    shape.bezierCurveTo(7, 17, 12, 13.5, 12, 9);
    shape.bezierCurveTo(12, 5.5, 8, 2.5, 5, 0);
    shape.bezierCurveTo(2.5, -2.5, 0, 0, 0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth:2, bevelEnabled:true, bevelSegments:3, steps:1, bevelSize:0.6, bevelThickness:0.6 });
    geo.center(); geo.scale(0.15, 0.15, 0.15);
    return geo;
  };

  // ── Pointer lock state ─────────────────────────────────────────────────────
  useEffect(() => {
    const onLock = () => {
      const active = document.pointerLockElement === canvasRef.current;
      setIsLocked(active);
      isLockedRef.current = active;
      if (!active) leftClickHeldRef.current = false;
    };
    document.addEventListener("pointerlockchange", onLock);
    return () => document.removeEventListener("pointerlockchange", onLock);
  }, []);

  const lockPointer = () => canvasRef.current?.requestPointerLock();

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== "playing") return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setGameState("gameover");
          synthEndSound();
          if (document.pointerLockElement === canvasRef.current) document.exitPointerLock();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState]);

  // ── Three.js initialisation ────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080205);
    scene.fog = new THREE.FogExp2(0x080205, 0.022);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    camera.rotation.order = "YXZ";
    camera.position.set(0, 1.6, 0);
    cameraRef.current = camera;
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current!, antialias: true, powerPreference:"high-performance" });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    // Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE), new THREE.MeshPhongMaterial({ color:0x0a0308, shininess:30 }));
    floor.rotation.x = -Math.PI/2; floor.position.y = -0.5; floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(MAP_SIZE, MAP_SIZE, 0xf43f5e, 0x1e1b4b);
    grid.position.y = -0.48; scene.add(grid);

    // Platforms (hot pink)
    PLATFORMS.forEach(p => addSurface(scene, p, 0xec4899, 0xff66cc));
    // Stairs (slightly darker magenta)
    STEPS.forEach(s => addSurface(scene, s, 0xbe185d, 0xff44aa));

    // Boundary walls
    const wallGeo = (w: number, d: number) => new THREE.BoxGeometry(w, 12, d);
    const wallMat = new THREE.MeshPhongMaterial({ color:0x15030f });
    const wL = new THREE.Mesh(wallGeo(1, MAP_SIZE), wallMat); wL.position.set(-MAP_SIZE/2, 5.5, 0); scene.add(wL);
    const wR = wL.clone(); wR.position.x = MAP_SIZE/2; scene.add(wR);
    const wB = new THREE.Mesh(wallGeo(MAP_SIZE, 1), wallMat); wB.position.set(0, 5.5, -MAP_SIZE/2); scene.add(wB);
    const wF = wB.clone(); wF.position.z = MAP_SIZE/2; scene.add(wF);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.42));
    const dir = new THREE.DirectionalLight(0xffd1e6, 1.2);
    dir.position.set(20, 40, 30); dir.castShadow = true;
    dir.shadow.mapSize.width = dir.shadow.mapSize.height = 1024;
    scene.add(dir);
    const pt = new THREE.PointLight(0xf43f5e, 2.0, 70);
    pt.position.set(0, 8, 0); scene.add(pt);

    // Heart targets
    const targetsGroup = new THREE.Group(); scene.add(targetsGroup); targetsGroupRef.current = targetsGroup;
    const heartGeo = createHeartGeometry();
    const heartMat = new THREE.MeshPhongMaterial({ color:0xf43f5e, emissive:0x47000d, shininess:120, specular:0xffffff });
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(heartGeo, heartMat);
      m.position.set((Math.random()-0.5)*(MAP_SIZE-10), 1.5+Math.random()*4.5, (Math.random()-0.5)*(MAP_SIZE-10));
      m.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
      m.castShadow = true; targetsGroup.add(m);
    }

    // Enemies
    enemiesRef.current = [];
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), new THREE.MeshPhongMaterial({ color: i%2===0?0x700c3b:0x420822, emissive:0x22010c, shininess:50 }));
      g.add(core);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color:0xff3385 }));
      ring.rotation.x = Math.PI/3; g.add(ring);
      const eyeGeo = new THREE.BoxGeometry(0.12, 0.06, 0.1);
      const eyeMat = new THREE.MeshBasicMaterial({ color:0xff003c });
      const eL = new THREE.Mesh(eyeGeo, eyeMat); eL.position.set(-0.3, 0.15, -0.65); eL.rotation.set(0, Math.PI/12, -Math.PI/12); g.add(eL);
      const eR = eL.clone(); eR.position.x = 0.3; eR.rotation.set(0, -Math.PI/12, Math.PI/12); g.add(eR);
      g.position.set((Math.random()>0.5?1:-1)*(20+Math.random()*25), 1.5, (Math.random()>0.5?1:-1)*(20+Math.random()*25));
      scene.add(g);
      enemiesRef.current.push({ mesh:g, orbitalRing:ring, health:4, maxHealth:4, velocity:new THREE.Vector3(), respawnTimer:0 });
    }

    // NPCs
    npcsRef.current = [];
    const makeNpc = (color1: number, color2: number, earGeo: THREE.BufferGeometry, earPos1: THREE.Vector3, earPos2: THREE.Vector3) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 12), new THREE.MeshPhongMaterial({ color: color1 }));
      body.position.y = 0.4; body.castShadow = true; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), new THREE.MeshPhongMaterial({ color: color2 }));
      head.position.y = 0.98; head.castShadow = true; g.add(head);
      const ear1 = new THREE.Mesh(earGeo, new THREE.MeshPhongMaterial({ color: color1 })); ear1.position.copy(earPos1); g.add(ear1);
      const ear2 = ear1.clone(); ear2.position.copy(earPos2); g.add(ear2);
      return g;
    };

    // Pipo (Teddy)
    const pipoEarGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const pipo = makeNpc(0xffa4b9, 0xffb8c8, pipoEarGeo, new THREE.Vector3(-0.28, 1.25, 0), new THREE.Vector3(0.28, 1.25, 0));
    pipo.position.set(-14, 2.2, -20); scene.add(pipo);
    npcsRef.current.push({ mesh:pipo, name:"Pipo the Teddy Bear", dialogues:[
      "Hi! Welcome to our dream world! Otávio wanted me to tell you that you are his favorite adventure companion.",
      "Walk up the pink step-blocks — they climb up automatically, no jumping needed!",
      "Switch weapons with keys [1], [2], [3]. Hold Right Click to aim (Sniper has a real scope overlay!)."
    ], currentDialogueIndex:0 });

    // Lulu (Bunny)
    const luluEarGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.38, 8);
    const lulu = makeNpc(0xffffff, 0xfffffa, luluEarGeo, new THREE.Vector3(-0.16, 1.22, 0), new THREE.Vector3(0.16, 1.22, 0));
    lulu.position.set(14, 4.8, -20); scene.add(lulu);
    npcsRef.current.push({ mesh:lulu, name:"Lulu the Bunny", dialogues:[
      "You made it all the way up here! Otávio told me he loves you more than all the stars in the sky.",
      "The Minigun fires automatically — just hold Left Click. It cannot aim but the fire rate is wild!",
      "The Sniper zooms in extremely close. Right-click for the full scope overlay and get that long-range kill!"
    ], currentDialogueIndex:0 });

    // ── Weapon Gun Models attached to camera ──────────────────────────────────
    // IMPORTANT: NO rotation.y = Math.PI  – that flips all faces backward, making guns invisible.
    // In camera-local space -Z is forward. Gun body's +Z face (nearest to camera) is what you see.

    const gunGroup = new THREE.Group();
    // Set the initial rest position immediately so the gun is visible on frame 1
    gunGroup.position.set(0.20, -0.18, -0.35);
    camera.add(gunGroup);
    gunGroupRef.current = gunGroup;

    // ── Blaster (Weapon 1) ────────────────────────────────────────────────────
    const blaster = new THREE.Group();
    // Body – wide, visible from the back
    const bBody = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.10, 0.28), new THREE.MeshPhongMaterial({ color:0xff77aa, emissive:0x220010, shininess:90 }));
    blaster.add(bBody);
    // Barrel – positioned slightly up and sticking out forward
    const bBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22), new THREE.MeshPhongMaterial({ color:0xf43f5e, emissive:0x440008, shininess:110 }));
    bBarrel.rotation.x = Math.PI/2; bBarrel.position.set(0, 0.025, -0.24); blaster.add(bBarrel);
    // Handle
    const bHandle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.06), new THREE.MeshPhongMaterial({ color:0xdb2777 }));
    bHandle.rotation.x = -Math.PI/8; bHandle.position.set(0, -0.10, 0.08); blaster.add(bHandle);
    // Glowing side emitter vents
    const bVentL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.16), new THREE.MeshBasicMaterial({ color:0xff66cc }));
    bVentL.position.set(-0.078, 0.015, -0.06); blaster.add(bVentL);
    const bVentR = bVentL.clone(); bVentR.position.x = 0.078; blaster.add(bVentR);
    // Scope bump on top
    const bScope = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.10, 8), new THREE.MeshPhongMaterial({ color:0xffeeff, shininess:120 }));
    bScope.rotation.x = Math.PI/2; bScope.position.set(0, 0.07, -0.10); blaster.add(bScope);

    gunGroup.add(blaster);
    blasterRef.current = blaster;

    // ── Minigun (Weapon 2) ────────────────────────────────────────────────────
    const minigun = new THREE.Group(); minigun.visible = false;
    // Thick body frame
    const mBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.30), new THREE.MeshPhongMaterial({ color:0xe879f9, emissive:0x1a0021, shininess:80 }));
    mBody.position.z = 0.04; minigun.add(mBody);
    // Top grip
    const mGrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), new THREE.MeshPhongMaterial({ color:0x701a75 }));
    mGrip.position.set(0, 0.13, 0.06); minigun.add(mGrip);
    // Rotating barrel cluster
    const barrelsGroup = new THREE.Group(); barrelsGroup.position.z = -0.08; minigun.add(barrelsGroup);
    minigunBarrelsRef.current = barrelsGroup;
    for (let j = 0; j < 6; j++) {
      const angle = (j/6)*Math.PI*2;
      const bCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.30, 6), new THREE.MeshPhongMaterial({ color:0xff66cc, shininess:90 }));
      bCyl.rotation.x = Math.PI/2; bCyl.position.set(Math.cos(angle)*0.055, Math.sin(angle)*0.055, -0.14); barrelsGroup.add(bCyl);
    }

    gunGroup.add(minigun);
    minigunRef.current = minigun;

    // ── Sniper (Weapon 3) ─────────────────────────────────────────────────────
    const sniper = new THREE.Group(); sniper.visible = false;
    // Long body
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.40), new THREE.MeshPhongMaterial({ color:0xa21caf, emissive:0x0a000f, shininess:90 }));
    sniper.add(sBody);
    // Buttstock
    const sStock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.22), new THREE.MeshPhongMaterial({ color:0x701a75 }));
    sStock.position.set(0, -0.03, 0.26); sniper.add(sStock);
    // Long thin barrel
    const sBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.54, 6), new THREE.MeshPhongMaterial({ color:0xf43f5e, shininess:120 }));
    sBarrel.rotation.x = Math.PI/2; sBarrel.position.set(0, 0.018, -0.44); sniper.add(sBarrel);
    // Scope tube on top
    const sTube = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.22, 8), new THREE.MeshPhongMaterial({ color:0xffffff, shininess:110 }));
    sTube.rotation.x = Math.PI/2; sTube.position.set(0, 0.082, -0.06); sniper.add(sTube);
    // Scope lens ring
    const sLens = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.015, 8), new THREE.MeshBasicMaterial({ color:0x88eeff }));
    sLens.rotation.x = Math.PI/2; sLens.position.set(0, 0.082, -0.175); sniper.add(sLens);

    gunGroup.add(sniper);
    sniperRef.current = sniper;

    // ── Input event listeners ──────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.ctrlKey && k === "w") { e.preventDefault(); }    // prevent Ctrl+W closing tab
      if (k === "w") keysRef.current.w = true;
      if (k === "a") keysRef.current.a = true;
      if (k === "s") keysRef.current.s = true;
      if (k === "d") keysRef.current.d = true;
      if (e.key === " ") keysRef.current.space = true;
      if (e.key === "Shift") keysRef.current.shift = true;
      if (k === "c" || e.key === "Control") keysRef.current.ctrl = true;
      if (k === "e") handleNpcInteraction();
      if (k === "1") switchWeapon(0);
      if (k === "2") switchWeapon(1);
      if (k === "3") switchWeapon(2);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "w") keysRef.current.w = false;
      if (k === "a") keysRef.current.a = false;
      if (k === "s") keysRef.current.s = false;
      if (k === "d") keysRef.current.d = false;
      if (e.key === " ") keysRef.current.space = false;
      if (e.key === "Shift") keysRef.current.shift = false;
      if (k === "c" || e.key === "Control") keysRef.current.ctrl = false;
    };
    const onMouseMove = (e: MouseEvent) => { if (!isLockedRef.current) return; mouseMoveRef.current.movementX += e.movementX; mouseMoveRef.current.movementY += e.movementY; };
    const onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvasRef.current) return;
      if (e.button === 0) {
        leftClickHeldRef.current = true;
        if (!WEAPONS[activeWeaponIndexRef.current].automatic) handleFire();
      } else if (e.button === 2) {
        if (WEAPONS[activeWeaponIndexRef.current].aimable) { isAimingRef.current = true; setIsAiming(true); }
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) leftClickHeldRef.current = false;
      else if (e.button === 2) { isAimingRef.current = false; setIsAiming(false); }
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("resize", onResize);
      rendererRef.current?.dispose();
    };
  }, [gameState]);

  const handleNpcInteraction = () => {
    if (!cameraRef.current) return;
    let closest: NPC|null = null; let minD = 3.8;
    npcsRef.current.forEach(npc => { const d = cameraRef.current!.position.distanceTo(npc.mesh.position); if (d < minD) { minD = d; closest = npc; } });
    if (closest) {
      const n = closest as NPC;
      setNpcName(n.name); setNpcDialogue(n.dialogues[n.currentDialogueIndex]);
      n.currentDialogueIndex = (n.currentDialogueIndex + 1) % n.dialogues.length;
    }
  };
  const handleCloseDialogue = () => { setNpcDialogue(null); setNpcName(null); lockPointer(); };

  const switchWeapon = (index: number) => {
    if (index === activeWeaponIndexRef.current || gameState !== "playing") return;
    isAimingRef.current = false; setIsAiming(false);
    activeWeaponIndexRef.current = index; setActiveWeaponIndex(index);
    weaponCooldownRef.current = 0.35;
    if (blasterRef.current) blasterRef.current.visible = index === 0;
    if (minigunRef.current) minigunRef.current.visible = index === 1;
    if (sniperRef.current)  sniperRef.current.visible  = index === 2;
  };

  const triggerDamageFlash = () => { setRedScreenFlash(true); setTimeout(() => setRedScreenFlash(false), 220); };

  const triggerExplosion = (point: THREE.Vector3, isEnemy: boolean) => {
    if (!sceneRef.current) return;
    const colors = isEnemy ? [0x5b0e2d, 0x1f030e, 0x8a1643, 0xff0055] : [0xf43f5e, 0xff66cc, 0xffffff];
    const pGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    for (let i = 0; i < (isEnemy?30:15); i++) {
      const pMat = new THREE.MeshBasicMaterial({ color: colors[i%colors.length], transparent:true });
      const pm = new THREE.Mesh(pGeo, pMat);
      pm.position.copy(point); sceneRef.current.add(pm);
      particlesRef.current.push({ mesh:pm, velocity: new THREE.Vector3((Math.random()-0.5)*7, Math.random()*5+1, (Math.random()-0.5)*7), life:1.0 });
    }
  };

  const createBulletTracer = (hitPoint: THREE.Vector3) => {
    if (!sceneRef.current || !cameraRef.current) return;
    const cam = cameraRef.current;
    const start = cam.position.clone().add(new THREE.Vector3(isAimingRef.current?0:0.18, -0.12, -0.35).applyEuler(cam.rotation));
    const dist = start.distanceTo(hitPoint);
    const geo = new THREE.CylinderGeometry(0.008, 0.008, dist, 4);
    geo.rotateX(Math.PI/2);
    const mat = new THREE.MeshBasicMaterial({ color:0xff66cc, transparent:true, opacity:0.9 });
    const tm = new THREE.Mesh(geo, mat);
    tm.position.copy(start).add(hitPoint).multiplyScalar(0.5);
    tm.lookAt(hitPoint);
    sceneRef.current.add(tm);
    tracersRef.current.push({ mesh:tm, life:0.10 });
  };

  const handleFire = () => {
    if (gameState!=="playing" || !isLockedRef.current || npcDialogue!==null || weaponCooldownRef.current>0) return;
    const config = WEAPONS[activeWeaponIndexRef.current];
    synthShootSound();
    setShots(p => p+1);
    weaponCooldownRef.current = config.cooldown;
    gunRecoilRef.current = config.recoil;
    cameraTargetKickRef.current = isAimingRef.current ? config.recoil*0.25 : config.recoil*0.6;
    if (!cameraRef.current || !targetsGroupRef.current) return;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), cameraRef.current);
    const targets = targetsGroupRef.current.children;
    const enemyMeshes = enemiesRef.current.filter(e => e.respawnTimer<=0).map(e => e.mesh);
    const hits = raycaster.intersectObjects([...targets, ...enemyMeshes], true);
    const hitPoint = new THREE.Vector3();
    if (hits.length > 0) {
      const hit = hits[0]; hitPoint.copy(hit.point);
      const hitTarget = targets.find(t => t===hit.object || t.children.includes(hit.object));
      const hitEnemy  = enemiesRef.current.find(e => e.mesh===hit.object || e.mesh.children.includes(hit.object) || e.mesh.children.some(c => c.children?.includes(hit.object)));
      if (hitTarget) {
        synthHitSound(); triggerExplosion(hit.point, false); setPoints(p => p+100);
        hitTarget.position.set((Math.random()-0.5)*(MAP_SIZE-20), 1.5+Math.random()*4.5, (Math.random()-0.5)*(MAP_SIZE-20));
        hitTarget.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
      } else if (hitEnemy) {
        synthHitSound();
        hitEnemy.health -= config.name==="Sniper" ? 2 : 1;
        triggerExplosion(hit.point, true);
        if (hitEnemy.health <= 0) {
          setPoints(p => p+250); triggerExplosion(hitEnemy.mesh.position, true);
          hitEnemy.respawnTimer = 4.0; hitEnemy.mesh.position.set(9999, -9999, 9999);
        }
      }
    } else {
      hitPoint.copy(cameraRef.current.position).addScaledVector(raycaster.ray.direction, 50);
    }
    createBulletTracer(hitPoint);
  };

  const handleCanvasClick = () => {
    if (gameState==="start") {
      setGameState("playing"); setPoints(0); setHealth(100); setTimeLeft(60);
      setActiveWeaponIndex(0); activeWeaponIndexRef.current = 0;
      playerPositionYRef.current = 0; playerVelocityYRef.current = 0;
      isGroundedRef.current = true; horizontalVelocityRef.current.set(0,0,0);
      lockPointer();
    } else if (gameState==="playing" && !isLocked) {
      lockPointer();
    }
  };

  // ── Main Animation Loop ────────────────────────────────────────────────────
  useEffect(() => {
    const clock = new THREE.Clock();

    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.1);

      if (sceneRef.current && cameraRef.current && rendererRef.current && gameState==="playing") {
        const camera  = cameraRef.current;
        const renderer = rendererRef.current;
        const gunGroup = gunGroupRef.current;

        // Weapon cooldown tick
        if (weaponCooldownRef.current > 0) weaponCooldownRef.current -= delta;

        // ── 1. Camera look (mouse) ─────────────────────────────────────────
        if (isLockedRef.current && npcDialogue===null) {
          const mv = mouseMoveRef.current;
          const sens = isAimingRef.current ? 0.0006 : 0.0018;
          camera.rotation.y -= mv.movementX * sens;
          camera.rotation.x = Math.max(-Math.PI/2.3, Math.min(Math.PI/2.3, camera.rotation.x - mv.movementY * sens));
          mv.movementX = mv.movementY = 0;
        }

        // Camera recoil kick decay
        if (cameraTargetKickRef.current > 0.001) {
          camera.rotation.x += cameraTargetKickRef.current;
          cameraKickRef.current += cameraTargetKickRef.current;
          cameraTargetKickRef.current = 0;
        }
        if (cameraKickRef.current > 0) {
          const rec = Math.min(cameraKickRef.current, delta*0.12);
          camera.rotation.x -= rec; cameraKickRef.current -= rec;
        }

        // ── 2. Horizontal movement & unified surface collision ─────────────
        const keys = keysRef.current;
        const isSneaking = keys.ctrl;

        // Target eye height (crouch)
        const targetEyeH = isSneaking ? 0.8 : 1.6;
        camera.position.y += (playerPositionYRef.current + targetEyeH - camera.position.y) * 12 * delta;

        // Walk speed
        let speed = 6.0;
        if (keys.shift && !isSneaking && isGroundedRef.current) speed = 9.8;
        else if (isSneaking) speed = 3.0;
        if (isAimingRef.current) speed *= 0.55;

        // Desired velocity (world space, yaw-rotated)
        const wish = new THREE.Vector3(
          (keys.d?1:0)-(keys.a?1:0), 0, (keys.s?1:0)-(keys.w?1:0)
        ).normalize().multiplyScalar(speed).applyEuler(new THREE.Euler(0, camera.rotation.y, 0));

        // Inertia
        const accel = isGroundedRef.current ? 12 : 3;
        horizontalVelocityRef.current.x += (wish.x - horizontalVelocityRef.current.x) * accel * delta;
        horizontalVelocityRef.current.z += (wish.z - horizontalVelocityRef.current.z) * accel * delta;

        const oldX = camera.position.x;
        const oldZ = camera.position.z;
        camera.position.x += horizontalVelocityRef.current.x * delta;
        camera.position.z += horizontalVelocityRef.current.z * delta;

        // Map boundary clamp
        const bl = MAP_SIZE/2 - 1.5;
        camera.position.x = Math.max(-bl, Math.min(bl, camera.position.x));
        camera.position.z = Math.max(-bl, Math.min(bl, camera.position.z));

        // ── Unified surface collision (step-up FIRST, then wall-block) ────
        //    This ensures stairs work without jumping.
        const playerY = playerPositionYRef.current;
        const buf = 0.46;

        for (const s of ALL_SURFACES) {
          const topY    = s.y + s.h / 2;
          const bottomY = s.y - s.h / 2;
          const xIn = camera.position.x > s.x - s.w/2 - buf && camera.position.x < s.x + s.w/2 + buf;
          const zIn = camera.position.z > s.z - s.d/2 - buf && camera.position.z < s.z + s.d/2 + buf;
          if (!xIn || !zIn) continue;

          const feetToTop = topY - playerY; // >0 means surface is above player feet

          if (feetToTop <= 0) {
            // Player is on top of or above this block – no collision needed
            continue;
          }

          if (feetToTop <= STEP_UP_MAX && isGroundedRef.current) {
            // AUTO STEP-UP: surface is within step-up range → lift player, no wall block
            playerPositionYRef.current = topY;
            continue;
          }

          // WALL BLOCK: surface too high to step over & player body intersects block
          if (playerY + 1.9 > bottomY) {
            // Try reverting X first
            camera.position.x = oldX;
            const xInAfter = camera.position.x > s.x - s.w/2 - buf && camera.position.x < s.x + s.w/2 + buf;
            // If still inside block (corner case) also revert Z
            if (xInAfter && zIn) {
              camera.position.z = oldZ;
            }
          }
        }

        // ── 3. Vertical physics ────────────────────────────────────────────
        const wasGrounded = isGroundedRef.current;

        if (!isGroundedRef.current) {
          // Gravity
          playerVelocityYRef.current -= 24 * delta;
          const impactVelocity = playerVelocityYRef.current;
          playerPositionYRef.current += playerVelocityYRef.current * delta;

          // Check landing on any surface
          const groundY = getSurfaceHeight(camera.position.x, camera.position.z);
          if (playerPositionYRef.current <= groundY) {
            playerPositionYRef.current = groundY;
            playerVelocityYRef.current = 0;
            isGroundedRef.current = true;
            // Landing shock proportional to fall speed
            if (!wasGrounded) {
              landingShockRef.current = -Math.min(0.22, Math.abs(impactVelocity) * 0.022);
            }
          }
        } else {
          // Grounded: snap to surface or detect walk-off edge
          const groundY = getSurfaceHeight(camera.position.x, camera.position.z);
          if (playerPositionYRef.current > groundY + 0.15) {
            // Walked off an edge – begin falling
            isGroundedRef.current = false;
            playerVelocityYRef.current = 0;
          } else {
            // Snap feet to whatever surface we're standing on
            playerPositionYRef.current = groundY;
          }

          // Jump
          if (keys.space && npcDialogue===null) {
            playerVelocityYRef.current = 8.5;
            isGroundedRef.current = false;
          }
        }

        // Landing shock dip decay
        if (Math.abs(landingShockRef.current) > 0.001) {
          landingShockRef.current += (0 - landingShockRef.current) * 9.5 * delta;
          camera.position.y += landingShockRef.current;
        }

        // View bobbing
        const spd = horizontalVelocityRef.current.length();
        if (isGroundedRef.current && spd > 0.1) {
          bobTimeRef.current += spd * delta * 1.5;
          camera.position.x += Math.cos(bobTimeRef.current * 0.5) * 0.022;
          camera.position.y += Math.sin(bobTimeRef.current) * 0.034;
        }

        // ── 4. Auto-fire (Minigun) ─────────────────────────────────────────
        const wCfg = WEAPONS[activeWeaponIndexRef.current];
        if (wCfg.automatic && leftClickHeldRef.current && weaponCooldownRef.current <= 0) handleFire();

        // ── 5. ADS FOV lerp ────────────────────────────────────────────────
        const targetFov = isAimingRef.current ? wCfg.adsFov : 70;
        if (Math.abs(camera.fov - targetFov) > 0.1) {
          camera.fov += (targetFov - camera.fov) * 15 * delta;
          camera.updateProjectionMatrix();
        }

        // ── 6. Gun position lerp & recoil ─────────────────────────────────
        if (gunGroup) {
          const aimX = isAimingRef.current ? 0.0 : 0.20;
          const aimY = isAimingRef.current ? -0.12 : -0.18;
          const restZ = -0.35;

          // Hide sniper model when scoped (replaced by overlay)
          gunGroup.visible = !(activeWeaponIndexRef.current === 2 && isAimingRef.current);

          gunGroup.position.x += (aimX - gunGroup.position.x) * 12 * delta;
          gunGroup.position.y += (aimY - gunGroup.position.y) * 12 * delta;

          if (gunRecoilRef.current > 0) {
            gunGroup.position.z = restZ + gunRecoilRef.current * 0.8;
            gunGroup.rotation.x = -gunRecoilRef.current * 3.0;
            gunRecoilRef.current -= delta * 0.55;
          } else {
            gunGroup.position.z += (restZ - gunGroup.position.z) * 14 * delta;
            gunGroup.rotation.x += (0 - gunGroup.rotation.x) * 14 * delta;
          }

          // Minigun barrel spin
          if (activeWeaponIndexRef.current === 1 && minigunBarrelsRef.current) {
            minigunBarrelsRef.current.rotation.z += (leftClickHeldRef.current && weaponCooldownRef.current > 0 ? 20 : 2) * delta;
          }
        }

        // ── 7. NPC proximity ──────────────────────────────────────────────
        let prompt: string|null = null;
        npcsRef.current.forEach(npc => { if (camera.position.distanceTo(npc.mesh.position) < 3.2) prompt = `Press 'E' to talk to ${npc.name}`; });
        setNearbyNpcPrompt(prompt);

        // ── 8. Enemy AI ────────────────────────────────────────────────────
        const elapsed = clock.getElapsedTime();
        enemiesRef.current.forEach(enemy => {
          if (enemy.respawnTimer > 0) {
            enemy.respawnTimer -= delta;
            if (enemy.respawnTimer <= 0) {
              enemy.health = enemy.maxHealth;
              enemy.mesh.position.set((Math.random()>0.5?1:-1)*(20+Math.random()*25), 1.5, (Math.random()>0.5?1:-1)*(20+Math.random()*25));
            }
            return;
          }
          const ep = enemy.mesh.position;
          enemy.mesh.lookAt(camera.position.x, ep.y, camera.position.z);
          enemy.orbitalRing.rotation.x += delta*2.0; enemy.orbitalRing.rotation.y += delta*3.2;
          const sc = 1.0 + Math.sin(elapsed*4+enemy.mesh.id)*0.08; enemy.mesh.scale.set(sc,sc,sc);
          const dir = new THREE.Vector3().subVectors(camera.position, ep); dir.y=0; dir.normalize();
          ep.addScaledVector(dir, 2.2*delta);
          ep.y = 1.3 + Math.sin(elapsed*2+enemy.mesh.id)*0.2;
          if (camera.position.distanceTo(ep) < 1.4) {
            setHealth(prev => {
              if (prev <= 0) return 0;
              synthDamageSound(); triggerDamageFlash();
              const push = new THREE.Vector3().subVectors(camera.position, ep).setY(0).normalize().multiplyScalar(2.2);
              camera.position.add(push);
              const next = prev - 15;
              if (next <= 0) { setGameState("gameover"); synthEndSound(); if (document.pointerLockElement===canvasRef.current) document.exitPointerLock(); return 0; }
              return next;
            });
          }
        });

        // ── 9. Tracer lifespan ─────────────────────────────────────────────
        for (let i = tracersRef.current.length-1; i >= 0; i--) {
          const t = tracersRef.current[i]; t.life -= delta;
          if (t.life <= 0) { sceneRef.current?.remove(t.mesh); t.mesh.geometry.dispose(); (t.mesh.material as THREE.Material).dispose(); tracersRef.current.splice(i,1); }
          else { (t.mesh.material as THREE.MeshBasicMaterial).opacity = t.life / 0.1; }
        }

        // ── 10. Particle physics ───────────────────────────────────────────
        for (let i = particlesRef.current.length-1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.mesh.position.addScaledVector(p.velocity, delta);
          p.velocity.y -= 9.8*delta; p.life -= delta*0.95;
          if (p.life <= 0) { sceneRef.current?.remove(p.mesh); p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); particlesRef.current.splice(i,1); }
          else { (p.mesh.material as THREE.MeshBasicMaterial).opacity = p.life; }
        }

        // ── 11. Target bob & spin ──────────────────────────────────────────
        targetsGroupRef.current?.children.forEach((m, i) => {
          m.rotation.y += delta*(0.45+(i%3)*0.08); m.rotation.x += delta*0.18;
          m.position.y  += Math.sin(elapsed*1.5+i)*0.0035;
        });

        renderer.render(sceneRef.current!, camera);
      } else if (sceneRef.current && cameraRef.current && rendererRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [gameState, npcDialogue]);

  const handleResetGame = () => {
    setPoints(0); setShots(0); setHealth(100); setTimeLeft(60);
    setNpcDialogue(null); setNpcName(null);
    setActiveWeaponIndex(0); activeWeaponIndexRef.current = 0;
    setGameState("playing");
    playerPositionYRef.current = 0; playerVelocityYRef.current = 0;
    isGroundedRef.current = true; horizontalVelocityRef.current.set(0,0,0);
    setTimeout(lockPointer, 150);
  };
  const getAccuracy = () => shots===0 ? 0 : Math.round((points/(shots*100))*100);
  const getVictoryMessage = () => {
    if (health<=0) return "Game Over! Love always conquers – try again! 💖";
    if (user.toLowerCase().includes("agata")) return `Amazing, Ágata! You scored ${points} pts! Otávio loves you forever! 💖`;
    if (user.toLowerCase().includes("otavio")) return `Outstanding, Otávio! ${points} pts! Ágata loves you to infinity! 💖`;
    return `Incredible! ${points} points – you have amazing aim and a loving heart! 💖`;
  };

  return (
    <main className="h-screen w-screen relative bg-zinc-950 flex items-center justify-center font-sans overflow-hidden select-none">

      {/* 3D Canvas */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-crosshair">
        <canvas ref={canvasRef} onClick={handleCanvasClick} className="w-full h-full block focus:outline-none" />
      </div>

      {/* Sniper scope overlay */}
      {isAiming && activeWeaponIndex===2 && gameState==="playing" && (
        <div className="absolute inset-0 z-15 pointer-events-none flex items-center justify-center">
          <div className="absolute left-0 top-0 bottom-0 w-1/5 bg-black" />
          <div className="absolute right-0 top-0 bottom-0 w-1/5 bg-black" />
          <div className="w-[80vh] h-[80vh] rounded-full border-4 border-zinc-800 shadow-[0_0_0_2000px_rgba(0,0,0,0.87)] flex items-center justify-center relative overflow-hidden">
            <div className="absolute w-full h-px bg-black/80" />
            <div className="absolute h-full w-px bg-black/80" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 border border-red-600 rounded-full" />
            <div className="w-1.5 h-1.5 bg-red-600 rounded-full z-10" />
            <div className="absolute inset-0" style={{ background:"radial-gradient(circle, transparent 68%, rgba(0,0,0,0.45) 100%)" }} />
          </div>
        </div>
      )}

      {/* Damage red flash */}
      <div className={`absolute inset-0 bg-red-600/35 z-20 pointer-events-none transition-opacity duration-75 ${redScreenFlash?"opacity-100":"opacity-0"}`} />

      {/* HUD */}
      {gameState==="playing" && (
        <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6">
          {/* Top row */}
          <div className="flex justify-between items-start">
            <div className="bg-black/60 backdrop-blur-md border border-pink-500/25 px-5 py-3 rounded-2xl flex items-center gap-3">
              <svg className="w-5 h-5 fill-pink-500" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              <div><div className="text-[10px] uppercase font-bold text-pink-300 font-mono tracking-wider">Score</div><div className="text-xl font-black text-white">{points}</div></div>
            </div>
            <div className="bg-black/60 backdrop-blur-md border border-pink-500/25 px-5 py-3 rounded-2xl flex flex-col gap-1 w-44">
              <div className="flex justify-between text-[10px] uppercase font-bold text-pink-300 font-mono tracking-wider"><span>Health</span><span className="text-white">{health}%</span></div>
              <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden"><div style={{width:`${health}%`}} className="h-full bg-gradient-to-r from-red-500 via-pink-500 to-emerald-400 transition-all duration-200"/></div>
            </div>
            <div className="bg-black/60 backdrop-blur-md border border-pink-500/25 px-5 py-3 rounded-2xl flex items-center gap-3">
              <svg className="w-5 h-5 fill-none stroke-pink-500 stroke-2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <div><div className="text-[10px] uppercase font-bold text-pink-300 font-mono tracking-wider">Timer</div><div className={`text-xl font-black font-mono ${timeLeft<12?"text-rose-500 animate-pulse":"text-white"}`}>{timeLeft}s</div></div>
            </div>
          </div>

          {/* NPC prompt */}
          {nearbyNpcPrompt && !npcDialogue && (
            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 bg-black/85 border border-pink-500/30 px-5 py-3 rounded-2xl text-xs font-bold text-pink-300 animate-bounce pointer-events-auto">
              💬 {nearbyNpcPrompt}
            </div>
          )}

          {/* Crosshair */}
          {(!isAiming || activeWeaponIndex!==2) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative flex items-center justify-center">
                <div className={`rounded-full border border-pink-500 transition-all duration-300 ${isAiming?"w-8 h-8 bg-pink-500/10 border-dashed animate-spin-slow":"w-2.5 h-2.5 bg-pink-500 border-white/60 shadow-[0_0_8px_rgba(244,63,94,0.8)]"}`} />
                {!isAiming && (<>
                  <div className="absolute w-5 h-px bg-pink-500/40 -left-6"/><div className="absolute w-5 h-px bg-pink-500/40 -right-6"/>
                  <div className="absolute w-px h-5 bg-pink-500/40 -top-6"/><div className="absolute w-px h-5 bg-pink-500/40 -bottom-6"/>
                </>)}
              </div>
            </div>
          )}

          {/* Bottom bar */}
          <div className="w-full flex justify-between items-end pointer-events-auto">
            <div className="bg-black/60 backdrop-blur-md border border-pink-500/25 px-5 py-3 rounded-2xl flex items-center gap-3">
              <div><div className="text-[10px] uppercase font-bold text-pink-300 font-mono tracking-wider">Weapon</div><div className="text-sm font-black text-white uppercase">{WEAPONS[activeWeaponIndex].name}</div></div>
              <div className="flex gap-1.5 pl-2 border-l border-zinc-800">
                {[0,1,2].map(i => (
                  <button key={i} onClick={() => switchWeapon(i)} className={`w-7 h-7 rounded-lg text-xs font-bold font-mono border transition-all flex items-center justify-center ${activeWeaponIndex===i?"bg-pink-500 border-pink-400 text-white":"bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"}`}>{i+1}</button>
                ))}
              </div>
            </div>
            <div className="bg-black/55 px-5 py-2.5 rounded-xl border border-zinc-800 text-[10px] text-zinc-300 font-mono tracking-wide text-center leading-relaxed">
              WASD: Walk • Shift: Sprint • Space: Jump • Ctrl/C: Crouch • [1,2,3]: Swap weapons<br/>
              Right Click: Aim (Sniper=scope) • Left Click: Shoot (Minigun=full-auto)
            </div>
          </div>
        </div>
      )}

      {/* NPC Dialogue */}
      {npcDialogue && (
        <div className="absolute inset-x-0 bottom-[10%] z-20 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-zinc-900/95 border-2 border-pink-500/30 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-zoom-expand">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
              <span className="text-sm font-black text-pink-400 uppercase tracking-widest">{npcName}</span>
              <span className="text-[10px] text-zinc-500 font-mono">Dialogue</span>
            </div>
            <p className="text-sm text-zinc-100 font-serif leading-relaxed italic">"{npcDialogue}"</p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={handleNpcInteraction} className="px-4 py-2 border border-pink-500/20 hover:border-pink-500/40 text-pink-400 text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer">Next</button>
              <button onClick={handleCloseDialogue} className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all cursor-pointer">Close (E)</button>
            </div>
          </div>
        </div>
      )}

      {/* Start Screen */}
      {gameState==="start" && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-30 flex items-center justify-center p-6">
          <div className="w-full max-w-md p-8 rounded-3xl bg-zinc-900/90 border border-pink-500/25 shadow-2xl text-center space-y-6 animate-zoom-expand">
            <div className="w-16 h-16 mx-auto bg-pink-500/10 rounded-2xl border border-pink-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 fill-pink-500 animate-heartbeat-slow" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-pink-300 tracking-wider">CUPID'S 3D ARCADE</h1>
              <p className="text-xs text-zinc-400 leading-relaxed">Explore 3D platforms connected by staircases, fight gloom orbs, and talk to friendly NPCs!</p>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800 text-left space-y-2 max-h-52 overflow-y-auto">
              <h3 className="text-xs font-bold text-pink-400 uppercase font-mono">Controls</h3>
              <ul className="text-[11px] text-zinc-300 font-mono space-y-1 list-disc list-inside">
                <li><b className="text-white">W A S D</b> — Walk (inertia sliding)</li>
                <li><b className="text-white">Shift</b> — Sprint</li>
                <li><b className="text-white">Spacebar</b> — Jump</li>
                <li><b className="text-white">Ctrl / C</b> — Crouch</li>
                <li><b className="text-white">Pink Step Blocks</b> — Walk onto them to climb automatically</li>
                <li><b className="text-white">1, 2, 3</b> — Switch guns</li>
                <li><b className="text-white">Right Click</b> — Aim / Sniper scope</li>
                <li><b className="text-white">Left Click</b> — Fire (Minigun = hold)</li>
                <li><b className="text-white">E</b> — Talk to NPCs</li>
              </ul>
            </div>
            <button onClick={() => { setGameState("playing"); setTimeout(lockPointer, 150); }} className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-bold rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all cursor-pointer">
              Start Game
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState==="gameover" && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-30 flex items-center justify-center p-6">
          <div className="w-full max-w-lg p-8 rounded-3xl bg-zinc-900/90 border border-pink-500/25 shadow-2xl text-center space-y-6 animate-zoom-expand">
            <div className="w-16 h-16 mx-auto bg-pink-500/10 rounded-2xl border border-pink-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 fill-pink-400 animate-bounce" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v3c0 2.44 1.72 4.48 4 4.9V19H3v2h18v-2h-4v-4.1c2.28-.42 4-2.46 4-4.9V7c0-1.1-.9-2-2-2zm-12 5V7h2v3c0 .55-.45 1-1 1s-1-.45-1-1zm10 0c0 .55-.45 1-1 1s-1-.45-1-1V7h2v3z"/></svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-pink-300 uppercase tracking-widest">{health<=0?"You Died!":"Time's Up!"}</h1>
              <p className="text-sm font-serif italic text-zinc-100 px-2 leading-relaxed">"{getVictoryMessage()}"</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[["Score",points],["Shots",shots],["Accuracy",getAccuracy()+"%"]].map(([l,v]) => (
                <div key={l as string} className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                  <div className="text-[9px] uppercase font-bold text-zinc-500 font-mono">{l}</div>
                  <div className="text-base font-black text-white">{v}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button onClick={handleResetGame} className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold rounded-xl shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer">Play Again</button>
              <button onClick={() => router.push(`/welcome?user=${user}`)} className="flex-1 py-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-pink-500/20 text-pink-300 text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer">Back to Dashboard</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function GamePage() {
  return <Suspense fallback={<GameFallback />}><GameContent /></Suspense>;
}
