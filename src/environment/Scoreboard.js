import * as THREE from 'three';

export class Scoreboard {
    constructor(scene) {
        this.group = new THREE.Group();
        
        
        this.canvas = document.createElement('canvas');
        this.canvas.width = 1024;
        this.canvas.height = 512;
        this.context = this.canvas.getContext('2d');
        
        
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.minFilter = THREE.LinearFilter;
        
        
        const material = new THREE.MeshBasicMaterial({ 
            map: this.texture, 
            transparent: true
        });
        
        
        const geometry = new THREE.PlaneGeometry(30, 15);
        this.screen = new THREE.Mesh(geometry, material);
        
        
        const backMaterial = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const backGeometry = new THREE.PlaneGeometry(30, 15);
        const backScreen = new THREE.Mesh(backGeometry, backMaterial);
        backScreen.rotation.y = Math.PI;
        
        
        const frameGeometry = new THREE.BoxGeometry(31, 16, 1);
        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.z = -0.6;
        
        this.group.add(this.screen);
        this.group.add(backScreen);
        this.group.add(frame);
        
        
        
        
        this.group.position.set(0, 25, -45); 
        
        this.group.rotation.x = Math.PI / 12; 

        scene.add(this.group);
        
        this.lastHomeScore = -1;
        this.lastAwayScore = -1;
        this.lastTime = -1;
        
        
        this.updateScore(0, 0, 0);
    }
    
    updateScore(homeScore, awayScore, timeInSeconds) {
        
        const currentSeconds = Math.floor(timeInSeconds);
        if (this.lastHomeScore === homeScore && 
            this.lastAwayScore === awayScore && 
            this.lastTime === currentSeconds) {
            return;
        }
        
        this.lastHomeScore = homeScore;
        this.lastAwayScore = awayScore;
        this.lastTime = currentSeconds;
        
        const ctx = this.context;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);
        
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        
        ctx.fillStyle = '#222222';
        ctx.fillRect(width/2 - 150, 20, 300, 100);
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 5;
        ctx.strokeRect(width/2 - 150, 20, 300, 100);
        
        const minutes = Math.floor(currentSeconds / 60).toString().padStart(2, '0');
        const seconds = (currentSeconds % 60).toString().padStart(2, '0');
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 70px "Courier New", monospace';
        ctx.fillText(`${minutes}:${seconds}`, width/2, 70);
        
        
        ctx.fillStyle = '#aa0000';
        ctx.fillRect(50, 150, 400, 300);
        ctx.fillStyle = '#ff3333';
        ctx.font = 'bold 200px Arial';
        ctx.fillText(homeScore.toString(), 250, 280); 
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.fillText('HOME', 250, 410);
        
        
        ctx.fillStyle = '#0000aa';
        ctx.fillRect(width - 450, 150, 400, 300);
        ctx.fillStyle = '#3366ff';
        ctx.font = 'bold 200px Arial';
        ctx.fillText(awayScore.toString(), width - 250, 280);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.fillText('AWAY', width - 250, 410);
        
        
        ctx.fillStyle = '#aaaaaa';
        ctx.font = 'bold 30px Arial';
        ctx.fillText('SOCCER DRIBBLE', width/2, height - 40);
        
        
        this.texture.needsUpdate = true;
    }
}
