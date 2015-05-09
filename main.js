var express = require('express'); 
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);


// ------------------------------------
// Game Objects
// ------------------------------------

function Egg(tile)
{
	this.tile = tile;
	tile.contents = this;
	return this;
}
Egg.prototype.type = "egg";

// ------------------------------------
// Grid
// ------------------------------------

var GRID_W = 10
var GRID_H = 10

var unhashTile = function(s)
{
	return grid.tileHash[s];
}

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
var grid = new Grid(GRID_W, GRID_H);


io.on('connection', function(socket){
  console.log('a user connected');

  socket.emit('connection');

  var contents = {};
  for(var i in grid.tileList)
  {
  	var t = grid.tileList[i];
  	if(t.contents)
  		contents[t.id] = t.contents.type;
	}
  socket.emit('grid', {
  	w : grid.w,
  	h : grid.h,
  	contents : contents
  });

  socket.on('cmd', function(cmd) {
		console.log('cmd', cmd);
	});

	socket.on('spawn', function(hash) {
		var t = unhashTile(hash);

		if(t && !t.contents)
		{
			var spawn = new Egg(t);

			socket.emit('spawn', hash);
			setTimeout(function() {
				if(!spawn.purge)
				{
					socket.emit('tile', {
						id : spawn.tile.id,
						contents : spawn.type
					});
				}
			}, 3000);
		}
	});
});

app.use(express.static("client"));

http.listen(3000, function(){
  console.log('listening on port 3000');
});