var express = require('express');
var app = express();
var exphbs  = require('express-handlebars');
var mongoose = require('mongoose');
var bparse = require('body-parser');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

//Handlebars init
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

// Body-parser init
app.use(bparse.urlencoded({ extended: false }));
app.use(bparse.json());

app.use(express.static(__dirname + '/public'));

mongoose.connect('mongodb://127.0.0.1:27017/chat-app');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    console.log('LOGGED | MongoDB Connected - ' + new Date());
});

// User Collection
var MessageSchema = mongoose.Schema({
    msg:Object
});
var Msg = mongoose.model('msg', MessageSchema);

app.get('/', function(req, res){
  res.redirect('/chat');
});

io.on('connection', function(socket){
	console.log('connected');
	socket.on('typing', function (data) {
	  console.log(data);
	  socket.broadcast.emit('typing', data);
	});
	socket.on('chat message', function(msg){
		console.log(msg);
		Msg.find({},function(err,document) {
			var message = new Msg({
				msg:msg
			});
			message.save();
		})
	io.emit('new message', msg.msg);
	});
});

app.get('/chat',function(req,res) {
	Msg.find({},function(err,document) {
		res.render('chat',{messages:document});
	})
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});
