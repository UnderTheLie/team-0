(function() { // module pattern


	//-------------------------------------------------------------------------
	// POLYFILLS
	//-------------------------------------------------------------------------

	if (!window.requestAnimationFrame) { // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
		window.requestAnimationFrame =	window.webkitRequestAnimationFrame	|| 
										window.mozRequestAnimationFrame		|| 
										window.oRequestAnimationFrame		|| 
										window.msRequestAnimationFrame		|| 
										function(callback, element) {
											window.setTimeout(callback, 1000/60);
										}
	}


	//-------------------------------------------------------------------------
	// UTILITIES
	//-------------------------------------------------------------------------

	function timestamp() {
		return window.performance && window.performance.now ? window.performance.now() : new Date().getTime();
	}

	function bound(x, min, max) {
		return Math.max(min, Math.min(max, x));
	}

	function get(url, onsuccess) {
		var request = new XMLHttpRequest();
		request.onreadystatechange = function() {
			if ((request.readyState == 4) && (request.status == 200)) onsuccess(request);
		}
		request.open('GET', url, true);
		request.send();
	}

	function overlap(x1, y1, w1, h1, x2, y2, w2, h2) {
		return !(((x1 + w1 - 1) < x2)	||
				((x2 + w2 - 1) < x1)	||
				((y1 + h1 - 1) < y2)	||
				((y2 + h2 - 1) < y1));
	}
	
	function getRandom(min, max) {
  		return Math.ceil(Math.random() * (max - min) + min);
	}


	//-------------------------------------------------------------------------
	// GAME CONSTANTS AND VARIABLES
	//-------------------------------------------------------------------------

	var MAP			= { tw: 64, th: 48 },
		TILE		= 32,
		METER		= TILE,
		GRAVITY		= 9.8 * 6,	// default (exagerated) gravity
		MAXDX		= 15,		// default max horizontal speed (15 tiles per second)
		MAXDY		= 60,		// default max vertical speed   (60 tiles per second)
		ACCEL		= 1/6,		// default take 1/6 second to reach maxdx (horizontal acceleration)
		FRICTION	= 1/5,		// default take 1/5 second to stop from maxdx (horizontal friction)
		IMPULSE		= 1500,		// default player jump impulse
		COLOR		= { BLACK: '#000000', WHITE: '#FFFFFF', YELLOW: '#ECD078', BRICK: '#D95B43', PINK: '#C02942', PURPLE: '#542437', GREY: '#333', SLATE: '#53777A', GOLD: 'gold' },
		COLORS		= [ COLOR.YELLOW, COLOR.BRICK, COLOR.PINK, COLOR.PURPLE, COLOR.GREY ],
		KEY			= { LEFT: 65, UP: 87, RIGHT: 68, FORCEUP: 73, SHOOT: 74 };
		
		backgroundImage = new Image();
		backgroundImage.src = 'images/back.jpg';
		
		playerImage 		= new Image();
		playerImage.src 	= 'images/player.png';
		
		playerLeftImage 		= new Image();
		playerLeftImage.src 	= 'images/playerLeft.png';
		
		playerRightImage 		= new Image();
		playerRightImage.src 	= 'images/playerRight.png';
		
		enemyLeftImage 		= new Image();
		enemyLeftImage.src 	= 'images/enemyLeft.png';
		
		enemyRightImage 		= new Image();
		enemyRightImage.src 	= 'images/enemyRight.png';
		
		cellImage 		= new Image();
		cellImage.src 	= 'images/cell.png';
		
		trapImage 		= new Image();
		trapImage.src 	= 'images/trap.png';
		
		boss1Image		= new Image();
		boss1Image.src 	= 'images/boss1.png';
		
		boss2Image		= new Image();
		boss2Image.src 	= 'images/boss2.png';
		
		oscarImage		= new Image();
		oscarImage.src	= 'images/oscar.png';
		
	var fps			= 60,
		step		= 1/fps,
		canvas		= document.getElementById('canvas'),
		ctx			= canvas.getContext('2d'),
		width		= canvas.width	= MAP.tw * TILE,
		height		= canvas.height	= MAP.th * TILE,
		player		= {},
		oscar		= undefined;
		bullets		= [],
		monsters	= [],
		traps		= [],
		timeTraps	= [],
		lasers		= [],
		exits		= [],
		cells		= [];

	var t2p		= function(t)		{ return t * TILE;					},
		p2t		= function(p)		{ return Math.floor(p/TILE);		},
		cell	= function(x, y)	{ return tcell(p2t(x), p2t(y));		},
		tcell	= function(tx, ty)	{ return cells[tx + (ty * MAP.tw)];	};


	//-------------------------------------------------------------------------
	// UPDATE LOOP
	//-------------------------------------------------------------------------

	function onkey(ev, key, down) {
		switch(key) {
			case KEY.LEFT:		player.left			= down; ev.preventDefault(); return false;
			case KEY.RIGHT:		player.right		= down; ev.preventDefault(); return false;
			case KEY.UP:		player.jump			= down; ev.preventDefault(); return false;
			case KEY.FORCEUP:	player.forcejump	= down; ev.preventDefault(); return false;
			case KEY.SHOOT:		player.shooting		= down; ev.preventDefault(); return false;
		}
	}

	function update(dt) {
		updatePlayer(dt);
		updateBullets();
		updateMonsters(dt);
		updateTraps();
		updateLasers();
		updateExits();
		if (!!boss) {
			updateTimeTraps();
			updateBoss();
		}
		if (!!oscar) {
			updateOscar();
		}
	}

	function updatePlayer(dt) {
		updateEntity(player, dt);
	}
	
	function updateOscar() {
		if (overlap(player.x - TILE/4, player.y - TILE/2, TILE*1.5, TILE*1.5, oscar.x, oscar.y, oscar.width, oscar.height))
				oscarRun();
	}
	
	function oscarRun() {
		var rndX = getRandom(736, 1376),
			rndY = getRandom(608, 928);
		oscar.x = rndX;
		oscar.y = rndY;
	}
	
	function updateBullets() {
		var n, max, bulllet, monster;
		var dead = [];
		for(n = 0, max = bullets.length ; n < max ; n++) {
			bullet = bullets[n];
			var tx			= p2t(bullet.x),
				ty			= p2t(bullet.y);
			if (tcell(tx, ty)) {
				dead.push(n);
			}
			else {
				for(m = 0 ; m < monsters.length ; m++) {
					monster = monsters[m];
					if (!monster.dead && overlap(monster.x, monster.y, TILE, TILE, bullet.x, bullet.y, TILE/4, TILE/4)) {
						dead.push(n);
						killMonster(monster);
					}
				}
				if (!!boss) {
					if (overlap(boss.x, boss.y, boss.width, boss.height, bullet.x, bullet.y, TILE/4, TILE/4)) {
						dead.push(n);
						boss.hp--;
					}
				}
			}
			if (dead[dead.length-1] != n)
				bullet.x += bullet.dir*20;
		}
		for (n = 0, max = dead.length ; n < max ; n++) {
			bullets.splice(dead[n], 1);
		}
	}
	
	function updateTimeTraps() {
		var n, max, timeTrap;
		var dead = [];
		for(n = 0, max = timeTraps.length ; n < max ; n++) {
			timeTrap = timeTraps[n];
			if  (overlap(player.x - TILE/4, player.y - TILE/2, TILE*1.5, TILE*1.5, timeTrap.x, timeTrap.y, timeTrap.width, timeTrap.height))
				killPlayer(player);
			timeTrap.time--;
			if (timeTrap.time < 0) {
				dead.push(n);
			}
		}
		for (n = 0, max = dead.length ; n < max ; n++) {
			timeTraps.splice(dead[n], 1);
		}
	}
	
	function updateMonsters(dt) {
		var n, max;
		for(n = 0, max = monsters.length ; n < max ; n++)
			updateMonster(monsters[n], dt);
	}

	function updateMonster(monster, dt) {
		if (!monster.dead) {
			updateEntity(monster, dt);
			if (overlap(player.x - TILE/4, player.y - TILE/2, TILE*1.5, TILE*1.5, monster.x, monster.y, TILE, TILE)) {
				killPlayer(player);
			}
		}
	}

	function updateTraps() {
		var n, max, trap;
		for(n = 0, max = traps.length ; n < max ; n++) {
			trap = traps[n];
			if (overlap(player.x - TILE/4, player.y - TILE/2, TILE*1.5, TILE*1.5, trap.x, trap.y, trap.width, trap.height))
				killPlayer(player);
		}
	}
	
	function updateLasers() {
		var n, max, laser;
		for(n = 0, max = lasers.length ; n < max ; n++) {
			laser = lasers[n];
			counter % laser.period > laser.period/2 ? laser.working = true : laser.working = false;
			if ((laser.working) && (overlap(player.x - TILE/4, player.y - TILE/2, TILE*1.5, TILE*1.5, laser.x, laser.y, laser.width, laser.height)))
				killPlayer(player);
		}
	}

	function updateExits() {
		var n, max, exit;
		for(n = 0, max = exits.length ; n < max ; n++) {
			exit = exits[n];
			if (overlap(player.x - TILE/4, player.y - TILE/2, TILE*1.5, TILE*1.5, exit.x, exit.y, exit.width, exit.height)) {
				window.localStorage.level = exit.next;
				window.location.reload();
				return;
			}
		}
	}
	
	function updateBoss() {
		var nowBoss = boss.timer % (boss.rules.length*2);
		
		if (boss.rules[nowBoss] && !boss.dead) {
			var tmp = boss.rules[nowBoss].split(' ');
			timeTraps.push({x: 1*tmp[0], y: 1*tmp[1], width: 1*tmp[2], height: 1*tmp[3], time: 1*tmp[4]});
		} 
		
		if (boss.hp < 0 && !boss.dead) {
			boss.dead = true;
			openExit();
		}
		
		
		boss.timer++;
	}
	
	function openExit() {
		exits[0].x -= TILE;
	};
	
	function killMonster(monster) {
		monster.dead = true;
	}

	function killPlayer(player) {
		player.x	= player.start.x;
		player.y	= player.start.y;
		player.dx	= 0;
		player.dy	= 0;
		
		var n, max;
		for(n = 0, max = monsters.length ; n < max ; n++)
			monsters[n].dead = false;
			
		if (!!boss) {
			boss.timer = 0;
			boss.hp = 16;
		} 
	}

	function updateEntity(entity, dt) {
		var wasleft		= entity.dx < 0,
			wasright	= entity.dx > 0,
			falling		= entity.falling,
			friction	= entity.friction * (falling ? 0.5 : 1),
			accel		= entity.accel * (falling ? 0.5 : 1);

		entity.ddx = 0;
		entity.ddy = entity.gravity;

		if (entity.shooting && entity.shotcd < 1) {
			bullets.push({ x: entity.x + TILE/2, y: entity.y + TILE/2, dir: wasleft ? -1 : 1});
			entity.shotcd = fps/3;
		}
		entity.shotcd--;

		if (entity.left)
			entity.ddx = entity.ddx - accel;
		else if (wasleft)
			entity.ddx = entity.ddx + friction;

		if (entity.right)
			entity.ddx = entity.ddx + accel;
		else if (wasright)
			entity.ddx = entity.ddx - friction;


		if (!entity.jumping && !falling) {
			entity.forceready	= true;
			entity.jumpready	= true;
		}

		if (entity.jump && !entity.jumping && !falling) {
			entity.ddy			= entity.ddy - entity.impulse; 
			entity.jumping		= true;
			entity.jumpready 	= false;
		} 

		if (entity.forcejump && entity.forceready && entity.falling) {
			entity.dy			= 0;
			entity.ddy			= entity.ddy - entity.impulse;
			entity.jumping		= true;
			entity.forceready	= false;
		}


		entity.x	= entity.x + (dt * entity.dx);
		entity.y	= entity.y + (dt * entity.dy);
		entity.dx	= bound(entity.dx + (dt * entity.ddx), -entity.maxdx, entity.maxdx);
		entity.dy	= bound(entity.dy + (dt * entity.ddy), -entity.maxdy, entity.maxdy);


		if ((wasleft  && (entity.dx > 0)) ||
			(wasright && (entity.dx < 0))) {
			entity.dx = 0;
		}


		var tx			= p2t(entity.x),
			ty			= p2t(entity.y),
			nx			= entity.x % TILE,
			ny			= entity.y % TILE,
			cell		= tcell(tx, ty),
			cellright	= tcell(tx + 1, ty),
			celldown	= tcell(tx, ty + 1),
			celldiag	= tcell(tx + 1, ty + 1);


		if (entity.dy > 0) {
			if ((celldown && !cell) || (celldiag && !cellright && nx)) {
				entity.y 		= t2p(ty);
				entity.dy 		= 0;
				entity.falling	= false;
				entity.jumping	= false;
				ny				= 0;
			}
		}
		else if (entity.dy < 0) {
			if ((cell && !celldown) || (cellright && !celldiag && nx)) {
				entity.y	= t2p(ty + 1);
				entity.dy	= 0;
				cell		= celldown;
				cellright	= celldiag;
				ny			= 0;
			}
		}

		if (entity.dx > 0) {
			if ((cellright && !cell) || celldiag  && !celldown && ny) {
				entity.x 	= t2p(tx);
				entity.dx 	= 0;
			}
		}
		else if (entity.dx < 0) {
			if ((cell && !cellright) || (celldown && !celldiag && ny)) {
				entity.x 	= t2p(tx + 1);
				entity.dx 	= 0;
			}
		}


		if (entity.monster) {
			if (entity.left && (cell || !celldown)) {
				entity.left 	= false;
				entity.right 	= true;
			}
			else if (entity.right && (cellright || !celldiag)) {
				entity.right	= false;
				entity.left		= true;
			}
		}

		entity.falling = !(celldown || (nx && celldiag));

	}


	//-------------------------------------------------------------------------
	// RENDERING
	//-------------------------------------------------------------------------

	function render(ctx, frame, dt) {
		ctx.clearRect(0, 0, width, height);
		renderMap(ctx);
		renderTraps(ctx);
		renderLasers(ctx);
		renderPlayer(ctx, dt);
		renderBullets(ctx);
		renderMonsters(ctx, dt);
		if (!!boss) {
			renderBoss(ctx);
			renderTimeTraps(ctx);
		}
		if (!!oscar) {
			renderOscar(ctx);
		}
	}

	function renderMap(ctx) {
		var x, y, cell;
		ctx.drawImage(backgroundImage, 0, 0, width, height);
		for(y = 0 ; y < MAP.th ; y++) {
			for(x = 0 ; x < MAP.tw ; x++) {
				cell = tcell(x, y);
				if (cell) {
					ctx.drawImage(cellImage, x * TILE, y * TILE, TILE, TILE);
				}
			}
		}
	}
	
	function renderOscar(ctx) {
		ctx.drawImage(oscarImage, oscar.x, oscar.y, oscar.width, oscar.height);
	}
	
	function renderPlayer(ctx, dt) {
		if (player.dx > 0)			ctx.drawImage(playerRightImage, player.x + (player.dx * dt) - TILE/4, player.y + (player.dy * dt) - TILE/2, TILE*1.5, TILE*1.5)
		else if (player.dx < 0) 	ctx.drawImage(playerLeftImage, player.x + (player.dx * dt) - TILE/4, player.y + (player.dy * dt) - TILE/2, TILE*1.5, TILE*1.5)
		else 						ctx.drawImage(playerImage, player.x + (player.dx * dt) - TILE/4, player.y + (player.dy * dt) - TILE/2, TILE*1.5, TILE*1.5);
	}

	function renderMonsters(ctx, dt) {
		var n, max, monster;
		for(n = 0, max = monsters.length ; n < max ; n++) {
			monster = monsters[n];
			if (!monster.dead) {
				if (monster.dx >= 0) 	ctx.drawImage(enemyRightImage, monster.x + (monster.dx * dt) - TILE/4, monster.y + (monster.dy * dt) - TILE/2, TILE*1.5, TILE*1.5); 
				else 					ctx.drawImage(enemyLeftImage, monster.x + (monster.dx * dt) - TILE/4, monster.y + (monster.dy * dt) - TILE/2, TILE*1.5, TILE*1.5);  
			}	
		}
	}
	
	function renderBullets(ctx) {
		ctx.fillStyle = COLOR.PURPLE;
		var n, max, bullet;
		for(n = 0, max = bullets.length ; n < max ; n++) {
			bullet = bullets[n];
			ctx.fillRect(bullet.x, bullet.y, TILE/4, TILE/4);
		}
	}
	
	function renderTraps(ctx) {
		var n, max, trap;
		for(n = 0, max = traps.length ; n < max ; n++) {
			trap = traps[n];
			ctx.drawImage(trapImage, trap.x, trap.y, trap.width, trap.height);
		}
	}

	function renderTimeTraps(ctx) {
		var n, max, timeTrap;
		for(n = 0, max = timeTraps.length ; n < max ; n++) {
			timeTrap = timeTraps[n];
			ctx.drawImage(trapImage, timeTrap.x, timeTrap.y, timeTrap.width, timeTrap.height);
		}
	}

	function renderLasers(ctx) {
		ctx.fillStyle	= COLOR.GOLD;
		var n, max, laser;
		for(n = 0, max = lasers.length ; n < max ; n++) {
			laser = lasers[n];
			if (laser.working)
				ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
		}
	}
	
	function renderBoss(ctx) {
		if (!boss.dead) {
			if (localStorage.level == 'levels/level123.json') ctx.drawImage(boss1Image, boss.x, boss.y, boss.width, boss.height);
			else ctx.drawImage(boss2Image, boss.x, boss.y, boss.width, boss.height);
		}
		
	}

	//-------------------------------------------------------------------------
	// LOAD THE MAP
	//-------------------------------------------------------------------------

	function setup(map) {
		var data		= map.layers[0].data,
			objects		= map.layers[1].objects,
			bossObj		= undefined,
			n, obj, entity;
			if (!!map.layers[2]) setupBoss(map.layers[2].objects[0]);
		
		for(n = 0 ; n < objects.length ; n++) {
			obj		= objects[n];
			entity	= setupEntity(obj);
			switch(obj.type) {
				case 'player'	: player = entity; break;
				case 'monster'	: monsters.push(entity); break;
				case 'trap'		: traps.push(entity); break;
				case 'laser'	: lasers.push(entity); break;
				case 'exit'		: exits.push(entity); break;	
				case 'oscar'	: oscar = entity; break;	
			}
		}

		cells = data;
	}
	
	function setupBoss(obj) {
		var entity 		= {};
		entity.x 		= obj.x;
		entity.y 		= obj.y;
		entity.width	= obj.width;
		entity.height	= obj.height;
		entity.timer 	= 0;
		entity.hp		= 16;
		entity.rules 	= [];
		entity.dead		= false;
		
		for (var key in obj.properties) {
			entity.rules[key] = obj.properties[key];
		}
		
		entity.period	= entity.rules.length;
		
		boss = entity;
	}

	function setupEntity(obj) {
		var entity 		= {};
		entity.x		= obj.x;
		entity.y		= obj.y;
		entity.dx		= 0;
		entity.dy		= 0;
		entity.gravity	= METER * (obj.properties.gravity	|| GRAVITY);
		entity.maxdx	= METER * (obj.properties.maxdx		|| MAXDX);
		entity.maxdy	= METER * (obj.properties.maxdy		|| MAXDY);
		entity.impulse	= METER * (obj.properties.impulse	|| IMPULSE);
		entity.period 	= obj.properties.period;
		entity.next 	= obj.properties.next;
		entity.shotcd	= 0;
		entity.width	= (obj.width	|| METER);
		entity.height	= (obj.height	|| METER);
		entity.accel	= entity.maxdx/(obj.properties.accel	|| ACCEL);
		entity.friction	= entity.maxdx/(obj.properties.friction	|| FRICTION);
		entity.monster	= obj.type == 'monster';
		entity.player	= obj.type == 'player';
		entity.trap		= obj.type == 'trap';
		entity.laser	= obj.type == 'laser';
		entity.exit		= obj.type == 'exit';
		entity.left		= obj.properties.left;
		entity.right	= obj.properties.right;
		entity.start	= { x: obj.x, y: obj.y }

		return entity;
	}


	//-------------------------------------------------------------------------
	// THE GAME LOOP
	//-------------------------------------------------------------------------

	var counter = 0, dt = 0, now,
		last = timestamp(),
		fpsmeter = new FPSMeter({ decimals: 0, graph: true, theme: 'dark', left: '5px' });

	function frame() {
		fpsmeter.tickStart();
		now	= timestamp();
		dt	= dt + Math.min(1, (now - last)/1000);
		while(dt > step) {
			dt = dt - step;
			update(step);
		}
		render(ctx, counter, dt);
		last = now;
		counter++;
		fpsmeter.tick();
		requestAnimationFrame(frame, canvas);
	}

	document.addEventListener('keydown', function(ev) { return onkey(ev, ev.keyCode, true); }, false);
	document.addEventListener('keyup', function(ev) { return onkey(ev, ev.keyCode, false); }, false);
	
	var level 	= localStorage.level ? localStorage.level : 'levels/level111.json';
	var stage 	= localStorage.stage ? localStorage.stage : '1';
	var boss;
		
	get(level, function(req) {
		setup(JSON.parse(req.responseText));
		frame();
	});

})();
