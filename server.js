// ----------------------------------------------------------------------------
// ROOM MANAGEMENT
// ----------------------------------------------------------------------------

var rooms = {
	next_id : 1
}

var openRoom = null;

function getRoom()
{
	if(openRoom)
	{
		var room = openRoom;
		openRoom = null
		return room;
	}
	else
	{
		openRoom = {
			id : rooms.next_id++
		};
		rooms[openRoom.id] = openRoom;
		return openRoom;
	}
}

// ----------------------------------------------------------------------------
// GAME STATE
// ----------------------------------------------------------------------------

// ------------------------------------
// Game Objects
// ------------------------------------

function Egg(tile, team)
{
	this.tile = tile;
	tile.contents = this;
	this.team = team;
	return this;
}
Egg.prototype.type = "egg";
Egg.prototype.canMove = function() {
	return false;
}
Egg.prototype.canDetonate = function() {
	return false;
}

function Kitten(tile, team)
{
	this.tile = tile;
	tile.contents = this;
	this.team = team;
	this.asleep = false;
	this.detonating = false;
	return this;
}
Kitten.prototype.type = "kitten";
Kitten.prototype.canMove = function() {
	return !this.asleep;
}
Kitten.prototype.canDetonate = function() {
	return !this.asleep && !this.detonating;
}
Kitten.prototype.moveTo = function(tile, socket, room, echo) {
	this.tile.contents = null;
	this.tile = tile;
	tile.contents = this;
	asleep = true;
	var kitten = this;
	setTimeout(function() {
		if(!kitten.purge)
		{
			kitten.asleep = false;
			socket.emit('awaken', kitten.tile.id);
			socket.other.emit('awaken', kitten.tile.id);
		}
	}, 7000);
	socket.emit('move', echo);
	socket.other.emit('move', echo);
}
Kitten.prototype.detonate = function(socket, room) {
	this.detonating = true;
	var grid = room.grid;
	var kitten = this;
	socket.emit('detonate', this.tile.id);
	socket.other.emit('detonate', this.tile.id);
	setTimeout(function() {
		if(!kitten.purge)
		{
			kitten.purge = true;

			for(x = Math.max(0, kitten.tile.grid_x - 2); 
				x < Math.min(grid.w - 1, kitten.tile.grid_x + 2); 
				x++)
			for(y = Math.max(0, kitten.tile.grid_y - 2); 
				y < Math.min(grid.h - 1, kitten.tile.grid_y + 2); 
				y++)
			{
				var tile = grid.tileList[GRID_W*y + x];
				if(tile.contents)
				{
					tile.contents.purge = true;
					tile.contents = null;
					socket.emit('kill', tile.id);
					socket.other.emit('kill', tile.id);
				}
			}
		}
	}, 4000);
}

// ------------------------------------
// Grid
// ------------------------------------

var GRID_W = 10
var GRID_H = 10

function Grid(w, h)
{
	this.w = w;
	this.h = h;
	this.tileList = [];
	this.tileHash = {}; 

	for(var x = 0; x < w; x++)
	{
		for(var y = 0; y < h; y++)
		{
			// letters down the left side
			var letter = String.fromCharCode(65 + y);

			// memorise tile information for game logic
			tile = {}
			tile.id = letter+x;
			tile.grid_x = x;
			tile.grid_y = y;

			// save the tile in look-up tables
			this.tileList[GRID_W*y + x] = tile;
			this.tileHash[tile.id] = tile;		
		}
	}
	return this;
}

Grid.prototype.unhashTile = function(s)
{
	return this.tileHash[s];
}


// ----------------------------------------------------------------------------
// SERVER
// ----------------------------------------------------------------------------

var express = require('express'); 
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

// ------------------------------------
// Socket.io
// ------------------------------------

io.on('connection', function(socket){
  socket.emit('connection');

  var room = getRoom();
  if(!room.host)
  {
  	console.log("New player hosting room " + room.id);
  	// first player is the host
  	room.host = socket;
  	room.host.emit('host');
  	room.host.team = 0;
  }
  else
  {
  	console.log("New player joined room " + room.id);
  	// second player is the guest
  	room.guest = socket;
  	room.guest.emit('guest');
  	room.guest.team = 1;
  	room.host.emit('joined');
  	room.guest.other = room.host;
  	room.host.other = room.guest;
	  // send the grid to all players
	  room.grid = new Grid(GRID_W, GRID_H);
	  var contents = {};
	  var tiles = room.grid.tileList;
	  for(var team = 0; team < 2; team++)
  	for(var n = 0; n < 3; n++)
  	{
  		var i;
  		do
  		{
  			i = Math.floor(Math.random() * tiles.length);
  		} 
  		while(tiles[i].contents);
  		new Kitten(tiles[i], team);
  		contents[tiles[i].id] = { type: "kitten", team: team }
  	}
	  var data = { w : room.grid.w, h : room.grid.h, contents : contents }
	  room.guest.emit('grid', data);
	  room.host.emit('grid', data);
	  // reset game state variables
	  room.guest.emit('resources', room.guest.resources = 3);
	  room.host.emit('resources', room.host.resources = 3);
	  // set resource spawn interval
	  setInterval(function() {

	  }, 1000)
  }
  socket.room = room;

  socket.on('say', function(msg) {
  	if(socket.other)
  		socket.other.emit('say', msg);
  });

  socket.on('move', function(data) {
  	var from_tile = room.grid.unhashTile(data.from_id);
  	var to_tile = room.grid.unhashTile(data.to_id);
  	if(!from_tile || !to_tile)
  		return;

  	var mover = from_tile.contents;

  	if(mover 
  		&& !to_tile.contents 
  		&& (mover.team === socket.team)
  		&& mover.canMove(to_tile))
  	{
  		mover.moveTo(to_tile, socket, room, data);
  	}

  });

  socket.on('detonate', function(data) {
  	var who_tile = room.grid.unhashTile(data.who);
  	if(!who_tile)
  		return;
  	var kamikaze = who_tile.contents;
  	if(kamikaze 
  		&& kamikaze.team === socket.team 
  		&& kamikaze.canDetonate())
  	{
  		kamikaze.detonate(socket, room);
  	}
  });


	socket.on('spawn', function(tile_id) {
		if(!room.host || !room.guest)
			return;

		var tile = room.grid.unhashTile(tile_id);

		if(socket.resources <= 0)
			return;
		socket.resources--;
		socket.emit("resources", socket.resources);

		if(tile && !tile.contents)
		{
			var team = socket.team;
			var spawn = new Egg(tile, team);
			var data = {
				tile_id : tile_id,
				team : team
			}
			room.host.emit('spawn', data);
			room.guest.emit('spawn', data);

			setTimeout(function() {
				if(!spawn.purge)
				{
					spawn.purge = true;
					spawn = new Kitten(tile, team);
					var data = {
						id : spawn.tile.id,
						team : team,
						type : spawn.type
					}

					room.host.emit('hatch', data);
					room.guest.emit('hatch', data);
				}
			}, 7000);
		}
	});
});

// ------------------------------------
// Express
// ------------------------------------

app.use(express.static("client"));

// ------------------------------------
// HTTP
// ------------------------------------

http.listen(process.env.PORT || 3000, function(){
  console.log('listening on port 3000');
});