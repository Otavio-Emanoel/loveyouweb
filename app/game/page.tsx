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

function GameContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = searchParams.get("user") || "";

  // React State for HUD & Menu
  const [score, setScore] = useState(0);
  const [shots, setShots] = useState(0);
  const [timeLeft, setTimeLeft] = useState(45);
  const [gameState, setGameState] = useState<"start" | "playing" | "gameover">("start");
  const [isLocked, setIsLocked] = useState(false);

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
  
  // Game simulation state refs
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const mouseMoveRef = useRef({ movementX: 0, movementY: 0 });
  const isLockedRef = useRef(false);
  const particlesRef = useRef<Particle[]>([]);
  const gunRecoilRef = useRef(0);

  // Sound Synth Helpers (Web Audio API)
  const synthShootSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.12);
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
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
      
      // Sweet high-pitched chime ding
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

  const synthEndSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.4);
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn(e);
    }
  };

  // Helper to build a 3D Heart geometry
  const createHeartGeometry = () => {
    const shape = new THREE.Shape();
    // Heart shape drawn with Bezier Curves
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
    // Scale heart to nominal in-game size
    geometry.scale(0.15, 0.15, 0.15);
    return geometry;
  };

  // Setup pointer-lock status monitoring
  useEffect(() => {
    const handleLockChange = () => {
      const active = document.pointerLockElement === canvasRef.current;
      setIsLocked(active);
      isLockedRef.current = active;
      
      if (!active && gameState === "playing") {
        // Pause/stop is handled by letting the user re-lock when ready
      }
    };
    
    document.addEventListener("pointerlockchange", handleLockChange);
    return () => {
      document.removeEventListener("pointerlockchange", handleLockChange);
    };
  }, [gameState]);

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
    scene.background = new THREE.Color(0x0e0509);
    sceneRef.current = scene;

    // Fog for depth
    scene.fog = new THREE.FogExp2(0x0e0509, 0.04);

    const camera = new THREE.PerspectiveCamera(
      70,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.rotation.order = "YXZ"; // Standard FPS camera rotation order
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
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    const floorMat = new THREE.MeshPhongMaterial({
      color: 0x12070f,
      shininess: 30,
      specular: 0x111111,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(60, 60, 0xec4899, 0x27272a);
    gridHelper.position.y = -0.48;
    scene.add(gridHelper);

    // Neon columns/pillars surrounding the bounds
    const colGeo = new THREE.BoxGeometry(1, 8, 1);
    const colMat = new THREE.MeshPhongMaterial({
      color: 0x3b0764,
      emissive: 0x1d003b,
      shininess: 80,
    });
    
    // Position columns at boundaries
    const colPositions = [
      [-25, 3, -25], [25, 3, -25], [-25, 3, 25], [25, 3, 25],
      [-25, 3, 0], [25, 3, 0], [0, 3, -25], [0, 3, 25]
    ];
    colPositions.forEach(([x, y, z]) => {
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.set(x, y, z);
      scene.add(col);
    });

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffb3d9, 1.2);
    dirLight.position.set(10, 20, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Glowing core target lights
    const pointLight = new THREE.PointLight(0xf43f5e, 1.5, 40);
    pointLight.position.set(0, 5, 0);
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

    for (let i = 0; i < 15; i++) {
      const heartMesh = new THREE.Mesh(heartGeometry, heartMaterial);
      // Random coordinates in the room
      heartMesh.position.set(
        (Math.random() - 0.5) * 44, // X bounds
        1.0 + Math.random() * 3.5,  // Y heights
        (Math.random() - 0.5) * 44  // Z bounds
      );
      // Random initial rotations
      heartMesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        0
      );
      heartMesh.castShadow = true;
      targetsGroup.add(heartMesh);
    }

    // Cozy pink futuristic blaster gun model attached to camera
    const gunGroup = new THREE.Group();
    
    // Gun body
    const bodyGeo = new THREE.BoxGeometry(0.08, 0.08, 0.25);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xffb6c1, shininess: 90 });
    const gunBody = new THREE.Mesh(bodyGeo, bodyMat);
    gunBody.position.set(0, 0, 0);
    gunGroup.add(gunBody);

    // Gun barrel
    const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.16);
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
    gunGroup.position.set(0.18, -0.15, -0.32); // Bottom right offsets
    gunGroup.rotation.y = Math.PI; // point forwards
    camera.add(gunGroup);
    scene.add(camera); // Must add camera when camera holds children!
    gunGroupRef.current = gunGroup;

    // Keyboard & Mouse Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "w") keysRef.current.w = true;
      if (key === "a") keysRef.current.a = true;
      if (key === "s") keysRef.current.s = true;
      if (key === "d") keysRef.current.d = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "w") keysRef.current.w = false;
      if (key === "a") keysRef.current.a = false;
      if (key === "s") keysRef.current.s = false;
      if (key === "d") keysRef.current.d = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isLockedRef.current) return;
      mouseMoveRef.current.movementX += e.movementX;
      mouseMoveRef.current.movementY += e.movementY;
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
    window.addEventListener("resize", handleResize);

    // Clean up
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, []);

  // Particle explosion handler
  const triggerHitExplosion = (point: THREE.Vector3) => {
    if (!sceneRef.current) return;

    const pCount = 20;
    const pGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const colors = [0xf43f5e, 0xff007f, 0xff66cc, 0xffffff];

    for (let i = 0; i < pCount; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const pMat = new THREE.MeshBasicMaterial({ color, transparent: true });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      
      pMesh.position.copy(point);
      sceneRef.current.add(pMesh);

      // Random speed vector
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 6.5,
        Math.random() * 5.0 + 1.0,
        (Math.random() - 0.5) * 6.5
      );

      particlesRef.current.push({
        mesh: pMesh,
        velocity,
        life: 1.0, // initial opacity/life ratio
      });
    }
  };

  // Raycast Firing Check
  const handleFire = () => {
    if (gameState !== "playing" || !isLockedRef.current) return;

    // Play synthesized sound
    synthShootSound();

    setShots((prev) => prev + 1);

    // Apply gun recoil push back
    gunRecoilRef.current = 0.08;

    if (!cameraRef.current || !targetsGroupRef.current) return;

    const raycaster = new THREE.Raycaster();
    // Ray originates from center screen
    const center = new THREE.Vector2(0, 0);
    raycaster.setFromCamera(center, cameraRef.current);

    const intersects = raycaster.intersectObjects(targetsGroupRef.current.children);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const target = hit.object as THREE.Mesh;

      // Play hit chime ding
      synthHitSound();

      // Emit heart particles at hit point
      triggerHitExplosion(hit.point);

      // Increment Score
      setScore((prev) => prev + 1);

      // Respawn target mesh immediately at a new random location inside the bounds
      target.position.set(
        (Math.random() - 0.5) * 44,
        1.0 + Math.random() * 3.5,
        (Math.random() - 0.5) * 44
      );
      // Give it a fresh random rotation
      target.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        0
      );
    }
  };

  // Canvas Click: Firing or Pointer Lock Trigger
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (gameState === "start") {
      setGameState("playing");
      lockPointer();
    } else if (gameState === "playing") {
      if (!isLocked) {
        lockPointer();
      } else {
        handleFire();
      }
    }
  };

  // Main Simulation Loop
  useEffect(() => {
    const clock = new THREE.Clock();

    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.1); // cap delta

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

        // 1. Mouse movement rotation (standard YXZ rotations)
        if (isLockedRef.current) {
          const move = mouseMoveRef.current;
          camera.rotation.y -= move.movementX * 0.0018;
          camera.rotation.x -= move.movementY * 0.0018;
          
          // Cap look pitch up and down
          camera.rotation.x = Math.max(-Math.PI / 2.4, Math.min(Math.PI / 2.4, camera.rotation.x));
          
          // Reset tracker values
          move.movementX = 0;
          move.movementY = 0;
        }

        // 2. Keyboard WASD movement
        const keys = keysRef.current;
        const moveSpeed = 6.8; // units per sec
        const moveVector = new THREE.Vector3();

        if (keys.w) moveVector.z -= 1.0;
        if (keys.s) moveVector.z += 1.0;
        if (keys.a) moveVector.x -= 1.0;
        if (keys.d) moveVector.x += 1.0;

        moveVector.normalize().multiplyScalar(moveSpeed * delta);
        // Apply camera yaw rotation (Y-axis) to movement so it matches looking direction
        moveVector.applyEuler(new THREE.Euler(0, camera.rotation.y, 0));

        camera.position.add(moveVector);

        // Keep player strictly inside floor boundaries (-24 to 24)
        camera.position.x = Math.max(-24.5, Math.min(24.5, camera.position.x));
        camera.position.z = Math.max(-24.5, Math.min(24.5, camera.position.z));
        camera.position.y = 1.6; // Keep height fixed

        // 3. Gun Recoil Spring Easing
        if (gunGroup) {
          if (gunRecoilRef.current > 0) {
            // Push gun back
            gunGroup.position.z = -0.32 + gunRecoilRef.current;
            gunRecoilRef.current -= delta * 0.5; // recoil decay
          } else {
            // Spring return back to rest offset
            gunGroup.position.z += (-0.32 - gunGroup.position.z) * 15 * delta;
          }
        }

        // 4. Update Particle Explosion Animations
        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          // Move
          p.mesh.position.addScaledVector(p.velocity, delta);
          // Gravity pull down
          p.velocity.y -= 9.8 * delta;
          // Fade
          p.life -= delta * 0.9;

          if (p.life <= 0) {
            // Remove mesh from scene
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

        // 5. Floating target animations (spin and bob)
        if (targetsGroup) {
          const time = clock.getElapsedTime();
          targetsGroup.children.forEach((mesh, index) => {
            // Spin
            mesh.rotation.y += delta * (0.4 + (index % 3) * 0.1);
            mesh.rotation.x += delta * 0.2;
            // Bob up and down gently
            mesh.position.y += Math.sin(time * 1.5 + index) * 0.003;
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
  }, [gameState]);

  // Restart trigger
  const handleResetGame = () => {
    setScore(0);
    setShots(0);
    setTimeLeft(45);
    setGameState("playing");
    lockPointer();
  };

  // Accuracy calculation
  const getAccuracy = () => {
    if (shots === 0) return 0;
    return Math.round((score / shots) * 100);
  };

  // Victory Message Generator based on credential parameters
  const isAgata = user.toLowerCase().includes("agata");
  const isOtavio = user.toLowerCase().includes("otavio");

  const getVictoryMessage = () => {
    if (isAgata) {
      return `Outstanding shooting, Ágata! You hit ${score} hearts! But Otávio's heart was hit the hardest when he met you! 💖`;
    }
    if (isOtavio) {
      return `Awesome shooter, Otávio! You hit ${score} hearts! But Ágata's heart was hit the hardest when she met you! 💖`;
    }
    return `Incredible score! You hit ${score} hearts! You have beautiful shooter coordination and a loving heart. 💖`;
  };

  return (
    <main className="h-screen w-screen relative bg-zinc-950 flex items-center justify-center font-sans overflow-hidden">
      
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-crosshair">
        <canvas 
          ref={canvasRef} 
          onClick={handleCanvasClick}
          className="w-full h-full block focus:outline-none" 
        />
      </div>

      {/* Main HUD overlay visible during play */}
      {gameState === "playing" && (
        <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6">
          
          {/* Top HUD: Score & Timer */}
          <div className="flex justify-between items-start">
            {/* Scoreboard */}
            <div className="bg-black/60 backdrop-blur-md border border-pink-500/25 px-5 py-3 rounded-2xl flex items-center gap-3">
              <svg className="w-5 h-5 fill-pink-500 animate-heartbeat-slow" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <div>
                <div className="text-[10px] uppercase font-bold text-pink-300 font-mono tracking-wider">Hearts Hit</div>
                <div className="text-xl font-black text-white leading-none">{score}</div>
              </div>
            </div>

            {/* Timer Panel */}
            <div className="bg-black/60 backdrop-blur-md border border-pink-500/25 px-5 py-3 rounded-2xl flex items-center gap-3">
              <svg className="w-5 h-5 fill-none stroke-pink-500 stroke-2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="text-[10px] uppercase font-bold text-pink-300 font-mono tracking-wider">Timer</div>
                <div className={`text-xl font-black leading-none font-mono ${timeLeft < 10 ? 'text-rose-500 animate-pulse' : 'text-white'}`}>
                  {timeLeft}s
                </div>
              </div>
            </div>
          </div>

          {/* Center Crosshair (CS Dot) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Horizontal & Vertical Crosshair ticks + core dot */}
            <div className="relative flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-pink-500 border border-white/60 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              <div className="absolute w-5 h-0.5 bg-pink-500/40 -left-6" />
              <div className="absolute w-5 h-0.5 bg-pink-500/40 -right-6" />
              <div className="absolute w-0.5 h-5 bg-pink-500/40 -top-6" />
              <div className="absolute w-0.5 h-5 bg-pink-500/40 -bottom-6" />
            </div>
          </div>

          {/* Bottom Controls / Lock indicator */}
          <div className="w-full flex flex-col items-center gap-2">
            {!isLocked && (
              <div className="bg-black/85 border border-pink-500/35 px-4 py-2.5 rounded-2xl text-xs text-pink-300/90 font-bold shadow-lg animate-pulse pointer-events-auto cursor-pointer" onClick={lockPointer}>
                ⚠️ Click screen to lock mouse and play!
              </div>
            )}
            
            <div className="bg-black/55 px-5 py-2.5 rounded-xl border border-zinc-800 text-[10px] md:text-xs text-zinc-300 font-mono tracking-wide">
              WASD: Move • Mouse: Look around • Left Click: Shoot Hearts
            </div>
          </div>
        </div>
      )}

      {/* Start screen menu overlay */}
      {gameState === "start" && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-30 flex items-center justify-center p-6">
          <div className="w-full max-w-md p-8 rounded-3xl bg-zinc-900/90 border border-pink-500/25 shadow-2xl text-center space-y-6 animate-zoom-expand">
            
            {/* Heart logo */}
            <div className="w-16 h-16 mx-auto bg-pink-500/10 rounded-2xl border border-pink-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 fill-pink-500 animate-heartbeat-slow" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-pink-300 tracking-wider">CUPID'S 3D ARCADE</h1>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Step inside the 3D shooting gallery! Move with WASD, lock your cursor, look around, and fire hot-pink laser hearts to pop the targets.
              </p>
            </div>

            {/* Controls instructions */}
            <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800 text-left space-y-2">
              <h3 className="text-xs font-bold text-pink-400 uppercase font-mono">Keyboard & Mouse Bindings</h3>
              <ul className="text-[11px] text-zinc-300 font-mono space-y-1 list-disc list-inside">
                <li><span className="text-white font-bold">W, A, S, D</span> — Walk around the arena</li>
                <li><span className="text-white font-bold">Mouse Look</span> — Pan first-person camera</li>
                <li><span className="text-white font-bold">Left Click</span> — Fire pink heart blaster</li>
                <li><span className="text-white font-bold">Esc Key</span> — Unlock mouse to pause/release</li>
              </ul>
            </div>

            <button
              onClick={() => {
                setGameState("playing");
                setTimeout(lockPointer, 150); // delay lock to let browser register click
              }}
              className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-sm font-bold rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all cursor-pointer text-center focus:outline-none"
            >
              Start Game
            </button>
          </div>
        </div>
      )}

      {/* Game Over / Victory Screen */}
      {gameState === "gameover" && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-30 flex items-center justify-center p-6">
          <div className="w-full max-w-lg p-8 rounded-3xl bg-zinc-900/90 border border-pink-500/25 shadow-2xl text-center space-y-6 animate-zoom-expand">
            
            {/* Trophy Icon */}
            <div className="w-16 h-16 mx-auto bg-pink-500/10 rounded-2xl border border-pink-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 fill-pink-400 animate-bounce" viewBox="0 0 24 24">
                <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v3c0 2.44 1.72 4.48 4 4.9V19H3v2h18v-2h-4v-4.1c2.28-.42 4-2.46 4-4.9V7c0-1.1-.9-2-2-2zm-12 5V7h2v3c0 .55-.45 1-1 1s-1-.45-1-1zm10 0c0 .55-.45 1-1 1s-1-.45-1-1V7h2v3z" />
              </svg>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-black text-pink-300 uppercase tracking-widest leading-tight">Time is Up!</h1>
              <p className="text-sm font-serif italic text-zinc-100 px-2 leading-relaxed">
                "{getVictoryMessage()}"
              </p>
            </div>

            {/* Performance Statistics Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                <div className="text-[9px] uppercase font-bold text-zinc-500 font-mono">Hearts Hit</div>
                <div className="text-base font-black text-white">{score}</div>
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
                className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs font-bold rounded-xl shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer text-center focus:outline-none"
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
