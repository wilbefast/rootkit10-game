var express = require('express'); 
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

io.on('connection', function(socket){
  console.log('a user connected');

  socket.emit('connection');

  socket.on('cmd', function(cmd) {
		console.log('cmd', cmd);
	})
});

app.use(express.static("client"));

http.listen(3000, function(){
  console.log('listening on port 3000');
});