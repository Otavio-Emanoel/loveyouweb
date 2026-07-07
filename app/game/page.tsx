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
  const enemiesRef = useRef<Enemy[]>([]);
  const npcsRef = useRef<NPC[]>([]);

  // Physics states
  const playerPositionYRef = useRef(0);
  const playerVelocityYRef = useRef(0);
  const isGroundedRef = useRef(true);
  
  // Game simulation state refs
  const keysRef = useRef({ w: false, a: false, s: false, d: false, shift: false, space: false, ctrl: false });
  const mouseMoveRef = useRef({ movementX: 0, movementY: 0 });
  const isLockedRef = useRef(false);
  const isAimingRef = useRef(false);
  const particlesRef = useRef<Particle[]>([]);
  const tracersRef = useRef<Tracer[]>([]);
  const gunRecoilRef = useRef(0);
  
  // Camera kickback offset (aim recoil)
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
      
      osc.type = isAimingRef.current ? "triangle" : "sine";
      osc.frequency.setValueAtTime(isAimingRef.current ? 800 : 950, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.12);
      
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
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
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.25); // C6
      
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc2.frequency.exponentialRampToValueAtTime(1318.50, ctx.currentTime + 0.25); // E6
      
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
    scene.background = new THREE.Color(0x0a0307);
    sceneRef.current = scene;

    // Fog for depth
    scene.fog = new THREE.FogExp2(0x0a0307, 0.025);

    const camera = new THREE.PerspectiveCamera(
      70,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.rotation.order = "YXZ";
    camera.position.set(0, 1.6, 0); // Player height
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
      color: 0x0c040a,
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

    // Build platform meshes
    PLATFORMS.forEach((p) => {
      const pGeo = new THREE.BoxGeometry(p.w, p.h, p.d);
      const pMat = new THREE.MeshPhongMaterial({
        color: 0xdb2777,
        emissive: 0x1c000e,
        shininess: 60,
        specular: 0xffffff,
      });
      const mesh = new THREE.Mesh(pGeo, pMat);
      mesh.position.set(p.x, p.y, p.z);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      scene.add(mesh);
    });

    // Outer boundary walls (neon frame)
    const boundaryGeo = new THREE.BoxGeometry(1, 12, MAP_SIZE);
    const boundaryMat = new THREE.MeshPhongMaterial({ color: 0x1e0717, shininess: 10 });
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffd1e6, 1.0);
    dirLight.position.set(20, 40, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Glowing core target lights
    const pointLight = new THREE.PointLight(0xf43f5e, 1.8, 60);
    pointLight.position.set(0, 8, 0);
    scene.add(pointLight);

    // Target Group Setup
    const targetsGroup = new THREE.Group();
    scene.add(targetsGroup);
    targetsGroupRef.current = targetsGroup;

    // Generate Floating 3D Heart Targets
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

    // Spawn Hostile Gloom Cloud Enemies
    enemiesRef.current = [];
    const colors = [0x5b0e2d, 0x3c081e];
    for (let i = 0; i < 4; i++) {
      const enemyGroup = new THREE.Group();
      
      // Cloud cluster geometry (composed of three spheres)
      const cloudGeo = new THREE.SphereGeometry(0.8, 8, 8);
      const cloudMat = new THREE.MeshPhongMaterial({
        color: colors[i % colors.length],
        emissive: 0x1f030e,
        shininess: 10,
        transparent: true,
        opacity: 0.9
      });

      const sphere1 = new THREE.Mesh(cloudGeo, cloudMat);
      sphere1.position.set(0, 0, 0);
      enemyGroup.add(sphere1);

      const sphere2 = new THREE.Mesh(cloudGeo, cloudMat);
      sphere2.position.set(-0.5, 0.1, 0.2);
      enemyGroup.add(sphere2);

      const sphere3 = new THREE.Mesh(cloudGeo, cloudMat);
      sphere3.position.set(0.5, -0.1, -0.2);
      enemyGroup.add(sphere3);

      // Angry Eyes (glowing red)
      const eyeGeo = new THREE.BoxGeometry(0.12, 0.06, 0.1);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff003c });
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(-0.35, 0.15, -0.75);
      leftEye.rotation.y = Math.PI / 12;
      leftEye.rotation.z = -Math.PI / 12; // angry tilt
      enemyGroup.add(leftEye);

      const rightEye = leftEye.clone();
      rightEye.position.x = 0.35;
      rightEye.rotation.y = -Math.PI / 12;
      rightEye.rotation.z = Math.PI / 12;
      enemyGroup.add(rightEye);

      // Set initial coordinate outside player center
      enemyGroup.position.set(
        (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 25),
        1.5,
        (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 25)
      );

      scene.add(enemyGroup);
      enemiesRef.current.push({
        mesh: enemyGroup,
        health: 3,
        maxHealth: 3,
        velocity: new THREE.Vector3(),
        respawnTimer: 0
      });
    }

    // Spawn Cute Talkable NPCs (Lulu and Pipo)
    npcsRef.current = [];

    // NPC 1: Teddy Bear Pipo
    const pipoGroup = new THREE.Group();
    const pipoBody = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 12), new THREE.MeshPhongMaterial({ color: 0xffa4b9 }));
    pipoBody.position.set(0, 0.4, 0);
    pipoBody.castShadow = true;
    pipoGroup.add(pipoBody);

    const pipoHead = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), new THREE.MeshPhongMaterial({ color: 0xffb8c8 }));
    pipoHead.position.set(0, 0.98, 0);
    pipoHead.castShadow = true;
    pipoGroup.add(pipoHead);

    // Ear meshes
    const pipoEarL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshPhongMaterial({ color: 0xff7b9a }));
    pipoEarL.position.set(-0.28, 1.25, 0);
    pipoGroup.add(pipoEarL);
    const pipoEarR = pipoEarL.clone();
    pipoEarR.position.x = 0.28;
    pipoGroup.add(pipoEarR);

    pipoGroup.position.set(-14, 2.2, -20); // stands on platform 2
    scene.add(pipoGroup);
    npcsRef.current.push({
      mesh: pipoGroup,
      name: "Pipo the Teddy Bear",
      dialogues: [
        "Hi! Welcome to our dream world! Otávio wanted me to tell you that you are his favorite adventure companion.",
        "Use WASD keys to explore, and hold SHIFT to sprint across platforms!",
        "Look around for floating platforms leading to the high castle target. You can do this!"
      ],
      currentDialogueIndex: 0
    });

    // NPC 2: Lulu the Bunny
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

    luluGroup.position.set(14, 4.8, -20); // stands on platform 4
    scene.add(luluGroup);
    npcsRef.current.push({
      mesh: luluGroup,
      name: "Lulu the Bunny",
      dialogues: [
        "Aha! You made it all the way up here to my platform! Otávio told me he loves you more than all the stars.",
        "Be careful with the angry purple shadow clouds! Shoot them down before they steal your energy.",
        "Hold the RIGHT MOUSE BUTTON to zoom and aim down sights for far away targets!"
      ],
      currentDialogueIndex: 0
    });

    // Cozy pink futuristic blaster gun model attached to camera
    const gunGroup = new THREE.Group();
    
    // Gun body
    const bodyGeo = new THREE.BoxGeometry(0.08, 0.08, 0.25);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xffb6c1, shininess: 90 });
    const gunBody = new THREE.Mesh(bodyGeo, bodyMat);
    gunGroup.add(gunBody);

    // Gun barrel
    const barrelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.16);
    const barrelMat = new THREE.MeshPhongMaterial({ color: 0xf43f5e, emissive: 0x630012, shininess: 100 });
    const gunBarrel = new THREE.Mesh(barrelGeo, barrelMat);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0, 0, -0.15);
    gunGroup.add(gunBarrel);

    // Gun handle
    const handleGeo = new THREE.BoxGeometry(0.06, 0.12, 0.06);
    const handleMat = new THREE.MeshPhongMaterial({ color: 0xdb2777, shininess: 50 });
    const gunHandle = new THREE.Mesh(handleGeo, handleMat);
    gunHandle.rotation.x = -Math.PI / 6;
    gunHandle.position.set(0, -0.08, 0.05);
    gunGroup.add(gunHandle);

    // Scope Heart sight decoration
    const scopeGeo = new THREE.BoxGeometry(0.03, 0.03, 0.03);
    const scopeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const gunScope = new THREE.Mesh(scopeGeo, scopeMat);
    gunScope.position.set(0, 0.055, -0.05);
    gunGroup.add(gunScope);

    // Put gun group as child of camera
    gunGroup.position.set(0.18, -0.15, -0.32); // Rest position
    gunGroup.rotation.y = Math.PI;
    camera.add(gunGroup);
    scene.add(camera);
    gunGroupRef.current = gunGroup;

    // Input handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "w") keysRef.current.w = true;
      if (key === "a") keysRef.current.a = true;
      if (key === "s") keysRef.current.s = true;
      if (key === "d") keysRef.current.d = true;
      if (e.key === " ") keysRef.current.space = true;
      if (e.key === "Shift") keysRef.current.shift = true;
      if (key === "c" || e.key === "Control") keysRef.current.ctrl = true;

      // Handle Dialogue Interaction or Next dialogue
      if (key === "e") {
        handleNpcInteraction();
      }
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
        // Left Click: Fire
        handleFire();
      } else if (e.button === 2) {
        // Right Click: Aim Down Sights (ADS)
        isAimingRef.current = true;
        setIsAiming(true);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        // Release Right Click: Stop aiming
        isAimingRef.current = false;
        setIsAiming(false);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Prevent browser default menu so right-click is fully captured
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

    // Clean up
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

    // Find if player is close to any NPC
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
      // Advance to next dialogue sequence
      npc.currentDialogueIndex = (npc.currentDialogueIndex + 1) % npc.dialogues.length;
    }
  };

  // Close Dialogue System
  const handleCloseDialogue = () => {
    setNpcDialogue(null);
    setNpcName(null);
    // Re-lock mouse coordinate tracker
    lockPointer();
  };

  // Trigger red flash when taking hits
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
      ? [0x5b0e2d, 0x1f030e, 0x8a1643, 0xff0055] // dark gloom particles
      : [0xf43f5e, 0xff66cc, 0xffffff];          // target pink particles

    for (let i = 0; i < pCount; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const pMat = new THREE.MeshBasicMaterial({ color, transparent: true });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      
      pMesh.position.copy(point);
      sceneRef.current.add(pMesh);

      // Random velocities
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
    
    // Approximate gun tip coordinates in world space relative to camera orientation
    const startPoint = new THREE.Vector3();
    startPoint.copy(camera.position);
    
    const sideOffset = new THREE.Vector3(
      isAimingRef.current ? 0.0 : 0.18, 
      -0.12, 
      -0.35
    ).applyEuler(camera.rotation);
    
    startPoint.add(sideOffset);

    // Calculate length and orientation
    const distance = startPoint.distanceTo(hitPoint);
    const tracerGeo = new THREE.CylinderGeometry(0.008, 0.008, distance, 4);
    tracerGeo.rotateX(Math.PI / 2); // align along camera look axis

    const tracerMat = new THREE.MeshBasicMaterial({
      color: 0xff66cc,
      transparent: true,
      opacity: 0.9,
    });
    const tracerMesh = new THREE.Mesh(tracerGeo, tracerMat);

    // Position tracer midway
    tracerMesh.position.copy(startPoint).add(hitPoint).multiplyScalar(0.5);
    tracerMesh.lookAt(hitPoint);

    sceneRef.current.add(tracerMesh);
    tracersRef.current.push({
      mesh: tracerMesh,
      life: 0.1 // quick fadeout duration
    });
  };

  // Raycast Firing Check
  const handleFire = () => {
    if (gameState !== "playing" || !isLockedRef.current || npcDialogue !== null) return;

    synthShootSound();
    setShots((prev) => prev + 1);

    // Recoil offsets
    gunRecoilRef.current = 0.07;
    // Kick camera pitch up slightly (screen recoil)
    cameraTargetKickRef.current = isAimingRef.current ? 0.015 : 0.035;

    if (!cameraRef.current || !targetsGroupRef.current) return;

    const raycaster = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0);
    raycaster.setFromCamera(center, cameraRef.current);

    // Target mesh lists
    const targets = targetsGroupRef.current.children;
    const enemyMeshes = enemiesRef.current
      .filter((e) => e.respawnTimer <= 0)
      .map((e) => e.mesh);

    // Combine targets and enemies for collision
    const shootableObjects = [...targets, ...enemyMeshes];
    const intersects = raycaster.intersectObjects(shootableObjects, true);

    const hitPoint = new THREE.Vector3();
    if (intersects.length > 0) {
      const hit = intersects[0];
      hitPoint.copy(hit.point);

      // Check if hit object belongs to target group or an enemy group
      let hitTargetMesh = targets.find((t) => t === hit.object || t.children.includes(hit.object));
      let hitEnemy = enemiesRef.current.find((e) => 
        e.mesh === hit.object || 
        e.mesh.children.includes(hit.object) || 
        e.mesh.children.some(child => child.children?.includes(hit.object))
      );

      if (hitTargetMesh) {
        // Heart target hit!
        synthHitSound();
        triggerExplosion(hit.point, false);
        setPoints((prev) => prev + 100);

        // Respawn heart target inside boundaries
        hitTargetMesh.position.set(
          (Math.random() - 0.5) * (MAP_SIZE - 20),
          1.5 + Math.random() * 4.5,
          (Math.random() - 0.5) * (MAP_SIZE - 20)
        );
        hitTargetMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

      } else if (hitEnemy) {
        // Enemy cloud hit!
        synthHitSound();
        hitEnemy.health -= 1;

        // Damage particles
        triggerExplosion(hit.point, true);

        if (hitEnemy.health <= 0) {
          // Enemy killed
          setPoints((prev) => prev + 250);
          
          // Large explosion
          triggerExplosion(hitEnemy.mesh.position, true);

          // Put enemy in respawn queue (invisible and moves away)
          hitEnemy.respawnTimer = 4.0; // 4 seconds respawn cooldown
          hitEnemy.mesh.position.set(9999, -9999, 9999);
        }
      }
    } else {
      // Calculate point far in front of camera
      hitPoint.copy(cameraRef.current.position).addScaledVector(raycaster.ray.direction, 50);
    }

    // Render tracer beam line
    createBulletTracer(hitPoint);
  };

  // Main Canvas Click handler
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (gameState === "start") {
      setGameState("playing");
      setPoints(0);
      setHealth(100);
      setTimeLeft(60);
      playerPositionYRef.current = 0;
      playerVelocityYRef.current = 0;
      isGroundedRef.current = true;
      lockPointer();
    } else if (gameState === "playing") {
      if (!isLocked) {
        lockPointer();
      }
    }
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

        // --- 1. Mouse coordinate pans (FPS Camera Look) ---
        if (isLockedRef.current && npcDialogue === null) {
          const move = mouseMoveRef.current;
          
          // Apply mouse multiplier (decreased under ADS zoom)
          const sens = isAimingRef.current ? 0.0008 : 0.0018;
          camera.rotation.y -= move.movementX * sens;
          
          // Track target recoil kick plus manual mouse look
          const nextPitch = camera.rotation.x - move.movementY * sens;
          camera.rotation.x = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, nextPitch));
          
          move.movementX = 0;
          move.movementY = 0;
        }

        // Apply visual Recoil Kickback decay
        if (cameraTargetKickRef.current > 0.001) {
          camera.rotation.x += cameraTargetKickRef.current;
          // Slowly push the kick recovery buffer
          cameraKickRef.current += cameraTargetKickRef.current;
          cameraTargetKickRef.current = 0; // reset single-fire kick trigger
        }
        
        // Recover camera look back down towards rest position
        if (cameraKickRef.current > 0) {
          const recovery = Math.min(cameraKickRef.current, delta * 0.12);
          camera.rotation.x -= recovery;
          cameraKickRef.current -= recovery;
        }

        // --- 2. JUMPING, SNEAKING, & RUNNING PHYSICS ---
        const keys = keysRef.current;
        
        // Sneak modifier
        const isSneaking = keys.ctrl;
        const targetEyeHeight = isSneaking ? 0.8 : 1.6;
        
        // Smoothly interpolate camera height (eye level lerp)
        const eyeLevelLerpSpeed = 12.0;
        camera.position.y += (playerPositionYRef.current + targetEyeHeight - camera.position.y) * eyeLevelLerpSpeed * delta;

        // Base walking speeds
        let currentWalkSpeed = 6.0; // standard units/sec
        if (keys.shift && !isSneaking && isGroundedRef.current) {
          currentWalkSpeed = 9.8; // Running sprint
        } else if (isSneaking) {
          currentWalkSpeed = 3.0; // Sneaking crawl
        }
        if (isAimingRef.current) {
          currentWalkSpeed *= 0.55; // ADS speed reduction
        }

        const moveVector = new THREE.Vector3();
        if (keys.w) moveVector.z -= 1.0;
        if (keys.s) moveVector.z += 1.0;
        if (keys.a) moveVector.x -= 1.0;
        if (keys.d) moveVector.x += 1.0;

        moveVector.normalize().multiplyScalar(currentWalkSpeed * delta);
        // Apply camera yaw (Y axis) to movement so it aligns with looking directions
        moveVector.applyEuler(new THREE.Euler(0, camera.rotation.y, 0));

        // Store old coordinates for slide collision
        const oldX = camera.position.x;
        const oldZ = camera.position.z;

        camera.position.x += moveVector.x;
        camera.position.z += moveVector.z;

        // Keep inside outer map bounds
        const boundaryLimit = (MAP_SIZE / 2) - 1.5;
        camera.position.x = Math.max(-boundaryLimit, Math.min(boundaryLimit, camera.position.x));
        camera.position.z = Math.max(-boundaryLimit, Math.min(boundaryLimit, camera.position.z));

        // Wall collisions check (squeezed past platform borders)
        for (const p of PLATFORMS) {
          const topY = p.y + p.h / 2;
          const bottomY = p.y - p.h / 2;

          // If player's Y levels intersect with platform height
          if (playerPositionYRef.current < topY - 0.15 && playerPositionYRef.current + 1.8 > bottomY) {
            const buffer = 0.55; // player radius bounds
            const xMin = p.x - p.w / 2 - buffer;
            const xMax = p.x + p.w / 2 + buffer;
            const zMin = p.z - p.d / 2 - buffer;
            const zMax = p.z + p.d / 2 + buffer;

            if (camera.position.x > xMin && camera.position.x < xMax &&
                camera.position.z > zMin && camera.position.z < zMax) {
              // Intersecting! Slide collision
              camera.position.x = oldX;
              if (camera.position.x > xMin && camera.position.x < xMax &&
                  camera.position.z > zMin && camera.position.z < zMax) {
                camera.position.z = oldZ;
              }
            }
          }
        }

        // Apply Vertical Physics (Gravity & Jumping)
        if (!isGroundedRef.current) {
          // Apply gravity decay
          playerVelocityYRef.current -= 24 * delta;
          playerPositionYRef.current += playerVelocityYRef.current * delta;

          // Floor level landing check
          if (playerPositionYRef.current <= 0) {
            playerPositionYRef.current = 0;
            playerVelocityYRef.current = 0;
            isGroundedRef.current = true;
          }

          // Platform top landing check
          if (playerVelocityYRef.current <= 0) { // falling down
            for (const p of PLATFORMS) {
              const topY = p.y + p.h / 2;
              const buffer = 0.35;
              const xMin = p.x - p.w / 2 - buffer;
              const xMax = p.x + p.w / 2 + buffer;
              const zMin = p.z - p.d / 2 - buffer;
              const zMax = p.z + p.d / 2 + buffer;

              if (camera.position.x > xMin && camera.position.x < xMax &&
                  camera.position.z > zMin && camera.position.z < zMax) {
                // If feet intersect top surface
                if (playerPositionYRef.current >= topY - 0.3 && playerPositionYRef.current + playerVelocityYRef.current * delta <= topY + 0.15) {
                  playerPositionYRef.current = topY;
                  playerVelocityYRef.current = 0;
                  isGroundedRef.current = true;
                  break;
                }
              }
            }
          }
        } else {
          // Grounded walk off platform check
          if (playerPositionYRef.current > 0) {
            let stillOnPlatform = false;
            for (const p of PLATFORMS) {
              const topY = p.y + p.h / 2;
              const buffer = 0.4;
              const xMin = p.x - p.w / 2 - buffer;
              const xMax = p.x + p.w / 2 + buffer;
              const zMin = p.z - p.d / 2 - buffer;
              const zMax = p.z + p.d / 2 + buffer;

              if (camera.position.x > xMin && camera.position.x < xMax &&
                  camera.position.z > zMin && camera.position.z < zMax &&
                  Math.abs(playerPositionYRef.current - topY) < 0.15) {
                stillOnPlatform = true;
                break;
              }
            }
            if (!stillOnPlatform) {
              isGroundedRef.current = false;
            }
          }

          // Trigger Jump Action
          if (keys.space && npcDialogue === null) {
            playerVelocityYRef.current = 8.5; // Jump vertical velocity force
            isGroundedRef.current = false;
          }
        }

        // --- 3. AIM DOWN SIGHTS (ADS) ZOOM LERP ---
        const targetFov = isAimingRef.current ? 42 : 70;
        if (Math.abs(camera.fov - targetFov) > 0.1) {
          camera.fov += (targetFov - camera.fov) * 15 * delta;
          camera.updateProjectionMatrix();
        }

        // Slide gun alignment smoothly (Centered for ADS, right-offset for normal)
        if (gunGroup) {
          const targetX = isAimingRef.current ? 0.0 : 0.18;
          const targetY = isAimingRef.current ? -0.11 : -0.15;
          const restZ = -0.32;
          
          gunGroup.position.x += (targetX - gunGroup.position.x) * 12 * delta;
          gunGroup.position.y += (targetY - gunGroup.position.y) * 12 * delta;

          // Apply recoil kick
          if (gunRecoilRef.current > 0) {
            gunGroup.position.z = restZ + gunRecoilRef.current;
            gunGroup.rotation.x = -gunRecoilRef.current * 2.5; // recoil barrel kick up
            gunRecoilRef.current -= delta * 0.45;
          } else {
            gunGroup.position.z += (restZ - gunGroup.position.z) * 15 * delta;
            gunGroup.rotation.x += (0 - gunGroup.rotation.x) * 15 * delta;
          }
        }

        // --- 4. NPC PROXIMITY DETECTION ---
        let closestPrompt: string | null = null;
        npcsRef.current.forEach((npc) => {
          const npcPos = npc.mesh.position;
          const dist = camera.position.distanceTo(npcPos);
          if (dist < 3.2) {
            closestPrompt = `Press 'E' to talk to ${npc.name}`;
          }
        });
        setNearbyNpcPrompt(closestPrompt);

        // --- 5. HOSTILE ENEMY AI SIMULATION ---
        const enemies = enemiesRef.current;
        enemies.forEach((enemy) => {
          if (enemy.respawnTimer > 0) {
            enemy.respawnTimer -= delta;
            if (enemy.respawnTimer <= 0) {
              // Respawn enemy at random coordinates
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
          
          // Face the player camera YXZ
          enemy.mesh.lookAt(camera.position.x, enemyPos.y, camera.position.z);

          // Drift/chase player camera coordinates
          const chaseSpeed = 2.2; // units per sec
          const dir = new THREE.Vector3().subVectors(camera.position, enemyPos);
          // Keep Y floating level
          dir.y = 0;
          dir.normalize();

          enemy.mesh.position.addScaledVector(dir, chaseSpeed * delta);
          // Wave bobbing height
          enemy.mesh.position.y = 1.3 + Math.sin(clock.getElapsedTime() * 2.0 + enemy.mesh.id) * 0.2;

          // Check if touches player (melee damage radius <= 1.4)
          const distToPlayer = camera.position.distanceTo(enemyPos);
          if (distToPlayer < 1.4) {
            // Apply damage if not in cooldown
            setHealth((prev) => {
              if (prev > 0) {
                synthDamageSound();
                triggerDamageFlash();
                // Melee recoil: bounce player backwards
                const pushDir = new THREE.Vector3().subVectors(camera.position, enemyPos);
                pushDir.y = 0;
                pushDir.normalize().multiplyScalar(2.0);
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

        // --- 6. UPDATE BULLET TRACER LIFESPANS ---
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

        // --- 7. UPDATE EXPLOSION PARTICLE PHYSICS ---
        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.mesh.position.addScaledVector(p.velocity, delta);
          p.velocity.y -= 9.8 * delta; // gravity pull
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

        // --- 8. TARGET BOB & SPIN ---
        if (targetsGroup) {
          const elapsed = clock.getElapsedTime();
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

  // Restart trigger
  const handleResetGame = () => {
    setPoints(0);
    setShots(0);
    setHealth(100);
    setTimeLeft(60);
    setNpcDialogue(null);
    setNpcName(null);
    setGameState("playing");
    playerPositionYRef.current = 0;
    playerVelocityYRef.current = 0;
    isGroundedRef.current = true;
    setTimeout(lockPointer, 150);
  };

  // Accuracy calculation
  const getAccuracy = () => {
    if (shots === 0) return 0;
    return Math.round((points / (shots * 100)) * 100); // normalized approx accuracy
  };

  // Victory / Ending message based on credentials
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

          {/* Center Crosshair (CS Sight) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative flex items-center justify-center">
              {/* Outer circle sight when aiming, core dot otherwise */}
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

          {/* Bottom HUD layout */}
          <div className="w-full flex flex-col items-center gap-2">
            {!isLocked && npcDialogue === null && (
              <div className="bg-black/85 border border-pink-500/35 px-4 py-2.5 rounded-2xl text-xs text-pink-300/90 font-bold shadow-lg animate-pulse pointer-events-auto cursor-pointer" onClick={lockPointer}>
                ⚠️ Click screen to lock mouse and play!
              </div>
            )}
            
            <div className="bg-black/55 px-5 py-2.5 rounded-xl border border-zinc-800 text-[10px] md:text-xs text-zinc-300 font-mono tracking-wide">
              WASD: Walk • Shift: Run • Space: Jump • Ctrl/C: Sneak • Right Click: Hold to Aim • Left Click: Shoot
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
                Step inside the upgraded 3D FPS arena! Walk on platforms, interact with friendly NPCs, shoot down angry shadow clouds, and aim down scope sights.
              </p>
            </div>

            {/* Controls instructions */}
            <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800 text-left space-y-2 max-h-52 overflow-y-auto">
              <h3 className="text-xs font-bold text-pink-400 uppercase font-mono">Controls & Bindings</h3>
              <ul className="text-[11px] text-zinc-300 font-mono space-y-1 list-disc list-inside">
                <li><span className="text-white font-bold">W, A, S, D</span> — Walk around map</li>
                <li><span className="text-white font-bold">Shift</span> — Hold to Sprint / Run</li>
                <li><span className="text-white font-bold">Spacebar</span> — Jump onto platforms</li>
                <li><span className="text-white font-bold">Ctrl / C</span> — Crawl / Sneak</li>
                <li><span className="text-white font-bold">Right Click</span> — Hold to AIM Down Sights (ADS)</li>
                <li><span className="text-white font-bold">Left Click</span> — Fire hot-pink blasters</li>
                <li><span className="text-white font-bold">E Key</span> — Speak to closest Teddy or Bunny</li>
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
