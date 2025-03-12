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
    };

    // Physics
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.acceleration = new THREE.Vector3(0, 0, 0);
    this.thrusterPower = 0.01;
    this.maxSpeed = 2;
    this.drag = 0.98; // Space has no drag, but a small amount helps gameplay

    // Mouse control
    this.mouseSensitivity = 0.002;
    this.isPointerLocked = false;

    // Galaxy parameters
    this.galaxyParams = {
      starsCount: 15000,
      galaxyRadius: 1000,
      galaxyThickness: 50,
      spiralArms: 5,
      spiralTightness: 0.7,
      nebulaCount: 20,
      nebulaSize: 100,
      dustLaneCount: 2000,
      dustLaneSize: 0.5,
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

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
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
      size: 0.1,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: false,
    });

    const starsVertices = [];
    for (let i = 0; i < 20000; i++) {
      // Distribute stars in a sphere around the player
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const distance = 5000 + Math.random() * 3000;

      const x = distance * Math.sin(phi) * Math.cos(theta);
      const y = distance * Math.sin(phi) * Math.sin(theta);
      const z = distance * Math.cos(phi);

      starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starsVertices, 3)
    );
    const distantStars = new THREE.Points(starsGeometry, starsMaterial);
    this.scene.add(distantStars);
  }

  createGalacticCore() {
    // Create a bright central core
    const coreGeometry = new THREE.SphereGeometry(30, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffcc,
      transparent: true,
      opacity: 0.7,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    this.scene.add(core);

    // Add a glow effect
    const glowGeometry = new THREE.SphereGeometry(40, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffaa,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    this.scene.add(glow);

    // Add dense stars around the core
    const coreStarsGeometry = new THREE.BufferGeometry();
    const coreStarsMaterial = new THREE.PointsMaterial({
      color: 0xffffdd,
      size: 0.5,
      transparent: true,
      opacity: 0.8,
    });

    const coreStarsVertices = [];
    for (let i = 0; i < 5000; i++) {
      const radius = 50 * Math.random();
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
      size: 0.7,
      transparent: true,
      opacity: 0.8,
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
        100 + Math.random() * this.galaxyParams.galaxyRadius * 0.7;
      const angle = Math.random() * Math.PI * 2;
      const x = distance * Math.cos(angle);
      const z = distance * Math.sin(angle);
      const y = (Math.random() - 0.5) * this.galaxyParams.galaxyThickness;

      // Create a bright point for the star
      const starGeometry = new THREE.SphereGeometry(1, 8, 8);
      const starMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
      });

      const star = new THREE.Mesh(starGeometry, starMaterial);
      star.position.set(x, y, z);
      this.scene.add(star);

      // Add a glow effect
      const glowGeometry = new THREE.SphereGeometry(2, 8, 8);
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
    });

    document.addEventListener("keyup", (event) => {
      if (event.key.toLowerCase() === "w") this.keys.w = false;
      if (event.key.toLowerCase() === "a") this.keys.a = false;
      if (event.key.toLowerCase() === "s") this.keys.s = false;
      if (event.key.toLowerCase() === "d") this.keys.d = false;
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
    // This ensures we get the correct forward direction
    const shipForward = new THREE.Vector3(0, 0, -1);
    shipForward.applyQuaternion(this.pitchObject.quaternion);
    shipForward.applyQuaternion(this.yawObject.quaternion);

    const shipRight = new THREE.Vector3(1, 0, 0);
    shipRight.applyQuaternion(this.pitchObject.quaternion);
    shipRight.applyQuaternion(this.yawObject.quaternion);

    const shipUp = new THREE.Vector3(0, 1, 0);
    shipUp.applyQuaternion(this.pitchObject.quaternion);
    shipUp.applyQuaternion(this.yawObject.quaternion);

    // Apply thrust based on key presses
    // Forward/backward thrust (W/S)
    if (this.keys.w) {
      this.acceleration.addScaledVector(shipForward, this.thrusterPower);
    }
    if (this.keys.s) {
      this.acceleration.addScaledVector(shipForward, -this.thrusterPower);
    }

    // Left/right thrust (A/D)
    if (this.keys.a) {
      this.acceleration.addScaledVector(shipRight, -this.thrusterPower);
    }
    if (this.keys.d) {
      this.acceleration.addScaledVector(shipRight, this.thrusterPower);
    }

    // Update velocity based on acceleration
    this.velocity.add(this.acceleration);

    // Apply drag
    this.velocity.multiplyScalar(this.drag);

    // Limit maximum speed
    if (this.velocity.length() > this.maxSpeed) {
      this.velocity.normalize().multiplyScalar(this.maxSpeed);
    }

    // Update position based on velocity
    this.shipContainer.position.add(this.velocity);

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
}

// Initialize the game when the page loads
window.onload = () => {
  new SpaceGame();
};
