'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface Turntable3DProps {
  isPlaying?: boolean;
  playbackSpeed?: number;
  className?: string;
}

export default function Turntable3D({
  isPlaying = false,
  playbackSpeed = 1.0,
  className = 'w-64 h-64 md:w-72 md:h-72',
}: Turntable3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (reducedMotion || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 5.5, 4.5);
    camera.lookAt(0, 0, 0);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    // Amber Filament Point Light (Vacuum Tube Glow)
    const tubeLight = new THREE.PointLight(0xff9f1c, 2.5, 10);
    tubeLight.position.set(-1.8, 0.8, -1.5);
    scene.add(tubeLight);

    // Signal Cyan Subtle Accent Light
    const cyanLight = new THREE.PointLight(0x00e5ff, 1.2, 8);
    cyanLight.position.set(2, 0.5, 2);
    scene.add(cyanLight);

    // 4. Mesh Geometries & Materials

    // Turntable Chassis Base
    const chassisGeo = new THREE.BoxGeometry(4.2, 0.4, 3.6);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x1e1e24,
      roughness: 0.4,
      metalness: 0.8,
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = -0.2;
    scene.add(chassis);

    // Chassis Top Plate Bezel
    const plateGeo = new THREE.BoxGeometry(4.0, 0.05, 3.4);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x121215,
      roughness: 0.2,
      metalness: 0.9,
    });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.y = 0.02;
    scene.add(plate);

    // Rotating Vinyl Platter Group
    const vinylGroup = new THREE.Group();
    vinylGroup.position.set(-0.5, 0.1, 0);

    // Vinyl Record Platter
    const recordGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.05, 64);
    const recordMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0c,
      roughness: 0.15,
      metalness: 0.3,
    });
    const record = new THREE.Mesh(recordGeo, recordMat);
    vinylGroup.add(record);

    // Vinyl Concentric Grooves (subtle inner ring)
    const grooveGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.052, 64);
    const grooveMat = new THREE.MeshStandardMaterial({
      color: 0x121215,
      roughness: 0.1,
      metalness: 0.2,
    });
    const groove = new THREE.Mesh(grooveGeo, grooveMat);
    vinylGroup.add(groove);

    // Center Amber Label
    const labelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.055, 32);
    const labelMat = new THREE.MeshStandardMaterial({
      color: 0xff9f1c,
      roughness: 0.3,
      emissive: 0xff9f1c,
      emissiveIntensity: 0.2,
    });
    const label = new THREE.Mesh(labelGeo, labelMat);
    vinylGroup.add(label);

    // Center Metal Spindle
    const spindleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.2, 16);
    const spindleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 1.0,
      roughness: 0.1,
    });
    const spindle = new THREE.Mesh(spindleGeo, spindleMat);
    spindle.position.y = 0.08;
    vinylGroup.add(spindle);

    scene.add(vinylGroup);

    // Tonearm Base & Arm
    const tonearmGroup = new THREE.Group();
    tonearmGroup.position.set(1.4, 0.15, -1.0);

    const toneBaseGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 16);
    const toneBaseMat = new THREE.MeshStandardMaterial({ color: 0x8d99ae, metalness: 0.9, roughness: 0.2 });
    const toneBase = new THREE.Mesh(toneBaseGeo, toneBaseMat);
    tonearmGroup.add(toneBase);

    // Metal Arm Pole
    const armGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.8, 16);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xe6e6e6, metalness: 0.95, roughness: 0.1 });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(-0.7, 0.2, 0.6);
    tonearmGroup.add(arm);

    scene.add(tonearmGroup);

    // Vacuum Tube Glass Shield
    const tubeGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.5, 16);
    const tubeMat = new THREE.MeshPhysicalMaterial({
      color: 0xff9f1c,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      transmission: 0.9,
      ior: 1.5,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    tubeMesh.position.set(-1.8, 0.35, -1.3);
    scene.add(tubeMesh);

    // 5. Animation Loop
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Spin record if audio is playing
      if (isPlaying) {
        vinylGroup.rotation.y += 0.03 * playbackSpeed;
        tubeLight.intensity = 2.5 + Math.sin(Date.now() * 0.005) * 0.5; // Vacuum tube warm pulse
        tonearmGroup.rotation.y = THREE.MathUtils.lerp(tonearmGroup.rotation.y, -0.35, 0.05); // Pivot arm onto record
      } else {
        vinylGroup.rotation.y += 0.002; // Idle slow spin
        tubeLight.intensity = 1.2;
        tonearmGroup.rotation.y = THREE.MathUtils.lerp(tonearmGroup.rotation.y, 0, 0.05); // Pivot arm away
      }

      renderer.render(scene, camera);
    };

    animate();

    // Handle Resize
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || 300;
      const newH = container.clientHeight || 300;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isPlaying, playbackSpeed, reducedMotion]);

  // Fallback for prefers-reduced-motion or low power
  if (reducedMotion) {
    return (
      <div className={`relative flex items-center justify-center bg-[#1E1E24] border border-[#8D99AE]/20 rounded-2xl p-6 ${className}`}>
        <div className="w-40 h-40 rounded-full border-4 border-[#0A0A0C] bg-[#0A0A0C] flex items-center justify-center relative shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-[#FF9F1C] border-2 border-white/20 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-[#0A0A0C]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
}
