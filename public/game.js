import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

class SpaceGame {
  constructor() {
    this.players = {};
    this.socket = io();

    // Game state
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      shift: false, // For warp speed
    };

    // Physics
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.acceleration = new THREE.Vector3(0, 0, 0);
    this.thrusterPower = 0.01;
    this.maxSpeed = 200; // 100x larger (was 2)
    this.drag = 0.98; // Space has no drag, but a small amount helps gameplay

    // Warp speed system
    this.warpActive = false;
    this.warpSpeedMultiplier = 100000; // Set to exactly 1000x
    this.maxStamina = 100;
    this.currentStamina = 100;
    this.staminaRegenRate = 5; // Per second
    this.staminaUseRate = 20; // Per second
    this.lastStaminaUpdate = 0;

    // Add warp visual effects
    this.warpEffect = null;
    this.normalMaxSpeed = 200; // Store the normal max speed

    // UI
    this.showUI = true;

    // Mouse control
    this.mouseSensitivity = 0.002;
    this.isPointerLocked = false;

    // Galaxy parameters
    this.galaxyParams = {
      starsCount: 15000,
      galaxyRadius: 1000000, // 100x larger (was 1000)
      galaxyThickness: 50000, // 100x larger (was 50)
      spiralArms: 5,
      spiralTightness: 0.7,
      nebulaCount: 2000, // 10x more nebulae for the larger space
      nebulaSize: 10000, // 100x larger (was 100)
      dustLaneCount: 200, // 10x more dust lanes
      dustLaneSize: 500, // 100x larger (was 0.5)
    };

    // Reference vectors
    this.worldUp = new THREE.Vector3(0, 1, 0);

