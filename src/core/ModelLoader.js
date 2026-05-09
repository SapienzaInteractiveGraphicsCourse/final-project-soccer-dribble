import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

class ModelManager {
    constructor() {
        this.loader = new GLTFLoader();
        this.cache = new Map();
        this.loading = new Map();
    }

    load(url, callback) {
        if (this.cache.has(url)) {
            const gltf = this.cache.get(url);
            const clonedScene = clone(gltf.scene);
            // Simulate async behavior for consistency
            setTimeout(() => {
                callback({ ...gltf, scene: clonedScene });
            }, 0);
            return;
        }

        if (this.loading.has(url)) {
            this.loading.get(url).push(callback);
            return;
        }

        this.loading.set(url, [callback]);

        this.loader.load(url, (gltf) => {
            this.cache.set(url, gltf);
            const callbacks = this.loading.get(url);
            this.loading.delete(url);
            
            for (const cb of callbacks) {
                const clonedScene = clone(gltf.scene);
                cb({ ...gltf, scene: clonedScene });
            }
        });
    }
}

export const modelManager = new ModelManager();
