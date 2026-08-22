'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface CityDome3DProps {
  className?: string;
  accentColor?: string;
}

export default function CityDome3D({
  className = 'w-48 h-48 md:w-56 md:h-56',
  accentColor = '#00F0FF',
}: CityDome3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

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
    const width = container.clientWidth || 220;
    const height = container.clientHeight || 220;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 2.5, 6.5);
    camera.lookAt(0, 0, 0);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(5, 10, 7);
    scene.add(mainLight);

    const colorHex = parseInt(accentColor.replace('#', '0x'), 16) || 0x00f0ff;
    const glowLight = new THREE.PointLight(colorHex, 2.5, 8);
    glowLight.position.set(0, 1.2, 0);
    scene.add(glowLight);

    // 4. Floating Island Group
    const domeGroup = new THREE.Group();

    // Floating Rock Base
    const rockGeo = new THREE.CylinderGeometry(2.0, 0.4, 0.8, 32);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x1a2b22,
      roughness: 0.8,
      metalness: 0.2,
    });
    const rockBase = new THREE.Mesh(rockGeo, rockMat);
    rockBase.position.y = -0.4;
    domeGroup.add(rockBase);

    // Island Top Grass/Surface Layer
    const grassGeo = new THREE.CylinderGeometry(2.02, 2.0, 0.1, 32);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x0f382a,
      roughness: 0.6,
    });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.position.y = 0.02;
    domeGroup.add(grass);

    // Glowing Central Pool
    const poolGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.05, 32);
    const poolMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.5,
      roughness: 0.1,
    });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.position.y = 0.08;
    domeGroup.add(pool);

    // Miniature Cityscape Skyscrapers
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x0a1628,
      roughness: 0.2,
      metalness: 0.8,
    });
    const windowMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.8,
    });

    const buildingCoords = [
      { x: 0, z: 0, w: 0.4, h: 1.8, d: 0.4 },
      { x: -0.5, z: -0.4, w: 0.35, h: 1.4, d: 0.35 },
      { x: 0.5, z: -0.3, w: 0.3, h: 1.6, d: 0.3 },
      { x: -0.4, z: 0.4, w: 0.3, h: 1.1, d: 0.3 },
      { x: 0.4, z: 0.4, w: 0.25, h: 1.3, d: 0.25 },
      { x: 0, z: -0.6, w: 0.3, h: 1.0, d: 0.3 },
    ];

    buildingCoords.forEach((b) => {
      const bGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const building = new THREE.Mesh(bGeo, buildingMat);
      building.position.set(b.x, b.h / 2 + 0.1, b.z);
      domeGroup.add(building);

      // Glowing Spire Cap
      const spireGeo = new THREE.CylinderGeometry(0.02, 0.08, 0.3, 8);
      const spire = new THREE.Mesh(spireGeo, windowMat);
      spire.position.set(b.x, b.h + 0.2, b.z);
      domeGroup.add(spire);
    });

    // Outer Glass Globe Dome (Hemisphere)
    const glassGeo = new THREE.SphereGeometry(2.1, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      roughness: 0.05,
      transmission: 0.95,
      ior: 1.5,
      reflectivity: 0.9,
    });
    const glassDome = new THREE.Mesh(glassGeo, glassMat);
    glassDome.position.y = 0.02;
    domeGroup.add(glassDome);

    scene.add(domeGroup);

    // 5. Animation Loop
    let animationFrameId: number;
    let startTime = Date.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = (Date.now() - startTime) / 1000;

      domeGroup.position.y = Math.sin(elapsed * 1.2) * 0.12;
      domeGroup.rotation.y = elapsed * 0.25;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || 220;
      const newH = container.clientHeight || 220;
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
  }, [reducedMotion, accentColor]);

  if (reducedMotion) {
    return (
      <div className={`relative flex items-center justify-center bg-[#060B19] border border-[#00F0FF]/30 rounded-full p-4 ${className}`}>
        <div className="w-32 h-32 rounded-full border-2 border-[#00F0FF] flex items-center justify-center text-xs font-bold text-[#00F0FF]">
          Dome View
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
}