    this.init();
    this.setupEventListeners();
    this.setupSocketListeners();
  }

  init() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000005); // Very dark blue, almost black

    // Create camera with increased far plane to see distant objects
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000000000000000 // 1000x larger (was 10000) to see very distant objects
    );

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.domElement.id = "game-canvas";
    document
      .getElementById("game-container")
      .appendChild(this.renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);

    // Create galaxy
    this.createGalaxy();

    // Create player ship
    this.createPlayerShip();

    // Setup pointer lock
    this.setupPointerLock();

    // Start animation loop
    this.animate();
  }

  createGalaxy() {
    // Create distant background stars (tiny points)
    this.createDistantStars();

    // Create distant galaxies
    this.createDistantGalaxies();

    // Create galactic core (bright center)
    this.createGalacticCore();

    // Create spiral arms with stars
    this.createSpiralArms();

    // Create nebulae (colorful gas clouds)
    this.createNebulae();

    // Create dust lanes (dark areas)
    this.createDustLanes();

    // Create some closer stars with lens flares
    this.createBrightStars();
  }

  createDistantStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1, // 100x larger (was 0.1)
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: false,
    });

    const starsVertices = [];
    const colors = [];

    // Create different colored stars
    const starColors = [
      new THREE.Color(0xffffdd), // Yellow-white
      new THREE.Color(0xffd6aa), // Orange-white
      new THREE.Color(0xaaaaff), // Blue-white
      new THREE.Color(0xddddff), // White-blue
    ];

    for (let i = 0; i < 50000; i++) {
      // More stars for a larger universe
      // Distribute stars in a sphere around the player
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      // All stars are now positioned beyond the galaxy
      const distance = 10000000000 + Math.random() * 3000000000; // 100x larger

      const x = distance * Math.sin(phi) * Math.cos(theta);
      const y = distance * Math.sin(phi) * Math.sin(theta);
      const z = distance * Math.cos(phi);

      starsVertices.push(x, y, z);

      // Assign random star color
      const color = starColors[Math.floor(Math.random() * starColors.length)];
      colors.push(color.r, color.g, color.b);
    }

    starsGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starsVertices, 3)
    );
    starsGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    starsMaterial.vertexColors = true;

    const distantStars = new THREE.Points(starsGeometry, starsMaterial);
    this.scene.add(distantStars);
  }

  createDistantGalaxies() {
    // Create several distant galaxies
    for (let i = 0; i < 3000; i++) {
      // More galaxies
      // Random position far away from the player
      const distance = 10000000000 + Math.random() * 3000000; // 100x larger
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = distance * Math.sin(phi) * Math.cos(theta);
      const y = distance * Math.sin(phi) * Math.sin(theta);
      const z = distance * Math.cos(phi);

      // Create galaxy type (disc, elliptical, or irregular)
      const galaxyType = Math.floor(Math.random() * 3);

      // Create galaxy container
      const galaxyContainer = new THREE.Object3D();
      galaxyContainer.position.set(x, y, z);

      // Random rotation
      galaxyContainer.rotation.x = Math.random() * Math.PI * 2;
      galaxyContainer.rotation.y = Math.random() * Math.PI * 2;
      galaxyContainer.rotation.z = Math.random() * Math.PI * 2;

      // Galaxy size
      const galaxySize = Math.min(6000000, Math.random() * 100000000); // 100x larger

      // Create galaxy based on type
      if (galaxyType === 0) {
        // Disc galaxy
        this.createDiscGalaxy(galaxyContainer, galaxySize);
      } else if (galaxyType === 1) {
        // Elliptical galaxy
        this.createEllipticalGalaxy(galaxyContainer, galaxySize);
      } else {
        // Irregular galaxy
        this.createIrregularGalaxy(galaxyContainer, galaxySize);
      }

      this.scene.add(galaxyContainer);
    }
  }

  createDiscGalaxy(container, size) {
    // Create a disc-shaped galaxy with spiral arms
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2000, // 100x larger (was 20)
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    const starsVertices = [];
    const colors = [];

    // Galaxy colors
    const galaxyColor = new THREE.Color(
      0.5 + Math.random() * 0.5,
      0.5 + Math.random() * 0.5,
      0.5 + Math.random() * 0.5
    );

    // Create spiral arms
    const arms = 2 + Math.floor(Math.random() * 4);
    const armTightness = 0.5 + Math.random() * 1.5;

    for (let i = 0; i < 5000; i++) {
      const arm = Math.floor(Math.random() * arms);
      const radius = Math.pow(Math.random(), 0.5) * size;
      const angle = (arm / arms) * Math.PI * 2 + (armTightness * radius) / size;

      const x = radius * Math.cos(angle + Math.random() * 0.3);
      const z = radius * Math.sin(angle + Math.random() * 0.3);
      const y = (Math.random() - 0.5) * size * 0.1;

      starsVertices.push(x, y, z);
      colors.push(galaxyColor.r, galaxyColor.g, galaxyColor.b);
    }

    starsGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starsVertices, 3)
    );
    starsGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    starsMaterial.vertexColors = true;

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    container.add(stars);

    // Add a bright core
    const coreGeometry = new THREE.SphereGeometry(size * 0.1, 16, 16);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: galaxyColor,
      transparent: true,
      opacity: 0.7,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    container.add(core);
  }

  createEllipticalGalaxy(container, size) {
    // Create an elliptical galaxy (more spherical)
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffdd,
      size: 2000, // 100x larger (was 20)
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    const starsVertices = [];

    // Galaxy color (ellipticals tend to be redder)
    const galaxyColor = new THREE.Color(
      0.8 + Math.random() * 0.2,
      0.6 + Math.random() * 0.2,
      0.5 + Math.random() * 0.2
    );

    // Elliptical shape parameters
    const a = size;
    const b = size * (0.7 + Math.random() * 0.3);
    const c = size * (0.6 + Math.random() * 0.3);

    for (let i = 0; i < 3000; i++) {
      // Create elliptical distribution
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);

      // Radius with higher concentration toward center
      const r = Math.pow(Math.random(), 2) * size;

      const x = r * Math.sin(phi) * Math.cos(theta) * (a / size);
      const y = r * Math.sin(phi) * Math.sin(theta) * (b / size);
      const z = r * Math.cos(phi) * (c / size);

      starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starsVertices, 3)
    );

    starsMaterial.color = galaxyColor;

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    container.add(stars);
  }

  createIrregularGalaxy(container, size) {
    // Create an irregular galaxy with random clumps
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2000, // 100x larger (was 20)
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    const starsVertices = [];
    const colors = [];

    // Create random clumps
    const clumpCount = 3 + Math.floor(Math.random() * 5);
    const clumpCenters = [];
    const clumpSizes = [];
    const clumpColors = [];

    for (let i = 0; i < clumpCount; i++) {
      // Random position within the galaxy volume
      const x = (Math.random() - 0.5) * size;
      const y = (Math.random() - 0.5) * size;
      const z = (Math.random() - 0.5) * size;

      clumpCenters.push(new THREE.Vector3(x, y, z));
      clumpSizes.push(size * 0.2 + Math.random() * size * 0.3);

      // Random color for this clump
      clumpColors.push(
        new THREE.Color(
          0.5 + Math.random() * 0.5,
          0.5 + Math.random() * 0.5,
          0.5 + Math.random() * 0.5
        )
      );
    }

    // Create stars, with higher probability near clump centers
    for (let i = 0; i < 4000; i++) {
      // Choose a random clump
      const clumpIndex = Math.floor(Math.random() * clumpCount);
      const clumpCenter = clumpCenters[clumpIndex];
      const clumpSize = clumpSizes[clumpIndex];
      const clumpColor = clumpColors[clumpIndex];

      // Random position near the clump center
      const radius = Math.pow(Math.random(), 0.5) * clumpSize;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = clumpCenter.x + radius * Math.sin(phi) * Math.cos(theta);
      const y = clumpCenter.y + radius * Math.sin(phi) * Math.sin(theta);
      const z = clumpCenter.z + radius * Math.cos(phi);

      starsVertices.push(x, y, z);
      colors.push(clumpColor.r, clumpColor.g, clumpColor.b);
    }

    starsGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starsVertices, 3)
    );
    starsGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    starsMaterial.vertexColors = true;

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    container.add(stars);
  }

  createGalacticCore() {
    // Create a bright central core
    const coreGeometry = new THREE.SphereGeometry(3000, 32, 32); // 100x larger (was 30)
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffcc,
      transparent: true,
      opacity: 0.1,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    this.scene.add(core);

    // Add a glow effect
    const glowGeometry = new THREE.SphereGeometry(4000, 32, 32); // 100x larger (was 40)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffaa,
      transparent: true,
      opacity: 0.9,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.scene.add(glow);

    // Add dense stars around the core
    const coreStarsGeometry = new THREE.BufferGeometry();
    const coreStarsMaterial = new THREE.PointsMaterial({
      color: 0xffffdd,
      size: 50, // 100x larger (was 0.5)
      transparent: true,
      opacity: 0.8,
    });

    const coreStarsVertices = [];
    for (let i = 0; i < 5000; i++) {
      const radius = 5000 * Math.random(); // 100x larger (was 50)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI - Math.PI / 2;

      const x = radius * Math.cos(theta) * Math.cos(phi);
      const y = radius * Math.sin(phi) * 0.2; // Flatten in y direction
      const z = radius * Math.sin(theta) * Math.cos(phi);

      coreStarsVertices.push(x, y, z);
    }

    coreStarsGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(coreStarsVertices, 3)
    );
    const coreStars = new THREE.Points(coreStarsGeometry, coreStarsMaterial);
    this.scene.add(coreStars);
  }

  createSpiralArms() {
    const {
      galaxyRadius,
      galaxyThickness,
      spiralArms,
      spiralTightness,
      starsCount,
    } = this.galaxyParams;

    // Create stars in spiral arms
    const armStarsGeometry = new THREE.BufferGeometry();
    const armStarsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 70, // 100x larger (was 0.7)
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    const colors = [];
    const armStarsVertices = [];

    // Create different colored stars
    const starColors = [
      new THREE.Color(0xffffdd), // Yellow-white
      new THREE.Color(0xffd6aa), // Orange-white
      new THREE.Color(0xaaaaff), // Blue-white
      new THREE.Color(0xddddff), // White-blue
    ];

    for (let i = 0; i < starsCount; i++) {
      // Determine which spiral arm this star belongs to
      const armIndex = Math.floor(Math.random() * spiralArms);

      // Calculate distance from center (with more stars toward the center)
      const distance = Math.pow(Math.random(), 0.5) * galaxyRadius;

      // Calculate angle based on distance and arm
      const angle =
        (armIndex / spiralArms) * Math.PI * 2 +
        (spiralTightness * distance) / galaxyRadius;

      // Add some randomness to the angle
      const randomAngle = angle + (Math.random() * 0.5 - 0.25);

      // Calculate position
      const x = distance * Math.cos(randomAngle);
      const z = distance * Math.sin(randomAngle);

      // Y position (thickness of the galaxy)
      const y =
        (Math.random() - 0.5) *
        galaxyThickness *
        (1 - Math.pow(distance / galaxyRadius, 2) * 0.8); // Thinner at edges

      armStarsVertices.push(x, y, z);

      // Assign random star color
      const color = starColors[Math.floor(Math.random() * starColors.length)];
      colors.push(color.r, color.g, color.b);
    }

    armStarsGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(armStarsVertices, 3)
    );
    armStarsGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    armStarsMaterial.vertexColors = true;

    const armStars = new THREE.Points(armStarsGeometry, armStarsMaterial);
    this.scene.add(armStars);
  }

  createNebulae() {
    const { nebulaCount, nebulaSize, galaxyRadius } = this.galaxyParams;

    // Create nebulae (gas clouds)
    const nebulaColors = [
      0xff5a5a, // Red
      0x5a5aff, // Blue
      0x5affff, // Cyan
      0xff5aff, // Purple
    ];

    for (let i = 0; i < nebulaCount; i++) {
      // Position nebulae along spiral arms
      const armIndex = Math.floor(Math.random() * this.galaxyParams.spiralArms);
      const distance = Math.random() * galaxyRadius * 0.8;
      const angle =
        (armIndex / this.galaxyParams.spiralArms) * Math.PI * 2 +
        (this.galaxyParams.spiralTightness * distance) / galaxyRadius;

      // Add some randomness
      const randomAngle = angle + (Math.random() * 0.3 - 0.15);

      const x = distance * Math.cos(randomAngle);
      const z = distance * Math.sin(randomAngle);
      const y = (Math.random() - 0.5) * this.galaxyParams.galaxyThickness * 0.5;

      // Create nebula
      const size = nebulaSize * (0.5 + Math.random() * 0.5);
      const nebulaGeometry = new THREE.SphereGeometry(size, 8, 8);
      const nebulaMaterial = new THREE.MeshBasicMaterial({
        color: nebulaColors[Math.floor(Math.random() * nebulaColors.length)],
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
      });

      const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
      nebula.position.set(x, y, z);
      this.scene.add(nebula);
    }
  }

  createDustLanes() {
    const { dustLaneCount, dustLaneSize, galaxyRadius } = this.galaxyParams;

    // Create dust lanes (dark areas in the galaxy)
    const dustGeometry = new THREE.BufferGeometry();
    const dustMaterial = new THREE.PointsMaterial({
      color: 0x000000,
      size: dustLaneSize,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    });

    const dustVertices = [];

    for (let i = 0; i < dustLaneCount; i++) {
      // Position dust along spiral arms but with an offset
      const armIndex = Math.floor(Math.random() * this.galaxyParams.spiralArms);
      const distance = 50 + Math.random() * (galaxyRadius * 0.9);
      const angle =
        (armIndex / this.galaxyParams.spiralArms) * Math.PI * 2 +
        (this.galaxyParams.spiralTightness * distance) / galaxyRadius +
        Math.PI / (this.galaxyParams.spiralArms * 2); // Offset from the arm

      const x = distance * Math.cos(angle);
      const z = distance * Math.sin(angle);
      const y = (Math.random() - 0.5) * this.galaxyParams.galaxyThickness * 0.3;

      dustVertices.push(x, y, z);
    }

    dustGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(dustVertices, 3)
    );
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    this.scene.add(dust);
  }

  createBrightStars() {
    // Create a few very bright stars with lens flares
    const textureLoader = new THREE.TextureLoader();

    // Create 10 bright stars
    for (let i = 0; i < 10; i++) {
      // Random position within the galaxy but not too close to center
      const distance =
        10000 + Math.random() * this.galaxyParams.galaxyRadius * 0.7; // 100x larger
      const angle = Math.random() * Math.PI * 2;
      const x = distance * Math.cos(angle);
      const z = distance * Math.sin(angle);
      const y = (Math.random() - 0.5) * this.galaxyParams.galaxyThickness;

      // Create a bright point for the star
      const starGeometry = new THREE.SphereGeometry(100, 8, 8); // 100x larger (was 1)
      const starMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
      });

      const star = new THREE.Mesh(starGeometry, starMaterial);
      star.position.set(x, y, z);
      this.scene.add(star);

      // Add a glow effect
      const glowGeometry = new THREE.SphereGeometry(200, 8, 8); // 100x larger (was 2)
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffdd,
        transparent: true,
        opacity: 0.5,
        side: THREE.BackSide,
      });

      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      star.add(glow);
    }
  }

  createPlayerShip() {
    // Create a container for the entire ship and camera system
    this.shipContainer = new THREE.Object3D();
    this.scene.add(this.shipContainer);

    // Create a separate object for horizontal rotation (yaw)
    this.yawObject = new THREE.Object3D();
    this.shipContainer.add(this.yawObject);

    // Create a separate object for vertical rotation (pitch)
    this.pitchObject = new THREE.Object3D();
    this.yawObject.add(this.pitchObject);

    // Create ship object
    const geometry = new THREE.ConeGeometry(0.5, 1, 8);
    geometry.rotateX(Math.PI / 2); // Orient the cone to point forward

    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    this.ship = new THREE.Mesh(geometry, material);
    this.pitchObject.add(this.ship);

    // Position camera behind the ship
    this.camera.position.set(0, 0.5, 3);
    this.pitchObject.add(this.camera);

    // Create warp speed visual effect (initially invisible)
    const warpGeometry = new THREE.CylinderGeometry(0.5, 3, 20, 16, 1, true);
    const warpMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    this.warpEffect = new THREE.Mesh(warpGeometry, warpMaterial);
    this.warpEffect.rotation.x = Math.PI / 2; // Align with ship
    this.warpEffect.position.z = -10; // Position behind the ship
    this.pitchObject.add(this.warpEffect);
  }

  setupPointerLock() {
    const canvas = this.renderer.domElement;

    // Request pointer lock when canvas is clicked
    canvas.addEventListener("click", () => {
      if (!this.isPointerLocked) {
        canvas.requestPointerLock();
      }
    });

    // Handle pointer lock change
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === canvas) {
        this.isPointerLocked = true;
        document.addEventListener(
          "mousemove",
          this.onMouseMove.bind(this),
          false
        );
      } else {
        this.isPointerLocked = false;
        document.removeEventListener(
          "mousemove",
          this.onMouseMove.bind(this),
          false
        );
      }
    });

    // Handle pointer lock error
    document.addEventListener("pointerlockerror", () => {
      console.error("Pointer lock error");
    });
  }

  onMouseMove(event) {
    if (!this.isPointerLocked) return;

    // Get mouse movement delta
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    // Apply yaw rotation (left/right) to the yaw object
    this.yawObject.rotation.y -= movementX * this.mouseSensitivity;

    // Apply pitch rotation (up/down) to the pitch object
    this.pitchObject.rotation.x -= movementY * this.mouseSensitivity;

    // Clamp the pitch rotation to avoid flipping
    this.pitchObject.rotation.x = Math.max(
      -Math.PI / 2 + 0.1,
      Math.min(Math.PI / 2 - 0.1, this.pitchObject.rotation.x)
    );
  }

  createOtherPlayerShip(playerId) {
    const geometry = new THREE.ConeGeometry(0.5, 1, 8);
    geometry.rotateX(Math.PI / 2);

    const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    const ship = new THREE.Mesh(geometry, material);
    this.scene.add(ship);

    this.players[playerId] = {
      ship: ship,
    };
  }

  setupEventListeners() {
    // Handle window resize
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Keyboard controls for thrusters
    document.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() === "w") this.keys.w = true;
      if (event.key.toLowerCase() === "a") this.keys.a = true;
      if (event.key.toLowerCase() === "s") this.keys.s = true;
      if (event.key.toLowerCase() === "d") this.keys.d = true;
      if (event.key === "Shift") this.keys.shift = true;

      // Toggle UI visibility with H key
      if (event.key.toLowerCase() === "h") {
        this.showUI = !this.showUI;
        this.updateUIVisibility();
      }
    });

    document.addEventListener("keyup", (event) => {
      if (event.key.toLowerCase() === "w") this.keys.w = false;
      if (event.key.toLowerCase() === "a") this.keys.a = false;
      if (event.key.toLowerCase() === "s") this.keys.s = false;
      if (event.key.toLowerCase() === "d") this.keys.d = false;
      if (event.key === "Shift") this.keys.shift = false;
    });
  }

  setupSocketListeners() {
    // Get current players when joining
    this.socket.on("currentPlayers", (players) => {
      Object.keys(players).forEach((id) => {
        if (id !== this.socket.id) {
          this.createOtherPlayerShip(id);
          this.players[id].ship.position.set(
            players[id].position.x,
            players[id].position.y,
            players[id].position.z
          );

          // Set quaternion for rotation
          const quaternion = new THREE.Quaternion(
            players[id].quaternion._x,
            players[id].quaternion._y,
            players[id].quaternion._z,
            players[id].quaternion._w
          );
          this.players[id].ship.quaternion.copy(quaternion);
        }
      });
    });

    // Handle new player joining
    this.socket.on("newPlayer", (playerInfo) => {
      this.createOtherPlayerShip(playerInfo.id);
    });

    // Update other player positions
    this.socket.on("playerMoved", (playerInfo) => {
      if (this.players[playerInfo.id]) {
        this.players[playerInfo.id].ship.position.set(
          playerInfo.position.x,
          playerInfo.position.y,
          playerInfo.position.z
        );

        // Set quaternion for rotation
        const quaternion = new THREE.Quaternion(
          playerInfo.quaternion._x,
          playerInfo.quaternion._y,
          playerInfo.quaternion._z,
          playerInfo.quaternion._w
        );
        this.players[playerInfo.id].ship.quaternion.copy(quaternion);
      }
    });

    // Remove disconnected players
    this.socket.on("playerDisconnected", (playerId) => {
      if (this.players[playerId]) {
        this.scene.remove(this.players[playerId].ship);
        delete this.players[playerId];
      }
    });
  }

  updateShipPhysics() {
    if (!this.shipContainer) return;

    // Reset acceleration
    this.acceleration.set(0, 0, 0);

    // Get ship's direction vectors based on the pitch object's orientation
    const shipForward = new THREE.Vector3(0, 0, -1);
    shipForward.applyQuaternion(this.pitchObject.quaternion);
    shipForward.applyQuaternion(this.yawObject.quaternion);

    const shipRight = new THREE.Vector3(1, 0, 0);
    shipRight.applyQuaternion(this.pitchObject.quaternion);
    shipRight.applyQuaternion(this.yawObject.quaternion);

    const shipUp = new THREE.Vector3(0, 1, 0);
    shipUp.applyQuaternion(this.pitchObject.quaternion);
    shipUp.applyQuaternion(this.yawObject.quaternion);

    // Handle warp speed
    const now = performance.now();
    const deltaTime = (now - this.lastStaminaUpdate) / 1000; // Convert to seconds
    this.lastStaminaUpdate = now;

    // Previous warp state for transition effects
    const wasWarping = this.warpActive;

    // Check if warp is active
    this.warpActive = this.keys.shift && this.currentStamina > 0;

    // Update stamina
    // if (this.warpActive) {
    //   // Drain stamina when warping
    //   this.currentStamina = Math.max(
    //     0,
    //     this.currentStamina - this.staminaUseRate * deltaTime
    //   );
    if (this.warpActive) {
      // Drain stamina when warping
      this.currentStamina = 1;

      // Update UI
      if (this.staminaBar) {
        this.staminaBar.style.width = `${this.currentStamina}%`;
        this.staminaBar.style.backgroundColor = "rgba(0, 255, 255, 0.7)"; // Cyan when active
      }

      // Set max speed to warp speed
      this.maxSpeed = this.normalMaxSpeed * this.warpSpeedMultiplier;

      // Show warp effect
      if (this.warpEffect) {
        // Fade in effect if just starting warp
        if (!wasWarping) {
          this.fadeInWarpEffect();
        }
        this.warpEffect.material.opacity = 0.7;
      }
    } else {
      // Regenerate stamina when not warping
      this.currentStamina = Math.min(
        this.maxStamina,
        this.currentStamina + this.staminaRegenRate * deltaTime
      );

      // Update UI
      if (this.staminaBar) {
        this.staminaBar.style.width = `${this.currentStamina}%`;

        // Change color based on stamina level
        if (this.currentStamina < 30) {
          this.staminaBar.style.backgroundColor = "rgba(255, 0, 0, 0.7)"; // Red when low
        } else {
          this.staminaBar.style.backgroundColor = "rgba(0, 255, 0, 0.7)"; // Green when recharging
        }
      }

      // Reset max speed to normal
      this.maxSpeed = this.normalMaxSpeed;

      // Hide warp effect
      if (this.warpEffect && wasWarping) {
        this.fadeOutWarpEffect();
      }
    }

    // Calculate thrust power (normal or warp)
    let currentThrusterPower = this.thrusterPower;
    if (this.warpActive) {
      currentThrusterPower *= this.warpSpeedMultiplier;
    }

    // Apply thrust based on key presses
    // Forward/backward thrust (W/S)
    if (this.keys.w) {
      this.acceleration.addScaledVector(shipForward, currentThrusterPower);
    }
    if (this.keys.s) {
      this.acceleration.addScaledVector(shipForward, -currentThrusterPower);
    }

    // Left/right thrust (A/D)
    if (this.keys.a) {
      this.acceleration.addScaledVector(shipRight, -currentThrusterPower);
    }
    if (this.keys.d) {
      this.acceleration.addScaledVector(shipRight, currentThrusterPower);
    }

    // Update velocity based on acceleration
    this.velocity.add(this.acceleration);

    // Apply drag
    this.velocity.multiplyScalar(this.drag);

    // Limit maximum speed
    const currentSpeed = this.velocity.length();
    if (currentSpeed > this.maxSpeed) {
      this.velocity.normalize().multiplyScalar(this.maxSpeed);
    }

    // Update position based on velocity
    this.shipContainer.position.add(this.velocity);

    // Update speed display in UI
    this.updateSpeedDisplay(currentSpeed);

    // Get the combined quaternion of the ship for sending to server
    const combinedQuaternion = new THREE.Quaternion();
    combinedQuaternion.multiplyQuaternions(
      this.yawObject.quaternion,
      this.pitchObject.quaternion
    );

    // Send position and rotation update to server
    this.socket.emit("playerMovement", {
      position: {
        x: this.shipContainer.position.x,
        y: this.shipContainer.position.y,
        z: this.shipContainer.position.z,
      },
      quaternion: {
        _x: combinedQuaternion.x,
        _y: combinedQuaternion.y,
        _z: combinedQuaternion.z,
        _w: combinedQuaternion.w,
      },
      velocity: {
        x: this.velocity.x,
        y: this.velocity.y,
        z: this.velocity.z,
      },
    });
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    this.updateShipPhysics();

    this.renderer.render(this.scene, this.camera);
  }

  createUI() {
    // Create UI container
    this.uiContainer = document.createElement("div");
    this.uiContainer.id = "game-ui";
    this.uiContainer.style.position = "absolute";
    this.uiContainer.style.bottom = "20px";
    this.uiContainer.style.left = "20px";
    this.uiContainer.style.color = "white";
    this.uiContainer.style.fontFamily = "Arial, sans-serif";
    this.uiContainer.style.padding = "15px";
    this.uiContainer.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    this.uiContainer.style.borderRadius = "5px";
    this.uiContainer.style.zIndex = "100";

    // Controls section
    const controlsTitle = document.createElement("h3");
    controlsTitle.textContent = "Controls";
    controlsTitle.style.margin = "0 0 10px 0";
    this.uiContainer.appendChild(controlsTitle);

    const controlsList = document.createElement("ul");
    controlsList.style.padding = "0 0 0 20px";
    controlsList.style.margin = "0";
    controlsList.style.listStyleType = "none";

    const controls = [
      "W - Forward thrust",
      "S - Backward thrust",
      "A - Left thrust",
      "D - Right thrust",
      "Mouse - Steer ship",
      "Shift - Warp speed (1000x, uses stamina)",
      "H - Toggle UI visibility",
      "Click - Lock/unlock mouse",
    ];

    controls.forEach((control) => {
      const item = document.createElement("li");
      item.textContent = control;
      item.style.margin = "5px 0";
      controlsList.appendChild(item);
    });

    this.uiContainer.appendChild(controlsList);

    // Stamina bar
    const staminaContainer = document.createElement("div");
    staminaContainer.style.marginTop = "15px";

    const staminaLabel = document.createElement("div");
    staminaLabel.textContent = "Warp Drive Energy";
    staminaLabel.style.marginBottom = "5px";
    staminaContainer.appendChild(staminaLabel);

    const staminaBarContainer = document.createElement("div");
    staminaBarContainer.style.width = "200px";
    staminaBarContainer.style.height = "15px";
    staminaBarContainer.style.backgroundColor = "rgba(50, 50, 50, 0.7)";
    staminaBarContainer.style.borderRadius = "3px";
    staminaBarContainer.style.overflow = "hidden";

    this.staminaBar = document.createElement("div");
    this.staminaBar.style.width = "100%";
    this.staminaBar.style.height = "100%";
    this.staminaBar.style.backgroundColor = "rgba(0, 255, 0, 0.7)";
    this.staminaBar.style.transition = "width 0.2s, background-color 0.3s";
    this.staminaBar.style.borderRadius = "3px";

    staminaBarContainer.appendChild(this.staminaBar);
    staminaContainer.appendChild(staminaBarContainer);

    this.uiContainer.appendChild(staminaContainer);

    // Add to document
    document.body.appendChild(this.uiContainer);
  }

  updateUIVisibility() {
    if (this.showUI) {
      this.uiContainer.style.display = "block";
      if (this.speedDisplay) this.speedDisplay.style.display = "block";
    } else {
      this.uiContainer.style.display = "none";
      if (this.speedDisplay) this.speedDisplay.style.display = "none";
    }
  }

  // Add these new methods for warp effects

  fadeInWarpEffect() {
    if (!this.warpEffect) return;

    // Reset opacity
    this.warpEffect.material.opacity = 0;

    // Animate opacity
    const fadeIn = () => {
      if (this.warpEffect.material.opacity < 0.7) {
        this.warpEffect.material.opacity += 0.05;
        requestAnimationFrame(fadeIn);
      }
    };

    fadeIn();
  }

  fadeOutWarpEffect() {
    if (!this.warpEffect) return;

    // Animate opacity
    const fadeOut = () => {
      if (this.warpEffect.material.opacity > 0) {
        this.warpEffect.material.opacity -= 0.05;
        requestAnimationFrame(fadeOut);
      }
    };

    fadeOut();
  }

  updateSpeedDisplay(currentSpeed) {
    // Create speed display if it doesn't exist
    if (!this.speedDisplay) {
      this.speedDisplay = document.createElement("div");
      this.speedDisplay.style.position = "absolute";
      this.speedDisplay.style.top = "20px";
      this.speedDisplay.style.right = "20px";
      this.speedDisplay.style.color = "white";
      this.speedDisplay.style.fontFamily = "Arial, sans-serif";
      this.speedDisplay.style.padding = "10px";
      this.speedDisplay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
      this.speedDisplay.style.borderRadius = "5px";
      this.speedDisplay.style.zIndex = "100";
      document.body.appendChild(this.speedDisplay);
    }

    // Format speed with commas for large numbers
    const formattedSpeed = Math.round(currentSpeed).toLocaleString();

    // Update display
    this.speedDisplay.innerHTML = `
      <div style="font-size: 14px;">CURRENT SPEED</div>
      <div style="font-size: 24px; font-weight: bold; color: ${
        this.warpActive ? "#00ffff" : "white"
      };">
        ${formattedSpeed} u/s
      </div>
      <div style="font-size: 12px; color: ${
        this.warpActive ? "#00ffff" : "#aaaaaa"
      };">
        ${this.warpActive ? "WARP DRIVE ACTIVE" : "NORMAL DRIVE"}
      </div>
    `;

    // Update visibility
    this.speedDisplay.style.display = this.showUI ? "block" : "none";
  }
}

// Initialize the game when the page loads
window.onload = () => {
  new SpaceGame();
};
