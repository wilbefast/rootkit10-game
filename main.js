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

function Kitten(tile, team)
{
	this.tile = tile;
	tile.contents = this;
	this.team = team;
	this.asleep = false;
	return this;
}
Kitten.prototype.type = "kitten";
Kitten.prototype.canMove = function() {
	return !this.asleep;
}
Kitten.prototype.moveTo = function(tile) {
	this.tile.contents = null;
	this.tile = tile;
	tile.contents = this;
	asleep = true;
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
	  var data = { w : room.grid.w, h : room.grid.h, contents : {} }
	  room.guest.emit('grid', data);
	  room.host.emit('grid', data);
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
  		mover.moveTo(to_tile);
  		setTimeout(function() {
  			if(!mover.purge)
  			{
  				mover.asleep = false;
  				socket.emit('awaken', mover.tile.id);
  				socket.other.emit('awaken', mover.tile.id);
  			}
  		}, 7000)
  		socket.emit('move', data);
  		socket.other.emit('move', data);
  	}

  });

	socket.on('spawn', function(tile_id) {
		if(!room.host || !room.guest)
			return;

		var tile = room.grid.unhashTile(tile_id);

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

http.listen(3000, function(){
  console.log('listening on port 3000');
});