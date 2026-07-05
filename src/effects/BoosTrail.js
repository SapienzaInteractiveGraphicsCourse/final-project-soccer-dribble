import * as THREE from 'three';

export class BoosterTrail {
    constructor(scene) {
        this.scene = scene;
        this.maxParticles = 800;
        this.particles = [];
        this.currentParticleIndex = 0;


        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.maxParticles * 3);
        this.colors = new Float32Array(this.maxParticles * 3);
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));


        this.material = new THREE.PointsMaterial({
            size: 0.18,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            sizeAttenuation: true
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.points.frustumCulled = false;
        this.scene.add(this.points);

        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push({
                velocity: new THREE.Vector3(),
                life: 0,
                maxLife: 0,
                baseColor: new THREE.Color()
            });
        }
    }

    emit(origin, playerDirection, deltaTime) {

        const spawnCount = Math.floor(600 * deltaTime);

        for (let i = 0; i < spawnCount; i++) {
            const p = this.particles[this.currentParticleIndex];

            p.maxLife = 0.4 + Math.random() * 0.3;
            p.life = p.maxLife;

            const index3 = this.currentParticleIndex * 3;
            this.positions[index3] = origin.x + (Math.random() - 0.5) * 0.15;
            this.positions[index3 + 1] = origin.y + (Math.random() - 0.5) * 0.15;
            this.positions[index3 + 2] = origin.z + (Math.random() - 0.5) * 0.15;


            p.velocity.set(
                -playerDirection.x * 7 + (Math.random() - 0.5) * 2,
                (Math.random() - 0.2) * 1.5,
                -playerDirection.z * 7 + (Math.random() - 0.5) * 2
            );


            if (Math.random() > 0.4) {
                p.baseColor.setHex(0x00ffff);
            } else {
                p.baseColor.setHex(0xff6600);
            }
            this.colors[index3] = p.baseColor.r;
            this.colors[index3 + 1] = p.baseColor.g;
            this.colors[index3 + 2] = p.baseColor.b;

            this.currentParticleIndex = (this.currentParticleIndex + 1) % this.maxParticles;
        }
    }

    update(deltaTime) {
        let needsUpdate = false;
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            if (p.life > 0) {
                p.life -= deltaTime;
                needsUpdate = true;
                const index3 = i * 3;

                this.positions[index3] += p.velocity.x * deltaTime;
                this.positions[index3 + 1] += p.velocity.y * deltaTime;
                this.positions[index3 + 2] += p.velocity.z * deltaTime;
                p.velocity.multiplyScalar(0.95);

                const lifeRatio = p.life / p.maxLife;
                const opacity = Math.max(0, lifeRatio * 1.5);

                this.colors[index3] = p.baseColor.r * opacity;
                this.colors[index3 + 1] = p.baseColor.g * opacity;
                this.colors[index3 + 2] = p.baseColor.b * opacity;

                if (p.life <= 0) {
                    this.positions[index3 + 1] = -100;
                }
            }
        }
        if (needsUpdate) {
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.color.needsUpdate = true;
        }
    }
}