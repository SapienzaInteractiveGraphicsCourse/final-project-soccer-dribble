import * as THREE from 'three';

export class Scoreboard {
    constructor(scene) {
        this.group = new THREE.Group();
        
        // Crea il canvas per il testo
        this.canvas = document.createElement('canvas');
        this.canvas.width = 1024;
        this.canvas.height = 512;
        this.context = this.canvas.getContext('2d');
        
        // Crea la texture
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.minFilter = THREE.LinearFilter;
        
        // Materiale e Mesh (con un pizzico di emissive per brillare leggermente)
        const material = new THREE.MeshBasicMaterial({ 
            map: this.texture, 
            transparent: true
        });
        
        // Crea un grande schermo (proporzioni 2:1 come il canvas)
        const geometry = new THREE.PlaneGeometry(30, 15);
        this.screen = new THREE.Mesh(geometry, material);
        
        // Aggiungi un retro nero per non farlo essere trasparente da dietro
        const backMaterial = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const backGeometry = new THREE.PlaneGeometry(30, 15);
        const backScreen = new THREE.Mesh(backGeometry, backMaterial);
        backScreen.rotation.y = Math.PI;
        
        // Aggiungi un piccolo frame/struttura
        const frameGeometry = new THREE.BoxGeometry(31, 16, 1);
        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.z = -0.6;
        
        this.group.add(this.screen);
        this.group.add(backScreen);
        this.group.add(frame);
        
        // Posiziona il tabellone in alto, sopra il campo.
        // Il campo Pitch.js è stato ruotato di 90 gradi. L'asse lungo del campo è sull'asse X.
        // Centriamolo fuori dal lato lungo: z = -45, y = 25
        this.group.position.set(0, 25, -45); 
        // Giriamolo in modo che punti verso il centro del campo (e leggermente in basso)
        this.group.rotation.x = Math.PI / 12; // Inclinato verso il basso

        scene.add(this.group);
        
        this.lastHomeScore = -1;
        this.lastAwayScore = -1;
        this.lastTime = -1;
        
        // Disegno iniziale per evitare che appaia nero
        this.updateScore(0, 0, 0);
    }
    
    updateScore(homeScore, awayScore, timeInSeconds) {
        // Ottimizzazione: aggiorna il canvas solo se i valori sono cambiati
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
        
        // Sfondo principale (Grigio scuro/Nero con effetto vetro/schermo)
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);
        
        // Stile base
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Disegna Timer
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
        
        // Disegna Home Score (Rosso)
        ctx.fillStyle = '#aa0000';
        ctx.fillRect(50, 150, 400, 300);
        ctx.fillStyle = '#ff3333';
        ctx.font = 'bold 200px Arial';
        ctx.fillText(homeScore.toString(), 250, 280); // Y shift per bilanciare font
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.fillText('HOME', 250, 410);
        
        // Disegna Away Score (Blu)
        ctx.fillStyle = '#0000aa';
        ctx.fillRect(width - 450, 150, 400, 300);
        ctx.fillStyle = '#3366ff';
        ctx.font = 'bold 200px Arial';
        ctx.fillText(awayScore.toString(), width - 250, 280);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.fillText('AWAY', width - 250, 410);
        
        // Testo centrale decorativo
        ctx.fillStyle = '#aaaaaa';
        ctx.font = 'bold 30px Arial';
        ctx.fillText('SOCCER DRIBBLE', width/2, height - 40);
        
        // Segnala a Three.js di aggiornare la texture sulla GPU
        this.texture.needsUpdate = true;
    }
}
