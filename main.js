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

function Kitten(tile, team)
{
	this.tile = tile;
	tile.contents = this;
	this.team = team;
	return this;
}
Kitten.prototype.type = "kitten";

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
  }
  else
  {
  	console.log("New player joined room " + room.id);
  	// second player is the guest
  	room.guest = socket;
  	room.guest.emit('guest');
  	room.host.emit('joined');
	  // send the grid to all players
	  room.grid = new Grid(GRID_W, GRID_H);
	  var data = { w : room.grid.w, h : room.grid.h, contents : {} }
	  room.guest.emit('grid', data);
	  room.host.emit('grid', data);
  }
  socket.room = room;

	socket.on('spawn', function(tile_id) {
		if(!room.host || !room.guest)
			return;

		var tile = room.grid.unhashTile(tile_id);

		if(tile && !tile.contents)
		{
			var team = (socket == room.host) ? 0 : 1;
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