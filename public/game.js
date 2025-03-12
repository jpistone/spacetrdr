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

    this.init();
    this.setupEventListeners();
    this.setupSocketListeners();
  }

  init() {
    // Create scene
    this.scene = new THREE.Scene();

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

    // Create stars (background)
    this.createStarfield();

    // Create player ship
    this.createPlayerShip();

    // Setup pointer lock
    this.setupPointerLock();

    // Start animation loop
    this.animate();
  }

  createStarfield() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1,
    });

    const starsVertices = [];
    for (let i = 0; i < 10000; i++) {
      const x = (Math.random() - 0.5) * 2000;
      const y = (Math.random() - 0.5) * 2000;
      const z = (Math.random() - 0.5) * 2000;
      starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starsVertices, 3)
    );
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    this.scene.add(stars);
  }

  createPlayerShip() {
    // Create a container for the ship and camera
    this.shipContainer = new THREE.Object3D();
    this.scene.add(this.shipContainer);

    // Create ship object
    const geometry = new THREE.ConeGeometry(0.5, 1, 8);
    geometry.rotateX(Math.PI / 2); // Orient the cone to point forward

    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    this.ship = new THREE.Mesh(geometry, material);
    this.shipContainer.add(this.ship);

    // Position camera behind the ship
    this.camera.position.set(0, 0.5, 3);
    this.shipContainer.add(this.camera);

    // Set initial rotation
    this.rotationX = 0;
    this.rotationY = 0;
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
    if (!this.isPointerLocked || !this.shipContainer) return;

    // Get mouse movement delta
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    // Update rotation values
    this.rotationY -= movementX * this.mouseSensitivity;
    this.rotationX -= movementY * this.mouseSensitivity;

    // Apply rotation using quaternions to avoid gimbal lock

    // First, create a quaternion for the Y-axis rotation (yaw)
    const quaternionY = new THREE.Quaternion();
    quaternionY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);

    // Then, create a quaternion for the X-axis rotation (pitch)
    const quaternionX = new THREE.Quaternion();
    quaternionX.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.rotationX);

    // Combine the rotations (order matters!)
    const quaternion = new THREE.Quaternion();
    quaternion.multiplyQuaternions(quaternionY, quaternionX);

    // Apply the combined quaternion to the ship container
    this.shipContainer.quaternion.copy(quaternion);
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

    // Get camera's view directions
    // These are the directions that will feel natural to the player
    // regardless of ship orientation

    // Forward is negative Z in camera's local space
    const cameraForward = new THREE.Vector3(0, 0, -1);
    cameraForward.applyQuaternion(this.camera.quaternion);

    // Right is positive X in camera's local space
    const cameraRight = new THREE.Vector3(1, 0, 0);
    cameraRight.applyQuaternion(this.camera.quaternion);

    // Up is positive Y in camera's local space
    const cameraUp = new THREE.Vector3(0, 1, 0);
    cameraUp.applyQuaternion(this.camera.quaternion);

    // Project camera's forward vector onto the ship's XZ plane
    // This ensures we move forward in the direction the ship is facing horizontally
    const shipForward = cameraForward.clone();
    shipForward.y = 0;
    shipForward.normalize();

    // Apply thrust based on key presses
    // Forward/backward thrust (W/S)
    if (this.keys.w) {
      this.acceleration.addScaledVector(shipForward, this.thrusterPower);
    }
    if (this.keys.s) {
      this.acceleration.addScaledVector(shipForward, -this.thrusterPower);
    }

    // Left/right thrust (A/D)
    // We want left/right to be perpendicular to forward in the XZ plane
    // and consistent with the camera's view
    if (this.keys.a || this.keys.d) {
      // Get the right vector perpendicular to forward in XZ plane
      const shipRight = new THREE.Vector3(-shipForward.z, 0, shipForward.x);
      shipRight.normalize();

      // Apply thrust in the appropriate direction
      if (this.keys.a) {
        this.acceleration.addScaledVector(shipRight, -this.thrusterPower);
      }
      if (this.keys.d) {
        this.acceleration.addScaledVector(shipRight, this.thrusterPower);
      }
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

    // Send position and rotation update to server
    this.socket.emit("playerMovement", {
      position: {
        x: this.shipContainer.position.x,
        y: this.shipContainer.position.y,
        z: this.shipContainer.position.z,
      },
      quaternion: {
        _x: this.shipContainer.quaternion.x,
        _y: this.shipContainer.quaternion.y,
        _z: this.shipContainer.quaternion.z,
        _w: this.shipContainer.quaternion.w,
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
