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

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

interface Tracer {
  mesh: THREE.Mesh;
  life: number;
}

interface Enemy {
  mesh: THREE.Group;
  orbitalRing: THREE.Mesh;
  health: number;
  maxHealth: number;
  velocity: THREE.Vector3;
  respawnTimer: number;
}

interface NPC {
  mesh: THREE.Group;
  name: string;
  dialogues: string[];
  currentDialogueIndex: number;
}

// Map dimensions & platform layout
const MAP_SIZE = 120;
const PLATFORMS = [
  { x: 0, z: -10, y: 0.5, w: 8, d: 8, h: 1 },       // Platform 1 (top surface at 1.0)
  { x: -15, z: -20, y: 1.6, w: 8, d: 8, h: 1.2 },   // Platform 2 (top surface at 2.2)
  { x: 0, z: -30, y: 2.8, w: 10, d: 8, h: 1.4 },    // Platform 3 (top surface at 3.5)
  { x: 15, z: -20, y: 4.0, w: 8, d: 8, h: 1.6 },    // Platform 4 (top surface at 4.8)
  { x: 0, z: -8, y: 5.2, w: 6, d: 6, h: 1.8 },      // Platform 5 (top surface at 6.1)
  { x: -8, z: 12, y: 1.8, w: 8, d: 8, h: 1 },       // Platform 6 (top surface at 2.3)
  { x: 10, z: 16, y: 3.2, w: 8, d: 8, h: 1.2 },     // Platform 7 (top surface at 3.8)
  { x: 0, z: 28, y: 4.5, w: 12, d: 10, h: 1.5 }     // High Platform (top surface at 5.25)
];

// Staircase step blocks to ease height navigation
const STEPS = [
  // Stairs leading from ground to Platform 1 (Y=1.0)
  { x: 0, z: -5.2, y: 0.15, w: 4, d: 1.2, h: 0.3 },
  { x: 0, z: -6.4, y: 0.45, w: 4, d: 1.2, h: 0.3 },
  { x: 0, z: -7.6, y: 0.75, w: 4, d: 1.2, h: 0.3 },

  // Steps leading from Platform 1 (Y=1.0) to Platform 2 (Y=2.2)
  { x: -5, z: -15, y: 0.65, w: 2.2, d: 2.2, h: 1.3 },
  { x: -10, z: -17, y: 0.88, w: 2.2, d: 2.2, h: 1.76 },

  // Steps leading from Platform 1 (Y=1.0) to Platform 4 (Y=4.8)
  { x: 5, z: -15, y: 0.9, w: 2.2, d: 2.2, h: 1.8 },
  { x: 8, z: -17, y: 1.35, w: 2.2, d: 2.2, h: 2.7 },
  { x: 11, z: -19, y: 1.85, w: 2.2, d: 2.2, h: 3.7 },

  // Steps leading from ground to High Platform (Y=5.25)
  { x: -5, z: 22, y: 0.75, w: 2.5, d: 2.5, h: 1.5 },
  { x: -5, z: 25, y: 1.5, w: 2.5, d: 2.5, h: 3.0 },
  { x: -5, z: 28, y: 2.25, w: 2.5, d: 2.5, h: 4.5 }
];

// Weapon parameters
interface WeaponConfig {
  name: string;
  cooldown: number; // in seconds
  adsFov: number;
  recoil: number;
  automatic: boolean;
  aimable: boolean;
  shootSynthFreq: number;
  shootSynthType: OscillatorType;
}

const WEAPONS: WeaponConfig[] = [
  {
    name: "Blaster",
    cooldown: 0.25,
    adsFov: 48,
    recoil: 0.06,
    automatic: false,
    aimable: true,
    shootSynthFreq: 900,
    shootSynthType: "sine"
  },
  {
    name: "Minigun",
    cooldown: 0.08,
    adsFov: 70, // No zoom / can't aim
    recoil: 0.025,
    automatic: true,
    aimable: false,
    shootSynthFreq: 750,
    shootSynthType: "triangle"
  },
  {
    name: "Sniper",
    cooldown: 1.5,
    adsFov: 15, // Scoped magnification
    recoil: 0.22,
    automatic: false,
    aimable: true,
    shootSynthFreq: 1100,
    shootSynthType: "sawtooth"
  }
];

function GameContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = searchParams.get("user") || "";

  // React State for HUD & Menu
  const [points, setPoints] = useState(0);
  const [shots, setShots] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [health, setHealth] = useState(100);
  const [gameState, setGameState] = useState<"start" | "playing" | "gameover" | "win">("start");
  const [isLocked, setIsLocked] = useState(false);
  const [isAiming, setIsAiming] = useState(false);
  const [redScreenFlash, setRedScreenFlash] = useState(false);
  const [activeWeaponIndex, setActiveWeaponIndex] = useState(0); // 0: Blaster, 1: Minigun, 2: Sniper

  // Dialog System State
  const [npcDialogue, setNpcDialogue] = useState<string | null>(null);
  const [npcName, setNpcName] = useState<string | null>(null);
  const [nearbyNpcPrompt, setNearbyNpcPrompt] = useState<string | null>(null);

  // References for WebGL Scene
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);

  // Three.js instances stored in refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const targetsGroupRef = useRef<THREE.Group | null>(null);
  const gunGroupRef = useRef<THREE.Group | null>(null);
  
  // Specific weapon mesh refs inside the camera holder
  const blasterRef = useRef<THREE.Group | null>(null);
  const minigunRef = useRef<THREE.Group | null>(null);
  const minigunBarrelsRef = useRef<THREE.Group | null>(null);
  const sniperRef = useRef<THREE.Group | null>(null);

  const enemiesRef = useRef<Enemy[]>([]);
  const npcsRef = useRef<NPC[]>([]);

  // Physics states
  const playerPositionYRef = useRef(0);
  const playerVelocityYRef = useRef(0);
  const isGroundedRef = useRef(true);
  const horizontalVelocityRef = useRef(new THREE.Vector3());
  
  // Advanced Camera feedback states
  const bobTimeRef = useRef(0);
  const landingShockRef = useRef(0);

  // Game simulation state refs
  const keysRef = useRef({ w: false, a: false, s: false, d: false, shift: false, space: false, ctrl: false });
  const mouseMoveRef = useRef({ movementX: 0, movementY: 0 });
  const isLockedRef = useRef(false);
  const isAimingRef = useRef(false);
  const leftClickHeldRef = useRef(false);
  const activeWeaponIndexRef = useRef(0);
  
  const particlesRef = useRef<Particle[]>([]);
  const tracersRef = useRef<Tracer[]>([]);
  const gunRecoilRef = useRef(0);
  const weaponCooldownRef = useRef(0);
  
  // Recoil kick offsets
  const cameraKickRef = useRef(0);
  const cameraTargetKickRef = useRef(0);

  // Sound Synth Helpers (Web Audio API)
  const synthShootSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      const config = WEAPONS[activeWeaponIndexRef.current];

      osc.type = config.shootSynthType;
      osc.frequency.setValueAtTime(config.shootSynthFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);
      
      gain.gain.setValueAtTime(config.name === "Minigun" ? 0.08 : 0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn(e);
    }
  };

  const synthHitSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.25);
      
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(1318.50, ctx.currentTime + 0.25);
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.3);
      osc2.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn(e);
    }
  };

  const synthDamageSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.25);
      
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      console.warn(e);
    }
  };

  const synthEndSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.5);
      
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn(e);
    }
  };

  // Helper to build a 3D Heart geometry
  const createHeartGeometry = () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(-2, 2.5, -6, 5.5, -6, 9);
    shape.bezierCurveTo(-6, 13.5, -1, 17, 3, 13.5);
    shape.bezierCurveTo(7, 17, 12, 13.5, 12, 9);
    shape.bezierCurveTo(12, 5.5, 8, 2.5, 5, 0);
    shape.bezierCurveTo(2.5, -2.5, 0, 0, 0, 0);

    const extrudeSettings = {
      depth: 2.0,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.6,
      bevelThickness: 0.6,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    geometry.scale(0.15, 0.15, 0.15);
    return geometry;
  };

  // Setup pointer-lock status monitoring
  useEffect(() => {
    const handleLockChange = () => {
      const active = document.pointerLockElement === canvasRef.current;
      setIsLocked(active);
      isLockedRef.current = active;
      
      if (!active) {
        leftClickHeldRef.current = false;
      }
    };
    
    document.addEventListener("pointerlockchange", handleLockChange);
    return () => {
      document.removeEventListener("pointerlockchange", handleLockChange);
    };
  }, []);

  // Request pointer lock
  const lockPointer = () => {
    if (canvasRef.current) {
      canvasRef.current.requestPointerLock();
    }
  };

  // Main Timer Effect
  useEffect(() => {
    if (gameState !== "playing") return;
    
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setGameState("gameover");
          synthEndSound();
          if (document.pointerLockElement === canvasRef.current) {
            document.exitPointerLock();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState]);

  // Three.js Scene Initialization
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080205);
    sceneRef.current = scene;

    scene.fog = new THREE.FogExp2(0x080205, 0.022);

    const camera = new THREE.PerspectiveCamera(
      70,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.rotation.order = "YXZ";
    camera.position.set(0, 1.6, 0); // Player eye height
    cameraRef.current = camera;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    // Floor (Grid + Material Helper)
    const floorGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
    const floorMat = new THREE.MeshPhongMaterial({
      color: 0x0a0308,
      shininess: 30,
      specular: 0x111111,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(MAP_SIZE, MAP_SIZE, 0xf43f5e, 0x1e1b4b);
    gridHelper.position.y = -0.48;
    scene.add(gridHelper);

    // Build Platform Meshes (Physical Glassmorphic Material + Glowing Neon Outlines)
    PLATFORMS.forEach((p) => {
      const pGeo = new THREE.BoxGeometry(p.w, p.h, p.d);
      const pMat = new THREE.MeshPhysicalMaterial({
        color: 0xec4899,
        emissive: 0x1e0310,
        roughness: 0.1,
        metalness: 0.1,
        transparent: true,
        opacity: 0.75,
        transmission: 0.5,
        thickness: 1.5,
      });

      const mesh = new THREE.Mesh(pGeo, pMat);
      mesh.position.set(p.x, p.y, p.z);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      scene.add(mesh);

      // Border outline
      const edges = new THREE.EdgesGeometry(pGeo);
      const borderLine = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0xff66cc, linewidth: 2 })
      );
      borderLine.position.copy(mesh.position);
      scene.add(borderLine);
    });

    // Build Staircase Steps (Slightly smaller, layered glass blocks with outlines)
    STEPS.forEach((s) => {
      const sGeo = new THREE.BoxGeometry(s.w, s.h, s.d);
      const sMat = new THREE.MeshPhysicalMaterial({
        color: 0xdb2777,
        emissive: 0x1a020e,
        roughness: 0.12,
        metalness: 0.1,
        transparent: true,
        opacity: 0.65,
        transmission: 0.55,
        thickness: 1.0,
      });

      const mesh = new THREE.Mesh(sGeo, sMat);
      mesh.position.set(s.x, s.y, s.z);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      scene.add(mesh);

      // Steps outlines
      const edges = new THREE.EdgesGeometry(sGeo);
      const borderLine = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0xff66cc, opacity: 0.6, transparent: true })
      );
      borderLine.position.copy(mesh.position);
      scene.add(borderLine);
    });

    // Outer walls
    const boundaryGeo = new THREE.BoxGeometry(1, 12, MAP_SIZE);
    const boundaryMat = new THREE.MeshPhongMaterial({ color: 0x15030f, shininess: 10 });
    const wallLeft = new THREE.Mesh(boundaryGeo, boundaryMat);
    wallLeft.position.set(-MAP_SIZE / 2, 5.5, 0);
    scene.add(wallLeft);

    const wallRight = wallLeft.clone();
    wallRight.position.x = MAP_SIZE / 2;
    scene.add(wallRight);

    const wallBack = new THREE.Mesh(new THREE.BoxGeometry(MAP_SIZE, 12, 1), boundaryMat);
    wallBack.position.set(0, 5.5, -MAP_SIZE / 2);
    scene.add(wallBack);

    const wallFront = wallBack.clone();
    wallFront.position.z = MAP_SIZE / 2;
    scene.add(wallFront);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.42);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffd1e6, 1.2);
    dirLight.position.set(20, 40, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xf43f5e, 2.0, 70);
    pointLight.position.set(0, 8, 0);
    scene.add(pointLight);

    // Target Group
    const targetsGroup = new THREE.Group();
    scene.add(targetsGroup);
    targetsGroupRef.current = targetsGroup;

    // Generate Floating Heart Targets
    const heartGeometry = createHeartGeometry();
    const heartMaterial = new THREE.MeshPhongMaterial({
      color: 0xf43f5e,
      emissive: 0x47000d,
      shininess: 120,
      specular: 0xffffff,
    });

    for (let i = 0; i < 18; i++) {
      const heartMesh = new THREE.Mesh(heartGeometry, heartMaterial);
      heartMesh.position.set(
        (Math.random() - 0.5) * (MAP_SIZE - 10),
        1.5 + Math.random() * 4.5,
        (Math.random() - 0.5) * (MAP_SIZE - 10)
      );
      heartMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      heartMesh.castShadow = true;
      targetsGroup.add(heartMesh);
    }

    // Spawn Hostile Core Orb Enemies
    enemiesRef.current = [];
    const orbColors = [0x700c3b, 0x420822];
    for (let i = 0; i < 5; i++) {
      const enemyGroup = new THREE.Group();
      
      const coreGeo = new THREE.SphereGeometry(0.7, 12, 12);
      const coreMat = new THREE.MeshPhongMaterial({
        color: orbColors[i % orbColors.length],
        emissive: 0x22010c,
        shininess: 50,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      enemyGroup.add(coreMesh);

      const ringGeo = new THREE.TorusGeometry(1.0, 0.05, 8, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3385 });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 3;
      enemyGroup.add(ringMesh);

      const eyeGeo = new THREE.BoxGeometry(0.12, 0.06, 0.1);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff003c });
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(-0.3, 0.15, -0.65);
      leftEye.rotation.y = Math.PI / 12;
      leftEye.rotation.z = -Math.PI / 12;
      enemyGroup.add(leftEye);

      const rightEye = leftEye.clone();
      rightEye.position.x = 0.3;
      rightEye.rotation.y = -Math.PI / 12;
      rightEye.rotation.z = Math.PI / 12;
      enemyGroup.add(rightEye);

      enemyGroup.position.set(
        (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 25),
        1.5,
        (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 25)
      );

      scene.add(enemyGroup);
      enemiesRef.current.push({
        mesh: enemyGroup,
        orbitalRing: ringMesh,
        health: 4,
        maxHealth: 4,
        velocity: new THREE.Vector3(),
        respawnTimer: 0
      });
    }

    // Spawn Cute Talkable NPCs
    npcsRef.current = [];

    // Teddy Pipo
    const pipoGroup = new THREE.Group();
    const pipoBody = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 12), new THREE.MeshPhongMaterial({ color: 0xffa4b9 }));
    pipoBody.position.set(0, 0.4, 0);
    pipoBody.castShadow = true;
    pipoGroup.add(pipoBody);

    const pipoHead = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), new THREE.MeshPhongMaterial({ color: 0xffb8c8 }));
    pipoHead.position.set(0, 0.98, 0);
    pipoHead.castShadow = true;
    pipoGroup.add(pipoHead);

    const pipoEarL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshPhongMaterial({ color: 0xff7b9a }));
    pipoEarL.position.set(-0.28, 1.25, 0);
    pipoGroup.add(pipoEarL);
    const pipoEarR = pipoEarL.clone();
    pipoEarR.position.x = 0.28;
    pipoGroup.add(pipoEarR);

    pipoGroup.position.set(-14, 2.2, -20); // Platform 2
    scene.add(pipoGroup);
    npcsRef.current.push({
      mesh: pipoGroup,
      name: "Pipo the Teddy Bear",
      dialogues: [
        "Hi! Welcome to our dream world! Otávio wanted me to tell you that you are his favorite adventure companion.",
        "Switch weapons using keys [1], [2], and [3]! Try the Minigun or Sniper!",
        "Sneak using Ctrl/C or sprint using Shift. Walk onto the steps of the staircases to climb up automatically!"
      ],
      currentDialogueIndex: 0
    });

    // Bunny Lulu
    const luluGroup = new THREE.Group();
    const luluBody = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), new THREE.MeshPhongMaterial({ color: 0xffffff }));
    luluBody.position.set(0, 0.35, 0);
    luluBody.castShadow = true;
    luluGroup.add(luluBody);

    const luluHead = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 12), new THREE.MeshPhongMaterial({ color: 0xfffffa }));
    luluHead.position.set(0, 0.85, 0);
    luluHead.castShadow = true;
    luluGroup.add(luluHead);

    const luluEarL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.38, 8), new THREE.MeshPhongMaterial({ color: 0xffeef2 }));
    luluEarL.position.set(-0.16, 1.22, 0);
    luluEarL.rotation.z = Math.PI / 16;
    luluGroup.add(luluEarL);
    const luluEarR = luluEarL.clone();
    luluEarR.position.x = 0.16;
    luluEarR.rotation.z = -Math.PI / 16;
    luluGroup.add(luluEarR);

    luluGroup.position.set(14, 4.8, -20); // Platform 4
    scene.add(luluGroup);
    npcsRef.current.push({
      mesh: luluGroup,
      name: "Lulu the Bunny",
      dialogues: [
        "Aha! You made it all the way up here to my platform! Otávio told me he loves you more than all the stars.",
        "The Minigun fires automatically just by holding Left Click, but it cannot aim down scope.",
        "The Sniper zooms in extreme magnification and deals high impact, but has a long bolt-action cooldown!"
      ],
      currentDialogueIndex: 0
    });

    // Camera Weapon attachment
    const gunGroup = new THREE.Group();
    camera.add(gunGroup);
    gunGroupRef.current = gunGroup;

    // --- GUN 0: Sleek Pink Blaster ---
    const blaster = new THREE.Group();
    const bBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.22), new THREE.MeshPhongMaterial({ color: 0xffb6c1, shininess: 90 }));
    blaster.add(bBody);
    const bBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14), new THREE.MeshPhongMaterial({ color: 0xf43f5e, emissive: 0x440008, shininess: 100 }));
    bBarrel.rotation.x = Math.PI / 2;
    bBarrel.position.set(0, 0, -0.13);
    blaster.add(bBarrel);
    const bHandle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.1, 0.045), new THREE.MeshPhongMaterial({ color: 0xdb2777 }));
    bHandle.rotation.x = -Math.PI / 6;
    bHandle.position.set(0, -0.07, 0.04);
    blaster.add(bHandle);
    // Side wings
    const bWingL = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.04, 0.12), new THREE.MeshBasicMaterial({ color: 0xff66cc }));
    bWingL.position.set(-0.04, 0.02, -0.04);
    blaster.add(bWingL);
    const bWingR = bWingL.clone();
    bWingR.position.x = 0.04;
    blaster.add(bWingR);

    blaster.position.set(0, 0, 0);
    blaster.rotation.y = Math.PI;
    gunGroup.add(blaster);
    blasterRef.current = blaster;

    // --- GUN 1: Minigun ---
    const minigun = new THREE.Group();
    const mBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.22), new THREE.MeshPhongMaterial({ color: 0xe879f9, shininess: 80 }));
    mBody.position.set(0, 0, 0.05);
    minigun.add(mBody);
    const mHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.05), new THREE.MeshPhongMaterial({ color: 0x701a75 }));
    mHandle.position.set(0, 0.09, 0.08);
    minigun.add(mHandle);

    const barrelsGroup = new THREE.Group();
    barrelsGroup.position.set(0, 0, -0.06);
    minigun.add(barrelsGroup);
    minigunBarrelsRef.current = barrelsGroup;

    const barrelCount = 6;
    const barrelRadius = 0.04;
    for (let j = 0; j < barrelCount; j++) {
      const angle = (j / barrelCount) * Math.PI * 2;
      const bCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.009, 0.009, 0.22, 6),
        new THREE.MeshPhongMaterial({ color: 0xff66cc, shininess: 90 })
      );
      bCyl.rotation.x = Math.PI / 2;
      bCyl.position.set(Math.cos(angle) * barrelRadius, Math.sin(angle) * barrelRadius, -0.11);
      barrelsGroup.add(bCyl);
    }
    
    minigun.position.set(0, 0, 0);
    minigun.rotation.y = Math.PI;
    gunGroup.add(minigun);
    minigunRef.current = minigun;
    minigun.visible = false;

    // --- GUN 2: Sniper ---
    const sniper = new THREE.Group();
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.08, 0.32), new THREE.MeshPhongMaterial({ color: 0xa21caf, shininess: 90 }));
    sniper.add(sBody);
    const sStock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.07, 0.18), new THREE.MeshPhongMaterial({ color: 0x701a75 }));
    sStock.position.set(0, -0.04, 0.2);
    sniper.add(sStock);
    const sBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.42, 6), new THREE.MeshPhongMaterial({ color: 0xf43f5e, shininess: 120 }));
    sBarrel.rotation.x = Math.PI / 2;
    sBarrel.position.set(0, 0.015, -0.34);
    sniper.add(sBarrel);
    
    const sScope = new THREE.Group();
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.16, 8), new THREE.MeshPhongMaterial({ color: 0xffffff }));
    scopeTube.rotation.x = Math.PI / 2;
    sScope.add(scopeTube);
    sScope.position.set(0, 0.065, -0.06);
    sniper.add(sScope);

    sniper.position.set(0, 0, 0);
    sniper.rotation.y = Math.PI;
    gunGroup.add(sniper);
    sniperRef.current = sniper;
    sniper.visible = false;

    // Input handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      // PREVENT TAB CLOSE SHORTCUTS (CTRL+W crouching and moving)
      if (e.ctrlKey && key === "w") {
        e.preventDefault();
      }

      if (key === "w") keysRef.current.w = true;
      if (key === "a") keysRef.current.a = true;
      if (key === "s") keysRef.current.s = true;
      if (key === "d") keysRef.current.d = true;
      if (e.key === " ") keysRef.current.space = true;
      if (e.key === "Shift") keysRef.current.shift = true;
      if (key === "c" || e.key === "Control") keysRef.current.ctrl = true;

      if (key === "e") {
        handleNpcInteraction();
      }

      if (key === "1") switchWeapon(0);
      if (key === "2") switchWeapon(1);
      if (key === "3") switchWeapon(2);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "w") keysRef.current.w = false;
      if (key === "a") keysRef.current.a = false;
      if (key === "s") keysRef.current.s = false;
      if (key === "d") keysRef.current.d = false;
      if (e.key === " ") keysRef.current.space = false;
      if (e.key === "Shift") keysRef.current.shift = false;
      if (key === "c" || e.key === "Control") keysRef.current.ctrl = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isLockedRef.current) return;
      mouseMoveRef.current.movementX += e.movementX;
      mouseMoveRef.current.movementY += e.movementY;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvasRef.current) return;
      
      if (e.button === 0) {
        leftClickHeldRef.current = true;
        const config = WEAPONS[activeWeaponIndexRef.current];
        if (!config.automatic) {
          handleFire();
        }
      } else if (e.button === 2) {
        const config = WEAPONS[activeWeaponIndexRef.current];
        if (config.aimable) {
          isAimingRef.current = true;
          setIsAiming(true);
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        leftClickHeldRef.current = false;
      } else if (e.button === 2) {
        isAimingRef.current = false;
        setIsAiming(false);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("resize", handleResize);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [gameState]);

  // Handle NPC dialog trigger
  const handleNpcInteraction = () => {
    if (!cameraRef.current) return;

    const playerPos = cameraRef.current.position;
    let closestNpc: NPC | null = null;
    let minDist = 3.8;

    npcsRef.current.forEach((npc) => {
      const npcPos = npc.mesh.position;
      const d = playerPos.distanceTo(npcPos);
      if (d < minDist) {
        minDist = d;
        closestNpc = npc;
      }
    });

    if (closestNpc) {
      const npc = closestNpc as NPC;
      setNpcName(npc.name);
      setNpcDialogue(npc.dialogues[npc.currentDialogueIndex]);
      npc.currentDialogueIndex = (npc.currentDialogueIndex + 1) % npc.dialogues.length;
    }
  };

  // Close Dialogue System
  const handleCloseDialogue = () => {
    setNpcDialogue(null);
    setNpcName(null);
    lockPointer();
  };

  // Weapon Switcher
  const switchWeapon = (index: number) => {
    if (index === activeWeaponIndexRef.current || gameState !== "playing") return;
    
    isAimingRef.current = false;
    setIsAiming(false);

    activeWeaponIndexRef.current = index;
    setActiveWeaponIndex(index);
    weaponCooldownRef.current = 0.35; // draw delay

    if (blasterRef.current) blasterRef.current.visible = index === 0;
    if (minigunRef.current) minigunRef.current.visible = index === 1;
    if (sniperRef.current) sniperRef.current.visible = index === 2;
  };

  // Trigger red flash when taking damage
  const triggerDamageFlash = () => {
    setRedScreenFlash(true);
    setTimeout(() => setRedScreenFlash(false), 220);
  };

  // Target explosion effects
  const triggerExplosion = (point: THREE.Vector3, isEnemy: boolean = false) => {
    if (!sceneRef.current) return;

    const pCount = isEnemy ? 30 : 15;
    const pGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const colors = isEnemy 
      ? [0x5b0e2d, 0x1f030e, 0x8a1643, 0xff0055]
      : [0xf43f5e, 0xff66cc, 0xffffff];

    for (let i = 0; i < pCount; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const pMat = new THREE.MeshBasicMaterial({ color, transparent: true });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      
      pMesh.position.copy(point);
      sceneRef.current.add(pMesh);

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * (isEnemy ? 8.0 : 6.0),
        Math.random() * (isEnemy ? 6.0 : 5.0) + 1.0,
        (Math.random() - 0.5) * (isEnemy ? 8.0 : 6.0)
      );

      particlesRef.current.push({
        mesh: pMesh,
        velocity,
        life: 1.0
      });
    }
  };

  // Bullet way tracer line renderer
  const createBulletTracer = (hitPoint: THREE.Vector3) => {
    if (!sceneRef.current || !cameraRef.current) return;

    const camera = cameraRef.current;
    
    const startPoint = new THREE.Vector3();
    startPoint.copy(camera.position);
    
    const sideOffset = new THREE.Vector3(
      isAimingRef.current ? 0.0 : 0.18, 
      -0.12, 
      -0.35
    ).applyEuler(camera.rotation);
    
    startPoint.add(sideOffset);

    const distance = startPoint.distanceTo(hitPoint);
    const tracerGeo = new THREE.CylinderGeometry(0.008, 0.008, distance, 4);
    tracerGeo.rotateX(Math.PI / 2);

    const tracerMat = new THREE.MeshBasicMaterial({
      color: 0xff66cc,
      transparent: true,
      opacity: 0.9,
    });
    const tracerMesh = new THREE.Mesh(tracerGeo, tracerMat);

    tracerMesh.position.copy(startPoint).add(hitPoint).multiplyScalar(0.5);
    tracerMesh.lookAt(hitPoint);

    sceneRef.current.add(tracerMesh);
    tracersRef.current.push({
      mesh: tracerMesh,
      life: 0.1
    });
  };

  // Raycast Firing Check
  const handleFire = () => {
    if (gameState !== "playing" || !isLockedRef.current || npcDialogue !== null || weaponCooldownRef.current > 0) return;

    const config = WEAPONS[activeWeaponIndexRef.current];

    synthShootSound();
    setShots((prev) => prev + 1);

    weaponCooldownRef.current = config.cooldown;

    gunRecoilRef.current = config.recoil;
    cameraTargetKickRef.current = isAimingRef.current ? config.recoil * 0.25 : config.recoil * 0.6;

    if (!cameraRef.current || !targetsGroupRef.current) return;

    const raycaster = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0);
    raycaster.setFromCamera(center, cameraRef.current);

    const targets = targetsGroupRef.current.children;
    const enemyMeshes = enemiesRef.current
      .filter((e) => e.respawnTimer <= 0)
      .map((e) => e.mesh);

    const shootableObjects = [...targets, ...enemyMeshes];
    const intersects = raycaster.intersectObjects(shootableObjects, true);

    const hitPoint = new THREE.Vector3();
    if (intersects.length > 0) {
      const hit = intersects[0];
      hitPoint.copy(hit.point);

      let hitTargetMesh = targets.find((t) => t === hit.object || t.children.includes(hit.object));
      let hitEnemy = enemiesRef.current.find((e) => 
        e.mesh === hit.object || 
        e.mesh.children.includes(hit.object) || 
        e.mesh.children.some(child => child.children?.includes(hit.object))
      );

      if (hitTargetMesh) {
        synthHitSound();
        triggerExplosion(hit.point, false);
        setPoints((prev) => prev + 100);

        hitTargetMesh.position.set(
          (Math.random() - 0.5) * (MAP_SIZE - 20),
          1.5 + Math.random() * 4.5,
          (Math.random() - 0.5) * (MAP_SIZE - 20)
        );
        hitTargetMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

      } else if (hitEnemy) {
        synthHitSound();
        const damage = config.name === "Sniper" ? 2 : 1;
        hitEnemy.health -= damage;

        triggerExplosion(hit.point, true);

        if (hitEnemy.health <= 0) {
          setPoints((prev) => prev + 250);
          triggerExplosion(hitEnemy.mesh.position, true);

          hitEnemy.respawnTimer = 4.0;
          hitEnemy.mesh.position.set(9999, -9999, 9999);
        }
      }
    } else {
      hitPoint.copy(cameraRef.current.position).addScaledVector(raycaster.ray.direction, 50);
    }

    createBulletTracer(hitPoint);
  };

  // Ground height calculation supporting Platforms and Stairs (automatic step-up check)
  const getSurfaceHeight = (px: number, pz: number) => {
    let maxHeight = 0;
    const buffer = 0.35; // margin

    // Check platforms
    for (const p of PLATFORMS) {
      const xMin = p.x - p.w / 2 - buffer;
      const xMax = p.x + p.w / 2 + buffer;
      const zMin = p.z - p.d / 2 - buffer;
      const zMax = p.z + p.d / 2 + buffer;

      if (px > xMin && px < xMax && pz > zMin && pz < zMax) {
        const topY = p.y + p.h / 2;
        if (topY > maxHeight) maxHeight = topY;
      }
    }

    // Check stairs / steps
    for (const s of STEPS) {
      const xMin = s.x - s.w / 2 - buffer;
      const xMax = s.x + s.w / 2 + buffer;
      const zMin = s.z - s.d / 2 - buffer;
      const zMax = s.z + s.d / 2 + buffer;

      if (px > xMin && px < xMax && pz > zMin && pz < zMax) {
        const topY = s.y + s.h / 2;
        if (topY > maxHeight) maxHeight = topY;
      }
    }

    return maxHeight;
  };

  // Main Simulation Loop
  useEffect(() => {
    const clock = new THREE.Clock();

    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.1);

      if (
        sceneRef.current &&
        cameraRef.current &&
        rendererRef.current &&
        gameState === "playing"
      ) {
        const camera = cameraRef.current;
        const targetsGroup = targetsGroupRef.current;
        const gunGroup = gunGroupRef.current;
        const renderer = rendererRef.current;

        if (weaponCooldownRef.current > 0) {
          weaponCooldownRef.current -= delta;
        }

        // --- 1. Mouse coordinate pans (FPS Camera Look) ---
        if (isLockedRef.current && npcDialogue === null) {
          const move = mouseMoveRef.current;
          
          const sens = isAimingRef.current ? 0.0006 : 0.0018;
          camera.rotation.y -= move.movementX * sens;
          
          const nextPitch = camera.rotation.x - move.movementY * sens;
          camera.rotation.x = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, nextPitch));
          
          move.movementX = 0;
          move.movementY = 0;
        }

        // Apply visual Recoil Kickback decay
        if (cameraTargetKickRef.current > 0.001) {
          camera.rotation.x += cameraTargetKickRef.current;
          cameraKickRef.current += cameraTargetKickRef.current;
          cameraTargetKickRef.current = 0;
        }
        
        if (cameraKickRef.current > 0) {
          const recovery = Math.min(cameraKickRef.current, delta * 0.12);
          camera.rotation.x -= recovery;
          cameraKickRef.current -= recovery;
        }

        // --- 2. MOVEMENT INERTIA, SNEAK, RUN, VIEW BOBBING & LANDING SHOCK ---
        const keys = keysRef.current;
        
        // Sneak camera Y crouch logic
        const isSneaking = keys.ctrl;
        const targetEyeHeight = isSneaking ? 0.8 : 1.6;
        const eyeLevelLerpSpeed = 12.0;

        // Smoothly interpolate vertical eye height
        camera.position.y += (playerPositionYRef.current + targetEyeHeight - camera.position.y) * eyeLevelLerpSpeed * delta;

        // Base walking speeds
        let currentWalkSpeed = 6.0;
        if (keys.shift && !isSneaking && isGroundedRef.current) {
          currentWalkSpeed = 9.8; // Sprint
        } else if (isSneaking) {
          currentWalkSpeed = 3.0; // Sneak
        }
        if (isAimingRef.current) {
          currentWalkSpeed *= 0.55; // ADS slowdown
        }

        const targetVector = new THREE.Vector3();
        if (keys.w) targetVector.z -= 1.0;
        if (keys.s) targetVector.z += 1.0;
        if (keys.a) targetVector.x -= 1.0;
        if (keys.d) targetVector.x += 1.0;

        targetVector.normalize().multiplyScalar(currentWalkSpeed);
        targetVector.applyEuler(new THREE.Euler(0, camera.rotation.y, 0));

        // Smooth horizontal velocity (Inertia physics slide)
        const accel = isGroundedRef.current ? 12.0 : 3.0;
        horizontalVelocityRef.current.x += (targetVector.x - horizontalVelocityRef.current.x) * accel * delta;
        horizontalVelocityRef.current.z += (targetVector.z - horizontalVelocityRef.current.z) * accel * delta;

        // Store old coordinates for slide collision
        const oldX = camera.position.x;
        const oldZ = camera.position.z;

        camera.position.x += horizontalVelocityRef.current.x * delta;
        camera.position.z += horizontalVelocityRef.current.z * delta;

        // Keep inside outer map bounds
        const boundaryLimit = (MAP_SIZE / 2) - 1.5;
        camera.position.x = Math.max(-boundaryLimit, Math.min(boundaryLimit, camera.position.x));
        camera.position.z = Math.max(-boundaryLimit, Math.min(boundaryLimit, camera.position.z));

        // Wall AABB collisions check for platforms (Slide block if feet are below platform Y surface)
        for (const p of PLATFORMS) {
          const topY = p.y + p.h / 2;
          const bottomY = p.y - p.h / 2;

          if (playerPositionYRef.current < topY - 0.25 && playerPositionYRef.current + 1.8 > bottomY) {
            const buffer = 0.55;
            const xMin = p.x - p.w / 2 - buffer;
            const xMax = p.x + p.w / 2 + buffer;
            const zMin = p.z - p.d / 2 - buffer;
            const zMax = p.z + p.d / 2 + buffer;

            if (camera.position.x > xMin && camera.position.x < xMax &&
                camera.position.z > zMin && camera.position.z < zMax) {
              camera.position.x = oldX;
              if (camera.position.x > xMin && camera.position.x < xMax &&
                  camera.position.z > zMin && camera.position.z < zMax) {
                camera.position.z = oldZ;
              }
            }
          }
        }

        // Wall AABB collisions check for stairs / step blocks
        for (const s of STEPS) {
          const topY = s.y + s.h / 2;
          const bottomY = s.y - s.h / 2;

          if (playerPositionYRef.current < topY - 0.25 && playerPositionYRef.current + 1.8 > bottomY) {
            const buffer = 0.55;
            const xMin = s.x - s.w / 2 - buffer;
            const xMax = s.x + s.w / 2 + buffer;
            const zMin = s.z - s.d / 2 - buffer;
            const zMax = s.z + s.d / 2 + buffer;

            if (camera.position.x > xMin && camera.position.x < xMax &&
                camera.position.z > zMin && camera.position.z < zMax) {
              camera.position.x = oldX;
              if (camera.position.x > xMin && camera.position.x < xMax &&
                  camera.position.z > zMin && camera.position.z < zMax) {
                camera.position.z = oldZ;
              }
            }
          }
        }

        // Apply Vertical Physics (Gravity & Platform/Stair step calculations)
        const wasGrounded = isGroundedRef.current;
        
        if (!isGroundedRef.current) {
          playerVelocityYRef.current -= 24 * delta;
          playerPositionYRef.current += playerVelocityYRef.current * delta;

          // Floor landing
          if (playerPositionYRef.current <= 0) {
            playerPositionYRef.current = 0;
            playerVelocityYRef.current = 0;
            isGroundedRef.current = true;
          }

          // Landing check on Platform or Stair Step
          if (playerVelocityYRef.current <= 0) {
            const currentSurfaceY = getSurfaceHeight(camera.position.x, camera.position.z);
            if (currentSurfaceY > 0) {
              if (playerPositionYRef.current >= currentSurfaceY - 0.3 && playerPositionYRef.current + playerVelocityYRef.current * delta <= currentSurfaceY + 0.15) {
                playerPositionYRef.current = currentSurfaceY;
                playerVelocityYRef.current = 0;
                isGroundedRef.current = true;
              }
            }
          }
        } else {
          // Grounded step-up and walk-off check
          const currentSurfaceY = getSurfaceHeight(camera.position.x, camera.position.z);
          const heightDiff = currentSurfaceY - playerPositionYRef.current;

          if (heightDiff > 0 && heightDiff <= 0.46) {
            // Walked onto a stair step block, step up automatically
            playerPositionYRef.current = currentSurfaceY;
          } else if (heightDiff < 0) {
            // Drop down smoothly or walk off edge
            if (heightDiff >= -0.46) {
              playerPositionYRef.current = currentSurfaceY;
            } else {
              // High fall, begin gravity drop
              isGroundedRef.current = false;
            }
          }

          // Jump Action trigger
          if (keys.space && npcDialogue === null) {
            playerVelocityYRef.current = 8.5;
            isGroundedRef.current = false;
          }
        }

        // Trigger landing view dip shock
        if (!wasGrounded && isGroundedRef.current) {
          landingShockRef.current = -Math.min(0.22, Math.abs(playerVelocityYRef.current) * 0.022);
        }
        
        // Decay landing shock back to rest
        if (Math.abs(landingShockRef.current) > 0.001) {
          landingShockRef.current += (0 - landingShockRef.current) * 9.5 * delta;
          camera.position.y += landingShockRef.current;
        }

        // View Bobbing
        const currentSpeed = horizontalVelocityRef.current.length();
        if (isGroundedRef.current && currentSpeed > 0.1) {
          bobTimeRef.current += currentSpeed * delta * 1.5;
          const bobX = Math.cos(bobTimeRef.current * 0.5) * 0.025;
          const bobY = Math.sin(bobTimeRef.current) * 0.038;
          
          camera.position.x += bobX;
          camera.position.y += bobY;
        }

        // --- 3. AUTOMATIC WEAPON HOLD TO FIRE LOOP (Minigun) ---
        const activeConfig = WEAPONS[activeWeaponIndexRef.current];
        if (activeConfig.automatic && leftClickHeldRef.current && weaponCooldownRef.current <= 0) {
          handleFire();
        }

        // --- 4. AIM DOWN SIGHTS (ADS) ZOOM LERP ---
        const targetFov = isAimingRef.current ? activeConfig.adsFov : 70;
        if (Math.abs(camera.fov - targetFov) > 0.1) {
          camera.fov += (targetFov - camera.fov) * 15 * delta;
          camera.updateProjectionMatrix();
        }

        // Slide gun alignment smoothly
        if (gunGroup) {
          const targetX = isAimingRef.current ? 0.0 : 0.18;
          const targetY = isAimingRef.current ? -0.11 : -0.15;
          const restZ = -0.32;
          
          if (activeWeaponIndexRef.current === 2 && isAimingRef.current) {
            gunGroup.visible = false;
          } else {
            gunGroup.visible = true;
          }

          gunGroup.position.x += (targetX - gunGroup.position.x) * 12 * delta;
          gunGroup.position.y += (targetY - gunGroup.position.y) * 12 * delta;

          // Apply recoil kick
          if (gunRecoilRef.current > 0) {
            gunGroup.position.z = restZ + gunRecoilRef.current;
            gunGroup.rotation.x = -gunRecoilRef.current * 2.5;
            gunRecoilRef.current -= delta * 0.45;
          } else {
            gunGroup.position.z += (restZ - gunGroup.position.z) * 15 * delta;
            gunGroup.rotation.x += (0 - gunGroup.rotation.x) * 15 * delta;
          }

          // Minigun barrel rotation animation
          if (activeWeaponIndexRef.current === 1 && minigunBarrelsRef.current) {
            const rotSpeed = leftClickHeldRef.current && weaponCooldownRef.current > 0 ? 18.0 : 2.0;
            minigunBarrelsRef.current.rotation.z += rotSpeed * delta;
          }
        }

        // --- 5. NPC PROXIMITY DETECTION ---
        let closestPrompt: string | null = null;
        npcsRef.current.forEach((npc) => {
          const npcPos = npc.mesh.position;
          const dist = camera.position.distanceTo(npcPos);
          if (dist < 3.2) {
            closestPrompt = `Press 'E' to talk to ${npc.name}`;
          }
        });
        setNearbyNpcPrompt(closestPrompt);

        // --- 6. HOSTILE ENEMY AI SIMULATION ---
        const elapsed = clock.getElapsedTime();
        const enemies = enemiesRef.current;
        enemies.forEach((enemy) => {
          if (enemy.respawnTimer > 0) {
            enemy.respawnTimer -= delta;
            if (enemy.respawnTimer <= 0) {
              enemy.health = enemy.maxHealth;
              enemy.mesh.position.set(
                (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 25),
                1.5,
                (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 25)
              );
            }
            return;
          }

          const enemyPos = enemy.mesh.position;
          
          enemy.mesh.lookAt(camera.position.x, enemyPos.y, camera.position.z);
          enemy.orbitalRing.rotation.x += delta * 2.0;
          enemy.orbitalRing.rotation.y += delta * 3.2;

          const coreScale = 1.0 + Math.sin(elapsed * 4.0 + enemy.mesh.id) * 0.08;
          enemy.mesh.scale.set(coreScale, coreScale, coreScale);

          const chaseSpeed = 2.2;
          const dir = new THREE.Vector3().subVectors(camera.position, enemyPos);
          dir.y = 0;
          dir.normalize();

          enemy.mesh.position.addScaledVector(dir, chaseSpeed * delta);
          enemy.mesh.position.y = 1.3 + Math.sin(elapsed * 2.0 + enemy.mesh.id) * 0.2;

          const distToPlayer = camera.position.distanceTo(enemyPos);
          if (distToPlayer < 1.4) {
            setHealth((prev) => {
              if (prev > 0) {
                synthDamageSound();
                triggerDamageFlash();
                const pushDir = new THREE.Vector3().subVectors(camera.position, enemyPos);
                pushDir.y = 0;
                pushDir.normalize().multiplyScalar(2.2);
                camera.position.add(pushDir);

                const nextHealth = prev - 15;
                if (nextHealth <= 0) {
                  setGameState("gameover");
                  synthEndSound();
                  if (document.pointerLockElement === canvasRef.current) {
                    document.exitPointerLock();
                  }
                  return 0;
                }
                return nextHealth;
              }
              return 0;
            });
          }
        });

        // --- 7. UPDATE BULLET TRACER LIFESPANS ---
        const tracers = tracersRef.current;
        for (let i = tracers.length - 1; i >= 0; i--) {
          const t = tracers[i];
          t.life -= delta;
          if (t.life <= 0) {
            sceneRef.current.remove(t.mesh);
            t.mesh.geometry.dispose();
            if (Array.isArray(t.mesh.material)) {
              t.mesh.material.forEach((m) => m.dispose());
            } else {
              t.mesh.material.dispose();
            }
            tracers.splice(i, 1);
          } else {
            const mat = t.mesh.material as THREE.MeshBasicMaterial;
            mat.opacity = t.life / 0.1;
          }
        }

        // --- 8. UPDATE EXPLOSION PARTICLE PHYSICS ---
        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.mesh.position.addScaledVector(p.velocity, delta);
          p.velocity.y -= 9.8 * delta;
          p.life -= delta * 0.95;

          if (p.life <= 0) {
            sceneRef.current.remove(p.mesh);
            p.mesh.geometry.dispose();
            if (Array.isArray(p.mesh.material)) {
              p.mesh.material.forEach((m) => m.dispose());
            } else {
              p.mesh.material.dispose();
            }
            particles.splice(i, 1);
          } else {
            const mat = p.mesh.material as THREE.MeshBasicMaterial;
            mat.opacity = p.life;
          }
        }

        // --- 9. TARGET BOB & SPIN ---
        if (targetsGroup) {
          targetsGroup.children.forEach((mesh, index) => {
            mesh.rotation.y += delta * (0.45 + (index % 3) * 0.08);
            mesh.rotation.x += delta * 0.18;
            mesh.position.y += Math.sin(elapsed * 1.5 + index) * 0.0035;
          });
        }

        // Render
        renderer.render(sceneRef.current, camera);
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [gameState, npcDialogue]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (gameState === "start") {
      setGameState("playing");
      setPoints(0);
      setHealth(100);
      setTimeLeft(60);
      setActiveWeaponIndex(0);
      activeWeaponIndexRef.current = 0;
      playerPositionYRef.current = 0;
      playerVelocityYRef.current = 0;
      isGroundedRef.current = true;
      horizontalVelocityRef.current.set(0, 0, 0);
      lockPointer();
    } else if (gameState === "playing") {
      if (!isLocked) {
        lockPointer();
      }
    }
  };

  const handleResetGame = () => {
    setPoints(0);
    setShots(0);
    setHealth(100);
    setTimeLeft(60);
    setNpcDialogue(null);
    setNpcName(null);
    setActiveWeaponIndex(0);
    activeWeaponIndexRef.current = 0;
    setGameState("playing");
    playerPositionYRef.current = 0;
    playerVelocityYRef.current = 0;
    isGroundedRef.current = true;
    horizontalVelocityRef.current.set(0, 0, 0);
    setTimeout(lockPointer, 150);
  };

  const getAccuracy = () => {
    if (shots === 0) return 0;
    return Math.round((points / (shots * 100)) * 100);
  };

  const getVictoryMessage = () => {
    if (health <= 0) {
      return "Game Over! You were overwhelmed by the gloom shadow clouds, but love always conquers! Try again to clean the map! 💖";
    }
    const isAgata = user.toLowerCase().includes("agata");
    const isOtavio = user.toLowerCase().includes("otavio");
    if (isAgata) {
      return `Amazing shooting, Ágata! You got ${points} points! You swept the Gloom clouds away. Otávio loves you forever and ever! 💖`;
    }
    if (isOtavio) {
      return `Outstanding, Otávio! You scored ${points} points! Ágata loves you to infinity and beyond! 💖`;
    }
    return `Incredible score! You finished with ${points} points. You have beautiful coordination and a loving heart! 💖`;
  };

  return (
    <main className="h-screen w-screen relative bg-zinc-950 flex items-center justify-center font-sans overflow-hidden select-none">
      
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-crosshair">
        <canvas 
          ref={canvasRef} 
          onClick={handleCanvasClick}
          className="w-full h-full block focus:outline-none" 
        />
      </div>

      {/* Full screen sniper scope overlay when aiming with sniper */}
      {isAiming && activeWeaponIndex === 2 && gameState === "playing" && (
        <div className="absolute inset-0 z-15 pointer-events-none flex items-center justify-center">
          <div className="absolute left-0 top-0 bottom-0 w-1/5 bg-black" />
          <div className="absolute right-0 top-0 bottom-0 w-1/5 bg-black" />
          
          <div className="w-[80vh] h-[80vh] max-w-full max-h-full rounded-full border-4 border-zinc-800 shadow-[0_0_0_2000px_rgba(0,0,0,0.85)] flex items-center justify-center relative overflow-hidden bg-transparent">
            <div className="absolute w-full h-0.5 bg-black/80" />
            <div className="absolute h-full w-0.5 bg-black/80" />
            
            <div className="w-1.5 h-1.5 bg-red-600 rounded-full z-10" />

            <div className="absolute inset-0 bg-radial-gradient" 
                 style={{
                   background: "radial-gradient(circle, transparent 70%, rgba(0,0,0,0.4) 100%)"
                 }} 
            />
          </div>
        </div>
      )}

      {/* Red screen flash when taking damage */}
      <div 
        className={`absolute inset-0 bg-red-600/30 z-20 pointer-events-none transition-opacity duration-75 ${
          redScreenFlash ? "opacity-100" : "opacity-0"
        }`} 
      />

      {/* Main HUD overlay visible during play */}
      {gameState === "playing" && (
        <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6">
          
          {/* Top HUD Row */}
          <div className="flex justify-between items-start">
            
            {/* Score & Points Panel */}
            <div className="bg-black/60 backdrop-blur-md border border-pink-500/25 px-5 py-3 rounded-2xl flex items-center gap-3">
              <svg className="w-5 h-5 fill-pink-500 animate-heartbeat-slow" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <div>
                <div className="text-[10px] uppercase font-bold text-pink-300 font-mono tracking-wider">Score Points</div>
                <div className="text-xl font-black text-white leading-none">{points}</div>
              </div>
            </div>

            {/* Health Bar HUD */}
            <div className="bg-black/60 backdrop-blur-md border border-pink-500/25 px-5 py-3 rounded-2xl flex flex-col gap-1 w-44">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold text-pink-300 font-mono tracking-wider">
                <span>Health</span>
                <span className="text-white">{health}%</span>
              </div>
              <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  style={{ width: `${health}%` }}
                  className="h-full bg-gradient-to-r from-red-500 via-pink-500 to-emerald-400 transition-all duration-200" 
                />
              </div>
            </div>

            {/* Timer Panel */}
            <div className="bg-black/60 backdrop-blur-md border border-pink-500/25 px-5 py-3 rounded-2xl flex items-center gap-3">
              <svg className="w-5 h-5 fill-none stroke-pink-500 stroke-2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="text-[10px] uppercase font-bold text-pink-300 font-mono tracking-wider">Timer</div>
                <div className={`text-xl font-black leading-none font-mono ${timeLeft < 12 ? 'text-rose-500 animate-pulse' : 'text-white'}`}>
                  {timeLeft}s
                </div>
              </div>
            </div>
          </div>

          {/* Dialog bubble overlay prompt when getting close to NPC */}
          {nearbyNpcPrompt && npcDialogue === null && (
            <div className="absolute top-[20%] left-1/2 transform -translate-x-1/2 bg-black/85 border border-pink-500/30 px-5 py-3 rounded-2xl text-xs font-bold text-pink-300 animate-bounce pointer-events-auto">
              💬 {nearbyNpcPrompt}
            </div>
          )}

          {/* Center Crosshair */}
          {(!isAiming || activeWeaponIndex !== 2) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative flex items-center justify-center">
                <div className={`rounded-full border border-pink-500 transition-all duration-300 ${
                  isAiming 
                    ? "w-8 h-8 bg-pink-500/10 shadow-[0_0_12px_rgba(244,63,94,0.5)] border-dashed animate-spin-slow"
                    : "w-2.5 h-2.5 bg-pink-500 border-white/60 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                }`} />
                {!isAiming && (
                  <>
                    <div className="absolute w-5 h-0.5 bg-pink-500/40 -left-6" />
                    <div className="absolute w-5 h-0.5 bg-pink-500/40 -right-6" />
                    <div className="absolute w-0.5 h-5 bg-pink-500/40 -top-6" />
                    <div className="absolute w-0.5 h-5 bg-pink-500/40 -bottom-6" />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Bottom HUD layout: Weapon selection indicator */}
          <div className="w-full flex justify-between items-end pointer-events-auto">
            {/* Active Weapon Indicator */}
            <div className="bg-black/60 backdrop-blur-md border border-pink-500/25 px-5 py-3 rounded-2xl flex items-center gap-3">
              <div>
                <div className="text-[10px] uppercase font-bold text-pink-300 font-mono tracking-wider">Weapon</div>
                <div className="text-sm font-black text-white uppercase tracking-wider">
                  {WEAPONS[activeWeaponIndex].name}
                </div>
              </div>
              <div className="flex gap-1.5 pl-2 border-l border-zinc-800">
                {[0, 1, 2].map((idx) => (
                  <button
                    key={idx}
                    onClick={() => switchWeapon(idx)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold font-mono transition-all flex items-center justify-center border ${
                      activeWeaponIndex === idx
                        ? "bg-pink-500 border-pink-400 text-white shadow-md shadow-pink-500/20"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="bg-black/55 px-5 py-2.5 rounded-xl border border-zinc-800 text-[10px] md:text-xs text-zinc-300 font-mono tracking-wide max-w-lg text-center leading-relaxed">
              WASD: Walk • Shift: Run • Space: Jump • Ctrl/C: Crouch • Keys [1, 2, 3]: Swap Weapons <br />
              Right Click: Zoom Aim (Blaster/Sniper) • Left Click: Shoot (Minigun is Full-Auto!)
            </div>
          </div>
        </div>
      )}

      {/* NPC Dialogue Dialog Overlay Box */}
      {npcDialogue && (
        <div className="absolute inset-x-0 bottom-[10%] z-20 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-zinc-900/95 border-2 border-pink-500/30 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 animate-zoom-expand">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
              <span className="text-sm font-black text-pink-400 uppercase tracking-widest">{npcName}</span>
              <span className="text-[10px] text-zinc-500 font-mono">Dialogue Screen</span>
            </div>
            <p className="text-sm text-zinc-100 font-serif leading-relaxed italic">
              "{npcDialogue}"
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleNpcInteraction}
                className="px-4 py-2 border border-pink-500/20 hover:border-pink-500/40 text-pink-400 text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer"
              >
                Next Dialogue
              </button>
              <button
                onClick={handleCloseDialogue}
                className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all cursor-pointer"
              >
                Close (E)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start screen menu overlay */}
      {gameState === "start" && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-30 flex items-center justify-center p-6">
          <div className="w-full max-w-md p-8 rounded-3xl bg-zinc-900/90 border border-pink-500/25 shadow-2xl text-center space-y-6 animate-zoom-expand">
            
            {/* Blaster Logo Icon */}
            <div className="w-16 h-16 mx-auto bg-pink-500/10 rounded-2xl border border-pink-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 fill-pink-500 animate-heartbeat-slow" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-pink-300 tracking-wider">CUPID'S 3D ARCADE</h1>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Step inside the upgraded 3D FPS arena! Walk on platforms, climb stairs automatically, interact with friendly NPCs, shoot down angry shadow clouds, and aim down scope sights.
              </p>
            </div>

            {/* Controls instructions */}
            <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800 text-left space-y-2 max-h-52 overflow-y-auto">
              <h3 className="text-xs font-bold text-pink-400 uppercase font-mono">Controls & Bindings</h3>
              <ul className="text-[11px] text-zinc-300 font-mono space-y-1 list-disc list-inside">
                <li><span className="text-white font-bold">W, A, S, D</span> — Walk with sliding inertia</li>
                <li><span className="text-white font-bold">Shift</span> — Hold to Sprint / Run</li>
                <li><span className="text-white font-bold">Spacebar</span> — Jump onto platforms</li>
                <li><span className="text-white font-bold">Ctrl / C</span> — Crouch / Sneak</li>
                <li><span className="text-white font-bold">Stairs Navigation</span> — Walk onto step blocks to climb automatically</li>
                <li><span className="text-white font-bold">Keys [1, 2, 3]</span> — Swap active guns</li>
                <li><span className="text-white font-bold">Right Click</span> — Aim Zoom (Sniper gets scope overlay!)</li>
                <li><span className="text-white font-bold">Left Click</span> — Fire blasters (Minigun is Full-Auto!)</li>
                <li><span className="text-white font-bold">E Key</span> — Speak to Teddy Pipo or Bunny Lulu</li>
              </ul>
            </div>

            <button
              onClick={() => {
                setGameState("playing");
                setTimeout(lockPointer, 150);
              }}
              className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-bold rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all cursor-pointer text-center focus:outline-none"
            >
              Start Game
            </button>
          </div>
        </div>
      )}

      {/* Game Over / Ending Score Screen */}
      {gameState === "gameover" && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-30 flex items-center justify-center p-6">
          <div className="w-full max-w-lg p-8 rounded-3xl bg-zinc-900/90 border border-pink-500/25 shadow-2xl text-center space-y-6 animate-zoom-expand">
            
            {/* Trophy / Broken Heart Icon */}
            <div className="w-16 h-16 mx-auto bg-pink-500/10 rounded-2xl border border-pink-500/20 flex items-center justify-center">
              {health <= 0 ? (
                <svg className="w-8 h-8 fill-rose-500" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35zM12 5v10m-3-6l6 2" stroke="white" strokeWidth="1.5" />
                </svg>
              ) : (
                <svg className="w-8 h-8 fill-pink-400 animate-bounce" viewBox="0 0 24 24">
                  <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v3c0 2.44 1.72 4.48 4 4.9V19H3v2h18v-2h-4v-4.1c2.28-.42 4-2.46 4-4.9V7c0-1.1-.9-2-2-2zm-12 5V7h2v3c0 .55-.45 1-1 1s-1-.45-1-1zm10 0c0 .55-.45 1-1 1s-1-.45-1-1V7h2v3z" />
                </svg>
              )}
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-black text-pink-300 uppercase tracking-widest leading-tight">
                {health <= 0 ? "You Died!" : "Time is Up!"}
              </h1>
              <p className="text-sm font-serif italic text-zinc-100 px-2 leading-relaxed">
                "{getVictoryMessage()}"
              </p>
            </div>

            {/* Performance Statistics Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                <div className="text-[9px] uppercase font-bold text-zinc-500 font-mono">Score Points</div>
                <div className="text-base font-black text-white">{points}</div>
              </div>
              <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                <div className="text-[9px] uppercase font-bold text-zinc-500 font-mono">Shots Fired</div>
                <div className="text-base font-black text-white">{shots}</div>
              </div>
              <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                <div className="text-[9px] uppercase font-bold text-zinc-500 font-mono">Accuracy</div>
                <div className="text-base font-black text-white">{getAccuracy()}%</div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleResetGame}
                className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold rounded-xl shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer text-center focus:outline-none"
              >
                Play Again
              </button>
              
              <button
                onClick={() => router.push(`/welcome?user=${user}`)}
                className="flex-1 py-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-pink-500/20 text-pink-300 hover:text-pink-200 text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all cursor-pointer text-center focus:outline-none"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<GameFallback />}>
      <GameContent />
    </Suspense>
  );
}
